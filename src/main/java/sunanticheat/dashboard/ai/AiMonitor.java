package sunanticheat.dashboard.ai;

import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitTask;
import sunanticheat.dashboard.handlers.AiHandler;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.logging.Logger;

/**
 * Monitor passif du serveur.
 *
 * Toutes les N minutes (config : dashboard.ai.passive-monitor.interval-minutes),
 * lance un diagnostic IA automatique et envoie une alerte Discord si des problèmes
 * critiques (🔴) sont détectés.
 *
 * Config :
 *   dashboard.ai.passive-monitor.enabled: false
 *   dashboard.ai.passive-monitor.interval-minutes: 30
 *   dashboard.ai.passive-monitor.only-on-critical: true
 *   dashboard.ai.passive-monitor.discord-webhook: ""
 *
 * La boucle est entièrement async (non-main-thread) car Gemini appelle une HTTP API.
 */
public final class AiMonitor {

    private final org.bukkit.plugin.java.JavaPlugin plugin;
    private final AiHandler aiHandler;
    private final Logger logger;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    private BukkitTask task;
    private long lastAlertAt = 0;
    private static final long ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min entre 2 alertes

    public AiMonitor(org.bukkit.plugin.java.JavaPlugin plugin, AiHandler aiHandler, Logger logger) {
        this.plugin = plugin;
        this.aiHandler = aiHandler;
        this.logger = logger;
    }

    public void start() {
        if (task != null) task.cancel();
        var cfg = plugin.getConfig();
        if (!cfg.getBoolean("dashboard.ai.passive-monitor.enabled", false)) {
            logger.info("[AI Monitor] Désactivé (dashboard.ai.passive-monitor.enabled: false)");
            return;
        }
        int intervalMin = Math.max(5, cfg.getInt("dashboard.ai.passive-monitor.interval-minutes", 30));
        long ticks = 20L * 60 * intervalMin;

        task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::tick,
                20L * 60 * 5,   // démarre 5 min après le boot
                ticks);
        logger.info("[AI Monitor] Activé — diagnostic auto toutes les " + intervalMin + " min");
    }

    public void stop() {
        if (task != null) { try { task.cancel(); } catch (Throwable ignored) {} task = null; }
    }

    private void tick() {
        try {
            var cfg = plugin.getConfig();
            String apiKey = cfg.getString("dashboard.ai.api-key", "");
            if (apiKey == null || apiKey.isBlank()) return;
            boolean onlyOnCritical = cfg.getBoolean("dashboard.ai.passive-monitor.only-on-critical", true);
            String webhook = cfg.getString("dashboard.ai.passive-monitor.discord-webhook", "");
            if (webhook == null || webhook.isBlank()) {
                // Pas de webhook = monitor inutile
                return;
            }

            // Cooldown anti-spam
            long now = System.currentTimeMillis();
            if (now - lastAlertAt < ALERT_COOLDOWN_MS) return;

            // Déclenche le diagnostic via AiHandler (lance une requête interne Gemini)
            AiHandler.DiagnosticResult r = aiHandler.runInternalDiagnostic();
            if (r == null || r.analysis == null) return;

            String analysis = r.analysis;
            boolean hasCritical = analysis.contains("🔴");
            boolean hasMajor    = analysis.contains("🟠");
            boolean worthAlerting = onlyOnCritical ? hasCritical : (hasCritical || hasMajor);
            if (!worthAlerting) return;

            // Envoie l'alerte Discord
            sendDiscordAlert(webhook, analysis, hasCritical);
            lastAlertAt = now;
        } catch (Throwable t) {
            logger.warning("[AI Monitor] tick erreur: " + t.getMessage());
        }
    }

    private void sendDiscordAlert(String webhookUrl, String analysis, boolean critical) {
        try {
            String serverName = Bukkit.getServer().getName();
            int players = Bukkit.getOnlinePlayers().size();
            String title = critical ? "🔴 Problème critique détecté" : "🟠 Problème détecté";
            String color = critical ? "15158332" : "15105570"; // red / orange decimal
            String truncated = analysis.length() > 3500 ? analysis.substring(0, 3500) + "\n\n*(tronqué)*" : analysis;

            String escaped = truncated
                    .replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n");

            String json = "{"
                    + "\"username\":\"SunGuard Monitor\","
                    + "\"embeds\":[{"
                    + "\"title\":\"" + title + "\","
                    + "\"description\":\"" + escaped + "\","
                    + "\"color\":" + color + ","
                    + "\"footer\":{\"text\":\"" + players + " joueurs en ligne · " + serverName + "\"},"
                    + "\"timestamp\":\"" + java.time.Instant.now().toString() + "\""
                    + "}]}";

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(webhookUrl))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
                logger.info("[AI Monitor] Alerte Discord envoyée (" + (critical ? "critique" : "majeure") + ")");
            } else {
                logger.warning("[AI Monitor] Webhook Discord HTTP " + resp.statusCode() + " : " + resp.body());
            }
        } catch (Throwable t) {
            logger.warning("[AI Monitor] sendDiscordAlert erreur: " + t.getMessage());
        }
    }
}
