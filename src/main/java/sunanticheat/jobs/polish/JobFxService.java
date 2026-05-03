package sunanticheat.jobs.polish;

import org.bukkit.*;
import org.bukkit.entity.Firework;
import org.bukkit.entity.Player;
import org.bukkit.inventory.meta.FireworkMeta;
import sunanticheat.jobs.CustomJob;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Effets visuels et sonores liés aux actions et aux progressions de métier.
 *
 * - {@link #playActionTick(Player, CustomJob)} : son discret + petite particule
 * - {@link #playLevelUp(Player, CustomJob, int)} : firework + grosse particule + sons
 * - {@link #playMilestone(Player, CustomJob, int)} : effet renforcé pour paliers (10/25/50/max)
 *
 * Throttle : on évite de spammer trop de tics si le joueur enchaîne (max 1/200ms).
 */
public final class JobFxService {

    private final ConcurrentMap<java.util.UUID, Long> lastTickAt = new ConcurrentHashMap<>();
    private static final long TICK_THROTTLE_MS = 200L;

    public void playActionTick(Player player, CustomJob job) {
        long now = System.currentTimeMillis();
        Long prev = lastTickAt.get(player.getUniqueId());
        if (prev != null && now - prev < TICK_THROTTLE_MS) return;
        lastTickAt.put(player.getUniqueId(), now);

        Location loc = player.getLocation().add(0, 1.5, 0);
        World w = player.getWorld();
        try {
            w.spawnParticle(particleFor(job), loc, 4, 0.3, 0.3, 0.3, 0.01);
        } catch (Throwable ignored) {}
        try {
            player.playSound(player.getLocation(), Sound.BLOCK_NOTE_BLOCK_PLING, 0.25f, 1.7f);
        } catch (Throwable ignored) {}
    }

    public void playLevelUp(Player player, CustomJob job, int newLevel) {
        Location loc = player.getLocation();
        World w = player.getWorld();
        try {
            w.spawnParticle(Particle.FIREWORK, loc.clone().add(0, 1, 0),
                    60, 0.6, 1.0, 0.6, 0.1);
            w.spawnParticle(Particle.END_ROD, loc.clone().add(0, 1, 0),
                    25, 0.4, 0.6, 0.4, 0.05);
        } catch (Throwable ignored) {}
        try {
            player.playSound(loc, Sound.UI_TOAST_CHALLENGE_COMPLETE, 0.7f, 1.2f);
            player.playSound(loc, Sound.BLOCK_BEACON_POWER_SELECT, 0.5f, 1.4f);
        } catch (Throwable ignored) {}

        if (newLevel % 10 == 0 || isMaxLevel(job, newLevel)) {
            spawnFirework(player, job);
        }
    }

    public void playMilestone(Player player, CustomJob job, int newLevel) {
        spawnFirework(player, job);
        try {
            player.playSound(player.getLocation(), Sound.ENTITY_ENDER_DRAGON_GROWL, 0.4f, 1.6f);
            player.playSound(player.getLocation(), Sound.UI_TOAST_CHALLENGE_COMPLETE, 1.0f, 1.0f);
        } catch (Throwable ignored) {}
    }

    public void playEventWin(Player player) {
        Location loc = player.getLocation();
        World w = player.getWorld();
        try {
            w.spawnParticle(Particle.TOTEM_OF_UNDYING, loc.clone().add(0, 1, 0),
                    100, 0.8, 1.2, 0.8, 0.3);
            player.playSound(loc, Sound.ENTITY_PLAYER_LEVELUP, 1.0f, 0.8f);
            player.playSound(loc, Sound.BLOCK_AMETHYST_BLOCK_CHIME, 1.0f, 1.4f);
        } catch (Throwable ignored) {}
    }

    private void spawnFirework(Player player, CustomJob job) {
        try {
            Firework fw = (Firework) player.getWorld().spawnEntity(
                    player.getLocation().add(0, 1, 0), org.bukkit.entity.EntityType.FIREWORK_ROCKET);
            FireworkMeta meta = fw.getFireworkMeta();
            Color c1 = jobColor(job);
            Color c2 = Color.WHITE;
            meta.addEffect(org.bukkit.FireworkEffect.builder()
                    .with(org.bukkit.FireworkEffect.Type.STAR)
                    .withColor(c1).withFade(c2)
                    .withTrail().withFlicker().build());
            meta.setPower(1);
            fw.setFireworkMeta(meta);
        } catch (Throwable ignored) {}
    }

    private static Particle particleFor(CustomJob job) {
        return switch (job.id().toLowerCase()) {
            case "miner"      -> Particle.CRIT;
            case "woodcutter" -> Particle.HAPPY_VILLAGER;
            case "fisherman"  -> Particle.SPLASH;
            case "hunter"     -> Particle.DAMAGE_INDICATOR;
            case "farmer"     -> Particle.COMPOSTER;
            default            -> Particle.ENCHANT;
        };
    }

    private static Color jobColor(CustomJob job) {
        return switch (job.id().toLowerCase()) {
            case "miner"      -> Color.AQUA;
            case "woodcutter" -> Color.LIME;
            case "fisherman"  -> Color.BLUE;
            case "hunter"     -> Color.RED;
            case "farmer"     -> Color.YELLOW;
            default            -> Color.PURPLE;
        };
    }

    private static boolean isMaxLevel(CustomJob job, int level) {
        return job.maxLevel() > 0 && level >= job.maxLevel();
    }
}
