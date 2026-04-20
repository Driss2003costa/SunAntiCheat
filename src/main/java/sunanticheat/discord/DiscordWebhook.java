package sunanticheat.discord;

import org.bukkit.plugin.java.JavaPlugin;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

/**
 * Envoi asynchrone de messages vers un webhook Discord (JSON).
 */
public class DiscordWebhook {

    private final JavaPlugin plugin;
    private final String webhookUrl;
    private final HttpClient client;

    public DiscordWebhook(JavaPlugin plugin, String webhookUrl) {
        this.plugin = plugin;
        this.webhookUrl = webhookUrl != null && !webhookUrl.isBlank() ? webhookUrl.trim() : null;
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public boolean isEnabled() {
        return webhookUrl != null;
    }

    /** Envoie un message (content) au webhook. Exécution asynchrone. */
    public void send(String content) {
        if (!isEnabled()) return;
        String escaped = content
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "");
        String json = "{\"content\":\"" + escaped + "\"}";
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(webhookUrl))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();
        CompletableFuture<HttpResponse<String>> future = client.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        future.thenAccept(resp -> {
            int code = resp.statusCode();
            if (code < 200 || code >= 300) {
                plugin.getLogger().warning("Discord webhook HTTP " + code + " : " + resp.body());
            }
        }).exceptionally(ex -> {
            plugin.getLogger().warning("Discord webhook error: " + ex.getMessage());
            return null;
        });
    }

    public void sendAlert(String type, String playerName, String detail) {
        if (!isEnabled()) return;
        send("[SunGuard] " + type + " — " + playerName + ": " + detail);
    }

    public void sendSanction(String sanctionType, String targetName, String staffName, String reason, String duration) {
        if (!isEnabled()) return;
        send("[Sanction] " + sanctionType + " | Cible: " + targetName + " | Par: " + staffName + (reason != null && !reason.isEmpty() ? " | " + reason : "") + (duration != null && !duration.isEmpty() ? " | " + duration : ""));
    }

    public void sendReport(String reporterName, String reportedName, String reason) {
        if (!isEnabled()) return;
        send("[Report] " + reporterName + " signale " + reportedName + ": " + reason);
    }

    /**
     * Envoie un embed (titre + description) au webhook.
     * La description est tronquée à 4096 caractères (limite Discord).
     * Couleur par défaut : bleu Discord (3447003).
     */
    public void sendEmbed(String title, String description) {
        sendEmbed(title, description, 3447003);
    }

    /**
     * @param colorRgb Couleur embed (décimal), ex. rouge {@code 0xFF0000} = {@code 16711680}.
     */
    public void sendEmbed(String title, String description, int colorRgb) {
        sendEmbed(title, description, colorRgb, "SunAntiCheat · SunGuard", true);
    }

    /**
     * Envoie un embed enrichi avec footer et timestamp ISO-8601.
     * @param footer texte du footer (null pour aucun)
     * @param withTimestamp si {@code true}, ajoute l’horodatage courant dans l’embed.
     */
    public void sendEmbed(String title, String description, int colorRgb, String footer, boolean withTimestamp) {
        if (!isEnabled()) return;
        String escapedTitle = escapeJson(title);
        String safeDesc = description != null ? description : "";
        if (safeDesc.length() > 4096) safeDesc = safeDesc.substring(0, 4093) + "...";
        String escapedDesc = escapeJson(safeDesc);

        StringBuilder embed = new StringBuilder();
        embed.append("{")
                .append("\"title\":\"").append(escapedTitle).append("\",")
                .append("\"description\":\"").append(escapedDesc).append("\",")
                .append("\"color\":").append(colorRgb);
        if (footer != null && !footer.isBlank()) {
            embed.append(",\"footer\":{\"text\":\"").append(escapeJson(footer)).append("\"}");
        }
        if (withTimestamp) {
            String iso = java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC)
                    .format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            embed.append(",\"timestamp\":\"").append(escapeJson(iso)).append("\"");
        }
        embed.append("}");
        String json = "{\"embeds\":[" + embed + "]}";
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(webhookUrl))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();
        CompletableFuture<HttpResponse<String>> future = client.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        future.thenAccept(resp -> {
            int code = resp.statusCode();
            if (code < 200 || code >= 300) {
                plugin.getLogger().warning("Discord webhook HTTP " + code + " (embed) : " + resp.body());
            }
        }).exceptionally(ex -> {
            plugin.getLogger().warning("Discord webhook error: " + ex.getMessage());
            return null;
        });
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
