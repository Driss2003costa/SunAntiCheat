package sunanticheat.dashboard.crates;

import org.bukkit.Bukkit;
import org.bukkit.block.Block;
import org.bukkit.inventory.ItemStack;

/**
 * Pont null-safe vers ItemsAdder. Toute interaction passe par la r\u00e9flexion
 * pour \u00e9viter d'avoir \u00e0 compiler contre le plugin ItemsAdder.
 */
public final class ItemAdderBridge {

    private ItemAdderBridge() {}

    public static boolean isAvailable() {
        try {
            return Bukkit.getPluginManager().getPlugin("ItemsAdder") != null;
        } catch (Throwable t) {
            return false;
        }
    }

    public static ItemStack buildItem(String itemAdderId, int amount) {
        if (itemAdderId == null || itemAdderId.isEmpty()) return null;
        try {
            Class<?> c = Class.forName("dev.lone.itemsadder.api.CustomStack");
            Object cs = c.getMethod("getInstance", String.class).invoke(null, itemAdderId);
            if (cs == null) return null;
            ItemStack is = (ItemStack) c.getMethod("getItemStack").invoke(cs);
            if (is == null) return null;
            is.setAmount(Math.max(1, amount));
            return is;
        } catch (Throwable t) {
            return null;
        }
    }

    public static String getCustomBlockId(Block block) {
        if (block == null) return null;
        try {
            Class<?> c = Class.forName("dev.lone.itemsadder.api.CustomBlock");
            Object cb = c.getMethod("byAlreadyPlaced", Block.class).invoke(null, block);
            if (cb == null) return null;
            Object id = c.getMethod("getNamespacedID").invoke(cb);
            return id != null ? id.toString() : null;
        } catch (Throwable t) {
            return null;
        }
    }
}
