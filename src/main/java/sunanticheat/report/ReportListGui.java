package sunanticheat.report;

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
import org.bukkit.inventory.meta.SkullMeta;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * GUI listant les reports pour le staff. Clic sur une tête = ouvrir le menu sanctions du joueur signalé.
 */
public class ReportListGui {

    private static final int GUI_SIZE = 54;
    public static final int SLOT_BACK = 49;
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM HH:mm").withZone(ZoneId.systemDefault());

    private final ReportStorage storage;

    public ReportListGui(ReportStorage storage) {
        this.storage = storage;
    }

    private static final int[] CONTENT_SLOTS = {10,11,12,13,14,15,16,17, 19,20,21,22,23,24,25, 28,29,30,31,32,33,34, 37,38,39,40,41,42,43};

    public void open(Player viewer) {
        List<ReportEntry> list = storage.getAll();
        Holder holder = new Holder(list);
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE,
                Component.text("Reports — " + list.size() + " signalement(s)").color(NamedTextColor.DARK_RED).decorate(TextDecoration.BOLD));

        ItemStack border = new ItemStack(Material.RED_STAINED_GLASS_PANE);
        ItemMeta bm = border.getItemMeta();
        if (bm != null) bm.displayName(Component.text(" "));
        border.setItemMeta(bm);
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 45; i < GUI_SIZE; i++) inv.setItem(i, border);
        for (int r = 1; r < 5; r++) {
            inv.setItem(r * 9, border);
            inv.setItem(r * 9 + 8, border);
        }

        for (int i = 0; i < list.size() && i < CONTENT_SLOTS.length; i++) {
            inv.setItem(CONTENT_SLOTS[i], itemFor(list.get(i)));
        }

        ItemStack back = new ItemStack(Material.ARROW);
        back.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Menu principal").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK, back);

        viewer.openInventory(inv);
    }

    /** Retourne l'entrée à ce slot ou null. */
    public static ReportEntry getEntryAt(Holder holder, int slot) {
        int idx = indexOfSlot(slot);
        if (idx < 0 || idx >= holder.getEntries().size()) return null;
        return holder.getEntries().get(idx);
    }

    private static int indexOfSlot(int slot) {
        for (int i = 0; i < CONTENT_SLOTS.length; i++) {
            if (CONTENT_SLOTS[i] == slot) return i;
        }
        return -1;
    }

    private ItemStack itemFor(ReportEntry e) {
        ItemStack skull = new ItemStack(Material.PLAYER_HEAD);
        skull.editMeta(SkullMeta.class, m -> {
            Player reported = Bukkit.getPlayer(e.getReportedUuid());
            if (reported != null) m.setOwningPlayer(reported);
            m.displayName(Component.text(e.getReportedName()).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));
            String reason = e.getReason().length() > 40 ? e.getReason().substring(0, 37) + "..." : e.getReason();
            m.lore(List.of(
                    Component.text("Signalé par: " + e.getReporterName()).color(NamedTextColor.GRAY),
                    Component.text("Raison: " + reason).color(NamedTextColor.GRAY),
                    Component.text(FMT.format(Instant.ofEpochMilli(e.getTimestamp()))).color(NamedTextColor.DARK_GRAY),
                    Component.text("Clic = menu sanctions").color(NamedTextColor.YELLOW)
            ));
        });
        return skull;
    }

    public static class Holder implements InventoryHolder {
        private final List<ReportEntry> entries;

        public Holder(List<ReportEntry> entries) {
            this.entries = entries != null ? new ArrayList<>(entries) : new ArrayList<>();
        }

        public List<ReportEntry> getEntries() {
            return entries;
        }

        @Override
        public org.bukkit.inventory.Inventory getInventory() {
            return null;
        }
    }
}
