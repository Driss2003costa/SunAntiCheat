package sunanticheat.dashboard.shop.providers;

import org.bukkit.Bukkit;
import org.bukkit.inventory.ItemStack;
import sunanticheat.dashboard.shop.ModdedItem;
import sunanticheat.dashboard.shop.ModdedItemProvider;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Provider MMOItems (Phoenix Dev). Items typés : TYPE:ID (ex: SWORD:CUTLASS).
 * L'ID interne du provider utilise le format "TYPE:ID" pour rester unique.
 */
public final class MMOItemsProvider implements ModdedItemProvider {

    private static final String SOURCE = "MMOItems";
    private List<ModdedItem> cache;

    @Override public String name() { return SOURCE; }

    @Override
    public boolean isAvailable() {
        try {
            return Bukkit.getPluginManager().getPlugin("MMOItems") != null
                    && Bukkit.getPluginManager().isPluginEnabled("MMOItems");
        } catch (Throwable t) { return false; }
    }

    @Override
    public List<ModdedItem> listAll() {
        if (!isAvailable()) return Collections.emptyList();
        if (cache != null) return cache;

        List<ModdedItem> out = new ArrayList<>();
        try {
            Class<?> mmoClass = Class.forName("net.Indyuce.mmoitems.MMOItems");
            Object plugin = mmoClass.getField("plugin").get(null);
            Object typeManager = mmoClass.getMethod("getTypes").invoke(plugin);
            // getAll() -> Collection<Type>
            Object types = typeManager.getClass().getMethod("getAll").invoke(typeManager);
            if (!(types instanceof Iterable<?> typeIter)) return Collections.emptyList();

            Object templateManager = mmoClass.getMethod("getTemplates").invoke(plugin);

            for (Object type : typeIter) {
                String typeId = (String) type.getClass().getMethod("getId").invoke(type);
                // getTemplates(type) -> Collection<MMOItemTemplate>
                Object templates = templateManager.getClass().getMethod("getTemplates", type.getClass().getSuperclass() != null ? type.getClass() : type.getClass()).invoke(templateManager, type);
                if (!(templates instanceof Iterable<?> tmplIter)) continue;

                for (Object tmpl : tmplIter) {
                    try {
                        String itemId = (String) tmpl.getClass().getMethod("getId").invoke(tmpl);
                        String combined = typeId + ":" + itemId;

                        Map<String, Object> yaml = Map.of(
                                "type", "MMOITEM",
                                "mmoitem-type", typeId,
                                "mmoitem-id", itemId
                        );
                        out.add(new ModdedItem(SOURCE, combined, itemId, "PAPER",
                                typeId, 0, null, List.of(), yaml));
                    } catch (Throwable ignored) {}
                }
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
        int sep = id.indexOf(':');
        if (sep <= 0) return null;
        String typeId = id.substring(0, sep);
        String itemId = id.substring(sep + 1);
        try {
            Class<?> mmoClass = Class.forName("net.Indyuce.mmoitems.MMOItems");
            Object plugin = mmoClass.getField("plugin").get(null);
            Object typeManager = mmoClass.getMethod("getTypes").invoke(plugin);
            Object type = typeManager.getClass().getMethod("get", String.class).invoke(typeManager, typeId);
            if (type == null) return null;

            // getItem(Type, String) -> ItemStack
            Object result = mmoClass.getMethod("getItem", type.getClass(), String.class).invoke(plugin, type, itemId);
            if (!(result instanceof ItemStack is)) return null;
            is.setAmount(Math.max(1, amount));
            return is;
        } catch (Throwable t) { return null; }
    }
}
