package sunanticheat.sanction;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.SkullMeta;

import java.util.ArrayList;
import java.util.List;

/**
 * GUI listant les joueurs en ligne. Clic sur une tête → menu des sanctions pour ce joueur.
 */
public class SanctionPlayerListGui {

    private static final int GUI_SIZE = 54;
    private final SanctionPlayerListHolder holder = new SanctionPlayerListHolder();
    private final SanctionMenuGui sanctionMenuGui;

    public SanctionPlayerListGui(SanctionMenuGui sanctionMenuGui) {
        this.sanctionMenuGui = sanctionMenuGui;
    }

    public SanctionPlayerListHolder getHolder() {
        return holder;
    }

    public void open(Player viewer) {
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE,
                Component.text("Sanctions — Choisir un joueur").color(NamedTextColor.DARK_RED).decorate(TextDecoration.BOLD));
        holder.setInventory(inv);

        ItemStack border = new ItemStack(Material.RED_STAINED_GLASS_PANE);
        ItemMeta borderMeta = border.getItemMeta();
        if (borderMeta != null) borderMeta.displayName(Component.text(" "));
        border.setItemMeta(borderMeta);
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 45; i < GUI_SIZE; i++) inv.setItem(i, border);
        for (int row = 1; row < 5; row++) {
            inv.setItem(row * 9, border);
            inv.setItem(row * 9 + 8, border);
        }

        int slot = 10;
        for (Player target : new ArrayList<>(Bukkit.getOnlinePlayers())) {
            if (slot >= 44) break;
            if (slot % 9 == 0 || slot % 9 == 8) slot++;
            inv.setItem(slot, createPlayerSkull(target));
            slot++;
        }

        viewer.openInventory(inv);
    }

    private ItemStack createPlayerSkull(Player player) {
        ItemStack skull = new ItemStack(Material.PLAYER_HEAD);
        skull.editMeta(SkullMeta.class, meta -> {
            meta.setOwningPlayer(player);
            meta.displayName(Component.text(player.getName()).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));
            meta.lore(List.of(
                    Component.text("Clic pour ouvrir le menu des sanctions").color(NamedTextColor.GRAY)
            ));
        });
        return skull;
    }

    public SanctionMenuGui getSanctionMenuGui() {
        return sanctionMenuGui;
    }
}
