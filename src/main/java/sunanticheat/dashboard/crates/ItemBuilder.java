package sunanticheat.dashboard.crates;

import org.bukkit.ChatColor;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Construit des ItemStack \u00e0 partir d'un POJO. Priorit\u00e9 :
 * itemAdderId (si ItemsAdder pr\u00e9sent) &gt; Material + CustomModelData &gt; Material seul.
 */
public final class ItemBuilder {

    private ItemBuilder() {}

    @SuppressWarnings("deprecation")
    public static ItemStack build(String material, int customModelData, String itemAdderId, int amount,
                                  String displayName, List<String> lore, List<String> enchantments) {
        int qty = Math.max(1, amount);
        ItemStack is = null;
        boolean fromItemAdder = false;

        if (itemAdderId != null && !itemAdderId.isEmpty() && ItemAdderBridge.isAvailable()) {
            is = ItemAdderBridge.buildItem(itemAdderId, qty);
            fromItemAdder = is != null;
        }

        if (is == null) {
            Material mat = null;
            if (material != null && !material.isEmpty()) {
                try {
                    mat = Material.valueOf(material.toUpperCase(Locale.ROOT));
                } catch (IllegalArgumentException ignored) {
                    mat = Material.matchMaterial(material);
                }
            }
            if (mat == null) mat = Material.STONE;
            is = new ItemStack(mat, qty);
        }

        ItemMeta meta = is.getItemMeta();
        if (meta != null) {
            if (displayName != null && !displayName.isEmpty()) {
                meta.setDisplayName(ChatColor.translateAlternateColorCodes('&', displayName));
            }
            if (lore != null && !lore.isEmpty()) {
                List<String> coloured = new ArrayList<>(lore.size());
                for (String line : lore) {
                    coloured.add(ChatColor.translateAlternateColorCodes('&', line == null ? "" : line));
                }
                meta.setLore(coloured);
            }
            if (customModelData > 0 && !fromItemAdder) {
                try { meta.setCustomModelData(customModelData); } catch (Throwable ignored) {}
            }
            is.setItemMeta(meta);
        }

        if (enchantments != null) {
            for (String spec : enchantments) {
                if (spec == null || spec.isEmpty()) continue;
                String name;
                int level = 1;
                int colon = spec.indexOf(':');
                if (colon > 0) {
                    name = spec.substring(0, colon).trim();
                    try { level = Integer.parseInt(spec.substring(colon + 1).trim()); }
                    catch (NumberFormatException ignored) { level = 1; }
                } else {
                    name = spec.trim();
                }
                Enchantment ench = null;
                try {
                    ench = Enchantment.getByKey(NamespacedKey.minecraft(name.toLowerCase(Locale.ROOT)));
                } catch (Throwable ignored) {}
                if (ench == null) {
                    try { ench = Enchantment.getByName(name.toUpperCase(Locale.ROOT)); } catch (Throwable ignored) {}
                }
                if (ench != null) {
                    try { is.addUnsafeEnchantment(ench, Math.max(1, level)); } catch (Throwable ignored) {}
                }
            }
        }

        return is;
    }
}
