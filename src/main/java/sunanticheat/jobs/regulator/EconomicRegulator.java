package sunanticheat.jobs.regulator;

import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;
import sunanticheat.dashboard.db.Database;
import sunanticheat.jobs.CustomJobConfig;
import sunanticheat.jobs.CustomJobStore;

import java.io.File;
import java.io.IOException;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Régulateur économique adaptatif.
 *
 * Toutes les heures (configurable), observe la distribution des joueurs
 * par métier dans {@code custom_job_players}. Pour chaque métier, calcule
 * une part {@code share = uniquePlayers / total}. Compare à la moyenne
 * (1/N) et applique une correction lissée :
 *
 *   raw    = clamp(1 - (share - mean) / mean * aggressiveness, 0.7, 1.4)
 *   smooth = (1 - alpha) * previous + alpha * raw       (alpha = 0.4)
 *
 * Le multiplier est appliqué dans {@code CustomJobService.processAction}
 * comme un facteur supplémentaire (jobMult) au même titre que les
 * dynamiques de monde.
 *
 * Persiste l'historique dans {@code custom_job_regulator} pour la courbe
 * 30j côté admin.
 *
 * Override admin : {@code freezeMultiplier(jobId, mult)} fixe une valeur
 * jusqu'à libération via {@code clearFreeze(jobId)}.
 */
public final class EconomicRegulator {

    private static final double MIN_MULT = 0.7;
    private static final double MAX_MULT = 1.4;
    private static final double SMOOTH_ALPHA = 0.4;

    private final Plugin plugin;
    private final Database db;
    private final CustomJobStore store;
    private final CustomJobConfig cfgRef;
    private final Logger logger;

    /** Live multipliers per job id. */
    private final Map<String, Double> multipliers = new ConcurrentHashMap<>();
    /** Manually frozen multipliers (admin override). */
    private final Map<String, Double> frozen      = new ConcurrentHashMap<>();
    /** Latest distribution share per job (debug + UI). */
    private final Map<String, Double> shares      = new ConcurrentHashMap<>();

    private volatile boolean enabled        = true;
    private volatile double  aggressiveness = 0.5;   // 0 = no effect, 1 = full
    private volatile long    lastTickAt     = 0;

    private BukkitTask tickTask;

    public EconomicRegulator(Plugin plugin, Database db, CustomJobStore store, CustomJobConfig cfg, Logger logger) {
        this.plugin = plugin;
        this.db     = db;
        this.store  = store;
        this.cfgRef = cfg;
        this.logger = logger;
        loadConfig();
    }

    /** Live multiplier for a job (frozen takes precedence, else smoothed value, else 1.0). */
    public double multiplierFor(String jobId) {
        if (!enabled) return 1.0;
        Double f = frozen.get(jobId);
        if (f != null) return f;
        return multipliers.getOrDefault(jobId, 1.0);
    }

    public boolean isEnabled()             { return enabled; }
    public double  aggressiveness()        { return aggressiveness; }
    public Map<String, Double> snapshot()  { return new LinkedHashMap<>(multipliers); }
    public Map<String, Double> shareMap()  { return new LinkedHashMap<>(shares); }
    public Map<String, Double> frozenMap() { return new LinkedHashMap<>(frozen); }
    public long lastTickAt()               { return lastTickAt; }

    public void setEnabled(boolean v)               { this.enabled = v; saveConfig(); }
    public void setAggressiveness(double v)         {
        this.aggressiveness = Math.max(0, Math.min(1, v));
        saveConfig();
    }
    public void freezeMultiplier(String jobId, double mult) {
        frozen.put(jobId, Math.max(MIN_MULT, Math.min(MAX_MULT, mult)));
        saveConfig();
    }
    public void clearFreeze(String jobId) { frozen.remove(jobId); saveConfig(); }

    /** Manually trigger a recalculation (admin button). */
    public void tickNow() { Bukkit.getScheduler().runTaskAsynchronously(plugin, this::tick); }

