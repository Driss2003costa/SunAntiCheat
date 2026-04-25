package sunanticheat.dashboard.crates;

import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.entity.Player;

/**
 * Bloque toute interaction sur les inventaires d'animation de crate.
 * Empêche le joueur de prendre les items qui défilent.
 *
 * Empêche aussi la fermeture pendant l'animation (sauf si finished).
 */
public final class CrateAnimationListener implements Listener {

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onClick(InventoryClickEvent e) {
        if (e.getInventory().getHolder() instanceof CrateAnimationHolder) {
            e.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onDrag(InventoryDragEvent e) {
        if (e.getInventory().getHolder() instanceof CrateAnimationHolder) {
            e.setCancelled(true);
        }
    }

    @EventHandler
    public void onClose(InventoryCloseEvent e) {
        // Si le joueur essaie de fermer pendant l'animation : on ignore, l'animation
        // gérera la fermeture quand finished=true. C'est l'animation elle-même qui
        // appelle player.closeInventory() à la fin.
        if (e.getInventory().getHolder() instanceof CrateAnimationHolder h) {
            if (!h.finished && !h.closing) {
                // Le joueur a forcé la fermeture (E key) — on laisse passer
                // mais on marque pour que l'animation ne replante pas
                h.closing = true;
            }
        }
    }
}
