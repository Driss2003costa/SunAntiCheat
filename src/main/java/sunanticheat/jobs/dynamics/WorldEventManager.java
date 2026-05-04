package sunanticheat.jobs.dynamics;

import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;
import sunanticheat.jobs.CustomJobConfig;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.logging.Logger;

/**
 * Gère les évènements aléatoires de monde — Filon Doré, Frénésie de pêche, etc.
 *
 * Toutes les N minutes, un type d'évènement est tiré (pondéré) et démarré.
 * Chaque type est représenté par un {@link ActiveEvent} avec un timer
 * d'expiration et un message d'annonce. Les évènements sont consommés par le
 * premier joueur qui réalise l'action liée au job ciblé (récompense bonus
 * + annonce du gagnant).
 */
public final class WorldEventManager {

    private final JavaPlugin plugin;
    private final Logger logger;
    private final JobDynamicsConfig cfg;
    private final CustomJobConfig jobs;

    private final Map<String, ActiveEvent> activeByJob = new ConcurrentHashMap<>();
    private BukkitTask task;
    private long lastSpawnAt = 0;

    public WorldEventManager(JavaPlugin plugin, Logger logger,
                              JobDynamicsConfig cfg, CustomJobConfig jobs) {
        this.plugin = plugin; this.logger = logger; this.cfg = cfg; this.jobs = jobs;
    }

    public void start() {
        if (!cfg.eventsEnabled()) return;
        long periodTicks = Math.max(20L * 60, 20L * 60 * cfg.eventsIntervalMin());
        task = Bukkit.getScheduler().runTaskTimer(plugin, this::tryTrigger, periodTicks, periodTicks);
        logger.info("[Jobs/Events] WorldEventManager actif — interval " + cfg.eventsIntervalMin() + " min");
    }

    public void stop() {
        if (task != null) task.cancel();
        activeByJob.clear();
    }

    private void tryTrigger() {
        if (!cfg.eventsEnabled() || cfg.eventTemplates().isEmpty()) return;
        if (Bukkit.getOnlinePlayers().isEmpty()) return;

        // Weighted pick
        int totalWeight = cfg.eventTemplates().stream().mapToInt(JobDynamicsConfig.EventTemplate::weight).sum();
        if (totalWeight <= 0) return;
        int roll = ThreadLocalRandom.current().nextInt(totalWeight);
        JobDynamicsConfig.EventTemplate picked = null;
        int acc = 0;
        for (var t : cfg.eventTemplates()) {
            acc += t.weight();
            if (roll < acc) { picked = t; break; }
        }
        if (picked == null) return;

        // Already an active event for this target job? skip
        String tj = picked.targetJob();
        if (tj != null && activeByJob.containsKey(tj.toLowerCase())) return;

        spawn(picked);
    }

    private void spawn(JobDynamicsConfig.EventTemplate tpl) {
        long now = System.currentTimeMillis();
        ActiveEvent ev = new ActiveEvent(
                tpl.id(), tpl.targetJob(),
                tpl.rewardMoney(), tpl.rewardXp(),
                now, now + tpl.durationSeconds() * 1000L);

        if (tpl.targetJob() != null) activeByJob.put(tpl.targetJob().toLowerCase(), ev);
        lastSpawnAt = now;

        // Broadcast
        Bukkit.getServer().broadcast(
                LegacyComponentSerializer.legacyAmpersand().deserialize(tpl.message()));

        // Auto-expire
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (tpl.targetJob() != null) {
                ActiveEvent existing = activeByJob.get(tpl.targetJob().toLowerCase());
                if (existing == ev) {
                    activeByJob.remove(tpl.targetJob().toLowerCase());
                    Bukkit.getServer().broadcast(
                            LegacyComponentSerializer.legacyAmpersand().deserialize(
                                    "&7L'évènement &e" + tpl.id() + "&7 s'est terminé sans gagnant."));
                }
            }
        }, tpl.durationSeconds() * 20L);
    }

    /**
     * Appelé par {@code CustomJobService} quand un joueur effectue une action.
     * Si un évènement actif cible ce job, il est consommé et le joueur gagne
     * la récompense.
     *
     * @return l'évènement consommé, ou {@code null} si aucun.
     */
    public ActiveEvent claimIfPresent(Player player, String jobId) {
        if (jobId == null) return null;
        ActiveEvent ev = activeByJob.remove(jobId.toLowerCase());
        if (ev == null) return null;

        Bukkit.getServer().broadcast(LegacyComponentSerializer.legacyAmpersand().deserialize(
                "&6✦ &e" + player.getName() + " &6a remporté l'évènement &a" + ev.id() +
                " &6(+&e" + (long) ev.rewardMoney() + "$&6 / +" + (long) ev.rewardXp() + " XP)&6 !"));
        return ev;
    }

    public Collection<ActiveEvent> active() { return activeByJob.values(); }
    public long lastSpawnAt() { return lastSpawnAt; }

    /** Force-trigger un évènement par id (admin/debug). */
    public boolean trigger(String id) {
        for (var t : cfg.eventTemplates()) {
            if (t.id().equalsIgnoreCase(id)) { spawn(t); return true; }
        }
        return false;
    }

    public record ActiveEvent(
            String id,
            String targetJob,
            double rewardMoney,
            double rewardXp,
            long startedAt,
            long endsAt
    ) {}
}