    public void start() {
        // Run every hour starting 5min after server up.
        long delay  = 20L * 60 * 5;       // 5 min
        long period = 20L * 60 * 60;      // 1 h
        tickTask = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::tick, delay, period);
    }

    public void stop() {
        if (tickTask != null) tickTask.cancel();
        tickTask = null;
        saveConfig();
    }

    private void tick() {
        try {
            Map<String, Integer> dist = store.jobDistribution();
            int totalSlots = dist.values().stream().mapToInt(Integer::intValue).sum();
            if (totalSlots == 0) { lastTickAt = System.currentTimeMillis(); return; }

            int jobCount = Math.max(1, cfgRef.getJobs().size());
            double mean = 1.0 / jobCount;
            long now = System.currentTimeMillis();

            for (String jobId : cfgRef.getJobs().keySet()) {
                int n = dist.getOrDefault(jobId, 0);
                double share = (double) n / totalSlots;
                shares.put(jobId, share);

                // Over-populated → multiplier < 1 ; under → > 1.
                double raw = 1.0 - ((share - mean) / Math.max(0.001, mean)) * aggressiveness;
                raw = Math.max(MIN_MULT, Math.min(MAX_MULT, raw));

                double prev = multipliers.getOrDefault(jobId, 1.0);
                double smooth = (1.0 - SMOOTH_ALPHA) * prev + SMOOTH_ALPHA * raw;
                multipliers.put(jobId, smooth);

                persistRow(now, jobId, share, smooth);
            }
            lastTickAt = now;
        } catch (Exception e) {
            logger.warning("[Regulator] tick: " + e.getMessage());
        }
    }

    private void persistRow(long ts, String jobId, double share, double mult) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "REPLACE INTO custom_job_regulator(ts,job_id,share,multiplier) VALUES(?,?,?,?)")) {
            ps.setLong(1, ts);
            ps.setString(2, jobId);
            ps.setDouble(3, share);
            ps.setDouble(4, mult);
            ps.executeUpdate();
        } catch (SQLException e) { logger.warning("[Regulator] persist: " + e.getMessage()); }
    }

    /** History rows for the last `days` days. */
    public List<Map<String, Object>> history(int days) {
        long since = System.currentTimeMillis() - days * 86_400_000L;
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT ts,job_id,share,multiplier FROM custom_job_regulator WHERE ts >= ? ORDER BY ts ASC")) {
            ps.setLong(1, since);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("ts",         rs.getLong("ts"));
                    m.put("job_id",     rs.getString("job_id"));
                    m.put("share",      rs.getDouble("share"));
                    m.put("multiplier", rs.getDouble("multiplier"));
                    out.add(m);
                }
            }
        } catch (SQLException e) { logger.warning("[Regulator] history: " + e.getMessage()); }
        return out;
    }

    // ── Config persistence (regulator.yml) ────────────────────────────────────

    private File configFile() {
        return new File(plugin.getDataFolder(), "regulator.yml");
    }

    private void loadConfig() {
        File f = configFile();
        if (!f.exists()) return;
        org.bukkit.configuration.file.YamlConfiguration y =
                org.bukkit.configuration.file.YamlConfiguration.loadConfiguration(f);
        this.enabled        = y.getBoolean("enabled", true);
        this.aggressiveness = y.getDouble("aggressiveness", 0.5);
        if (y.isConfigurationSection("frozen")) {
            for (String k : y.getConfigurationSection("frozen").getKeys(false)) {
                frozen.put(k, y.getDouble("frozen." + k));
            }
        }
    }

    private synchronized void saveConfig() {
        org.bukkit.configuration.file.YamlConfiguration y =
                new org.bukkit.configuration.file.YamlConfiguration();
        y.set("enabled", enabled);
        y.set("aggressiveness", aggressiveness);
        for (Map.Entry<String, Double> e : frozen.entrySet()) {
            y.set("frozen." + e.getKey().toLowerCase(Locale.ROOT), e.getValue());
        }
        try {
            plugin.getDataFolder().mkdirs();
            y.save(configFile());
        } catch (IOException e) {
            logger.warning("[Regulator] saveConfig: " + e.getMessage());
        }
    }
}
