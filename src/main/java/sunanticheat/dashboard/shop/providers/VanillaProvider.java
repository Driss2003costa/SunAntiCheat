package sunanticheat.dashboard.shop.providers;

import org.bukkit.Material;
import org.bukkit.inventory.ItemStack;
import sunanticheat.dashboard.shop.ModdedItem;
import sunanticheat.dashboard.shop.ModdedItemProvider;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Catalogue complet des Material Bukkit utilisables dans un shop. */
public final class VanillaProvider implements ModdedItemProvider {

    private static final String SOURCE = "Vanilla";
    private List<ModdedItem> cache;

    @Override public String name() { return SOURCE; }
    @Override public boolean isAvailable() { return true; }

    @Override
    public List<ModdedItem> listAll() {
        if (cache != null) return cache;
        List<ModdedItem> out = new ArrayList<>(1500);
        for (Material mat : Material.values()) {
            if (mat.isLegacy() || !mat.isItem()) continue;
            String id = mat.name();
            String display = prettify(id);
            String category = categorize(mat);
            Map<String, Object> yaml = Map.of(
                    "material", id
            );
            out.add(new ModdedItem(SOURCE, id, display, id, category, 0, null, List.of(), yaml));
        }
        cache = List.copyOf(out);
        return cache;
    }

    @Override
    public ItemStack build(String id, int amount) {
        if (id == null || id.isEmpty()) return null;
        Material mat;
        try { mat = Material.valueOf(id.toUpperCase()); }
        catch (IllegalArgumentException ex) { mat = Material.matchMaterial(id); }
        if (mat == null) return null;
        return new ItemStack(mat, Math.max(1, amount));
    }

    @Override
    public String matchId(ItemStack stack) {
        if (stack == null || stack.getType() == Material.AIR) return null;
        return stack.getType().name();
    }

    private static String prettify(String enumName) {
        String lower = enumName.toLowerCase().replace('_', ' ');
        StringBuilder sb = new StringBuilder(lower.length());
        boolean up = true;
        for (int i = 0; i < lower.length(); i++) {
            char c = lower.charAt(i);
            if (c == ' ') { sb.append(c); up = true; continue; }
            sb.append(up ? Character.toUpperCase(c) : c);
            up = false;
        }
        return sb.toString();
    }

    private static String categorize(Material mat) {
        String n = mat.name();
        if (mat.isEdible()) return "FOOD";
        if (n.endsWith("_SWORD") || n.endsWith("_AXE") || n.endsWith("_BOW") || n.equals("TRIDENT") || n.equals("CROSSBOW")) return "WEAPON";
        if (n.endsWith("_PICKAXE") || n.endsWith("_SHOVEL") || n.endsWith("_HOE") || n.endsWith("_SHEARS") || n.equals("FISHING_ROD")) return "TOOL";
        if (n.endsWith("_HELMET") || n.endsWith("_CHESTPLATE") || n.endsWith("_LEGGINGS") || n.endsWith("_BOOTS") || n.endsWith("_SHIELD")) return "ARMOR";
        if (n.contains("POTION")) return "POTION";
        if (n.contains("SPAWN_EGG")) return "SPAWN_EGG";
        if (n.startsWith("MUSIC_DISC") || n.startsWith("DISC_")) return "MUSIC";
        if (n.contains("REDSTONE") || n.contains("REPEATER") || n.contains("COMPARATOR") || n.contains("PISTON")) return "REDSTONE";
        if (mat.isBlock()) return "BLOCK";
        return "MISC";
    }
}
