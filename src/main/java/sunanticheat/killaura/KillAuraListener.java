package sunanticheat.killaura;

import org.bukkit.Location;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.util.Vector;
import sunanticheat.Permissions;
import sunanticheat.alerts.StaffAlertService;

/**
 * Détecte les comportements type Kill Aura : portée excessive, angle impossible, à travers les murs, CPS anormal.
 */
public class KillAuraListener implements Listener {

    private final JavaPlugin plugin;
    private final KillAuraTracker tracker;
    private final StaffAlertService alertService;

    public KillAuraListener(JavaPlugin plugin, KillAuraTracker tracker, StaffAlertService alertService) {
        this.plugin = plugin;
        this.tracker = tracker;
        this.alertService = alertService;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onEntityDamageByEntity(EntityDamageByEntityEvent event) {
        if (!(event.getDamager() instanceof Player player)) return;
        if (event.getDamager() instanceof org.bukkit.entity.Projectile) return;

        Entity victim = event.getEntity();
        if (victim instanceof Player && victim.equals(player)) return;
        if (player.hasPermission(Permissions.BYPASS_KILLAURA)) return;

        if (!plugin.getConfig().getBoolean("killaura.enabled", true)) return;

        double maxReach = plugin.getConfig().getDouble("killaura.max-reach", 3.5);
        double maxAngleDeg = plugin.getConfig().getDouble("killaura.max-angle-degrees", 120.0);
        int maxCps = plugin.getConfig().getInt("killaura.max-cps", 15);
        boolean requireLineOfSight = plugin.getConfig().getBoolean("killaura.require-line-of-sight", true);
        boolean cancelSuspicious = plugin.getConfig().getBoolean("killaura.cancel-suspicious-hits", false);
        int violationsBeforeAlert = Math.max(1, plugin.getConfig().getInt("alerts.killaura.violations-before-alert", 3));

        tracker.recordHit(player.getUniqueId());
        int cps = tracker.getHitsInLastSecond(player.getUniqueId());

        String reason = null;

        // Portée : distance joueur → cible
        double distance = distanceToEntity(player, victim);
        if (distance > maxReach) {
            reason = "Portée excessive (" + String.format("%.1f", distance) + " blocs > " + maxReach + ")";
        }

        // Angle : la cible doit être dans le cône de vision
        if (reason == null && maxAngleDeg < 360) {
            double angleDeg = angleBetweenPlayerLookAndTarget(player, victim);
            if (angleDeg > maxAngleDeg / 2) {
                reason = "Angle impossible (" + String.format("%.0f", angleDeg) + "°)";
            }
        }

        // Ligne de visée (à travers les murs)
        if (reason == null && requireLineOfSight && !player.hasLineOfSight(victim)) {
            reason = "Coup à travers un mur";
        }

        // CPS trop élevé
        if (reason == null && cps > maxCps) {
            reason = "CPS anormal (" + cps + " > " + maxCps + ")";
        }

        if (reason != null) {
            int violations = tracker.incrementViolations(player.getUniqueId());
            if (cancelSuspicious) {
                event.setCancelled(true);
            }
            if (violations >= violationsBeforeAlert && plugin.getConfig().getBoolean("alerts.killaura.enabled", true)) {
                alertService.alertKillAura(player, reason + " (violations: " + violations + ")");
                tracker.resetViolations(player.getUniqueId());
            }
        }
    }

    private static double distanceToEntity(Player player, Entity entity) {
        Location eye = player.getEyeLocation();
        Location target = entity.getLocation().clone().add(0, entity.getHeight() * 0.5, 0);
        return eye.distance(target);
    }

    /** Angle en degrés entre la direction du regard du joueur et la cible. 0 = droit devant. */
    private static double angleBetweenPlayerLookAndTarget(Player player, Entity target) {
        Vector look = player.getEyeLocation().getDirection().normalize();
        Vector toTarget = target.getLocation().clone().add(0, target.getHeight() * 0.5, 0)
                .subtract(player.getEyeLocation()).toVector().normalize();
        double dot = Math.max(-1, Math.min(1, look.dot(toTarget)));
        return Math.toDegrees(Math.acos(dot));
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        tracker.remove(event.getPlayer().getUniqueId());
    }
}
