package sunanticheat.xray;

import org.bukkit.Bukkit;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Enregistre les données X-Ray jour par jour dans des fichiers log.
 * Conserve 2 semaines de données, puis supprime les fichiers plus anciens.
 */
public class XRayLogManager {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final String LOG_PREFIX = "xray-log-";
    private static final String LOG_SUFFIX = ".yml";

    private final JavaPlugin plugin;
    private final XRayTracker tracker;
    private final File logDirectory;

    public XRayLogManager(JavaPlugin plugin, XRayTracker tracker) {
        this.plugin = plugin;
        this.tracker = tracker;
        this.logDirectory = new File(plugin.getDataFolder(), "xray-logs");
    }

    private int getRetentionDays() {
        return Math.max(1, plugin.getConfig().getInt("xray-log.retention-days", 14));
    }

    /** Crée le dossier des logs si besoin, supprime les fichiers de plus de 2 semaines, charge le log du jour si présent. */
    public void onEnable() {
        if (!logDirectory.exists()) {
            logDirectory.mkdirs();
        }
        purgeOldLogs();
        loadTodayIfExists();
    }

    /** Sauvegarde les données actuelles dans le fichier du jour. */
    public void saveToday() {
        String dateStr = LocalDate.now().format(DATE_FORMAT);
        File file = new File(logDirectory, LOG_PREFIX + dateStr + LOG_SUFFIX);
        YamlConfiguration config = new YamlConfiguration();
        config.set("date", dateStr);

        for (Map.Entry<UUID, BlockMiningStats> e : tracker.getAllStats().entrySet()) {
            BlockMiningStats s = e.getValue();
            if (s.getTotal() == 0) continue;
            UUID uuid = e.getKey();
            String path = "players." + uuid.toString();
            String name = Bukkit.getOfflinePlayer(uuid).getName();
            config.set(path + ".name", name != null ? name : "?");
            config.set(path + ".diamond", s.getDiamondCount());
            config.set(path + ".iron", s.getIronCount());
            config.set(path + ".gold", s.getGoldCount());
            config.set(path + ".netherrack", s.getNetherrackCount());
            config.set(path + ".ancientDebris", s.getAncientDebrisCount());
            config.set(path + ".common", s.getCommonCount());
        }

        try {
            config.save(file);
        } catch (IOException ex) {
            plugin.getLogger().warning("Impossible de sauvegarder le log X-Ray: " + ex.getMessage());
        }
    }

    /** Charge le fichier du jour dans le tracker (cumul après redémarrage). */
    public void loadTodayIfExists() {
        String dateStr = LocalDate.now().format(DATE_FORMAT);
        File file = new File(logDirectory, LOG_PREFIX + dateStr + LOG_SUFFIX);
        if (!file.exists()) return;
        YamlConfiguration config = YamlConfiguration.loadConfiguration(file);
        Map<UUID, XRayTracker.DaySnapshot> snapshot = new HashMap<>();
        if (config.getConfigurationSection("players") == null) return;
        for (String key : config.getConfigurationSection("players").getKeys(false)) {
            try {
                UUID uuid = UUID.fromString(key);
                String p = "players." + key + ".";
                long diamond = config.getLong(p + "diamond", 0);
                long iron = config.getLong(p + "iron", 0);
                long gold = config.getLong(p + "gold", 0);
                long netherrack = config.getLong(p + "netherrack", 0);
                long ancientDebris = config.getLong(p + "ancientDebris", 0);
                long common = config.getLong(p + "common", 0);
                snapshot.put(uuid, new XRayTracker.DaySnapshot(diamond, iron, gold, netherrack, ancientDebris, common));
            } catch (IllegalArgumentException ignored) {
            }
        }
        if (!snapshot.isEmpty()) {
            tracker.loadSnapshot(snapshot);
        }
    }

    /** Supprime les fichiers de log plus anciens que la rétention configurée. */
    public void purgeOldLogs() {
        LocalDate cutoff = LocalDate.now().minusDays(getRetentionDays());
        File[] files = logDirectory.listFiles((dir, name) -> name.startsWith(LOG_PREFIX) && name.endsWith(LOG_SUFFIX));
        if (files == null) return;
        for (File f : files) {
            try {
                String dateStr = f.getName().substring(LOG_PREFIX.length(), f.getName().length() - LOG_SUFFIX.length());
                LocalDate fileDate = LocalDate.parse(dateStr, DATE_FORMAT);
                if (fileDate.isBefore(cutoff)) {
                    if (f.delete()) {
                        plugin.getLogger().info("Log X-Ray supprimé (rétention 2 semaines): " + f.getName());
                    }
                }
            } catch (Exception ignored) {
            }
        }
    }

    public File getLogDirectory() {
        return logDirectory;
    }
}
