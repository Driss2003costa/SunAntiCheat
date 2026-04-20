package sunanticheat.dashboard.handlers;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Proxy sécurisé vers l'API Claude (Anthropic).
 * Lit la clé API depuis config.yml : dashboard.ai.api-key
 * Enrichit le prompt système avec des infos read-only sur le serveur.
 */
public final class AiHandler {

    private static final Gson GSON = new Gson();
    private final JavaPlugin plugin;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public AiHandler(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public void status(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        String key = plugin.getConfig().getString("dashboard.ai.api-key", "");
        String model = plugin.getConfig().getString("dashboard.ai.model", "claude-3-5-sonnet-20241022");
        HttpHelper.json(ex, 200, Map.of(
                "configured", key != null && !key.isBlank(),
                "model", model
        ));
    }

    @SuppressWarnings("unchecked")
    public void chat(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;

        String apiKey = plugin.getConfig().getString("dashboard.ai.api-key", "");
        if (apiKey == null || apiKey.isBlank()) {
            HttpHelper.error(ex, 503, "API Claude non configurée. Ajoutez dashboard.ai.api-key dans config.yml.");
            return;
        }
        String model = plugin.getConfig().getString("dashboard.ai.model", "claude-3-5-sonnet-20241022");

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
        if (messages == null || messages.isEmpty()) { HttpHelper.error(ex, 400, "messages manquant"); return; }

        String systemPrompt = buildSystemPrompt();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("max_tokens", 1024);
        payload.put("system", systemPrompt);
        payload.put("messages", messages);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.anthropic.com/v1/messages"))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(payload), StandardCharsets.UTF_8))
                .build();

        CompletableFuture<HttpResponse<String>> future = http.sendAsync(req, HttpResponse.BodyHandlers.ofString());

        try {
            HttpResponse<String> res = future.get();
            byte[] data = res.body().getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
            ex.sendResponseHeaders(res.statusCode(), data.length);
            try (OutputStream os = ex.getResponseBody()) { os.write(data); }
        } catch (Exception e) {
            HttpHelper.error(ex, 502, "Erreur API Claude : " + e.getMessage());
        }
    }

    private String buildSystemPrompt() {
        StringBuilder sb = new StringBuilder();
        sb.append("Tu es l'assistant IA du dashboard admin SunGuard (plugin anti-triche Minecraft Paper 1.21). ");
        sb.append("Tu aides l'administrateur à gérer son serveur. Réponds en français, de façon concise et précise.\n\n");
        sb.append("=== ÉTAT DU SERVEUR ===\n");
        sb.append("Joueurs connectés : ").append(Bukkit.getOnlinePlayers().size())
                .append(" / ").append(Bukkit.getMaxPlayers()).append("\n");
        sb.append("Version : ").append(Bukkit.getVersion()).append("\n");
        sb.append("Mondes :\n");
        Bukkit.getWorlds().forEach(w -> sb.append("  - ").append(w.getName())
                .append(" (").append(w.getPlayers().size()).append(" joueurs, ")
                .append(w.getEntities().size()).append(" entités)\n"));

        sb.append("\nJoueurs en ligne :\n");
        Bukkit.getOnlinePlayers().stream().limit(20).forEach(p ->
                sb.append("  - ").append(p.getName())
                        .append(" [").append(p.getWorld().getName()).append("]")
                        .append(" HP=").append(Math.round(p.getHealth()))
                        .append(" gamemode=").append(p.getGameMode().name()).append("\n"));

        sb.append("\nPlugins actifs : ").append(Bukkit.getPluginManager().getPlugins().length).append("\n");

        long banned = Bukkit.getBannedPlayers().stream().filter(OfflinePlayer::isBanned).count();
        sb.append("Bannis : ").append(banned).append("\n");

        sb.append("\n=== INSTRUCTIONS ===\n");
        sb.append("- Tu ne peux PAS exécuter de commandes. Suggère-les à l'admin.\n");
        sb.append("- Si on te demande un résumé des alertes / triches, indique les pages du dashboard (Alertes, Rapports, Sanctions).\n");
        sb.append("- Pour diagnostiquer, propose des commandes /tps /mspt /lag.\n");
        return sb.toString();
    }
}
