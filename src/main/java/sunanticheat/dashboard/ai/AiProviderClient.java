package sunanticheat.dashboard.ai;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Abstraction multi-provider pour les appels LLM.
 *
 * Supporte :
 *   - "gemini" → Google Gemini (generativelanguage.googleapis.com)
 *   - "openai" → OpenAI Chat Completions (api.openai.com/v1/chat/completions)
 *
 * Le caller fournit un system prompt + une liste de messages {role, content}
 * avec role ∈ {"user", "assistant"}. Le client traduit vers le format natif
 * du provider et normalise la réponse.
 */
public final class AiProviderClient {

    private static final Gson GSON = new Gson();
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    /** Résultat unifié d'un appel LLM. */
    public static final class CallResult {
        public final boolean success;
        public final int httpStatus;
        public final String text;          // texte de la réponse (success) ou message d'erreur
        public final long inputTokens;
        public final long outputTokens;
        public final String rawBody;       // corps brut (pour debug/usage tracking supplémentaire)

        public CallResult(boolean success, int status, String text, long in, long out, String raw) {
            this.success = success;
            this.httpStatus = status;
            this.text = text;
            this.inputTokens = in;
            this.outputTokens = out;
            this.rawBody = raw;
        }
        public static CallResult error(int status, String msg) {
            return new CallResult(false, status, msg, 0, 0, null);
        }
    }

    private AiProviderClient() {}

    /**
     * Appel unifié vers Gemini ou OpenAI.
     * messages : liste de { role ∈ ["user","assistant"], content: String }
     */
    public static CallResult call(String provider, String apiKey, String model,
                                   String systemPrompt, List<Map<String, Object>> messages,
                                   int maxTokens, double temperature, int timeoutSeconds) {
        if (apiKey == null || apiKey.isBlank()) {
            return CallResult.error(503, "API key manquante pour provider " + provider);
        }
        String prov = provider != null ? provider.toLowerCase() : "gemini";
        try {
            return switch (prov) {
                case "openai" -> callOpenAI(apiKey, model, systemPrompt, messages, maxTokens, temperature, timeoutSeconds);
                default      -> callGemini(apiKey, model, systemPrompt, messages, maxTokens, temperature, timeoutSeconds);
            };
        } catch (Throwable t) {
            return CallResult.error(500, "Erreur interne : " + t.getMessage());
        }
    }

    // ── Gemini ──────────────────────────────────────────────────────────────

    private static CallResult callGemini(String apiKey, String model,
                                          String systemPrompt, List<Map<String, Object>> messages,
                                          int maxTokens, double temperature, int timeoutSeconds) throws Exception {
        JsonObject payload = new JsonObject();

        // system
        JsonObject si = new JsonObject();
        JsonArray sparts = new JsonArray();
        JsonObject sp = new JsonObject();
        sp.addProperty("text", systemPrompt);
        sparts.add(sp);
        si.add("parts", sparts);
        payload.add("systemInstruction", si);

        // contents : assistant → model
        JsonArray contents = new JsonArray();
        for (Map<String, Object> m : messages) {
            String role = String.valueOf(m.get("role"));
            String content = String.valueOf(m.getOrDefault("content", ""));
            if (content.isBlank()) continue;
            JsonObject turn = new JsonObject();
            turn.addProperty("role", "assistant".equals(role) ? "model" : "user");
            JsonArray parts = new JsonArray();
            JsonObject part = new JsonObject();
            part.addProperty("text", content);
            parts.add(part);
            turn.add("parts", parts);
            contents.add(turn);
        }
        payload.add("contents", contents);

        JsonObject gen = new JsonObject();
        gen.addProperty("temperature", temperature);
        gen.addProperty("maxOutputTokens", maxTokens);
        payload.add("generationConfig", gen);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + URLEncoder.encode(model, StandardCharsets.UTF_8)
                + ":generateContent?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(payload), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        int status = res.statusCode();

        if (status < 200 || status >= 300) {
            return CallResult.error(status, extractGeminiError(res.body(), status));
        }

        String text = extractGeminiText(res.body());
        long[] tokens = extractGeminiTokens(res.body());
        return new CallResult(true, status, text, tokens[0], tokens[1], res.body());
    }

