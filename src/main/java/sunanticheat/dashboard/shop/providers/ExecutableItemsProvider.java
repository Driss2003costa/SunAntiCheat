package sunanticheat.dashboard.shop.providers;

import org.bukkit.Bukkit;
import org.bukkit.inventory.ItemStack;
import sunanticheat.dashboard.shop.ModdedItem;
import sunanticheat.dashboard.shop.ModdedItemProvider;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Provider ExecutableItems (SsomarDev). */
public final class ExecutableItemsProvider implements ModdedItemProvider {

    private static final String SOURCE = "ExecutableItems";
    private List<ModdedItem> cache;

    @Override public String name() { return SOURCE; }

    @Override
    public boolean isAvailable() {
        try {
            return Bukkit.getPluginManager().getPlugin("ExecutableItems") != null
                    && Bukkit.getPluginManager().isPluginEnabled("ExecutableItems");
        } catch (Throwable t) { return false; }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<ModdedItem> listAll() {
        if (!isAvailable()) return Collections.emptyList();
        if (cache != null) return cache;

        List<ModdedItem> out = new ArrayList<>();
        try {
            Class<?> apiClass = Class.forName("com.ssomar.score.api.executableitems.ExecutableItemsAPI");
            Object manager = apiClass.getMethod("getExecutableItemsManager").invoke(null);

            // getExecutableItemIdsList() -> List<String>
            List<String> ids;
            try {
                ids = (List<String>) manager.getClass().getMethod("getExecutableItemIdsList").invoke(manager);
            } catch (NoSuchMethodException e) {
                ids = (List<String>) manager.getClass().getMethod("getAllIds").invoke(manager);
            }

            for (String id : ids) {
                try {
                    Object opt = manager.getClass().getMethod("getExecutableItem", String.class).invoke(manager, id);
                    if (!(opt instanceof Optional<?> optional) || optional.isEmpty()) continue;
                    Object ei = optional.get();

                    String display = id;
                    try {
                        Object dn = ei.getClass().getMethod("getDisplayName").invoke(ei);
                        if (dn instanceof String s && !s.isEmpty()) display = s;
                    } catch (Throwable ignored) {}

                    String matName = "PAPER";
                    try {
                        Object mat = ei.getClass().getMethod("getMaterial").invoke(ei);
                        if (mat != null) matName = mat.toString();
                    } catch (Throwable ignored) {}

                    Map<String, Object> yaml = Map.of(
                            "type", "EXECUTABLEITEMS",
                            "executableitem", id
                    );
                    out.add(new ModdedItem(SOURCE, id, display, matName,
                            "CUSTOM", 0, null, List.of(), yaml));
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
            Class<?> apiClass = Class.forName("com.ssomar.score.api.executableitems.ExecutableItemsAPI");
            Object manager = apiClass.getMethod("getExecutableItemsManager").invoke(null);
            Object opt = manager.getClass().getMethod("getExecutableItem", String.class).invoke(manager, id);
            if (!(opt instanceof Optional<?> optional) || optional.isEmpty()) return null;
            Object ei = optional.get();
            Object is = ei.getClass().getMethod("buildItem", int.class, Optional.class)
                    .invoke(ei, Math.max(1, amount), Optional.empty());
            if (!(is instanceof ItemStack stack)) return null;
            return stack;
        } catch (Throwable t) { return null; }
    }
}
