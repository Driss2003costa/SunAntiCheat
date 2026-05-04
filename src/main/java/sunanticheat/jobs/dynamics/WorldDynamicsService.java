package sunanticheat.jobs.dynamics;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;
import sunanticheat.dashboard.db.Database;
import sunanticheat.jobs.CustomJobConfig;

import java.util.*;
import java.util.logging.Logger;

/**
 * Orchestre tous les sous-systèmes de monde dynamique :
 *  - Saisons          (Season)
 *  - Météo            (rain/storm/clear via Player.world.hasStorm/isThundering)
 *  - Cycle jour/nuit  (world.getTime())
 *  - Heatmap          (anti-surexploitation locale)
 *  - Évènements       (WorldEventManager)
 *  - Bulletin du jour (DailyBulletin)
 *
 * Expose {@link #computeMultiplier(Player, String, String)} qui retourne
 * une {@link MultiplierBreakdown} avec le détail de tous les bonus appliqués.
 */
public final class WorldDynamicsService {

    private final JavaPlugin plugin;
    private final Logger logger;
    private final JobDynamicsConfig cfg;
    private final HeatmapTracker heatmap;
    private final WorldEventManager events;
    private final DailyBulletin bulletin;

    private BukkitTask flushTask;
    private BukkitTask bulletinTask;

    /** In-memory overrides : clé = subsystem name, true = forcé actif, false = forcé inactif. */
    private final java.util.concurrent.ConcurrentHashMap<String, Boolean> subsystemOverrides
            = new java.util.concurrent.ConcurrentHashMap<>();

    public static final String SYS_GLOBAL   = "global";
    public static final String SYS_SEASONS  = "seasons";
    public static final String SYS_WEATHER  = "weather";
    public static final String SYS_TIME     = "time";
    public static final String SYS_HEATMAP  = "heatmap";
    public static final String SYS_EVENTS   = "events";
    public static final String SYS_BULLETIN = "bulletin";

    public WorldDynamicsService(JavaPlugin plugin, Database db,
                                  CustomJobConfig jobsCfg, Logger logger) {
        this.plugin = plugin; this.logger = logger;
        this.cfg      = new JobDynamicsConfig(plugin, logger);
        this.heatmap  = new HeatmapTracker(db, logger, cfg);
        this.events   = new WorldEventManager(plugin, logger, cfg, jobsCfg);
        this.bulletin = new DailyBulletin(cfg, jobsCfg);
    }

    public void start() {
        if (!cfg.enabled()) {
            logger.info("[Jobs/Dynamics] désactivé via config — bonus de monde inactifs.");
            return;
        }
        events.start();
        bulletin.tickRefresh(true);

        // Heatmap flush périodique
        flushTask = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin,
                heatmap::flush, 20L * 300, 20L * 300);

