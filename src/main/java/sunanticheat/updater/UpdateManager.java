package sunanticheat.updater;

import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.mobile.PushService;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.logging.Logger;

/**
 * Orchestrateur de l'auto-update.
 *
 * Cycle complet :
 *   1. Démarrage → handlePostUpdateMigration() détecte un changement de version
 *      et migre les configs si besoin.
 *   2. Vérification périodique (async) → fetchLatest() depuis GitHub.
 *   3. Si nouvelle version : téléchargement en tâche async + vérification SHA-256.
 *   4. Arrêt du serveur → applyUpdate() remplace atomiquement le JAR actuel
 *      par le nouveau (prise d'effet au prochain démarrage).
 */
public final class UpdateManager {

    private static final String PENDING_FILE   = ".update_pending";
    private static final String LAST_VER_FILE  = ".last-version";
    private static final String UPDATE_JAR     = "SunAntiCheat-UPDATE.jar";

    private final JavaPlugin plugin;
    private final Logger logger;

    private final String currentVersion;
    private volatile String latestVersion;
    private volatile boolean updateAvailable    = false;
    private volatile boolean downloadedPending  = false;
    private volatile boolean checking           = false;

    public UpdateManager(JavaPlugin plugin) {
        this.plugin         = plugin;
        this.logger         = plugin.getLogger();
        this.currentVersion = plugin.getDescription().getVersion();
    }

    // ── Démarrage ────────────────────────────────────────────────────────────

