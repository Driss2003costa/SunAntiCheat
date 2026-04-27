package sunanticheat.dashboard.update;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Vérifie GitHub Releases et télécharge le nouveau JAR dans `plugins/update/`
 * si disponible. Paper applique automatiquement le remplacement au prochain
 * redémarrage du serveur.
 *
 * Configuration (config.yml) :
 * <pre>
 * dashboard:
 *   auto-update:
 *     enabled: true
 *     repo: "Driss2003costa/SunAntiCheat"
 *     check-interval-hours: 6      # 0 = check seulement au boot
 *     prerelease: false            # ignore les pre-releases (alpha/beta)
 * </pre>
 *
 * Sécurité :
 *   - Toutes les opérations HTTP sont async
 *   - Validation du nom de fichier avant téléchargement (pas de path traversal)
 *   - Pas d'écriture si la version est ≤ courante
 *   - Le JAR est écrit dans plugins/update/ (mécanisme natif Bukkit)
 *
 * État connu de Paper :
 *   - Au shutdown propre, Paper move tout fichier de plugins/update/<NAME>.jar
 *     vers plugins/<NAME>.jar (en remplaçant) si le nom de plugin matche.
 *   - Le mécanisme n'a pas besoin de signing — Paper se base sur le name défini
 *     dans plugin.yml du JAR téléchargé.
 */
public final class AutoUpdater {

    private final JavaPlugin plugin;
    private final Logger logger;
    private final String repo;          // "owner/repo"
    private final String token;         // PAT GitHub (optionnel, requis pour repos privés)
    private final boolean allowPrerelease;
    private final long checkIntervalMs;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private volatile boolean stopping = false;

    public AutoUpdater(JavaPlugin plugin, String repo, String token, boolean allowPrerelease, long checkIntervalMs) {
        this.plugin = plugin;
        this.logger = plugin.getLogger();
        this.repo = repo;
        this.token = (token != null && !token.isBlank()) ? token : null;
        this.allowPrerelease = allowPrerelease;
        this.checkIntervalMs = checkIntervalMs;
    }

    /** Lance le check au boot + planifie les checks périodiques. */
    public void start() {
        // Premier check après 30s (laisse le serveur finir de boot)
        plugin.getServer().getScheduler().runTaskLaterAsynchronously(plugin, this::checkAndUpdate, 20L * 30);

        // Checks périodiques (si configuré)
        if (checkIntervalMs > 0) {
            long ticks = checkIntervalMs / 50; // 1 tick = 50ms
            plugin.getServer().getScheduler().runTaskTimerAsynchronously(plugin, () -> {
                if (!stopping) checkAndUpdate();
            }, ticks, ticks);
        }
    }

    public void stop() { stopping = true; }

    /** Vérifie GitHub et télécharge si une nouvelle version est dispo. */
    public void checkAndUpdate() {
        try {
            JsonObject release = fetchLatestRelease();
            if (release == null) return;

            String tagName = optString(release, "tag_name");
            if (tagName == null) return;
            String latestVersion = tagName.startsWith("v") ? tagName.substring(1) : tagName;
            String currentVersion = plugin.getDescription().getVersion();

            if (compareVersions(latestVersion, currentVersion) <= 0) {
                logger.info("[AutoUpdate] Plugin à jour (v" + currentVersion + ")");
                return;
            }

            // Nouvelle version dispo — trouve l'asset .jar
            JsonArray assets = release.has("assets") && release.get("assets").isJsonArray()
                    ? release.getAsJsonArray("assets") : null;
            if (assets == null) {
                logger.warning("[AutoUpdate] Release " + tagName + " n'a aucun asset");
                return;
            }

            String jarUrl = null;
            String jarName = null;
            for (JsonElement el : assets) {
                JsonObject asset = el.getAsJsonObject();
                String name = optString(asset, "name");
                if (name != null && name.endsWith(".jar")) {
                    // Pour repo privé : on doit passer par l'API URL avec
                    // Authorization + Accept: application/octet-stream
                    // (browser_download_url ne marche pas avec un PAT).
                    // Pour repo public : les deux fonctionnent, on prend l'API
                    // URL pour cohérence.
                    jarUrl = optString(asset, "url");           // API URL
                    if (jarUrl == null || token == null) {
                        // Fallback browser_download_url si pas de token
                        jarUrl = optString(asset, "browser_download_url");
                    }
                    jarName = name;
                    break;
                }
            }
            if (jarUrl == null) {
                logger.warning("[AutoUpdate] Aucun asset .jar dans la release " + tagName);
                return;
            }

            // Validation nom de fichier (anti path-traversal)
            if (!isSafeFilename(jarName)) {
                logger.warning("[AutoUpdate] Nom de fichier suspect : " + jarName);
                return;
            }

            logger.info("[AutoUpdate] Mise à jour disponible : "
                + currentVersion + " → " + latestVersion + " (" + jarName + ")");

            // Téléchargement vers plugins/update/<jarName>
            File updateDir = new File(plugin.getDataFolder().getParentFile(), "update");
            if (!updateDir.exists() && !updateDir.mkdirs()) {
                logger.warning("[AutoUpdate] Impossible de créer plugins/update/");
                return;
            }
            File target = new File(updateDir, jarName);
            downloadTo(jarUrl, target);

            logger.info("[AutoUpdate] ✅ JAR téléchargé : " + target.getAbsolutePath());
            logger.info("[AutoUpdate] La mise à jour sera appliquée au prochain redémarrage.");
        } catch (Throwable t) {
            logger.log(Level.WARNING, "[AutoUpdate] Échec du check : " + t.getMessage(), t);
        }
    }

