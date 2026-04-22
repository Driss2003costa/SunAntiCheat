package sunanticheat.dashboard.handlers;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Proxy sécurisé vers Google Gemini (generativelanguage.googleapis.com).
 *
 * Config :
 *   dashboard.ai.api-key : clé API Google AI Studio (https://aistudio.google.com/apikey)
 *   dashboard.ai.model   : modèle Gemini (défaut: gemini-2.0-flash)
 *
 * La réponse est normalisée au format Anthropic-compatible
 * ({content:[{type:"text",text:"..."}]}) pour rester compatible avec le frontend existant.
 */
public final class AiHandler {

    private static final Gson GSON = new Gson();
    private static final String DEFAULT_MODEL = "gemini-2.0-flash";

    private final JavaPlugin plugin;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public AiHandler(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    /** Liste des modèles Gemini supportés (affichés dans le dropdown frontend). */
    private static final List<Map<String, Object>> AVAILABLE_MODELS = List.of(
            Map.of("id", "gemini-2.0-flash",       "name", "Gemini 2.0 Flash",       "desc", "Rapide et équilibré (recommandé)", "tier", "free"),
            Map.of("id", "gemini-2.0-flash-lite",  "name", "Gemini 2.0 Flash Lite",  "desc", "Ultra rapide, moins cher",         "tier", "free"),
            Map.of("id", "gemini-2.5-flash",       "name", "Gemini 2.5 Flash",       "desc", "Version plus récente, qualité++",   "tier", "free"),
            Map.of("id", "gemini-2.5-pro",         "name", "Gemini 2.5 Pro",         "desc", "Plus intelligent mais plus lent",  "tier", "paid"),
            Map.of("id", "gemini-1.5-flash",       "name", "Gemini 1.5 Flash (legacy)","desc", "Ancien modèle, toujours dispo",  "tier", "free"),
            Map.of("id", "gemini-1.5-pro",         "name", "Gemini 1.5 Pro (legacy)","desc", "Ancien modèle pro, fallback",    "tier", "paid")
    );

    public void status(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        String key = plugin.getConfig().getString("dashboard.ai.api-key", "");
        String model = plugin.getConfig().getString("dashboard.ai.model", DEFAULT_MODEL);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("configured", key != null && !key.isBlank());
        out.put("model", model);
        out.put("provider", "gemini");
        out.put("availableModels", AVAILABLE_MODELS);
        HttpHelper.json(ex, 200, out);
    }

    /** POST /api/ai/config — change le modèle actif. ADMIN only. */
    @SuppressWarnings("unchecked")
    public void setConfig(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        Map<String, Object> body;
        try {
            body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        } catch (Exception e) {
            HttpHelper.error(ex, 400, "JSON invalide"); return;
        }
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        String newModel = (String) body.get("model");
        String newApiKey = (String) body.get("apiKey");
        boolean changed = false;

        if (newModel != null && !newModel.isBlank()) {
            // Valide contre la liste connue (évite n'importe quelle string)
            boolean valid = AVAILABLE_MODELS.stream().anyMatch(m -> newModel.equals(m.get("id")));
            if (!valid) { HttpHelper.error(ex, 400, "Modèle inconnu : " + newModel); return; }
            plugin.getConfig().set("dashboard.ai.model", newModel);
            changed = true;
        }
        if (newApiKey != null) { // peut être vide pour effacer
            plugin.getConfig().set("dashboard.ai.api-key", newApiKey);
            changed = true;
        }
        if (changed) plugin.saveConfig();

        HttpHelper.json(ex, 200, Map.of(
                "ok", true,
                "model", plugin.getConfig().getString("dashboard.ai.model", DEFAULT_MODEL),
                "configured", !plugin.getConfig().getString("dashboard.ai.api-key", "").isBlank()
        ));
    }

    @SuppressWarnings("unchecked")
    public void chat(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;

        String apiKey = plugin.getConfig().getString("dashboard.ai.api-key", "");
        if (apiKey == null || apiKey.isBlank()) {
            HttpHelper.error(ex, 503,
                    "Gemini API non configurée. Ajoutez dashboard.ai.api-key dans config.yml " +
                    "(clé gratuite sur https://aistudio.google.com/apikey).");
            return;
        }
        String model = plugin.getConfig().getString("dashboard.ai.model", DEFAULT_MODEL);

        // ── Parse le body entrant (format frontend : { messages: [{role, content}] }) ──
        Map<String, Object> body;
        try {
            body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        } catch (Exception e) {
            HttpHelper.error(ex, 400, "JSON invalide"); return;
        }
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
        if (messages == null || messages.isEmpty()) { HttpHelper.error(ex, 400, "messages manquant"); return; }

        String systemPrompt = buildSystemPrompt();

        // ── Construit le payload Gemini ──
        // Format : { systemInstruction:{parts:[{text:...}]},
        //            contents:[{role:"user|model", parts:[{text:...}]}],
        //            generationConfig:{temperature, maxOutputTokens} }
        JsonObject payload = new JsonObject();

        JsonObject systemInstruction = new JsonObject();
        JsonArray sysParts = new JsonArray();
        JsonObject sysPart = new JsonObject();
        sysPart.addProperty("text", systemPrompt);
        sysParts.add(sysPart);
        systemInstruction.add("parts", sysParts);
        payload.add("systemInstruction", systemInstruction);

        JsonArray contents = new JsonArray();
        for (Map<String, Object> m : messages) {
            String role = String.valueOf(m.get("role"));
            String content = String.valueOf(m.getOrDefault("content", ""));
            if (content.isBlank()) continue;
            JsonObject turn = new JsonObject();
            // Gemini utilise "model" au lieu de "assistant"
            turn.addProperty("role", "assistant".equals(role) ? "model" : "user");
            JsonArray parts = new JsonArray();
            JsonObject part = new JsonObject();
            part.addProperty("text", content);
            parts.add(part);
            turn.add("parts", parts);
            contents.add(turn);
        }
        payload.add("contents", contents);

        JsonObject genConfig = new JsonObject();
        genConfig.addProperty("temperature", 0.7);
        genConfig.addProperty("maxOutputTokens", 2048);
        payload.add("generationConfig", genConfig);

        // ── Appel Gemini ──
        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + URLEncoder.encode(model, StandardCharsets.UTF_8)
                + ":generateContent?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(payload), StandardCharsets.UTF_8))
                .build();

        CompletableFuture<HttpResponse<String>> future = http.sendAsync(req, HttpResponse.BodyHandlers.ofString());

        try {
            HttpResponse<String> res = future.get();
            int status = res.statusCode();

            if (status < 200 || status >= 300) {
                // Tente de parser l'erreur Gemini pour un message plus clair
                String msg = extractGeminiError(res.body(), status);
                HttpHelper.error(ex, 502, "Erreur Gemini : " + msg);
                return;
            }

            // ── Parse la réponse Gemini et transforme au format Anthropic-compatible ──
            String text = extractGeminiText(res.body());
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("role", "assistant");
            normalized.put("model", model);
            normalized.put("content", List.of(Map.of("type", "text", "text", text)));
            HttpHelper.json(ex, 200, normalized);

        } catch (Exception e) {
            HttpHelper.error(ex, 502, "Erreur API Gemini : " + e.getMessage());
        }
    }

    /** Parse { candidates: [{ content: { parts: [{ text: "..." }] } }] } et retourne le texte concaténé. */
    private static String extractGeminiText(String json) {
        try {
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            JsonArray candidates = root.getAsJsonArray("candidates");
            if (candidates == null || candidates.isEmpty()) {
                // Peut arriver avec un blocage de sécurité — on retourne le promptFeedback
                if (root.has("promptFeedback")) {
                    return "(Réponse bloquée par les filtres de sécurité Gemini)";
                }
                return "(Réponse vide)";
            }
            StringBuilder out = new StringBuilder();
            for (int i = 0; i < candidates.size(); i++) {
                JsonObject cand = candidates.get(i).getAsJsonObject();
                JsonObject content = cand.getAsJsonObject("content");
                if (content == null) continue;
                JsonArray parts = content.getAsJsonArray("parts");
                if (parts == null) continue;
                for (int j = 0; j < parts.size(); j++) {
                    JsonObject part = parts.get(j).getAsJsonObject();
                    if (part.has("text")) {
                        if (!out.isEmpty()) out.append("\n");
                        out.append(part.get("text").getAsString());
                    }
                }
            }
            return out.isEmpty() ? "(Réponse vide)" : out.toString();
        } catch (Throwable t) {
            return "(Erreur parsing réponse Gemini : " + t.getMessage() + ")";
        }
    }

    /** Extrait le message d'erreur d'une réponse non-200 de Gemini. */
    private static String extractGeminiError(String body, int status) {
        try {
            JsonObject root = JsonParser.parseString(body).getAsJsonObject();
            JsonObject err = root.getAsJsonObject("error");
            if (err != null && err.has("message")) {
                return err.get("message").getAsString() + " (HTTP " + status + ")";
            }
        } catch (Throwable ignored) {}
        return "HTTP " + status + " : " + (body.length() > 200 ? body.substring(0, 200) + "..." : body);
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
