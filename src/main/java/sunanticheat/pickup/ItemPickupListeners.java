package sunanticheat.pickup;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityPickupItemEvent;
import org.bukkit.inventory.ItemStack;

/**
 * Enregistre les ramassages d'items pour l'historique 48h.
 */
public class ItemPickupListeners implements Listener {

    private final ItemPickupStorage storage;

    public ItemPickupListeners(ItemPickupStorage storage) {
        this.storage = storage;
    }

    @EventHandler
    public void onPickup(EntityPickupItemEvent event) {
        if (!(event.getEntity() instanceof Player player)) return;
        ItemStack item = event.getItem().getItemStack();
        if (item == null || item.getType().isAir()) return;
        storage.recordPickup(player, item);
    }
}
