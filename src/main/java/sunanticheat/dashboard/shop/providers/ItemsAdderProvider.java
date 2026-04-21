package sunanticheat.dashboard.shop.providers;

import org.bukkit.Bukkit;
import org.bukkit.inventory.ItemStack;
import sunanticheat.dashboard.shop.ModdedItem;
import sunanticheat.dashboard.shop.ModdedItemProvider;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Provider ItemsAdder (Lone.dev). Utilise dev.lone.itemsadder.api.CustomStack.
 * Entièrement null-safe : si ItemsAdder est absent ou API incompatible, retourne des listes vides.
 */
public final class ItemsAdderProvider implements ModdedItemProvider {

    private static final String SOURCE = "ItemsAdder";
    private List<ModdedItem> cache;

    @Override public String name() { return SOURCE; }

    @Override
    public boolean isAvailable() {
        try {
            return Bukkit.getPluginManager().getPlugin("ItemsAdder") != null
                    && Bukkit.getPluginManager().isPluginEnabled("ItemsAdder");
        } catch (Throwable t) {
            return false;
        }
    }

    @Override
    @SuppressWarnings({"unchecked", "rawtypes"})
    public List<ModdedItem> listAll() {
        if (!isAvailable()) return Collections.emptyList();
        if (cache != null) return cache;

        List<ModdedItem> out = new ArrayList<>();
        try {
            Class<?> csClass = Class.forName("dev.lone.itemsadder.api.CustomStack");

            // CustomStack.getNamespacedIdsInRegistry() — Set<String>
            Method ids = null;
            try { ids = csClass.getMethod("getNamespacedIdsInRegistry"); }
            catch (NoSuchMethodException ignored) {}

            Iterable<String> namespacedIds;
            if (ids != null) {
                Object result = ids.invoke(null);
                namespacedIds = (Iterable<String>) result;
            } else {
                namespacedIds = Collections.emptyList();
            }

            Method getInstance = csClass.getMethod("getInstance", String.class);
            Method getItem     = csClass.getMethod("getItemStack");
            Method getDisplay  = safeMethod(csClass, "getDisplayName");

            for (String nsId : namespacedIds) {
                try {
                    Object cs = getInstance.invoke(null, nsId);
                    if (cs == null) continue;
                    ItemStack is = (ItemStack) getItem.invoke(cs);
                    if (is == null) continue;

                    String display = nsId;
                    if (getDisplay != null) {
                        Object d = getDisplay.invoke(cs);
                        if (d instanceof String s && !s.isEmpty()) display = s;
                    }

                    int cmd = 0;
                    if (is.hasItemMeta()) {
                        var meta = is.getItemMeta();
                        try { if (meta != null && meta.hasCustomModelData()) cmd = meta.getCustomModelData(); }
                        catch (Throwable ignored) {}
                    }

                    Map<String, Object> yaml = Map.of(
                            "type", "ITEMSADDER",
                            "itemsadder", nsId
                    );
                    out.add(new ModdedItem(SOURCE, nsId, display, is.getType().name(),
                            "CUSTOM", cmd, null, List.of(), yaml));
                } catch (Throwable ignored) { /* skip individual item errors */ }
            }
        } catch (Throwable t) {
            return Collections.emptyList();
        }
        cache = List.copyOf(out);
        return cache;
    }

    @Override
    public ItemStack build(String id, int amount) {
        if (!isAvailable() || id == null || id.isEmpty()) return null;
        try {
            Class<?> c = Class.forName("dev.lone.itemsadder.api.CustomStack");
            Object cs = c.getMethod("getInstance", String.class).invoke(null, id);
            if (cs == null) return null;
            ItemStack is = (ItemStack) c.getMethod("getItemStack").invoke(cs);
            if (is == null) return null;
            is.setAmount(Math.max(1, amount));
            return is;
        } catch (Throwable t) { return null; }
    }

    @Override
    public String matchId(ItemStack stack) {
        if (!isAvailable() || stack == null) return null;
        try {
            Class<?> c = Class.forName("dev.lone.itemsadder.api.CustomStack");
            Object cs = c.getMethod("byItemStack", ItemStack.class).invoke(null, stack);
            if (cs == null) return null;
            Object id = c.getMethod("getNamespacedID").invoke(cs);
            return id != null ? id.toString() : null;
        } catch (Throwable t) { return null; }
    }

    private static Method safeMethod(Class<?> c, String name, Class<?>... params) {
        try { return c.getMethod(name, params); }
        catch (NoSuchMethodException e) { return null; }
    }
}
