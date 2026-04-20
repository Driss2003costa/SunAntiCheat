package sunanticheat.blocklog;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.SkullMeta;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * GUI affichant l'historique des actions sur un bloc (cassé, placé, interaction).
 */
public class BlockLogGui {

    private static final int GUI_SIZE = 54;
    private static final int SLOT_INFO = 4;
    public static final int SLOT_BACK = 49;
    private static final int FIRST_SLOT = 9;
    private static final int LAST_SLOT = 44;
    private static final int MAX_ENTRIES = LAST_SLOT - FIRST_SLOT + 1;
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM HH:mm:ss").withZone(ZoneId.systemDefault());

    private final BlockLogStore store;

    public BlockLogGui(BlockLogStore store) {
        this.store = store;
    }

    public void open(Player viewer, Block block) {
        if (block == null) return;
        String blockKey = BlockLogStore.keyOf(block);
        if (blockKey == null) return;

        List<BlockLogEntry> entries = store.getEntries(blockKey);
        String[] parts = blockKey.split(";");
        String world = parts.length >= 1 ? parts[0] : "?";
        String coords = parts.length >= 4 ? parts[1] + ", " + parts[2] + ", " + parts[3] : blockKey;
        String blockType = block.getType().name();

        BlockLogGuiHolder holder = new BlockLogGuiHolder(blockKey);
        String title = "Log bloc: " + blockType + " @ " + coords;
        if (title.length() > 32) title = title.substring(0, 32);
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE,
                Component.text(title).color(NamedTextColor.DARK_GRAY).decorate(TextDecoration.BOLD));
        holder.setInventory(inv);

        ItemStack border = new ItemStack(Material.GRAY_STAINED_GLASS_PANE);
        ItemMeta bMeta = border.getItemMeta();
        if (bMeta != null) bMeta.displayName(Component.text(" "));
        border.setItemMeta(bMeta);
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 45; i < GUI_SIZE; i++) inv.setItem(i, border);
        for (int i = 9; i < 45; i++) {
            if (i % 9 == 0 || i % 9 == 8) inv.setItem(i, border);
        }

        ItemStack infoItem = new ItemStack(block.getType());
        if (infoItem.getType() == Material.AIR) infoItem = new ItemStack(Material.GRASS_BLOCK);
        infoItem.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text(blockType + " @ " + coords).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));
            m.lore(List.of(
                    Component.text("Monde: " + world).color(NamedTextColor.GRAY),
                    Component.text(entries.size() + " événement(s) enregistré(s)").color(NamedTextColor.GRAY)
            ));
        });
        inv.setItem(SLOT_INFO, infoItem);

        int slot = FIRST_SLOT;
        for (BlockLogEntry entry : entries) {
            if (slot > LAST_SLOT) break;
            if (slot % 9 == 0 || slot % 9 == 8) slot++;
            inv.setItem(slot, entryItem(entry));
            slot++;
        }

        ItemStack back = new ItemStack(Material.ARROW);
        back.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Fermer").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK, back);

        viewer.openInventory(inv);
    }

    private ItemStack entryItem(BlockLogEntry entry) {
        Material mat = switch (entry.getType()) {
            case BREAK -> Material.RED_CONCRETE;
            case PLACE -> Material.LIME_CONCRETE;
            case INTERACT -> Material.YELLOW_CONCRETE;
        };
        ItemStack item = new ItemStack(mat);
        String date = DATE_FMT.format(Instant.ofEpochMilli(entry.getTimestamp()));
        item.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text(entry.getType().getLabel() + " — " + entry.getPlayerName()).color(NamedTextColor.WHITE));
            m.lore(List.of(
                    Component.text("Joueur: " + entry.getPlayerName()).color(NamedTextColor.GRAY),
                    Component.text("Date: " + date).color(NamedTextColor.DARK_GRAY)
            ));
        });
        return item;
    }
}
