package sunanticheat.sanction;

import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

/**
 * Holder du menu de sanctions pour un joueur cible.
 */
public class SanctionMenuHolder implements InventoryHolder {

    private final Player target;
    private Inventory inventory;

    public SanctionMenuHolder(Player target) {
        this.target = target;
    }

    @Nullable
    public Player getTarget() {
        return target != null && target.isOnline() ? target : null;
    }

    void setInventory(Inventory inventory) {
        this.inventory = inventory;
    }

    @Override
    public @NotNull Inventory getInventory() {
        return inventory;
    }
}