        // Bulletin refresh check toutes les 10 min
        bulletinTask = Bukkit.getScheduler().runTaskTimer(plugin,
                () -> bulletin.tickRefresh(true), 20L * 60 * 10, 20L * 60 * 10);
    }

    public void stop() {
        if (flushTask != null)    flushTask.cancel();
        if (bulletinTask != null) bulletinTask.cancel();
        events.stop();
        heatmap.flush();
    }

    public void reload() {
        cfg.reload();
        bulletin.tickRefresh(true);
    }

    // ── Admin toggles ─────────────────────────────────────────────────────────

    /** Force-active ou force-désactive un sous-système (en mémoire uniquement). */
    public void setSubsystemEnabled(String key, boolean enabled) {
        subsystemOverrides.put(key.toLowerCase(), enabled);
    }

    /** Réinitialise les overrides (reprise des valeurs YAML). */
    public void clearOverrides() { subsystemOverrides.clear(); }

    public boolean isSubsystemEnabled(String key) {
        Boolean override = subsystemOverrides.get(key.toLowerCase());
        if (override != null) return override;
        return switch (key.toLowerCase()) {
            case SYS_GLOBAL   -> cfg.enabled();
            case SYS_SEASONS  -> cfg.seasonsEnabled();
            case SYS_WEATHER  -> cfg.weatherEnabled();
            case SYS_TIME     -> cfg.timeEnabled();
            case SYS_HEATMAP  -> cfg.heatmapEnabled();
            case SYS_EVENTS   -> cfg.eventsEnabled();
            case SYS_BULLETIN -> cfg.bulletinEnabled();
            default -> true;
        };
    }

    public Map<String, Object> subsystemStates() {
        Map<String, Object> m = new LinkedHashMap<>();
        for (String key : List.of(SYS_GLOBAL, SYS_SEASONS, SYS_WEATHER, SYS_TIME, SYS_HEATMAP, SYS_EVENTS, SYS_BULLETIN)) {
            m.put(key, isSubsystemEnabled(key));
        }
        return m;
    }

    /** Vide la heatmap en mémoire + en DB. */
    public void clearHeatmap() { heatmap.clearAll(); }

    /** Force un refresh du bulletin (tire un nouveau job du jour + broadcast). */
    public void forceBulletinRefresh() {
        bulletin.forceRefresh(true);
    }

    /**
     * Calcule le multiplicateur final à appliquer à une action métier.
     * Combine saison, météo, jour/nuit, heatmap, bulletin.
     * Ne consomme PAS les évènements (cf. {@link #claimEventReward}).
     */
    public MultiplierBreakdown computeMultiplier(Player player, String jobId, String actionType) {
        return computeMultiplier(player, jobId, actionType, false);
    }

    /** Variante avec bypass heatmap (ticket admin). */
    public MultiplierBreakdown computeMultiplier(Player player, String jobId, String actionType, boolean bypassHeatmap) {
        MultiplierBreakdown b = new MultiplierBreakdown();
        if (!isSubsystemEnabled(SYS_GLOBAL)) return b;

        // Season
        if (isSubsystemEnabled(SYS_SEASONS)) {
            Season s = Season.current();
            double mult = cfg.seasonMultiplier(s, jobId);
            if (mult != 1.0) b.add(s.icon + " " + s.label, mult);
        }

        // Weather
        if (isSubsystemEnabled(SYS_WEATHER) && player != null) {
            World w = player.getWorld();
            String state = w.isThundering() ? "storm" : w.hasStorm() ? "rain" : "clear";
            double mult = cfg.weatherMultiplier(state, jobId);
            if (mult != 1.0) {
                String label = switch (state) {
                    case "storm" -> "⚡ Orage";
                    case "rain"  -> "🌧 Pluie";
                    default       -> "☀ Beau temps";
                };
                b.add(label, mult);
            }
        }

        // Day / night
        if (isSubsystemEnabled(SYS_TIME) && player != null) {
            long t = player.getWorld().getTime();
            String period = (t >= 13000 && t < 23000) ? "night" : "day";
            double mult = cfg.timeMultiplier(period, jobId);
            if (mult != 1.0) b.add(period.equals("night") ? "🌙 Nuit" : "🌞 Jour", mult);
        }

        // Heatmap (skipped if the player holds a bypass_heatmap ticket)
        if (isSubsystemEnabled(SYS_HEATMAP) && player != null && !bypassHeatmap) {
            Location loc = player.getLocation();
            int cx = loc.getBlockX() >> 4;
            int cz = loc.getBlockZ() >> 4;
            String world = player.getWorld().getName();
            // record action; if returns true, chunk is under penalty
            boolean overused = heatmap.recordAndCheck(world, cx, cz, jobId);
            if (overused) b.add("🔥 Zone surexploitée", cfg.heatmapMalus());
        }

        // Daily bulletin
        if (isSubsystemEnabled(SYS_BULLETIN)) {
            double mult = bulletin.multiplierFor(jobId);
            if (mult != 1.0) b.add("📰 Demande du jour", mult);
        }
        return b;
    }

    /**
     * À appeler après le calcul du multiplicateur si une récompense d'évènement
     * doit être consommée. Retourne null si aucun évènement actif pour ce job.
     */
    public WorldEventManager.ActiveEvent claimEventReward(Player player, String jobId) {
        if (!isSubsystemEnabled(SYS_EVENTS)) return null;
        return events.claimIfPresent(player, jobId);
    }

    // ── State snapshot for API/portal ────────────────────────────────────────

    public Map<String, Object> snapshot() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enabled",    isSubsystemEnabled(SYS_GLOBAL));
        m.put("subsystems", subsystemStates());

        Map<String, Object> season = new LinkedHashMap<>();
        Season s = Season.current();
        season.put("key",   s.configKey);
        season.put("label", s.label);
        season.put("icon",  s.icon);
        m.put("season", season);

        Map<String, Object> bul = new LinkedHashMap<>();
        bul.put("job_id",       bulletin.currentJobId());
        bul.put("multiplier",   bulletin.currentMult());
        bul.put("refreshed_at", bulletin.refreshedAt());
        m.put("bulletin", bul);

        List<Map<String, Object>> evs = new ArrayList<>();
        for (var ev : events.active()) {
            Map<String, Object> em = new LinkedHashMap<>();
            em.put("id",          ev.id());
            em.put("target_job",  ev.targetJob());
            em.put("reward_xp",   ev.rewardXp());
            em.put("reward_money",ev.rewardMoney());
            em.put("started_at",  ev.startedAt());
            em.put("ends_at",     ev.endsAt());
            evs.add(em);
        }
        m.put("active_events", evs);
        return m;
    }

    // Getters
    public JobDynamicsConfig config()    { return cfg; }
    public HeatmapTracker heatmap()      { return heatmap; }
    public DailyBulletin bulletin()      { return bulletin; }
    public WorldEventManager events()    { return events; }
}