    private static String extractGeminiText(String json) {
        try {
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            JsonArray candidates = root.getAsJsonArray("candidates");
            if (candidates == null || candidates.isEmpty()) {
                if (root.has("promptFeedback"))
                    return "(Réponse bloquée par les filtres de sécurité Gemini)";
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
            return "(Erreur parsing : " + t.getMessage() + ")";
        }
    }

    private static long[] extractGeminiTokens(String json) {
        try {
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            if (!root.has("usageMetadata")) return new long[]{0, 0};
            JsonObject u = root.getAsJsonObject("usageMetadata");
            long in = u.has("promptTokenCount") ? u.get("promptTokenCount").getAsLong() : 0;
            long out = u.has("candidatesTokenCount") ? u.get("candidatesTokenCount").getAsLong() : 0;
            return new long[]{in, out};
        } catch (Throwable t) { return new long[]{0, 0}; }
    }

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

    // ── OpenAI ──────────────────────────────────────────────────────────────

    private static CallResult callOpenAI(String apiKey, String model,
                                          String systemPrompt, List<Map<String, Object>> messages,
                                          int maxTokens, double temperature, int timeoutSeconds) throws Exception {
        JsonObject payload = new JsonObject();
        payload.addProperty("model", model);
        payload.addProperty("temperature", temperature);
        // GPT-4o et + acceptent max_tokens ET max_completion_tokens ; on privilégie max_tokens pour compat large
        payload.addProperty("max_tokens", maxTokens);

        JsonArray msgs = new JsonArray();
        // system message en premier
        JsonObject sysMsg = new JsonObject();
        sysMsg.addProperty("role", "system");
        sysMsg.addProperty("content", systemPrompt);
        msgs.add(sysMsg);
        // historique
        for (Map<String, Object> m : messages) {
            String role = String.valueOf(m.get("role"));
            String content = String.valueOf(m.getOrDefault("content", ""));
            if (content.isBlank()) continue;
            JsonObject msg = new JsonObject();
            msg.addProperty("role", "assistant".equals(role) ? "assistant" : "user");
            msg.addProperty("content", content);
            msgs.add(msg);
        }
        payload.add("messages", msgs);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.openai.com/v1/chat/completions"))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(payload), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        int status = res.statusCode();

        if (status < 200 || status >= 300) {
            return CallResult.error(status, extractOpenAiError(res.body(), status));
        }

        String text = extractOpenAiText(res.body());
        long[] tokens = extractOpenAiTokens(res.body());
        return new CallResult(true, status, text, tokens[0], tokens[1], res.body());
    }

    private static String extractOpenAiText(String json) {
        try {
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            JsonArray choices = root.getAsJsonArray("choices");
            if (choices == null || choices.isEmpty()) return "(Réponse vide)";
            JsonObject first = choices.get(0).getAsJsonObject();
            JsonObject msg = first.getAsJsonObject("message");
            if (msg == null || !msg.has("content")) return "(Réponse vide)";
            return msg.get("content").getAsString();
        } catch (Throwable t) {
            return "(Erreur parsing : " + t.getMessage() + ")";
        }
    }

    private static long[] extractOpenAiTokens(String json) {
        try {
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            if (!root.has("usage")) return new long[]{0, 0};
            JsonObject u = root.getAsJsonObject("usage");
            long in = u.has("prompt_tokens") ? u.get("prompt_tokens").getAsLong() : 0;
            long out = u.has("completion_tokens") ? u.get("completion_tokens").getAsLong() : 0;
            return new long[]{in, out};
        } catch (Throwable t) { return new long[]{0, 0}; }
    }

    private static String extractOpenAiError(String body, int status) {
        try {
            JsonObject root = JsonParser.parseString(body).getAsJsonObject();
            if (root.has("error")) {
                JsonObject err = root.getAsJsonObject("error");
                if (err.has("message")) return err.get("message").getAsString() + " (HTTP " + status + ")";
            }
        } catch (Throwable ignored) {}
        return "HTTP " + status + " : " + (body.length() > 200 ? body.substring(0, 200) + "..." : body);
    }
}
