package sunanticheat.jobs;

import net.milkbowl.vault.economy.Economy;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import net.kyori.adventure.text.Component;
import sunanticheat.jobs.dynamics.MultiplierBreakdown;
import sunanticheat.jobs.dynamics.WorldDynamicsService;
import sunanticheat.jobs.dynamics.WorldEventManager;
import sunanticheat.jobs.polish.ComboTracker;
import sunanticheat.jobs.polish.JobActionBarService;
import sunanticheat.jobs.polish.JobBossBarService;
import sunanticheat.jobs.polish.JobFxService;
import sunanticheat.jobs.polish.JobTitlesService;
import sunanticheat.jobs.regulator.EconomicRegulator;
import sunanticheat.jobs.tickets.JobTicketService;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

public final class CustomJobService {

    private final CustomJobConfig config;
    private final CustomJobStore store;
    private final Economy economy;
    private final Logger logger;

    // Optional polish + dynamics layers (set by module after construction).
    private WorldDynamicsService dynamics;
    private JobBossBarService    bossBarService;
    private JobActionBarService  actionBarService;
    private JobFxService         fxService;
    private JobTitlesService     titlesService;
    private ComboTracker         comboTracker;
    private JobTicketService     tickets;
    private EconomicRegulator    regulator;

    // Anti-farm: uuid+jobId+target -> last reward timestamp
    private final Map<String, Long> antiFarmMap = new ConcurrentHashMap<>();

    public CustomJobService(CustomJobConfig config, CustomJobStore store,
                             Economy economy, Logger logger) {
        this.config  = config;
        this.store   = store;
        this.economy = economy;
        this.logger  = logger;
    }

    /** Branche les services de polish + dynamiques. Appelé une fois par {@code CustomJobModule}. */
    public void attachExtensions(WorldDynamicsService dynamics,
                                  JobBossBarService bossBar,
                                  JobActionBarService actionBar,
                                  JobFxService fx,
                                  JobTitlesService titles,
                                  ComboTracker combos,
                                  JobTicketService tickets,
                                  EconomicRegulator regulator) {
        this.dynamics         = dynamics;
        this.bossBarService   = bossBar;
        this.actionBarService = actionBar;
        this.fxService        = fx;
        this.titlesService    = titles;
        this.comboTracker     = combos;
        this.tickets          = tickets;
        this.regulator        = regulator;
    }

    public JobTicketService tickets()       { return tickets; }
    public EconomicRegulator regulator()    { return regulator; }

    public enum JoinResult { OK, ALREADY_IN, NOT_FOUND, DISABLED, NO_SLOT }

    /** Online-player join (with messages). */
    public boolean join(Player player, String jobId) {
        JoinResult r = tryJoin(player.getUniqueId().toString(), jobId);
        switch (r) {
            case OK -> sendMsg(player, "§a✔ Tu as rejoint le métier §e" + config.getJob(jobId).name() + "§a !");
            case ALREADY_IN -> sendMsg(player, "§eTu es déjà dans ce métier.");
            case NOT_FOUND  -> sendMsg(player, "§cMétier introuvable.");
            case DISABLED   -> sendMsg(player, "§cCe métier est actuellement désactivé.");
            case NO_SLOT    -> sendMsg(player, "§cTu as atteint ta limite de métiers (" + maxSlotsFor(player.getUniqueId().toString()) + ").");
        }
        return r == JoinResult.OK;
    }

    /** UUID-based join with slot + enabled enforcement. Used by portal API + commands. */
    public JoinResult tryJoin(String uuid, String jobId) {
        CustomJob job = config.getJob(jobId);
        if (job == null) return JoinResult.NOT_FOUND;
        if (!config.isJobEnabled(jobId)) return JoinResult.DISABLED;
        if (store.hasJob(uuid, jobId)) return JoinResult.ALREADY_IN;
        if (countJobs(uuid) >= maxSlotsFor(uuid)) return JoinResult.NO_SLOT;
        store.joinJob(uuid, jobId);
        return JoinResult.OK;
    }

    /** Online-player leave (with messages). */
    public boolean leave(Player player, String jobId) {
        boolean ok = tryLeave(player.getUniqueId().toString(), jobId);
        if (ok) sendMsg(player, "§c✖ Tu as quitté le métier §e" + config.getJob(jobId).name() + "§c.");
        else    sendMsg(player, "§cTu n'es pas dans ce métier.");
        return ok;
    }

