package sunanticheat.blocklog;

import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.NotNull;

/**
 * Holder du GUI d'affichage des logs d'un bloc.
 */
public class BlockLogGuiHolder implements InventoryHolder {

    private final String blockKey;
    private Inventory inventory;

    public BlockLogGuiHolder(String blockKey) {
        this.blockKey = blockKey;
    }

    public String getBlockKey() {
        return blockKey;
    }

    void setInventory(Inventory inventory) {
        this.inventory = inventory;
    }

    @Override
    public @NotNull Inventory getInventory() {
        return inventory;
    }
}
