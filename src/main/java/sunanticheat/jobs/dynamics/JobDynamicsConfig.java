package sunanticheat.jobs.dynamics;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.Plugin;

import java.io.*;
import java.util.*;
import java.util.logging.Logger;

/**
 * Charge {@code dynamics.yml} et expose les multiplicateurs de toutes les
 * mécaniques de monde dynamique : saisons, météo, cycle jour/nuit, heatmap,
 * évènements aléatoires, bulletin quotidien.
 *
 * Toute la configuration est rechargeable via {@link #reload()}.
 */
public final class JobDynamicsConfig {

    private final Plugin plugin;
    private final Logger logger;

    private boolean enabled = true;

    // seasons[seasonKey][jobId] = multiplier
    private final Map<String, Map<String, Double>> seasonMults = new HashMap<>();
    private boolean seasonsEnabled = true;

    // weather[state][jobId] = multiplier  (state: clear|rain|storm)
    private final Map<String, Map<String, Double>> weatherMults = new HashMap<>();
    private boolean weatherEnabled = true;

    // time[period][jobId] = multiplier  (period: day|night)
    private final Map<String, Map<String, Double>> timeMults = new HashMap<>();
    private boolean timeEnabled = true;

    private boolean heatmapEnabled  = true;
    private int     heatmapThreshold = 200;
    private double  heatmapMalus     = 0.5;
    private int     heatmapWindowMin = 60;
    private int     heatmapCooldownH = 6;

    private boolean eventsEnabled       = true;
    private int     eventsIntervalMin   = 30;
    private final Map<String, EventTemplate> eventTemplates = new LinkedHashMap<>();

    private boolean bulletinEnabled        = true;
    private int     bulletinRefreshHour    = 4;
    private double  bulletinMin            = 1.2;
    private double  bulletinMax            = 1.8;
    private String  bulletinMessage        = "&6📰 Bulletin du jour : &e{job} &6→ &a×{mult}";

    public JobDynamicsConfig(Plugin plugin, Logger logger) {
        this.plugin = plugin; this.logger = logger;
        reload();
    }

    public void reload() {
        seasonMults.clear(); weatherMults.clear(); timeMults.clear();
        eventTemplates.clear();

        File file = new File(plugin.getDataFolder(), "dynamics.yml");
        if (!file.exists()) {
            try (InputStream in = plugin.getResource("dynamics.yml")) {
                if (in != null) {
                    plugin.getDataFolder().mkdirs();
                    try (OutputStream out = new FileOutputStream(file)) { in.transferTo(out); }
                }
            } catch (IOException e) {
                logger.warning("[Jobs/Dynamics] Impossible de créer dynamics.yml : " + e.getMessage());
            }
        }
        if (!file.exists()) {
            logger.warning("[Jobs/Dynamics] dynamics.yml absent — dynamiques désactivées.");
            enabled = false;
            return;
        }

        YamlConfiguration cfg = YamlConfiguration.loadConfiguration(file);
        ConfigurationSection root = cfg.getConfigurationSection("dynamics");
        if (root == null) {
            logger.warning("[Jobs/Dynamics] section 'dynamics' absente — désactivées.");
            enabled = false; return;
        }
        enabled = root.getBoolean("enabled", true);

        // Seasons
        ConfigurationSection seasons = root.getConfigurationSection("seasons");
        if (seasons != null) {
            seasonsEnabled = seasons.getBoolean("enabled", true);
            ConfigurationSection mults = seasons.getConfigurationSection("multipliers");
            if (mults != null) for (String s : mults.getKeys(false)) {
                seasonMults.put(s.toLowerCase(), readJobMap(mults.getConfigurationSection(s)));
            }
        }

        // Weather
        ConfigurationSection weather = root.getConfigurationSection("weather");
        if (weather != null) {
            weatherEnabled = weather.getBoolean("enabled", true);
            for (String state : List.of("clear", "rain", "storm")) {
                weatherMults.put(state, readJobMap(weather.getConfigurationSection(state)));
            }
        }

        // Time
        ConfigurationSection time = root.getConfigurationSection("time");
        if (time != null) {
            timeEnabled = time.getBoolean("enabled", true);
            for (String p : List.of("day", "night")) {
                timeMults.put(p, readJobMap(time.getConfigurationSection(p)));
            }
        }

        // Heatmap
        ConfigurationSection hm = root.getConfigurationSection("heatmap");
        if (hm != null) {
            heatmapEnabled    = hm.getBoolean("enabled", true);
            heatmapThreshold  = hm.getInt("chunk-action-threshold", 200);
            heatmapMalus      = hm.getDouble("overuse-multiplier", 0.5);
            heatmapWindowMin  = hm.getInt("window-minutes", 60);
            heatmapCooldownH  = hm.getInt("cooldown-hours", 6);
        }

        // Events
        ConfigurationSection ev = root.getConfigurationSection("events");
        if (ev != null) {
            eventsEnabled     = ev.getBoolean("enabled", true);
            eventsIntervalMin = ev.getInt("interval-minutes", 30);
            ConfigurationSection types = ev.getConfigurationSection("types");
            if (types != null) for (String id : types.getKeys(false)) {
                ConfigurationSection es = types.getConfigurationSection(id);
                if (es == null) continue;
                eventTemplates.put(id, new EventTemplate(
                        id,
                        es.getInt("weight", 100),
                        es.getString("message", "&6Évènement métier !"),
                        es.getDouble("reward-money", 100),
                        es.getDouble("reward-xp", 100),
                        es.getString("target-job", null),
                        es.getInt("duration-seconds", 300)
                ));
            }
        }

        // Bulletin
        ConfigurationSection b = root.getConfigurationSection("bulletin");
        if (b != null) {
            bulletinEnabled     = b.getBoolean("enabled", true);
            bulletinRefreshHour = b.getInt("refresh-hour", 4);
            bulletinMin         = b.getDouble("bonus-multiplier-min", 1.2);
            bulletinMax         = b.getDouble("bonus-multiplier-max", 1.8);
            bulletinMessage     = b.getString("message",
                    "&6📰 Bulletin du jour : &e{job} &6→ &a×{mult}");
        }

        logger.info("[Jobs/Dynamics] Configuration chargée — saisons=" + seasonsEnabled
                + ", météo=" + weatherEnabled + ", heure=" + timeEnabled
                + ", heatmap=" + heatmapEnabled + ", events=" + eventsEnabled
                + " (" + eventTemplates.size() + " types), bulletin=" + bulletinEnabled);
    }

