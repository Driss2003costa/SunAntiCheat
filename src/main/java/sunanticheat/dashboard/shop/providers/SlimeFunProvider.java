package sunanticheat.dashboard.shop.providers;

import org.bukkit.Bukkit;
import org.bukkit.inventory.ItemStack;
import sunanticheat.dashboard.shop.ModdedItem;
import sunanticheat.dashboard.shop.ModdedItemProvider;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/** Provider Slimefun4 (TheBusyBiscuit). */
public final class SlimeFunProvider implements ModdedItemProvider {

    private static final String SOURCE = "Slimefun";
    private List<ModdedItem> cache;

    @Override public String name() { return SOURCE; }

    @Override
    public boolean isAvailable() {
        try {
            return (Bukkit.getPluginManager().getPlugin("Slimefun") != null
                    || Bukkit.getPluginManager().getPlugin("CMI-Slimefun") != null);
        } catch (Throwable t) { return false; }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<ModdedItem> listAll() {
        if (!isAvailable()) return Collections.emptyList();
        if (cache != null) return cache;

        List<ModdedItem> out = new ArrayList<>();
        try {
            Class<?> registry = Class.forName("io.github.thebusybiscuit.slimefun4.api.SlimefunAddon");
            // Utiliser Slimefun.getRegistry().getEnabledSlimefunItems()
            Class<?> sf = Class.forName("io.github.thebusybiscuit.slimefun4.implementation.Slimefun");
            Object reg = sf.getMethod("getRegistry").invoke(null);
            Object items = reg.getClass().getMethod("getEnabledSlimefunItems").invoke(reg);
            if (!(items instanceof Iterable<?> iter)) return Collections.emptyList();

            for (Object sfItem : iter) {
                try {
                    String id = (String) sfItem.getClass().getMethod("getId").invoke(sfItem);
                    Object stackObj = sfItem.getClass().getMethod("getItem").invoke(sfItem);
                    if (!(stackObj instanceof ItemStack is)) continue;

                    String display = id;
                    try {
                        if (is.hasItemMeta() && is.getItemMeta() != null && is.getItemMeta().hasDisplayName()) {
                            display = is.getItemMeta().getDisplayName();
                        }
                    } catch (Throwable ignored) {}

                    Map<String, Object> yaml = Map.of(
                            "type", "SLIMEFUN",
                            "slimefun", id
                    );
                    out.add(new ModdedItem(SOURCE, id, display, is.getType().name(),
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
            Class<?> sfItemClass = Class.forName("io.github.thebusybiscuit.slimefun4.api.items.SlimefunItem");
            Object sfItem = sfItemClass.getMethod("getById", String.class).invoke(null, id);
            if (sfItem == null) return null;
            Object stackObj = sfItem.getClass().getMethod("getItem").invoke(sfItem);
            if (!(stackObj instanceof ItemStack is)) return null;
            ItemStack clone = is.clone();
            clone.setAmount(Math.max(1, amount));
            return clone;
        } catch (Throwable t) { return null; }
    }
}
