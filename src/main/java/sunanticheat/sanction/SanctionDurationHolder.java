package sunanticheat.sanction;

import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

/**
 * Holder pour le choix de la durée (ban temp / mute temp).
 * type = "BAN_TEMP" ou "MUTE_TEMP"
 */
public class SanctionDurationHolder implements InventoryHolder {

    public static final String TYPE_BAN_TEMP = "BAN_TEMP";
    public static final String TYPE_MUTE_TEMP = "MUTE_TEMP";

    private final Player target;
    private final String type;
    private Inventory inventory;

    public SanctionDurationHolder(Player target, String type) {
        this.target = target;
        this.type = type != null ? type : TYPE_BAN_TEMP;
    }

    @Nullable
    public Player getTarget() {
        return target != null && target.isOnline() ? target : null;
    }

    public String getType() {
        return type;
    }

    void setInventory(Inventory inventory) {
        this.inventory = inventory;
    }

    @Override
    public @NotNull Inventory getInventory() {
        return inventory;
    }
}