    /** UUID-based leave. */
    public boolean tryLeave(String uuid, String jobId) {
        if (config.getJob(jobId) == null) return false;
        if (!store.hasJob(uuid, jobId)) return false;
        store.leaveJob(uuid, jobId);
        return true;
    }

    /** How many custom jobs the player currently holds. */
    public int countJobs(String uuid) {
        return store.getPlayerJobs(uuid).size();
    }

    /** Max joinable jobs based on the player's LuckPerms primary group + active extra_slot tickets. */
    public int maxSlotsFor(String uuid) {
        String rank = sunanticheat.dashboard.luckperms.LuckPermsBridge.getPrimaryGroup(uuid);
        int base = config.slotsForRank(rank);
        if (tickets != null && tickets.has(uuid, JobTicketService.TYPE_EXTRA_SLOT)) base += 1;
        return base;
    }

    public enum PrestigeResult { OK, NOT_FOUND, NOT_JOINED, NOT_MAX_LEVEL, MAX_STARS, ERROR }
    private static final int MAX_PRESTIGE_STARS = 5;

    /** Prestige a job: requires the player to be at max level. Resets level to 1 and grants +1 star. */
    public PrestigeResult tryPrestige(String uuid, String jobId) {
        CustomJob job = config.getJob(jobId);
        if (job == null) return PrestigeResult.NOT_FOUND;
        Map<String, Object> pj = store.getPlayerJob(uuid, jobId);
        if (pj == null) return PrestigeResult.NOT_JOINED;
        int level = ((Number) pj.get("level")).intValue();
        int stars = ((Number) pj.getOrDefault("prestige_stars", 0)).intValue();
        if (!job.isMaxLevel(level)) return PrestigeResult.NOT_MAX_LEVEL;
        if (stars >= MAX_PRESTIGE_STARS) return PrestigeResult.MAX_STARS;
        return store.prestige(uuid, jobId) > 0 ? PrestigeResult.OK : PrestigeResult.ERROR;
    }

    /** {used, max, primaryGroup} snapshot used by the portal slots endpoint. */
    public Map<String, Object> slotsSnapshot(String uuid) {
        String rank = sunanticheat.dashboard.luckperms.LuckPermsBridge.getPrimaryGroup(uuid);
        if (rank == null) rank = "default";
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("used", countJobs(uuid));
        m.put("max",  config.slotsForRank(rank));
        m.put("rank", rank);
        return m;
    }

    public CustomJobConfig config() { return config; }

    /**
     * Called by the event listener when a player performs a job action.
     * actionType: "break", "kill", "fish", "craft"
     * target: material or entity name (uppercase).
     */
    public void processAction(Player player, String actionType, String target) {
        processAction(player, actionType, target, null);
    }

