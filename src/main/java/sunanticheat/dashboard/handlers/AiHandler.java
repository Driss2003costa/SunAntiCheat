package sunanticheat.dashboard.handlers;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.World;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.ai.AiUsageStore;
import sunanticheat.dashboard.ws.DashboardWsServer;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;

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
    private DashboardWsServer wsServer;  // injecté après construction pour casser le cycle
    private final AiUsageStore usageStore;

    public AiHandler(JavaPlugin plugin) {
        this.plugin = plugin;
        this.usageStore = new AiUsageStore(plugin.getDataFolder(), plugin.getLogger());
    }

    public void setWsServer(DashboardWsServer ws) { this.wsServer = ws; }
    public AiUsageStore getUsageStore() { return usageStore; }

    /** Tente d'extraire les tokens consommés depuis la réponse Gemini (usageMetadata). */
    private static long[] extractTokens(String body) {
        try {
            JsonObject root = JsonParser.parseString(body).getAsJsonObject();
            if (!root.has("usageMetadata")) return new long[]{0, 0};
            JsonObject u = root.getAsJsonObject("usageMetadata");
            long in = u.has("promptTokenCount") ? u.get("promptTokenCount").getAsLong() : 0;
            long out = u.has("candidatesTokenCount") ? u.get("candidatesTokenCount").getAsLong() : 0;
            return new long[]{in, out};
        } catch (Throwable t) { return new long[]{0, 0}; }
    }

    /** Enregistre la consommation dans le store (appelé après chaque réponse Gemini success). */
    private void recordUsage(String model, String body) {
        long[] tokens = extractTokens(body);
        if (tokens[0] > 0 || tokens[1] > 0) {
            usageStore.record(model, tokens[0], tokens[1]);
        }
    }

    /** GET /api/ai/usage — stats de consommation (today, last7, allTime, pricing). */
    public void usage(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        HttpHelper.json(ex, 200, usageStore.snapshot());
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
            recordUsage(model, res.body());
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

    /** Résultat d'un diagnostic IA interne (utilisé par AiMonitor). */
    public static final class DiagnosticResult {
        public final String analysis;
        public final String context;
        public final long timestamp;
        public DiagnosticResult(String analysis, String context) {
            this.analysis = analysis;
            this.context = context;
            this.timestamp = System.currentTimeMillis();
        }
    }

    /**
     * Lance un diagnostic IA sans HTTP (utilisé par AiMonitor en tâche async).
     * Retourne null en cas d'erreur.
     */
    public DiagnosticResult runInternalDiagnostic() {
        try {
            String apiKey = plugin.getConfig().getString("dashboard.ai.api-key", "");
            if (apiKey == null || apiKey.isBlank()) return null;
            String model = plugin.getConfig().getString("dashboard.ai.model", DEFAULT_MODEL);

            String context = buildDiagnosticContext();
            String systemPrompt = buildDiagnosticSystemPrompt("full");
            String userPrompt = "Analyse le diagnostic serveur ci-dessous :\n\n```\n" + context + "\n```";

            JsonObject payload = buildGeminiPayload(systemPrompt, userPrompt, 4096, 0.3);
            String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                    + URLEncoder.encode(model, StandardCharsets.UTF_8)
                    + ":generateContent?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(90))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(payload), StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() < 200 || res.statusCode() >= 300) return null;
            recordUsage(model, res.body());
            return new DiagnosticResult(extractGeminiText(res.body()), context);
        } catch (Throwable t) {
            plugin.getLogger().warning("[AI] runInternalDiagnostic erreur: " + t.getMessage());
            return null;
        }
    }

    /** Builder utilitaire du payload Gemini (extrait pour réutilisation). */
    private static JsonObject buildGeminiPayload(String systemPrompt, String userPrompt, int maxTokens, double temp) {
        JsonObject payload = new JsonObject();
        JsonObject si = new JsonObject();
        JsonArray siParts = new JsonArray();
        JsonObject siPart = new JsonObject();
        siPart.addProperty("text", systemPrompt);
        siParts.add(siPart);
        si.add("parts", siParts);
        payload.add("systemInstruction", si);

        JsonArray contents = new JsonArray();
        JsonObject turn = new JsonObject();
        turn.addProperty("role", "user");
        JsonArray parts = new JsonArray();
        JsonObject part = new JsonObject();
        part.addProperty("text", userPrompt);
        parts.add(part);
        turn.add("parts", parts);
        contents.add(turn);
        payload.add("contents", contents);

        JsonObject gen = new JsonObject();
        gen.addProperty("temperature", temp);
        gen.addProperty("maxOutputTokens", maxTokens);
        payload.add("generationConfig", gen);
        return payload;
    }

    /**
     * POST /api/ai/diagnose
     *
     * Collecte automatiquement les métriques serveur (TPS, RAM, entités, chunks,
     * plugins, dernières erreurs dans la console) et demande à Gemini de faire
     * un diagnostic complet des problèmes de performance.
     *
     * Body optionnel : { focus: "tps" | "ram" | "plugins" | "full" }
     * Par défaut : "full"
     */
    @SuppressWarnings("unchecked")
    public void diagnose(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;

        String apiKey = plugin.getConfig().getString("dashboard.ai.api-key", "");
        if (apiKey == null || apiKey.isBlank()) {
            HttpHelper.error(ex, 503, "Gemini API non configurée. Ajoutez dashboard.ai.api-key dans config.yml.");
            return;
        }
        String model = plugin.getConfig().getString("dashboard.ai.model", DEFAULT_MODEL);

        String focus = "full";
        try {
            Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
            if (body != null && body.get("focus") instanceof String s) focus = s;
        } catch (Exception ignored) {}

        // ── Collecte du contexte de diagnostic ──
        String diagnosticContext = buildDiagnosticContext();

        // ── Prompt spécifique diagnostic (factorisé) ──
        String systemPrompt = buildDiagnosticSystemPrompt(focus);

        String userPrompt = "Analyse le diagnostic serveur ci-dessous et dis-moi ce qui cloche :\n\n"
                + "```\n" + diagnosticContext + "\n```";

        // ── Construit payload Gemini ──
        JsonObject payload = new JsonObject();
        JsonObject systemInstruction = new JsonObject();
        JsonArray sysParts = new JsonArray();
        JsonObject sysPart = new JsonObject();
        sysPart.addProperty("text", systemPrompt);
        sysParts.add(sysPart);
        systemInstruction.add("parts", sysParts);
        payload.add("systemInstruction", systemInstruction);

        JsonArray contents = new JsonArray();
        JsonObject turn = new JsonObject();
        turn.addProperty("role", "user");
        JsonArray parts = new JsonArray();
        JsonObject part = new JsonObject();
        part.addProperty("text", userPrompt);
        parts.add(part);
        turn.add("parts", parts);
        contents.add(turn);
        payload.add("contents", contents);

        JsonObject genConfig = new JsonObject();
        genConfig.addProperty("temperature", 0.3);  // plus déterministe pour diagnostic
        genConfig.addProperty("maxOutputTokens", 4096);
        payload.add("generationConfig", genConfig);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + URLEncoder.encode(model, StandardCharsets.UTF_8)
                + ":generateContent?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(90))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(payload), StandardCharsets.UTF_8))
                .build();

        CompletableFuture<HttpResponse<String>> future = http.sendAsync(req, HttpResponse.BodyHandlers.ofString());
        try {
            HttpResponse<String> res = future.get();
            if (res.statusCode() < 200 || res.statusCode() >= 300) {
                HttpHelper.error(ex, 502, "Gemini : " + extractGeminiError(res.body(), res.statusCode()));
                return;
            }
            String analysis = extractGeminiText(res.body());
            recordUsage(model, res.body());
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("analysis", analysis);
            out.put("context", diagnosticContext);
            out.put("model", model);
            out.put("timestamp", System.currentTimeMillis());
            HttpHelper.json(ex, 200, out);
        } catch (Exception e) {
            HttpHelper.error(ex, 502, "Erreur diagnostic IA : " + e.getMessage());
        }
    }

    /**
     * Collecte toutes les métriques serveur dans un format textuel lisible par l'IA.
     * Tout est sur main thread ou read-only, donc safe même depuis un thread HTTP.
     */
    private String buildDiagnosticContext() {
        StringBuilder sb = new StringBuilder();
        sb.append("=== DIAGNOSTIC SERVEUR MINECRAFT (").append(new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date())).append(") ===\n\n");

        // ── Serveur général ──
        sb.append("## Serveur\n");
        sb.append("Version : ").append(Bukkit.getVersion()).append("\n");
        sb.append("Bukkit version : ").append(Bukkit.getBukkitVersion()).append("\n");
        sb.append("Joueurs : ").append(Bukkit.getOnlinePlayers().size())
                .append(" / ").append(Bukkit.getMaxPlayers()).append("\n");
        sb.append("View distance : ").append(Bukkit.getViewDistance()).append("\n");
        sb.append("Simulation distance : ").append(Bukkit.getSimulationDistance()).append("\n");

        // ── TPS ──
        sb.append("\n## TPS (ticks per second — cible 20)\n");
        try {
            double[] tps = Bukkit.getTPS();
            sb.append("  1 min : ").append(String.format("%.2f", tps[0])).append(tpsLabel(tps[0])).append("\n");
            sb.append("  5 min : ").append(String.format("%.2f", tps[1])).append(tpsLabel(tps[1])).append("\n");
            sb.append(" 15 min : ").append(String.format("%.2f", tps[2])).append(tpsLabel(tps[2])).append("\n");
        } catch (Throwable t) { sb.append("  Non disponible\n"); }

        // ── MSPT (ms per tick — cible <50) ──
        try {
            double[] mspt = Bukkit.getAverageTickTime() > 0
                    ? new double[]{ Bukkit.getAverageTickTime() }
                    : null;
            if (mspt != null) {
                sb.append("MSPT moyen : ").append(String.format("%.2f", mspt[0])).append(" ms");
                sb.append(mspt[0] > 50 ? " 🔴 SURCHARGE" : mspt[0] > 35 ? " 🟠 CHARGE" : " ✓");
                sb.append("\n");
            }
        } catch (Throwable ignored) {}

        // ── RAM ──
        sb.append("\n## RAM\n");
        try {
            MemoryMXBean mem = ManagementFactory.getMemoryMXBean();
            long usedMb = mem.getHeapMemoryUsage().getUsed() / (1024 * 1024);
            long maxMb  = mem.getHeapMemoryUsage().getMax() / (1024 * 1024);
            long pct    = maxMb > 0 ? (usedMb * 100 / maxMb) : 0;
            sb.append("Heap : ").append(usedMb).append(" / ").append(maxMb).append(" Mo (").append(pct).append("%)");
            if (pct > 95) sb.append(" 🔴 SATURÉE");
            else if (pct > 85) sb.append(" 🟠 ÉLEVÉE");
            else sb.append(" ✓");
            sb.append("\n");
            long nonHeapMb = mem.getNonHeapMemoryUsage().getUsed() / (1024 * 1024);
            sb.append("Non-heap : ").append(nonHeapMb).append(" Mo\n");
        } catch (Throwable t) { sb.append("  Non disponible : ").append(t.getMessage()).append("\n"); }

        // ── Mondes ──
        sb.append("\n## Mondes (nom | joueurs | entités | chunks chargés | tile entities)\n");
        for (World w : Bukkit.getWorlds()) {
            int players = w.getPlayers().size();
            int entities = 0;
            int tiles = 0;
            int chunks = 0;
            try { entities = w.getEntities().size(); } catch (Throwable ignored) {}
            try { chunks = w.getLoadedChunks().length; } catch (Throwable ignored) {}
            try {
                for (org.bukkit.Chunk c : w.getLoadedChunks()) tiles += c.getTileEntities().length;
            } catch (Throwable ignored) {}
            sb.append("  - ").append(w.getName()).append(" | ")
                    .append(players).append("p | ")
                    .append(entities).append("e");
            if (entities > 2000) sb.append("🔴");
            else if (entities > 1000) sb.append("🟠");
            sb.append(" | ").append(chunks).append("c");
            if (chunks > 10000) sb.append("🔴");
            else if (chunks > 5000) sb.append("🟠");
            sb.append(" | ").append(tiles).append("t\n");
        }

        // ── Plugins ──
        sb.append("\n## Plugins chargés\n");
        Plugin[] plugins = Bukkit.getPluginManager().getPlugins();
        sb.append("Total : ").append(plugins.length).append("\n");
        for (Plugin p : plugins) {
            sb.append("  - ").append(p.getName())
                    .append(" v").append(p.getDescription().getVersion())
                    .append(p.isEnabled() ? " ✓" : " ✗ DÉSACTIVÉ")
                    .append("\n");
        }

        // ── Logs console récents ──
        sb.append("\n## Derniers logs console (200 lignes)\n");
        if (wsServer != null) {
            java.util.List<String> recent = wsServer.getRecentConsoleLines(200);
            if (recent.isEmpty()) {
                sb.append("  (buffer vide — aucun log capturé récemment)\n");
            } else {
                // Priorise les erreurs/warnings en fin de liste
                for (String line : recent) sb.append(line).append("\n");
            }
        } else {
            sb.append("  (capture console non disponible)\n");
        }

        // ── Fichiers de config serveur (paper, spigot, bukkit) ──
        sb.append("\n## Configs serveur (extraits clés)\n");
        appendConfigSnippet(sb, "server.properties", 80, false);
        appendConfigSnippet(sb, "bukkit.yml", 60, true);
        appendConfigSnippet(sb, "spigot.yml", 120, true);
        appendConfigSnippet(sb, "paper-global.yml", 100, true);
        appendConfigSnippet(sb, "paper-world-defaults.yml", 80, true);

        return sb.toString();
    }

    /**
     * Ajoute un extrait d'un fichier config au contexte de diagnostic.
     * Lit depuis le dossier parent de plugins/ (= dossier serveur).
     * Limite le contenu à maxLines lignes + filtre les clés les plus pertinentes.
     */
    private void appendConfigSnippet(StringBuilder sb, String relativePath, int maxLines, boolean yamlFilter) {
        try {
            java.io.File serverRoot = plugin.getDataFolder().getParentFile().getParentFile();
            if (serverRoot == null) return;
            java.io.File file = new java.io.File(serverRoot, relativePath);
            if (!file.exists() || !file.isFile()) return;
            if (file.length() > 100_000) {
                sb.append("### ").append(relativePath).append(" (trop volumineux, skip)\n");
                return;
            }

            java.util.List<String> lines = java.nio.file.Files.readAllLines(file.toPath(), java.nio.charset.StandardCharsets.UTF_8);
            sb.append("### ").append(relativePath).append("\n```yaml\n");
            int kept = 0;
            for (String line : lines) {
                if (kept >= maxLines) { sb.append("# ... (tronqué)\n"); break; }
                if (yamlFilter) {
                    // Skip commentaires purs et lignes vides pour économiser les tokens
                    String trimmed = line.trim();
                    if (trimmed.isEmpty()) continue;
                    if (trimmed.startsWith("#") && !trimmed.toLowerCase().contains("warn")
                            && !trimmed.toLowerCase().contains("important")) continue;
                }
                sb.append(line).append("\n");
                kept++;
            }
            sb.append("```\n");
        } catch (Throwable t) {
            sb.append("### ").append(relativePath).append(" — erreur lecture: ").append(t.getMessage()).append("\n");
        }
    }

    /**
     * POST /api/ai/apply-patch — applique un patch YAML suggéré par l'IA.
     * ADMIN uniquement. Backup auto avant écriture. Whitelist stricte des fichiers.
     *
     * Body : {
     *   file: "spigot.yml",           // ou "paper-global.yml", "bukkit.yml", etc.
     *   changes: [
     *     { path: "settings.player-shuffle", value: 80 },
     *     { path: "world-settings.default.merge-radius.item", value: 3.5 }
     *   ]
     * }
     */
    @SuppressWarnings("unchecked")
    public void applyPatch(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

        Map<String, Object> body;
        try {
            body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        } catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
        if (body == null) { HttpHelper.error(ex, 400, "body requis"); return; }

        String file = (String) body.get("file");
        List<Map<String, Object>> changes = (List<Map<String, Object>>) body.get("changes");
        if (file == null || changes == null || changes.isEmpty()) {
            HttpHelper.error(ex, 400, "file + changes[] requis"); return;
        }

        // ── Whitelist stricte (sécurité) ──
        java.util.Set<String> allowed = java.util.Set.of(
                "server.properties", "bukkit.yml", "spigot.yml",
                "paper-global.yml", "paper-world-defaults.yml", "paper.yml"
        );
        if (!allowed.contains(file)) {
            HttpHelper.error(ex, 403, "Fichier non autorisé pour l'auto-patch : " + file); return;
        }

        java.io.File serverRoot = plugin.getDataFolder().getParentFile().getParentFile();
        if (serverRoot == null) { HttpHelper.error(ex, 500, "server root introuvable"); return; }
        java.io.File target = new java.io.File(serverRoot, file);
        if (!target.exists() || !target.isFile()) {
            HttpHelper.error(ex, 404, "Fichier introuvable : " + target.getAbsolutePath()); return;
        }

        try {
            // Backup
            String stamp = new java.text.SimpleDateFormat("yyyyMMdd-HHmmss").format(new java.util.Date());
            java.io.File backup = new java.io.File(target.getParentFile(), target.getName() + ".backup-" + stamp);
            java.nio.file.Files.copy(target.toPath(), backup.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);

            // Applique les patches
            List<Map<String, Object>> applied = new java.util.ArrayList<>();
            if (file.endsWith(".properties")) {
                java.util.Properties props = new java.util.Properties();
                try (var in = new java.io.FileInputStream(target)) { props.load(in); }
                for (Map<String, Object> change : changes) {
                    String path = String.valueOf(change.get("path"));
                    Object value = change.get("value");
                    String oldValue = props.getProperty(path);
                    props.setProperty(path, String.valueOf(value));
                    Map<String, Object> log = new LinkedHashMap<>();
                    log.put("path", path); log.put("old", oldValue); log.put("new", value);
                    applied.add(log);
                }
                try (var out = new java.io.FileOutputStream(target)) { props.store(out, "Patched by SunAntiCheat dashboard (AI)"); }
            } else {
                org.bukkit.configuration.file.YamlConfiguration yaml =
                        org.bukkit.configuration.file.YamlConfiguration.loadConfiguration(target);
                for (Map<String, Object> change : changes) {
                    String path = String.valueOf(change.get("path"));
                    Object value = change.get("value");
                    Object oldValue = yaml.get(path);
                    yaml.set(path, value);
                    Map<String, Object> log = new LinkedHashMap<>();
                    log.put("path", path); log.put("old", oldValue); log.put("new", value);
                    applied.add(log);
                }
                yaml.save(target);
            }

            plugin.getLogger().info("[AI-Patch] " + user.username() + " a appliqué " + applied.size() + " changements sur " + file);
            HttpHelper.json(ex, 200, Map.of(
                    "success", true,
                    "file", file,
                    "backup", backup.getName(),
                    "changes", applied,
                    "message", "Patch appliqué. Fais /reload confirm ou redémarre pour que ça prenne effet."
            ));
        } catch (Exception e) {
            HttpHelper.error(ex, 500, "Erreur patch : " + e.getMessage());
        }
    }

    /** Lit un fichier config d'un plugin spécifique (plugins/{name}/config.yml). Retourne null si absent. */
    private String readPluginConfig(String pluginName) {
        try {
            java.io.File f = new java.io.File(plugin.getDataFolder().getParentFile(), pluginName + "/config.yml");
            if (!f.exists() || !f.isFile() || f.length() > 100_000) return null;
            return java.nio.file.Files.readString(f.toPath(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Throwable t) { return null; }
    }

    /** System prompt factorisé pour diagnostic (utilisé par /api/ai/diagnose + AiMonitor). */
    private static String buildDiagnosticSystemPrompt(String focus) {
        return ""
                + "Tu es un expert Paper/Spigot server admin. Tu analyses les métriques "
                + "ET les fichiers de configuration du serveur Minecraft pour diagnostiquer "
                + "les problèmes de performance.\n\n"
                + "Réponds en français, structuré en 4 sections markdown :\n\n"
                + "## 🔍 Constat\n"
                + "Résume l'état du serveur en 2-3 phrases. TPS, RAM, mondes actifs.\n\n"
                + "## ⚠️ Problèmes détectés\n"
                + "Liste à puces des problèmes RÉELS trouvés. Pour chaque problème :\n"
                + "- Sévérité : 🔴 Critique / 🟠 Majeur / 🟡 Mineur\n"
                + "- Description concise\n"
                + "- Cause racine identifiée\n"
                + "Si rien : 'Aucun problème notable détecté'.\n\n"
                + "## 💡 Actions manuelles\n"
                + "Liste numérotée de commandes à taper ou plugins à gérer.\n"
                + "Une seule action par ligne, la plus impactante en premier.\n\n"
                + "## 🔧 Patches auto-applicables\n"
                + "Si tu détectes des réglages YAML/properties qui amélioreraient les perfs,\n"
                + "fournis-les dans un bloc JSON EXACTEMENT dans ce format, rien d'autre :\n"
                + "```patch\n"
                + "{\n"
                + "  \"patches\": [\n"
                + "    {\n"
                + "      \"file\": \"spigot.yml\",\n"
                + "      \"description\": \"Réduit les calculs d'items au sol\",\n"
                + "      \"reason\": \"Le monde 'nether' a 800 items au sol qui laggent\",\n"
                + "      \"changes\": [\n"
                + "        { \"path\": \"world-settings.default.merge-radius.item\", \"value\": 3.5 },\n"
                + "        { \"path\": \"world-settings.default.item-despawn-rate\", \"value\": 3000 }\n"
                + "      ]\n"
                + "    }\n"
                + "  ]\n"
                + "}\n"
                + "```\n"
                + "Fichiers autorisés : server.properties, bukkit.yml, spigot.yml,\n"
                + "paper-global.yml, paper-world-defaults.yml, paper.yml\n"
                + "Si aucun patch auto-applicable : `patches: []` ou omets la section.\n\n"
                + "RÈGLES :\n"
                + "- Sois concis et technique, pas de blabla\n"
                + "- Base-toi sur les DONNÉES RÉELLES fournies, pas sur du générique\n"
                + "- Si tu vois une stack trace, identifie le plugin coupable par son package\n"
                + "- TPS < 18 = problème, < 15 = critique\n"
                + "- RAM > 85% = problème, > 95% = critique\n"
                + "- > 2000 entités / monde = problème\n"
                + "- > 10000 chunks chargés = problème\n"
                + "- Valeurs patches concrètes et prouvées (pas d'invention)\n\n"
                + "Focus : " + focus + "\n";
    }

    private static String tpsLabel(double tps) {
        if (tps >= 19.5) return " ✓";
        if (tps >= 18)   return " 🟡";
        if (tps >= 15)   return " 🟠";
        return " 🔴 CRITIQUE";
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
