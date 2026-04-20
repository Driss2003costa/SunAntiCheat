package sunanticheat.menu;

import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.NotNull;

import java.util.UUID;

/**
 * Holder pour le GUI d'inventaire complet d'un joueur (cible).
 */
public class PlayerInventoryHolder implements InventoryHolder {

    private Inventory inventory;
    private final UUID targetPlayerId;

    public PlayerInventoryHolder(UUID targetPlayerId) {
        this.targetPlayerId = targetPlayerId;
    }

    void setInventory(Inventory inventory) {
        this.inventory = inventory;
    }

    public UUID getTargetPlayerId() {
        return targetPlayerId;
    }

    @Override
    public @NotNull Inventory getInventory() {
        return inventory;
    }
}
