package sunanticheat.menu;

import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.NotNull;

import java.util.UUID;

/** Holder pour la fiche détaillée d'un joueur (toutes les données). */
public class PlayerDataDetailHolder implements InventoryHolder {

    private final UUID targetUuid;
    private Inventory inventory;

    public PlayerDataDetailHolder(UUID targetUuid) {
        this.targetUuid = targetUuid;
    }

    public UUID getTargetUuid() {
        return targetUuid;
    }

    void setInventory(Inventory inventory) {
        this.inventory = inventory;
    }

    @Override
    public @NotNull Inventory getInventory() {
        return inventory;
    }
}
