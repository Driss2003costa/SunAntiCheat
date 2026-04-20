package sunanticheat.menu;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.List;

/**
 * GUI affichant l'inventaire COMPLET d'un joueur : inventaire, armure, main droite, main gauche.
 * Lecture seule (copies des items).
 */
public class PlayerInventoryGui {

    private static final int SIZE = 54;
    public static final int SLOT_BACK = 49;

    /** Slot 0-8: hotbar, 9-35: inventaire principal, 36: casque, 37: plastron, 38: jambières, 39: bottes, 40: main gauche, 41: main droite (item tenu). */
    public void open(Player viewer, Player target) {
        PlayerInventoryHolder holder = new PlayerInventoryHolder(target.getUniqueId());
        String targetName = target.getName();
        Inventory inv = Bukkit.createInventory(holder, SIZE, Component.text("Inventaire: " + targetName)
                .color(NamedTextColor.DARK_GRAY)
                .decorate(TextDecoration.BOLD));
        holder.setInventory(inv);

        PlayerInventory pinv = target.getInventory();
        ItemStack[] contents = pinv.getContents();

        // Hotbar 0-8
        for (int i = 0; i < 9; i++) {
            inv.setItem(i, cloneOrNull(contents[i]));
        }
        // Inventaire 9-35
        for (int i = 9; i < 36; i++) {
            inv.setItem(i, cloneOrNull(contents[i]));
        }
        // Armure (Bukkit: 36=boots, 37=legs, 38=chest, 39=helmet) → on affiche casque, plastron, jambières, bottes
        inv.setItem(36, cloneOrNull(pinv.getHelmet()));
        inv.setItem(37, cloneOrNull(pinv.getChestplate()));
        inv.setItem(38, cloneOrNull(pinv.getLeggings()));
        inv.setItem(39, cloneOrNull(pinv.getBoots()));
        // Main gauche (off-hand)
        inv.setItem(40, cloneOrNull(pinv.getItemInOffHand()));
        // Main droite (item tenu = slot de la hotbar sélectionné)
        inv.setItem(41, cloneOrNull(pinv.getItemInMainHand()));

        // Labels en verre pour les slots 42-44
        ItemStack labelMainG = label("Main gauche", Material.SHIELD);
        ItemStack labelMainD = label("Main droite", Material.DIAMOND_SWORD);
        inv.setItem(42, labelMainG);
        inv.setItem(43, labelMainD);

        // Bouton retour (slot 49)
        ItemStack back = new ItemStack(Material.ARROW);
        back.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Fiche joueur").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK, back);

        viewer.openInventory(inv);
    }

    public void open(Player viewer, java.util.UUID targetUuid) {
        Player target = Bukkit.getPlayer(targetUuid);
        if (target != null && target.isOnline()) {
            open(viewer, target);
        }
    }

    private static ItemStack cloneOrNull(ItemStack item) {
        return item == null || item.getType().isAir() ? null : item.clone();
    }

    private static ItemStack label(String name, Material icon) {
        ItemStack i = new ItemStack(icon);
        ItemMeta m = i.getItemMeta();
        if (m != null) {
            m.displayName(Component.text(name).color(NamedTextColor.GRAY));
            i.setItemMeta(m);
        }
        return i;
    }
}