    private Map<String, Double> readJobMap(ConfigurationSection s) {
        Map<String, Double> m = new HashMap<>();
        if (s == null) return m;
        for (String k : s.getKeys(false)) m.put(k.toLowerCase(), s.getDouble(k, 1.0));
        return m;
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    public boolean enabled() { return enabled; }

    public boolean seasonsEnabled() { return seasonsEnabled; }
    public double  seasonMultiplier(Season season, String jobId) {
        Map<String, Double> m = seasonMults.get(season.configKey);
        if (m == null) return 1.0;
        return m.getOrDefault(jobId.toLowerCase(), 1.0);
    }

    public boolean weatherEnabled() { return weatherEnabled; }
    public double  weatherMultiplier(String state, String jobId) {
        Map<String, Double> m = weatherMults.get(state);
        if (m == null) return 1.0;
        return m.getOrDefault(jobId.toLowerCase(), 1.0);
    }

    public boolean timeEnabled() { return timeEnabled; }
    public double  timeMultiplier(String period, String jobId) {
        Map<String, Double> m = timeMults.get(period);
        if (m == null) return 1.0;
        return m.getOrDefault(jobId.toLowerCase(), 1.0);
    }

    public boolean heatmapEnabled()      { return heatmapEnabled; }
    public int     heatmapThreshold()    { return heatmapThreshold; }
    public double  heatmapMalus()        { return heatmapMalus; }
    public int     heatmapWindowMin()    { return heatmapWindowMin; }
    public int     heatmapCooldownH()    { return heatmapCooldownH; }

    public boolean eventsEnabled()      { return eventsEnabled; }
    public int     eventsIntervalMin()  { return eventsIntervalMin; }
    public Collection<EventTemplate> eventTemplates() { return eventTemplates.values(); }

    public boolean bulletinEnabled()     { return bulletinEnabled; }
    public int     bulletinRefreshHour() { return bulletinRefreshHour; }
    public double  bulletinMin()         { return bulletinMin; }
    public double  bulletinMax()         { return bulletinMax; }
    public String  bulletinMessage()     { return bulletinMessage; }

    public record EventTemplate(
            String  id,
            int     weight,
            String  message,
            double  rewardMoney,
            double  rewardXp,
            String  targetJob,
            int     durationSeconds
    ) {}
}
