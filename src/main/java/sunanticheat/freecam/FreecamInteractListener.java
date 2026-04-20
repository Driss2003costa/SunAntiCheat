package sunanticheat.freecam;

import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.Permissions;
import sunanticheat.alerts.StaffAlertService;

/**
 * Enregistre les interactions (clic droit sur bloc) : si le bloc n'est pas
 * dans le champ de vision / à portée, compte comme suspect freecam.
 * Si cancelSuspiciousActions est true, annule l'interaction pour les actions suspectes.
 */
public class FreecamInteractListener implements Listener {

    private final FreecamTracker tracker;
    private final boolean cancelSuspiciousActions;
    private final JavaPlugin plugin;
    private final StaffAlertService staffAlerts;

    public FreecamInteractListener(FreecamTracker tracker, boolean cancelSuspiciousActions) {
        this.tracker = tracker;
        this.cancelSuspiciousActions = cancelSuspiciousActions;
        this.plugin = null;
        this.staffAlerts = null;
    }

    public FreecamInteractListener(FreecamTracker tracker, boolean cancelSuspiciousActions,
                                   JavaPlugin plugin, StaffAlertService staffAlerts) {
        this.tracker = tracker;
        this.cancelSuspiciousActions = cancelSuspiciousActions;
        this.plugin = plugin;
        this.staffAlerts = staffAlerts;
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onInteract(PlayerInteractEvent event) {
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK) return;
        Block block = event.getClickedBlock();
        if (block == null) return;
        Player player = event.getPlayer();
        if (player.hasPermission(Permissions.BYPASS_FREECAM)) return;
        boolean inSight = FreecamChecker.isBlockInLineOfSightAndReach(player, block);
        if (inSight) {
            tracker.recordValidAction(player.getUniqueId());
        } else {
            tracker.recordSuspiciousAction(player.getUniqueId());
            if (cancelSuspiciousActions) {
                event.setCancelled(true);
            }
            maybeAlertFreecam(player);
        }
    }

    private void maybeAlertFreecam(Player player) {
        if (staffAlerts == null || plugin == null || !plugin.getConfig().getBoolean("alerts.freecam.enabled", true)) return;
        FreecamTracker.FreecamStats stats = tracker.getStats(player.getUniqueId());
        if (stats == null) return;
        int minTotal = plugin.getConfig().getInt("alerts.freecam.min-total-actions", 20);
        double alertAbovePct = plugin.getConfig().getDouble("alerts.freecam.alert-above-suspicion-percent", 50);
        if (stats.getTotal() >= minTotal && stats.getSuspicionPercentage() >= alertAbovePct) {
            staffAlerts.alertFreecam(player, String.format("Suspect: %.0f%% (%d/%d)", stats.getSuspicionPercentage(), stats.getSuspicious(), stats.getTotal()));
        }
    }
}
