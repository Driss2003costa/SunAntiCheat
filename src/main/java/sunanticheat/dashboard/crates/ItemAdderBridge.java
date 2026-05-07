package sunanticheat.dashboard.crates;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.inventory.ItemStack;

/**
 * Pont null-safe vers ItemsAdder via réflexion (pour ne pas avoir à compiler
 * contre le plugin ItemsAdder).
 *
 * Couvre les cas les plus fréquents :
 *   - {@link #buildItem(String, int)}     : crée un ItemStack à partir d'un namespacedID
 *   - {@link #placeCustomBlock(String, Location)} : pose un bloc custom au monde
 *   - {@link #placeFromItem(ItemStack, Location)} : si l'ItemStack provient d'ItemsAdder,
 *     pose le bloc correspondant à la même location (utile pour le workflow
 *     "donne le bloc → pose le bloc → bloc custom apparaît").
 *   - {@link #getCustomBlockId(Block)}    : récupère l'ID du bloc placé (si custom)
 *   - {@link #getNamespacedIdOfItem(ItemStack)} : récupère l'ID d'un item ItemsAdder
 */
public final class ItemAdderBridge {

    private ItemAdderBridge() {}

    private static volatile Boolean cachedAvailable = null;

    public static boolean isAvailable() {
        Boolean a = cachedAvailable;
        if (a != null) return a;
        try {
            a = Bukkit.getPluginManager().getPlugin("ItemsAdder") != null;
        } catch (Throwable t) {
            a = false;
        }
        cachedAvailable = a;
        return a;
    }

    /** Force re-check (ex. plugin chargé tardivement). */
    public static void invalidate() { cachedAvailable = null; }

    public static ItemStack buildItem(String itemAdderId, int amount) {
        if (itemAdderId == null || itemAdderId.isEmpty() || !isAvailable()) return null;
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
        if (block == null || !isAvailable()) return null;
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

    /** Récupère le namespacedID si un ItemStack provient d'ItemsAdder, sinon null. */
    public static String getNamespacedIdOfItem(ItemStack stack) {
        if (stack == null || !isAvailable()) return null;
        try {
            Class<?> c = Class.forName("dev.lone.itemsadder.api.CustomStack");
            Object cs = c.getMethod("byItemStack", ItemStack.class).invoke(null, stack);
            if (cs == null) return null;
            Object id = c.getMethod("getNamespacedID").invoke(cs);
            return id != null ? id.toString() : null;
        } catch (Throwable t) {
            return null;
        }
    }

    /**
     * Place un bloc ItemsAdder au monde.
     * Retourne true si succès. Sinon le caller peut tomber sur un fallback Material vanilla.
     */
    public static boolean placeCustomBlock(String itemAdderId, Location location) {
        if (itemAdderId == null || itemAdderId.isEmpty() || location == null || !isAvailable()) return false;
        try {
            Class<?> c = Class.forName("dev.lone.itemsadder.api.CustomBlock");
            Object cb = c.getMethod("getInstance", String.class).invoke(null, itemAdderId);
            if (cb == null) return false;
            // Certaines versions exposent place(Location), d'autres place(Location, boolean).
            try {
                Object placed = c.getMethod("place", Location.class).invoke(cb, location);
                return placed != null;
            } catch (NoSuchMethodException nsm) {
                Object placed = c.getMethod("place", Location.class, boolean.class).invoke(cb, location, true);
                return placed != null;
            }
        } catch (Throwable t) {
            return false;
        }
    }

    /**
     * Si l'ItemStack provient d'ItemsAdder (CustomStack.byItemStack != null),
     * pose le bloc correspondant à la location demandée.
     * Retourne true si le bloc custom a été posé.
     */
    public static boolean placeFromItem(ItemStack stack, Location location) {
        String id = getNamespacedIdOfItem(stack);
        if (id == null) return false;
        return placeCustomBlock(id, location);
    }
}
