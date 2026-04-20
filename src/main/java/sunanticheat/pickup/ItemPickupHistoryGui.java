package sunanticheat.pickup;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * GUI affichant les items ramassés par un joueur (48 dernières heures).
 * Agrégation par type de matériau.
 */
public class ItemPickupHistoryGui {

    private static final int GUI_SIZE = 54;
    private static final int SLOT_BACK = 49;

    private final ItemPickupStorage storage;

    public ItemPickupHistoryGui(ItemPickupStorage storage) {
        this.storage = storage;
    }

    public void open(Player viewer, UUID targetUuid) {
        String targetName = Bukkit.getOfflinePlayer(targetUuid).getName();
        if (targetName == null || targetName.isEmpty()) targetName = targetUuid.toString().substring(0, 8);

        Map<Material, Integer> aggregated = storage.getAggregatedByMaterial(targetUuid);
        List<Map.Entry<Material, Integer>> sorted = aggregated.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .toList();

        Holder holder = new Holder();
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE,
                Component.text("Ramassages 48h: " + targetName)
                        .color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));
        holder.setInventory(inv);

        ItemStack border = new ItemStack(Material.GRAY_STAINED_GLASS_PANE);
        ItemMeta bm = border.getItemMeta();
        if (bm != null) bm.displayName(Component.text(" "));
        border.setItemMeta(bm);
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 45; i < GUI_SIZE; i++) inv.setItem(i, border);
        for (int r = 1; r < 5; r++) {
            inv.setItem(r * 9, border);
            inv.setItem(r * 9 + 8, border);
        }

        int slot = 10;
        for (Map.Entry<Material, Integer> e : sorted) {
            if (slot >= 45) break;
            if (slot % 9 == 0 || slot % 9 == 8) {
                slot++;
                continue;
            }
            Material mat = e.getKey();
            int amount = e.getValue();
            ItemStack item = new ItemStack(mat, Math.min(mat.getMaxStackSize(), amount));
            item.editMeta(ItemMeta.class, m -> {
                String name = formatMaterialName(mat);
                m.displayName(Component.text(name).color(NamedTextColor.WHITE).decorate(TextDecoration.BOLD));
                m.lore(List.of(
                        Component.text("Quantité totale: " + amount).color(NamedTextColor.GRAY)
                ));
            });
            inv.setItem(slot, item);
            slot++;
        }

        ItemStack back = new ItemStack(Material.ARROW);
        back.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Fiche joueur").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK, back);

        viewer.openInventory(inv);
    }

    private static String formatMaterialName(Material mat) {
        String name = mat.name().toLowerCase().replace('_', ' ');
        if (name.length() > 1) {
            name = name.substring(0, 1).toUpperCase() + name.substring(1);
        }
        return name;
    }

    public static class Holder implements InventoryHolder {
        private Inventory inventory;

        void setInventory(Inventory inv) {
            this.inventory = inv;
        }

        @Override
        public Inventory getInventory() {
            return inventory;
        }
    }
}
