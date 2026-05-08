package sunanticheat.xray;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.Permissions;
import sunanticheat.alerts.StaffAlertService;
import sunanticheat.xray.analysis.XRayAnalysisStore;

public class BlockBreakListener implements Listener {

    private final XRayTracker tracker;
    private final JavaPlugin plugin;
    private final StaffAlertService staffAlerts;
    private XRayAnalysisStore analysisStore;

    public BlockBreakListener(XRayTracker tracker) {
        this.tracker = tracker;
        this.plugin = null;
        this.staffAlerts = null;
    }

    public BlockBreakListener(XRayTracker tracker, JavaPlugin plugin, StaffAlertService staffAlerts) {
        this.tracker = tracker;
        this.plugin = plugin;
        this.staffAlerts = staffAlerts;
    }

    public void setAnalysisStore(XRayAnalysisStore store) { this.analysisStore = store; }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockBreak(BlockBreakEvent event) {
        Player player = event.getPlayer();
        if (player.hasPermission(Permissions.BYPASS_XRAY)) return;
        tracker.recordBlockBreak(player, event.getBlock().getType());
        if (analysisStore != null) {
            try { analysisStore.recordBreak(player, event.getBlock()); } catch (Throwable ignored) {}
        }
        if (staffAlerts != null && plugin != null && plugin.getConfig().getBoolean("alerts.xray.enabled", true)) {
            BlockMiningStats stats = tracker.getStats(player.getUniqueId());
            if (stats != null) {
                int minBlocks = plugin.getConfig().getInt("alerts.xray.min-blocks", 150);
                double alertAbovePct = plugin.getConfig().getDouble("alerts.xray.alert-above-valuable-percent", 45);
                if (stats.getTotal() >= minBlocks && stats.getValuablePercentage() >= alertAbovePct) {
                    double diamondPer1k = stats.getDiamondPerThousandCommon();
                    double diamondThreshold = plugin.getConfig().getDouble("xray.diamond-per-thousand-common-suspicious", 2.5);
                    if (stats.getValuablePercentage() >= plugin.getConfig().getDouble("xray.valuable-percent-high", 45)
                            || diamondPer1k >= diamondThreshold) {
                        String detail = String.format("Précieux: %.1f%% | D/1000: %.1f", stats.getValuablePercentage(), diamondPer1k);
                        staffAlerts.alertXRay(player, detail);
                    }
                }
            }
        }
    }
}