    public void start() {
        handlePostUpdateMigration();

        if (!plugin.getConfig().getBoolean("auto-update.enabled", true)) {
            logger.info("[AutoUpdate] Désactivé (auto-update.enabled: false dans config.yml).");
            return;
        }

        int intervalMin = Math.max(5, plugin.getConfig().getInt("auto-update.check-interval-minutes", 30));
        long intervalTicks = 20L * 60 * intervalMin;

        // Premier check 1 minute après le démarrage
        Bukkit.getScheduler().runTaskLaterAsynchronously(plugin, this::checkAndDownload, 20L * 60);
        // Checks périodiques
        Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::checkAndDownload,
                intervalTicks, intervalTicks);
    }

    // ── Arrêt : remplace le JAR avant extinction du serveur ─────────────────

    public void applyUpdate() {
        File pendingFile = pendingMarker();
        if (!pendingFile.exists()) return;

        File pluginsDir = getPluginsDir();
        if (pluginsDir == null) return;
        File updateJar = new File(pluginsDir, UPDATE_JAR);
        if (!updateJar.exists()) { pendingFile.delete(); return; }

        File currentJar = getPluginJarFile();
        if (currentJar == null) {
            logger.warning("[AutoUpdate] Impossible de localiser le JAR actuel — remplacement ignoré.");
            return;
        }

        try {
            Files.move(updateJar.toPath(), currentJar.toPath(),
                    StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            logger.info("[AutoUpdate] JAR remplacé : " + currentJar.getName()
                    + " — la nouvelle version sera active au prochain démarrage.");
        } catch (IOException e) {
            // ATOMIC_MOVE peut échouer si les chemins ne sont pas sur la même partition
            // (très rare dans un dossier plugins/) — fallback non-atomique
            try {
                Files.copy(updateJar.toPath(), currentJar.toPath(), StandardCopyOption.REPLACE_EXISTING);
                updateJar.delete();
                logger.info("[AutoUpdate] JAR remplacé (copie) : " + currentJar.getName());
            } catch (IOException ex) {
                logger.warning("[AutoUpdate] Impossible de remplacer le JAR : " + ex.getMessage()
                        + " — mise à jour manuelle requise.");
            }
        }
    }

    // ── Vérification + téléchargement (async) ───────────────────────────────

    public void checkAndDownload() {
        if (checking) return;
        checking = true;
        try {
            UpdateChecker.LatestRelease latest = UpdateChecker.fetchLatest();
            latestVersion = latest.version();

            if (!UpdateChecker.isNewer(currentVersion, latestVersion)) {
                updateAvailable = false;
                return;
            }
            updateAvailable = true;
            logger.info("[AutoUpdate] Nouvelle version disponible : v" + latestVersion
                    + "  (actuelle : v" + currentVersion + ")");

            // Déjà téléchargée pour cette version ?
            File pending = pendingMarker();
            if (pending.exists()) {
                try {
                    String pendingVer = Files.readString(pending.toPath(), StandardCharsets.UTF_8).trim();
                    if (pendingVer.equals(latestVersion)) {
                        downloadedPending = true;
                        logger.info("[AutoUpdate] v" + latestVersion
                                + " déjà téléchargée — en attente d'un redémarrage.");
                        return;
                    }
                } catch (IOException ignored) {}
            }

            downloadUpdate(latest);
        } catch (Exception e) {
            logger.warning("[AutoUpdate] Vérification impossible : " + e.getMessage());
        } finally {
            checking = false;
        }
    }

    private void downloadUpdate(UpdateChecker.LatestRelease latest) {
        File pluginsDir = getPluginsDir();
        if (pluginsDir == null) { logger.warning("[AutoUpdate] plugins/ introuvable."); return; }

        File updateJar = new File(pluginsDir, UPDATE_JAR);
        try {
            logger.info("[AutoUpdate] Téléchargement de v" + latest.version() + "...");
            JarDownloader.download(latest.jarUrl(), updateJar);
            long kb = updateJar.length() / 1024;
            logger.info("[AutoUpdate] Téléchargement terminé (" + kb + " KB).");

            // Vérification SHA-256 (fichier .sha256 attaché à la release)
            String sha256Url = latest.jarUrl().replaceFirst("\\.jar$", ".sha256");
            String expected  = JarDownloader.fetchExpectedSha256(sha256Url);
            if (expected != null) {
                String actual = JarDownloader.sha256(updateJar);
                if (!actual.equalsIgnoreCase(expected)) {
                    updateJar.delete();
                    logger.severe("[AutoUpdate] SHA-256 invalide ! Téléchargement rejeté "
                            + "(attendu=" + expected + ", reçu=" + actual + ").");
                    return;
                }
                logger.info("[AutoUpdate] SHA-256 OK.");
            } else {
                logger.info("[AutoUpdate] Pas de fichier .sha256 dans la release — vérification ignorée.");
            }

            Files.writeString(pendingMarker().toPath(), latest.version(), StandardCharsets.UTF_8);
            downloadedPending = true;
            logger.info("[AutoUpdate] v" + latest.version()
                    + " prête — sera appliquée au prochain redémarrage du serveur.");

            notifyAdmins(latest.version());
        } catch (Exception e) {
            if (updateJar.exists()) updateJar.delete();
            logger.warning("[AutoUpdate] Erreur téléchargement : " + e.getMessage());
        }
    }

    // ── Migration post-update (appelée au démarrage) ─────────────────────────

    private void handlePostUpdateMigration() {
        File lastVerFile = new File(plugin.getDataFolder(), LAST_VER_FILE);
        String lastVersion = null;
        if (lastVerFile.exists()) {
            try { lastVersion = Files.readString(lastVerFile.toPath(), StandardCharsets.UTF_8).trim(); }
            catch (IOException ignored) {}
        }

        boolean versionChanged = lastVersion != null && !lastVersion.equals(currentVersion);
        if (versionChanged) {
            logger.info("[AutoUpdate] Mise à jour appliquée : v" + lastVersion + " → v" + currentVersion);
            backupConfig(lastVersion);
            File jar = getPluginJarFile();
            if (jar != null) ConfigMigrator.migrate(jar, plugin.getDataFolder(), logger);
        }

        // Mettre à jour le marqueur de version
        try { Files.writeString(lastVerFile.toPath(), currentVersion, StandardCharsets.UTF_8); }
        catch (IOException ignored) {}

        // Nettoyer le marqueur de téléchargement en attente
        pendingMarker().delete();
        downloadedPending = false;
    }

    private void backupConfig(String fromVersion) {
        try {
            File backupDir = new File(plugin.getDataFolder(), "config-backups");
            backupDir.mkdirs();
            File src = new File(plugin.getDataFolder(), "config.yml");
            if (!src.exists()) return;
            File dst = new File(backupDir, "config-v" + fromVersion.replace('.', '_') + ".yml");
            Files.copy(src.toPath(), dst.toPath(), StandardCopyOption.REPLACE_EXISTING);
            logger.info("[AutoUpdate] Backup config sauvegardé : " + dst.getName());
        } catch (IOException e) {
            logger.warning("[AutoUpdate] Backup config échoué : " + e.getMessage());
        }
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    private void notifyAdmins(String newVersion) {
        try {
            PushService push = PushService.get();
            if (push != null) {
                push.broadcast(
                        "🔄 SunAntiCheat v" + newVersion + " disponible",
                        "Redémarrez le serveur pour appliquer la mise à jour.",
                        "default");
            }
        } catch (Throwable ignored) {}
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public File getPluginJarFile() {
        try {
            Method m = JavaPlugin.class.getDeclaredMethod("getFile");
            m.setAccessible(true);
            return (File) m.invoke(plugin);
        } catch (Exception e) {
            return null;
        }
    }

    private File getPluginsDir() {
        File jar = getPluginJarFile();
        return jar != null ? jar.getParentFile() : null;
    }

    private File pendingMarker() {
        return new File(plugin.getDataFolder(), PENDING_FILE);
    }

    // ── Accesseurs pour UpdateHandler ─────────────────────────────────────────

    public String getCurrentVersion()  { return currentVersion; }
    public String getLatestVersion()   { return latestVersion; }
    public boolean isUpdateAvailable() { return updateAvailable; }
    public boolean isDownloadedPending() { return downloadedPending; }

    /** Force une vérification immédiate (appelée depuis le dashboard). */
    public void triggerCheck() {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, this::checkAndDownload);
    }
}