    private JsonObject fetchLatestRelease() throws IOException, InterruptedException {
        // L'API "/releases/latest" retourne uniquement les releases stables.
        // Pour inclure les pre-releases on liste toutes les releases et on prend la première
        // qui matche notre critère.
        String url = allowPrerelease
                ? "https://api.github.com/repos/" + repo + "/releases?per_page=10"
                : "https://api.github.com/repos/" + repo + "/releases/latest";

        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .header("User-Agent", "SunAntiCheat-AutoUpdater")
                .timeout(Duration.ofSeconds(15))
                .GET();
        if (token != null) b.header("Authorization", "Bearer " + token);
        HttpRequest req = b.build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() == 404) {
            // Soit le repo n'existe pas, soit il est privé sans token
            if (token == null) {
                logger.warning("[AutoUpdate] " + repo + " inaccessible (404). Si le repo est privé, "
                    + "ajoute un Personal Access Token dans dashboard.auto-update.github-token.");
            } else {
                logger.warning("[AutoUpdate] " + repo + " : pas de release ou token sans permission "
                    + "« contents:read ».");
            }
            return null;
        }
        if (res.statusCode() == 401 || res.statusCode() == 403) {
            logger.warning("[AutoUpdate] Token GitHub invalide ou sans permission (HTTP "
                + res.statusCode() + ")");
            return null;
        }
        if (res.statusCode() != 200) {
            logger.warning("[AutoUpdate] GitHub a renvoyé " + res.statusCode() + " : " + res.body());
            return null;
        }

        JsonElement parsed = JsonParser.parseString(res.body());
        if (allowPrerelease && parsed.isJsonArray()) {
            for (JsonElement el : parsed.getAsJsonArray()) {
                JsonObject rel = el.getAsJsonObject();
                if (rel.has("draft") && rel.get("draft").getAsBoolean()) continue;
                return rel; // première = la plus récente
            }
            return null;
        }
        return parsed.getAsJsonObject();
    }

    private void downloadTo(String url, File target) throws IOException, InterruptedException {
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create(url))
                // Accept: application/octet-stream → demande le binaire (pas le JSON metadata)
                // Sur l'API URL d'un asset, GitHub redirige alors vers une URL signée S3 que
                // notre HttpClient suit (Redirect.NORMAL).
                .header("Accept", "application/octet-stream")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .header("User-Agent", "SunAntiCheat-AutoUpdater")
                .timeout(Duration.ofMinutes(5))
                .GET();
        if (token != null) b.header("Authorization", "Bearer " + token);
        HttpRequest req = b.build();

        HttpResponse<InputStream> res = http.send(req, HttpResponse.BodyHandlers.ofInputStream());
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new IOException("Download HTTP " + res.statusCode());
        }
        try (InputStream in = res.body()) {
            Files.copy(in, target.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static boolean isSafeFilename(String name) {
        if (name == null || name.isBlank()) return false;
        if (name.contains("/") || name.contains("\\") || name.contains("..")) return false;
        return name.endsWith(".jar");
    }

    private static String optString(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) return null;
        try { return o.get(key).getAsString(); } catch (Exception e) { return null; }
    }

    /**
     * Compare deux versions semver-like (ex "2.1.1" vs "2.0.5").
     * @return >0 si a > b, 0 si égal, <0 si a < b
     */
    static int compareVersions(String a, String b) {
        if (a == null) a = "0";
        if (b == null) b = "0";
        // Strip suffix éventuel (ex "-pre1") pour ne comparer que la partie numérique
        a = a.split("[^0-9.]")[0];
        b = b.split("[^0-9.]")[0];
        String[] pa = a.split("\\.");
        String[] pb = b.split("\\.");
        int len = Math.max(pa.length, pb.length);
        for (int i = 0; i < len; i++) {
            int va = i < pa.length ? parseInt(pa[i]) : 0;
            int vb = i < pb.length ? parseInt(pb[i]) : 0;
            if (va != vb) return Integer.compare(va, vb);
        }
        return 0;
    }

    private static int parseInt(String s) {
        try { return Integer.parseInt(s); }
        catch (Exception e) { return 0; }
    }
}
