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
import java.util.Set;

/**
 * Provider Oraxen (io.th0rgal.oraxen.api.OraxenItems).
 * Tolère toutes les versions : getItemNames() / getItems() selon la version.
 */
public final class OraxenProvider implements ModdedItemProvider {

    private static final String SOURCE = "Oraxen";
    private List<ModdedItem> cache;

    @Override public String name() { return SOURCE; }

    @Override
    public boolean isAvailable() {
        try {
            return Bukkit.getPluginManager().getPlugin("Oraxen") != null
                    && Bukkit.getPluginManager().isPluginEnabled("Oraxen");
        } catch (Throwable t) { return false; }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<ModdedItem> listAll() {
        if (!isAvailable()) return Collections.emptyList();
        if (cache != null) return cache;

        List<ModdedItem> out = new ArrayList<>();
        try {
            Class<?> api = Class.forName("io.th0rgal.oraxen.api.OraxenItems");
            Set<String> names;
            try {
                names = (Set<String>) api.getMethod("getItemNames").invoke(null);
            } catch (NoSuchMethodException e) {
                // fallback : getItems() -> Map<String, ItemBuilder>
                Object items = api.getMethod("getItems").invoke(null);
                if (items instanceof Map<?, ?> m) {
                    names = new java.util.HashSet<>();
                    for (Object k : m.keySet()) names.add(String.valueOf(k));
                } else names = Collections.emptySet();
            }

            Method getItemById = api.getMethod("getItemById", String.class);
            for (String id : names) {
                try {
                    Object builder = getItemById.invoke(null, id);
                    if (builder == null) continue;
                    ItemStack is = (ItemStack) builder.getClass().getMethod("build").invoke(builder);
                    if (is == null) continue;

                    String display = id;
                    try {
                        if (is.hasItemMeta() && is.getItemMeta() != null && is.getItemMeta().hasDisplayName()) {
                            display = is.getItemMeta().getDisplayName();
                        }
                    } catch (Throwable ignored) {}

                    int cmd = 0;
                    try {
                        if (is.hasItemMeta() && is.getItemMeta() != null && is.getItemMeta().hasCustomModelData()) {
                            cmd = is.getItemMeta().getCustomModelData();
                        }
                    } catch (Throwable ignored) {}

                    Map<String, Object> yaml = Map.of("type", "ORAXEN", "oraxen", id);
                    out.add(new ModdedItem(SOURCE, id, display, is.getType().name(),
                            "CUSTOM", cmd, null, List.of(), yaml));
                } catch (Throwable ignored) {}
            }
        } catch (Throwable t) {
            return Collections.emptyList();
        }
        cache = List.copyOf(out);
        return cache;
    }

    @Override
    public ItemStack build(String id, int amount) {
        if (!isAvailable() || id == null) return null;
        try {
            Class<?> api = Class.forName("io.th0rgal.oraxen.api.OraxenItems");
            Object builder = api.getMethod("getItemById", String.class).invoke(null, id);
            if (builder == null) return null;
            ItemStack is = (ItemStack) builder.getClass().getMethod("build").invoke(builder);
            if (is == null) return null;
            is.setAmount(Math.max(1, amount));
            return is;
        } catch (Throwable t) { return null; }
    }

    @Override
    public String matchId(ItemStack stack) {
        if (!isAvailable() || stack == null) return null;
        try {
            Class<?> api = Class.forName("io.th0rgal.oraxen.api.OraxenItems");
            Object id = api.getMethod("getIdByItem", ItemStack.class).invoke(null, stack);
            return id != null ? id.toString() : null;
        } catch (Throwable t) { return null; }
    }
}
