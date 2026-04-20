package sunanticheat.dashboard.honeypot;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import sunanticheat.dashboard.DashboardModule;

import java.util.function.Consumer;

/**
 * Détecte quand un joueur casse un bloc honeypot. Alerte staff + log.
 */
public final class HoneypotListener implements Listener {

    private final HoneypotStore store;
    private final Consumer<java.util.Map<String, Object>> alertSink;

    public HoneypotListener(HoneypotStore store, Consumer<java.util.Map<String, Object>> alertSink) {
        this.store = store;
        this.alertSink = alertSink;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) {
        Block b = e.getBlock();
        HoneypotTrap trap = store.findByBlock(b.getWorld().getName(), b.getX(), b.getY(), b.getZ());
        if (trap == null) return;
        Player p = e.getPlayer();
        if (p.isOp()) return; // admins ne déclenchent pas
        store.recordTrigger(trap, p.getName(), p.getUniqueId().toString());

        // Broadcast staff (permission sunguard.alerts)
        Component msg = Component.text("🍯 HONEYPOT déclenché : ", NamedTextColor.GOLD)
                .append(Component.text(p.getName(), NamedTextColor.RED))
                .append(Component.text(" a cassé " + trap.getLabel() + " à " + trap.getX() + "," + trap.getY() + "," + trap.getZ() + " (" + trap.getWorld() + ")", NamedTextColor.YELLOW));
        for (Player online : Bukkit.getOnlinePlayers()) {
            if (online.hasPermission("sunguard.alerts")) online.sendMessage(msg);
        }

        if (alertSink != null) {
            alertSink.accept(java.util.Map.of(
                    "type", "HONEYPOT",
                    "player", p.getName(),
                    "world", trap.getWorld(),
                    "detail", trap.getLabel() + " @ " + trap.getX() + "," + trap.getY() + "," + trap.getZ()
            ));
        }
    }
}
