package sunanticheat.jobs;

import net.milkbowl.vault.economy.Economy;
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
                                  ComboTracker combos) {
        this.dynamics         = dynamics;
        this.bossBarService   = bossBar;
        this.actionBarService = actionBar;
        this.fxService        = fx;
        this.titlesService    = titles;
        this.comboTracker     = combos;
    }

    /** Player joins a job. Returns false if already in it. */
    public boolean join(Player player, String jobId) {
        CustomJob job = config.getJob(jobId);
        if (job == null) return false;
        String uuid = player.getUniqueId().toString();
        if (store.hasJob(uuid, jobId)) return false;
        store.joinJob(uuid, jobId);
        sendMsg(player, "§a✔ Tu as rejoint le métier §e" + job.name() + "§a !");
        return true;
    }

    /** Player leaves a job. Returns false if not in it. */
    public boolean leave(Player player, String jobId) {
        CustomJob job = config.getJob(jobId);
        if (job == null) return false;
        String uuid = player.getUniqueId().toString();
        if (!store.hasJob(uuid, jobId)) return false;
        store.leaveJob(uuid, jobId);
        sendMsg(player, "§c✖ Tu as quitté le métier §e" + job.name() + "§c.");
        return true;
    }

    /**
     * Called by the event listener when a player performs a job action.
     * actionType: "break", "kill", "fish", "craft"
     * target: material or entity name (uppercase).
     */
    public void processAction(Player player, String actionType, String target) {
        String uuid = player.getUniqueId().toString();
        String upperTarget = target.toUpperCase();

        for (CustomJob job : config.getJobs().values()) {
            if (!store.hasJob(uuid, job.id())) continue;

            Map<String, JobAction> targets = job.actions().get(actionType.toLowerCase());
            if (targets == null) continue;

            JobAction action = targets.get(upperTarget);
            if (action == null) continue;

            // Anti-farm check
            String antiFarmKey = uuid + "|" + job.id() + "|" + actionType + "|" + upperTarget;
            long now = System.currentTimeMillis();
            long cooldownMs = job.antiFarmCooldownSeconds() * 1000L;
            Long last = antiFarmMap.get(antiFarmKey);
            if (last != null && (now - last) < cooldownMs) continue;
            antiFarmMap.put(antiFarmKey, now);

            Map<String, Object> playerJob = store.getPlayerJob(uuid, job.id());
            if (playerJob == null) continue;

            int level = ((Number) playerJob.get("level")).intValue();
            double currentXp = ((Number) playerJob.get("xp")).doubleValue();
            double levelMult = job.rewardMultiplier(level);

            // ── Dynamiques de monde (saison, météo, jour/nuit, heatmap, bulletin) ─
            MultiplierBreakdown world = dynamics != null
                    ? dynamics.computeMultiplier(player, job.id(), actionType)
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

            double xpGain    = action.xp()    * levelMult * worldMult * comboMult;
            double moneyGain = action.money() * levelMult * worldMult * comboMult;

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
