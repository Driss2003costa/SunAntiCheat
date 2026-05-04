package sunanticheat.jobs.polish;

import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;
import sunanticheat.jobs.CustomJob;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Affiche une BossBar de progression XP au-dessus de l'inventaire.
 *
 * Comportement :
 *  - Apparaît après une action métier (et persiste 8 s avant de fade)
 *  - Couleur per-métier (mappée sur le rôle du métier)
 *  - Texte « Métier · Niv X · 1234/5000 XP (+25 XP combo×2) »
 *  - Au level up : flash GOLD + son joué par {@link JobFxService}
 */
public final class JobBossBarService implements Listener {

    private static final long FADE_AFTER_TICKS = 20L * 8;

    private final JavaPlugin plugin;
    private final Map<UUID, ActiveBar> active = new ConcurrentHashMap<>();

    public JobBossBarService(JavaPlugin plugin) {
        this.plugin = plugin;
        Bukkit.getServer().getPluginManager().registerEvents(this, plugin);
    }

    /**
     * Met à jour la BossBar du joueur après une action.
     */
    public void update(Player player, CustomJob job, int level, double xp,
                       long xpForCurrent, long xpForNext, double xpGain,
                       int combo, double comboMult, boolean leveledUp) {
        UUID id = player.getUniqueId();
        ActiveBar ab = active.get(id);

        // New bar if absent OR job changed
        if (ab == null || !ab.jobId.equals(job.id())) {
            if (ab != null) {
                player.hideBossBar(ab.bar);
                if (ab.task != null) ab.task.cancel();
            }
            BossBar bar = BossBar.bossBar(
                    Component.text("…"),
                    0f,
                    leveledUp ? BossBar.Color.YELLOW : colorOf(job),
                    BossBar.Overlay.NOTCHED_10);
            ab = new ActiveBar(job.id(), bar, null);
            active.put(id, ab);
            player.showBossBar(bar);
        }

        // Compute progress 0..1
        long range = Math.max(1L, xpForNext - xpForCurrent);
        double inLevel = Math.max(0, xp - xpForCurrent);
        float pct = (float) Math.min(1.0, inLevel / range);
        ab.bar.progress(pct);
        ab.bar.color(leveledUp ? BossBar.Color.YELLOW : colorOf(job));

        // Build text
        Component title = Component.text(job.name(), TextColor.color(0xFFD7A0))
                .append(Component.text(" · ", NamedTextColor.DARK_GRAY))
                .append(Component.text("Niv " + level, NamedTextColor.GOLD))
                .append(Component.text(" · ", NamedTextColor.DARK_GRAY))
                .append(Component.text(formatXp(inLevel) + "/" + formatXp(range) + " XP",
                        NamedTextColor.WHITE))
                .append(combo > 1
                        ? Component.text("  ⚡x" + combo, NamedTextColor.AQUA)
                        : Component.empty())
                .append(xpGain > 0
                        ? Component.text("  +" + Math.round(xpGain) + " XP", NamedTextColor.GREEN)
                        : Component.empty());
        ab.bar.name(title);

        // Reset fade timer
        if (ab.task != null) ab.task.cancel();
        ActiveBar finalAb = ab;
        ab.task = Bukkit.getScheduler().runTaskLater(plugin, () -> {
            player.hideBossBar(finalAb.bar);
            active.remove(id, finalAb);
        }, FADE_AFTER_TICKS);
    }

    /** Bossbar dédiée au level up (s'affiche solide pendant 4 s). */
    public void showLevelUp(Player player, CustomJob job, int newLevel) {
        UUID id = player.getUniqueId();
        ActiveBar prev = active.remove(id);
        if (prev != null) {
            player.hideBossBar(prev.bar);
            if (prev.task != null) prev.task.cancel();
        }
        BossBar bar = BossBar.bossBar(
                Component.text("✦ Niveau " + newLevel + " ✦  ", NamedTextColor.GOLD)
                    .append(Component.text(job.name(), NamedTextColor.YELLOW)),
                1f, BossBar.Color.YELLOW, BossBar.Overlay.PROGRESS);
        player.showBossBar(bar);
        ActiveBar ab = new ActiveBar(job.id() + "::levelup", bar, null);
        ab.task = Bukkit.getScheduler().runTaskLater(plugin, () -> {
            player.hideBossBar(bar);
            active.remove(id, ab);
        }, 20L * 4);
        active.put(id, ab);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) { clear(e.getPlayer()); }

    public void clear(Player p) {
        ActiveBar ab = active.remove(p.getUniqueId());
        if (ab != null) {
            p.hideBossBar(ab.bar);
            if (ab.task != null) ab.task.cancel();
        }
    }

    public void shutdown() {
        for (var e : active.entrySet()) {
            Player p = Bukkit.getPlayer(e.getKey());
            if (p != null) p.hideBossBar(e.getValue().bar);
            if (e.getValue().task != null) e.getValue().task.cancel();
        }
        active.clear();
    }

    private static BossBar.Color colorOf(CustomJob job) {
        // Heuristique simple : mapping connu, sinon GREEN par défaut
        return switch (job.id().toLowerCase()) {
            case "miner"      -> BossBar.Color.BLUE;
            case "woodcutter" -> BossBar.Color.GREEN;
            case "fisherman"  -> BossBar.Color.BLUE;
            case "hunter"     -> BossBar.Color.RED;
            case "farmer"     -> BossBar.Color.YELLOW;
            default            -> BossBar.Color.PURPLE;
        };
    }

    private static String formatXp(double v) {
        if (v >= 1_000_000) return String.format("%.1fM", v / 1_000_000);
        if (v >= 1_000)     return String.format("%.1fk", v / 1_000);
        return String.valueOf((long) v);
    }

    private static final class ActiveBar {
        final String jobId;
        final BossBar bar;
        BukkitTask task;
        ActiveBar(String jobId, BossBar bar, BukkitTask task) {
            this.jobId = jobId; this.bar = bar; this.task = task;
        }
    }
}
