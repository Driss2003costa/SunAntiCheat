package sunanticheat.sanction;

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

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * GUI listant l'historique des sanctions d'un joueur.
 */
public class SanctionHistoryGui {

    private static final int GUI_SIZE = 54;
    private static final int MAX_SHOWN = 45;
    public static final int SLOT_BACK = 49;
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yy HH:mm").withZone(ZoneId.systemDefault());

    private final SanctionHistoryStorage storage;

    public SanctionHistoryGui(SanctionHistoryStorage storage) {
        this.storage = storage;
    }

    public void open(Player viewer, UUID targetUuid, String targetName) {
        List<SanctionHistoryEntry> list = storage.getByTarget(targetUuid, MAX_SHOWN);
        Inventory inv = Bukkit.createInventory(new Holder(), GUI_SIZE,
                Component.text("Historique sanctions: " + (targetName != null ? targetName : "?"))
                        .color(NamedTextColor.DARK_RED).decorate(TextDecoration.BOLD));

        ItemStack border = new ItemStack(Material.GRAY_STAINED_GLASS_PANE);
        ItemMeta bm = border.getItemMeta();
        if (bm != null) bm.displayName(Component.text(" "));
        border.setItemMeta(bm);
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 45; i < GUI_SIZE; i++) inv.setItem(i, border);

        int slot = 9;
        for (SanctionHistoryEntry e : list) {
            if (slot >= 45) break;
            if (slot % 9 == 0 || slot % 9 == 8) { slot++; continue; }
            inv.setItem(slot, itemFor(e));
            slot++;
        }

        ItemStack back = new ItemStack(Material.ARROW);
        back.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Liste des joueurs").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK, back);

        viewer.openInventory(inv);
    }

    private ItemStack itemFor(SanctionHistoryEntry e) {
        Material mat = switch (e.getType().toLowerCase(Locale.ROOT)) {
            case "kick" -> Material.IRON_DOOR;
            case "ban_permanent", "ban_temp" -> Material.BARRIER;
            case "mute_permanent", "mute_temp" -> Material.GRAY_DYE;
            case "freeze", "unfreeze" -> Material.ICE;
            default -> Material.PAPER;
        };
        ItemStack i = new ItemStack(mat);
        String duration = e.getDurationMillis() <= 0 ? "Permanent" : (e.getDurationMillis() / 60000) + " min";
        i.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text(e.getType()).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));
            m.lore(List.of(
                    Component.text("Par: " + e.getStaffName()).color(NamedTextColor.GRAY),
                    Component.text("Raison: " + (e.getReason().isEmpty() ? "—" : e.getReason())).color(NamedTextColor.GRAY),
                    Component.text("Durée: " + duration).color(NamedTextColor.GRAY),
                    Component.text(FMT.format(Instant.ofEpochMilli(e.getTimestamp()))).color(NamedTextColor.DARK_GRAY)
            ));
        });
        return i;
    }

    public static class Holder implements InventoryHolder {
        @Override
        public org.bukkit.inventory.Inventory getInventory() {
            return null;
        }
    }
}
