package sunanticheat.dashboard.mobile;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Service d'envoi de notifications push via Expo Push API.
 * Persistance des devices enregistrés dans dashboard/mobile_devices.json.
 *
 * Usage : PushService.get().sendAlert("⚠ Kill Aura détecté",
 *              "Notch en a attaqué 8 joueurs en 2s", "alerts");
 *
 * Aucune clé API requise (Expo Push API est gratuit et ouvert).
 * Limite : 600 notifs/seconde, pas de quota quotidien.
 */
public final class PushService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
    private static PushService INSTANCE;

    private final JavaPlugin plugin;
    private final Logger logger;
    private final Persistence storage;
    private final Gson gson = new Gson();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    private final Map<String, MobileDevice> devicesByToken = new ConcurrentHashMap<>();

    private PushService(JavaPlugin plugin, BlobStorage blobs) {
        this.plugin = plugin;
        this.logger = plugin.getLogger();
        File legacy = new File(new File(plugin.getDataFolder(), "dashboard"), "mobile_devices.json");
        this.storage = new Persistence(blobs, "mobile_devices", legacy);
        load();
    }

    public static void init(JavaPlugin plugin, BlobStorage blobs) {
        if (INSTANCE == null) INSTANCE = new PushService(plugin, blobs);
    }

    public static PushService get() { return INSTANCE; }

    private synchronized void load() {
        String json = storage.read();
        if (json == null || json.isBlank()) return;
        try {
            List<MobileDevice> list = gson.fromJson(json, new TypeToken<List<MobileDevice>>() {}.getType());
            if (list != null) for (MobileDevice d : list) if (d.expoPushToken != null) devicesByToken.put(d.expoPushToken, d);
        } catch (Exception e) { logger.warning("[Push] load: " + e.getMessage()); }
    }

    public synchronized void save() {
        try {
            storage.write(gson.toJson(new ArrayList<>(devicesByToken.values())));
        } catch (Exception e) { logger.warning("[Push] save: " + e.getMessage()); }
    }

    public synchronized void registerDevice(String expoPushToken, String username, String deviceName) {
        if (expoPushToken == null || expoPushToken.isBlank()) return;
        MobileDevice d = devicesByToken.get(expoPushToken);
        if (d == null) d = new MobileDevice(expoPushToken, username, deviceName);
        d.username = username;
        d.deviceName = deviceName;
        d.lastSeenAt = System.currentTimeMillis();
        devicesByToken.put(expoPushToken, d);
        save();
        logger.info("[Push] Device enregistré : " + deviceName + " (" + username + ")");
    }

    public synchronized List<MobileDevice> listDevices() {
        return new ArrayList<>(devicesByToken.values());
    }

    public synchronized void removeDevice(String token) {
        devicesByToken.remove(token);
        save();
    }

    /**
     * Envoie une notification à TOUS les devices enregistrés.
     * channelId = "alerts" (haute priorité Android) ou "default".
     */
    public void broadcast(String title, String body, String channelId) {
        List<String> tokens = new ArrayList<>(devicesByToken.keySet());
        if (tokens.isEmpty()) return;
        sendToTokens(tokens, title, body, channelId);
    }

    /** Envoie uniquement aux devices d'un user spécifique. */
    public void sendToUser(String username, String title, String body, String channelId) {
        List<String> tokens = new ArrayList<>();
        for (MobileDevice d : devicesByToken.values()) {
            if (username.equalsIgnoreCase(d.username)) tokens.add(d.expoPushToken);
        }
        if (!tokens.isEmpty()) sendToTokens(tokens, title, body, channelId);
    }

    private void sendToTokens(List<String> tokens, String title, String body, String channelId) {
        try {
            JsonArray messages = new JsonArray();
            for (String t : tokens) {
                JsonObject m = new JsonObject();
                m.addProperty("to", t);
                m.addProperty("title", title);
                m.addProperty("body", body);
                m.addProperty("sound", "default");
                m.addProperty("channelId", channelId != null ? channelId : "default");
                m.addProperty("priority", "high");
                messages.add(m);
            }

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(EXPO_PUSH_URL))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("Accept-Encoding", "gzip, deflate")
                    .POST(HttpRequest.BodyPublishers.ofString(messages.toString(), StandardCharsets.UTF_8))
                    .build();

            http.sendAsync(req, HttpResponse.BodyHandlers.ofString())
                    .thenAccept(res -> {
                        if (res.statusCode() >= 200 && res.statusCode() < 300) {
                            logger.info("[Push] " + tokens.size() + " notif(s) envoyée(s) — " + title);
                        } else {
                            logger.warning("[Push] HTTP " + res.statusCode() + " : " +
                                    (res.body().length() > 200 ? res.body().substring(0, 200) : res.body()));
                        }
                    })
                    .exceptionally(e -> { logger.warning("[Push] erreur : " + e.getMessage()); return null; });
        } catch (Throwable t) {
            logger.warning("[Push] broadcast erreur : " + t.getMessage());
        }
    }
}