    public void processAction(Player player, String actionType, String target, Location loc) {
        String uuid = player.getUniqueId().toString();
        String upperTarget = target.toUpperCase();

        for (CustomJob job : config.getJobs().values()) {
            if (!store.hasJob(uuid, job.id())) continue;

            Map<String, JobAction> targets = job.actions().get(actionType.toLowerCase());
            if (targets == null) continue;

            JobAction action = targets.get(upperTarget);
            if (action == null) continue;

            // Anti-farm check
            if (config.isAntiFarmEnabled(job.id())) {
                String antiFarmSuffix = (loc != null)
                        ? loc.getWorld().getName() + ":" + loc.getBlockX() + ":" + loc.getBlockY() + ":" + loc.getBlockZ()
                        : upperTarget;
                String antiFarmKey = uuid + "|" + job.id() + "|" + actionType + "|" + antiFarmSuffix;
                long now = System.currentTimeMillis();
                long cooldownMs = job.antiFarmCooldownSeconds() * 1000L;
                Long last = antiFarmMap.get(antiFarmKey);
                if (last != null && (now - last) < cooldownMs) continue;
                antiFarmMap.put(antiFarmKey, now);
            }

            Map<String, Object> playerJob = store.getPlayerJob(uuid, job.id());
            if (playerJob == null) continue;

            int level = ((Number) playerJob.get("level")).intValue();
            int stars = ((Number) playerJob.getOrDefault("prestige_stars", 0)).intValue();
            double currentXp = ((Number) playerJob.get("xp")).doubleValue();
            double levelMult = job.rewardMultiplier(level);

            // ── Dynamiques de monde (saison, météo, jour/nuit, heatmap, bulletin) ─
            boolean bypassHeatmap = tickets != null && tickets.has(uuid, JobTicketService.TYPE_BYPASS_HEATMAP);
            MultiplierBreakdown world = dynamics != null
                    ? dynamics.computeMultiplier(player, job.id(), actionType, bypassHeatmap)
                    : new MultiplierBreakdown();
            double worldMult = world.total();

            // ── Combo ────────────────────────────────────────────────────────────
            int    comboCount = 1;
            double comboMult  = 1.0;
            if (comboTracker != null) {
                ComboTracker.ComboState st = comboTracker.onAction(player, job.id());
                comboCount = st.count();
                comboMult  = st.multiplier();
            }

            // ── Prestige (étoiles permanentes, +3% par étoile) ───────────────────
            double prestigeMult = 1.0 + (stars * 0.03);

            // ── Ticket xp_boost (+25% sur tout le gain) ──────────────────────────
            double ticketMult = (tickets != null && tickets.has(uuid, JobTicketService.TYPE_XP_BOOST_25))
                    ? 1.25 : 1.0;

            // ── Régulateur économique (correction par métier) ────────────────────
            double regMult = regulator != null ? regulator.multiplierFor(job.id()) : 1.0;

            double xpGain    = action.xp()    * levelMult * worldMult * comboMult * prestigeMult * ticketMult * regMult;
            double moneyGain = action.money() * levelMult * worldMult * comboMult * prestigeMult * ticketMult * regMult;

            // ── Évènement (1er servi gagne) ──────────────────────────────────────
            WorldEventManager.ActiveEvent claimed = dynamics != null
                    ? dynamics.claimEventReward(player, job.id())
                    : null;
            if (claimed != null) {
                xpGain    += claimed.rewardXp();
                moneyGain += claimed.rewardMoney();
                if (titlesService != null) {
                    titlesService.showEventWin(player, claimed.id(), claimed.rewardMoney(), claimed.rewardXp());
                }
                if (fxService != null) fxService.playEventWin(player);
            }

            store.addXpAndEarnings(uuid, job.id(), xpGain, moneyGain);
            store.recordHistory(uuid, player.getName(), job.id(), actionType, upperTarget, xpGain, moneyGain);

            if (economy != null && moneyGain > 0) {
                economy.depositPlayer(player, moneyGain);
            }

            // ── Polish FX en réaction immédiate ──────────────────────────────────
            if (fxService != null) fxService.playActionTick(player, job);
            if (actionBarService != null) actionBarService.show(player, xpGain, moneyGain, comboCount, comboMult, world);

            // Level-up check
            int newLevel = level;
            double newXp = currentXp + xpGain;
            if (!job.isMaxLevel(level)) {
                while (!job.isMaxLevel(newLevel) && newXp >= job.xpForLevel(newLevel + 1)) {
                    newLevel++;
                }
                if (newLevel > level) {
                    store.setLevel(uuid, job.id(), newLevel);
                    sendMsg(player, "§6✦ Niveau " + newLevel + " atteint dans le métier §e" + job.name() + "§6 !");

                    if (fxService != null)        fxService.playLevelUp(player, job, newLevel);
                    if (titlesService != null)    titlesService.showLevelUp(player, job, newLevel);
                    if (bossBarService != null)   bossBarService.showLevelUp(player, job, newLevel);

                    String tagline = JobTitlesService.taglineFor(newLevel, job.maxLevel());
                    if (tagline != null) {
                        if (titlesService != null) titlesService.showMilestone(player, job, newLevel, tagline);
                        if (fxService != null)     fxService.playMilestone(player, job, newLevel);
                        if ("MAÎTRE".equals(tagline) && titlesService != null) {
                            titlesService.announceMaxLevel(player, job);
                        }
                    }
                }
            }

            // BossBar (always — refresh progress)
            if (bossBarService != null && newLevel == level) {
                long xpForCurrent = job.xpForLevel(newLevel);
                long xpForNext    = job.isMaxLevel(newLevel)
                        ? Math.max(1, xpForCurrent)
                        : job.xpForLevel(newLevel + 1);
                bossBarService.update(player, job, newLevel, newXp, xpForCurrent, xpForNext, xpGain,
                        comboCount, comboMult, false);
            }
        }
    }

    public Map<String, CustomJob> getJobs() { return config.getJobs(); }

    public CustomJob getJob(String id) { return config.getJob(id); }

    public CustomJobStore getStore() { return store; }

    public WorldDynamicsService dynamics() { return dynamics; }

    public void cleanup() { antiFarmMap.clear(); }

    private static void sendMsg(Player player, String msg) {
        player.sendMessage(Component.text(msg));
    }
}
