package sunanticheat.dashboard.ws;

import com.google.gson.JsonObject;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.JwtUtil;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Serveur WebSocket sur le port dashboard.ws-port (défaut 60036).
 * Channels : "console", "alerts", "stats"
 * Protocole :
 *   Client → {"type":"auth","token":"<jwt>"}
 *   Client → {"type":"subscribe","channel":"console"}
 *   Client → {"type":"console_input","command":"/list"}
 *   Server → {"channel":"console","data":"[INFO] ..."}
 *   Server → {"channel":"alerts","data":{...}}
 *   Server → {"channel":"stats","data":{...}}
 */
public final class DashboardWsServer extends WebSocketServer {

    private final JwtUtil jwt;
    private final Map<String, DashboardUser> users;
    private final Logger logger;
    private final java.util.function.Consumer<String> commandExecutor;

    // conn → set of subscribed channels
    private final Map<WebSocket, Set<String>> subscriptions = new ConcurrentHashMap<>();
    // conn → authenticated user
    private final Map<WebSocket, DashboardUser> authenticated = new ConcurrentHashMap<>();

    /** Ring buffer des N dernières lignes console — renvoyé à chaque nouvelle souscription. */
    private static final int CONSOLE_BUFFER_SIZE = 300;
    private final java.util.Deque<String> consoleBuffer = new java.util.concurrent.ConcurrentLinkedDeque<>();

    public DashboardWsServer(int port,
                             JwtUtil jwt,
                             Map<String, DashboardUser> users,
                             Logger logger,
                             java.util.function.Consumer<String> commandExecutor) {
        super(new InetSocketAddress(port));
        this.jwt = jwt;
        this.users = users;
        this.logger = logger;
        this.commandExecutor = commandExecutor;
        setReuseAddr(true);
        setConnectionLostTimeout(30);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        subscriptions.put(conn, ConcurrentHashMap.newKeySet());
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            JsonObject msg = com.google.gson.JsonParser.parseString(message).getAsJsonObject();
            String type = msg.has("type") ? msg.get("type").getAsString() : "";

            switch (type) {
                case "auth" -> handleAuth(conn, msg);
                case "subscribe" -> handleSubscribe(conn, msg);
                case "console_input" -> handleConsoleInput(conn, msg);
                default -> conn.send(error("Type de message inconnu: " + type));
            }
        } catch (Exception e) {
            conn.send(error("Message invalide: " + e.getMessage()));
        }
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        subscriptions.remove(conn);
        authenticated.remove(conn);
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        if (conn != null) {
            subscriptions.remove(conn);
            authenticated.remove(conn);
        }
    }

    @Override
    public void onStart() {
        logger.info("[Dashboard] WebSocket démarré sur le port " + getPort());
    }

    // -------------------------------------------------------------------------
    // Broadcast API (appelé depuis ConsoleLogCapture, AlertStore, AnalyticsRecorder)
    // -------------------------------------------------------------------------

    public void broadcastConsole(String line) {
        // Enregistre dans le buffer (pour les nouveaux clients qui souscrivent)
        consoleBuffer.offerLast(line);
        while (consoleBuffer.size() > CONSOLE_BUFFER_SIZE) consoleBuffer.pollFirst();
        broadcast("console", line);
    }

    /** Renvoie une copie des N dernières lignes de console (exposé pour l'IA / diagnostic). */
    public java.util.List<String> getRecentConsoleLines(int maxLines) {
        java.util.List<String> snapshot = new java.util.ArrayList<>(consoleBuffer);
        if (maxLines <= 0 || snapshot.size() <= maxLines) return snapshot;
        return snapshot.subList(snapshot.size() - maxLines, snapshot.size());
    }

    public void broadcastAlert(Object alertData) {
        broadcastJson("alerts", alertData);
    }

    public void broadcastStats(Object statsData) {
        broadcastJson("stats", statsData);
    }

    // -------------------------------------------------------------------------
    // Handlers internes
    // -------------------------------------------------------------------------

    private void handleAuth(WebSocket conn, JsonObject msg) {
        if (!msg.has("token")) { conn.send(error("Token manquant")); return; }
        String token = msg.get("token").getAsString();
        try {
            var claims = jwt.validate(token);
            DashboardUser user = users.get(claims.getSubject());
            if (user == null) { conn.send(error("Utilisateur inconnu")); return; }
            authenticated.put(conn, user);
            JsonObject ok = new JsonObject();
            ok.addProperty("type", "auth_ok");
            ok.addProperty("username", user.username());
            ok.addProperty("role", user.role().name());
            conn.send(ok.toString());
        } catch (Exception e) {
            conn.send(error("Token invalide ou expiré"));
        }
    }

    private void handleSubscribe(WebSocket conn, JsonObject msg) {
        if (!isAuthenticated(conn)) { conn.send(error("Non authentifié")); return; }
        if (!msg.has("channel")) { conn.send(error("Channel manquant")); return; }
        String channel = msg.get("channel").getAsString();
        if (!Set.of("console", "alerts", "stats").contains(channel)) {
            conn.send(error("Channel inconnu: " + channel)); return;
        }
        subscriptions.get(conn).add(channel);
        JsonObject ok = new JsonObject();
        ok.addProperty("type", "subscribed");
        ok.addProperty("channel", channel);
        conn.send(ok.toString());

        // ── Si le client souscrit à "console", lui envoyer le buffer d'historique ──
        if ("console".equals(channel)) {
            try {
                for (String line : consoleBuffer) {
                    conn.send(buildPayload("console", line));
                }
            } catch (Exception ignored) {}
        }
    }

    private void handleConsoleInput(WebSocket conn, JsonObject msg) {
        if (!isAuthenticated(conn)) { conn.send(error("Non authentifié")); return; }
        DashboardUser user = authenticated.get(conn);
        if (!user.isAdmin()) { conn.send(error("Commande réservée aux admins")); return; }
        if (!msg.has("command")) { conn.send(error("Commande vide")); return; }
        String cmd = msg.get("command").getAsString().trim();
        if (cmd.startsWith("/")) cmd = cmd.substring(1);
        commandExecutor.accept(cmd);
    }

    private boolean isAuthenticated(WebSocket conn) {
        return authenticated.containsKey(conn);
    }

    private void broadcast(String channel, String data) {
        String payload = buildPayload(channel, data);
        for (Map.Entry<WebSocket, Set<String>> entry : subscriptions.entrySet()) {
            if (entry.getValue().contains(channel)) {
                try { entry.getKey().send(payload); } catch (Exception ignored) {}
            }
        }
    }

    private void broadcastJson(String channel, Object data) {
        String json = com.google.gson.JsonParser.parseString(
                sunanticheat.dashboard.HttpHelper.GSON.toJson(data)).toString();
        String payload = "{\"channel\":\"" + channel + "\",\"data\":" + json + "}";
        for (Map.Entry<WebSocket, Set<String>> entry : subscriptions.entrySet()) {
            if (entry.getValue().contains(channel)) {
                try { entry.getKey().send(payload); } catch (Exception ignored) {}
            }
        }
    }

    private static String buildPayload(String channel, String data) {
        String escaped = data.replace("\\", "\\\\").replace("\"", "\\\"")
                             .replace("\n", "\\n").replace("\r", "");
        return "{\"channel\":\"" + channel + "\",\"data\":\"" + escaped + "\"}";
    }

    private static String error(String msg) {
        return "{\"type\":\"error\",\"message\":\"" + msg.replace("\"", "'") + "\"}";
    }
}
