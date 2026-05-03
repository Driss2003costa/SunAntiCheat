package sunanticheat.jobs;

import net.milkbowl.vault.economy.Economy;
import org.bukkit.entity.Player;
import net.kyori.adventure.text.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

public final class CustomJobService {

    private final CustomJobConfig config;
    private final CustomJobStore store;
    private final Economy economy;
    private final Logger logger;

    // Anti-farm: uuid+jobId+target -> last reward timestamp
    private final Map<String, Long> antiFarmMap = new ConcurrentHashMap<>();

    public CustomJobService(CustomJobConfig config, CustomJobStore store,
                             Economy economy, Logger logger) {
        this.config  = config;
        this.store   = store;
        this.economy = economy;
        this.logger  = logger;
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
            double mult = job.rewardMultiplier(level);

            double xpGain    = action.xp()    * mult;
            double moneyGain = action.money() * mult;

            store.addXpAndEarnings(uuid, job.id(), xpGain, moneyGain);
            store.recordHistory(uuid, player.getName(), job.id(), actionType, upperTarget, xpGain, moneyGain);

            if (economy != null && moneyGain > 0) {
                economy.depositPlayer(player, moneyGain);
            }

            // Level-up check
            if (!job.isMaxLevel(level)) {
                double newXp = currentXp + xpGain;
                int newLevel = level;
                while (!job.isMaxLevel(newLevel) && newXp >= job.xpForLevel(newLevel + 1)) {
                    newLevel++;
                }
                if (newLevel > level) {
                    store.setLevel(uuid, job.id(), newLevel);
                    sendMsg(player, "§6✦ Niveau " + newLevel + " atteint dans le métier §e" + job.name() + "§6 !");
                }
            }
        }
    }

    public Map<String, CustomJob> getJobs() { return config.getJobs(); }

    public CustomJob getJob(String id) { return config.getJob(id); }

    public CustomJobStore getStore() { return store; }

    public void cleanup() { antiFarmMap.clear(); }

    private static void sendMsg(Player player, String msg) {
        player.sendMessage(Component.text(msg));
    }
}
