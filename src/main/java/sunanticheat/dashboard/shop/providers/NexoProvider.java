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

/** Provider Nexo (successeur d'Oraxen, API : com.nexomc.nexo.api.NexoItems). */
public final class NexoProvider implements ModdedItemProvider {

    private static final String SOURCE = "Nexo";
    private List<ModdedItem> cache;

    @Override public String name() { return SOURCE; }

    @Override
    public boolean isAvailable() {
        try {
            return Bukkit.getPluginManager().getPlugin("Nexo") != null
                    && Bukkit.getPluginManager().isPluginEnabled("Nexo");
        } catch (Throwable t) { return false; }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<ModdedItem> listAll() {
        if (!isAvailable()) return Collections.emptyList();
        if (cache != null) return cache;

        List<ModdedItem> out = new ArrayList<>();
        try {
            Class<?> api = Class.forName("com.nexomc.nexo.api.NexoItems");
            Set<String> names;
            try {
                names = (Set<String>) api.getMethod("itemNames").invoke(null);
            } catch (NoSuchMethodException e) {
                names = (Set<String>) api.getMethod("getItemNames").invoke(null);
            }

            Method itemFromId = null;
            try { itemFromId = api.getMethod("itemFromId", String.class); }
            catch (NoSuchMethodException e) {
                try { itemFromId = api.getMethod("getItemFromId", String.class); }
                catch (NoSuchMethodException ignored) {}
            }
            if (itemFromId == null) return Collections.emptyList();

            for (String id : names) {
                try {
                    Object builder = itemFromId.invoke(null, id);
                    if (builder == null) continue;
                    Object built;
                    try { built = builder.getClass().getMethod("build").invoke(builder); }
                    catch (NoSuchMethodException e) { built = builder; }
                    if (!(built instanceof ItemStack is)) continue;

                    String display = id;
                    int cmd = 0;
                    try {
                        if (is.hasItemMeta() && is.getItemMeta() != null) {
                            if (is.getItemMeta().hasDisplayName()) display = is.getItemMeta().getDisplayName();
                            if (is.getItemMeta().hasCustomModelData()) cmd = is.getItemMeta().getCustomModelData();
                        }
                    } catch (Throwable ignored) {}

                    Map<String, Object> yaml = Map.of("type", "NEXO", "nexo", id);
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
            Class<?> api = Class.forName("com.nexomc.nexo.api.NexoItems");
            Method m;
            try { m = api.getMethod("itemFromId", String.class); }
            catch (NoSuchMethodException e) { m = api.getMethod("getItemFromId", String.class); }

            Object builder = m.invoke(null, id);
            if (builder == null) return null;
            Object built;
            try { built = builder.getClass().getMethod("build").invoke(builder); }
            catch (NoSuchMethodException e) { built = builder; }
            if (!(built instanceof ItemStack is)) return null;
            is.setAmount(Math.max(1, amount));
            return is;
        } catch (Throwable t) { return null; }
    }

    @Override
    public String matchId(ItemStack stack) {
        if (!isAvailable() || stack == null) return null;
        try {
            Class<?> api = Class.forName("com.nexomc.nexo.api.NexoItems");
            Method m;
            try { m = api.getMethod("idFromItem", ItemStack.class); }
            catch (NoSuchMethodException e) { m = api.getMethod("getIdFromItem", ItemStack.class); }
            Object id = m.invoke(null, stack);
            return id != null ? id.toString() : null;
        } catch (Throwable t) { return null; }
    }
}
