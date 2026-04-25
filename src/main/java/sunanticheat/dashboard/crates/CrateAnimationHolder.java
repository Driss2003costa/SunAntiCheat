package sunanticheat.dashboard.crates;

import org.bukkit.Bukkit;
import org.bukkit.event.inventory.InventoryType;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;

/**
 * Marker InventoryHolder pour les inventaires d'animation de crate.
 *
 * Permet :
 *  - D'identifier rapidement nos inventaires dans les events
 *    (InventoryClickEvent, InventoryDragEvent, InventoryCloseEvent)
 *  - De bloquer toute interaction utilisateur pendant l'animation
 *  - De stocker l'état de l'animation (crate, wonItem, callback)
 */
public final class CrateAnimationHolder implements InventoryHolder {

    public final String crateId;
    public final String playerName;
    public volatile boolean finished = false;
    public volatile boolean closing = false;
    private Inventory inventory;

    public CrateAnimationHolder(String crateId, String playerName) {
        this.crateId = crateId;
        this.playerName = playerName;
    }

    public void setInventory(Inventory inv) { this.inventory = inv; }

    @Override
    public Inventory getInventory() {
        if (inventory == null) {
            // Fallback : crée un inventaire vide (ne devrait jamais arriver en pratique)
            inventory = Bukkit.createInventory(this, InventoryType.CHEST, "Crate");
        }
        return inventory;
    }
}
