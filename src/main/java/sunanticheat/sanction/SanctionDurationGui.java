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
import java.util.List;

/**
 * GUI pour choisir la durée d'un ban ou mute temporaire. Applique la sanction puis ferme / retour au menu.
 */
public class SanctionDurationGui {

    // Durées en millisecondes
    public static final long DURATION_1M = 60 * 1000L;
    public static final long DURATION_5M = 5 * 60 * 1000L;
    public static final long DURATION_15M = 15 * 60 * 1000L;
    public static final long DURATION_1H = 60 * 60 * 1000L;
    public static final long DURATION_6H = 6 * 60 * 60 * 1000L;
    public static final long DURATION_1D = 24 * 60 * 60 * 1000L;
    public static final long DURATION_7D = 7 * 24 * 60 * 60 * 1000L;
    public static final long DURATION_30D = 30 * 24 * 60 * 60 * 1000L;

    public static final int SLOT_1M = 10;
    public static final int SLOT_5M = 11;
    public static final int SLOT_15M = 12;
    public static final int SLOT_1H = 13;
    public static final int SLOT_6H = 14;
    public static final int SLOT_1D = 15;
    public static final int SLOT_7D = 16;
    public static final int SLOT_30D = 17;
    public static final int SLOT_BACK = 22;

    private static final int GUI_SIZE = 27;
    private final SanctionService sanctionService;
    private final SanctionMenuGui sanctionMenuGui;

    public SanctionDurationGui(SanctionService sanctionService, SanctionMenuGui sanctionMenuGui) {
        this.sanctionService = sanctionService;
        this.sanctionMenuGui = sanctionMenuGui;
    }

    public void open(Player viewer, Player target, String type) {
        if (target == null || !target.isOnline()) {
            viewer.sendMessage(Component.text("Ce joueur n'est plus en ligne.").color(NamedTextColor.RED));
            return;
        }
        SanctionDurationHolder holder = new SanctionDurationHolder(target, type);
        boolean isBan = SanctionDurationHolder.TYPE_BAN_TEMP.equals(type);
        String title = isBan ? "Durée du bannissement" : "Durée du mute";
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE,
                Component.text(title + " — " + target.getName()).color(NamedTextColor.DARK_RED).decorate(TextDecoration.BOLD));
        holder.setInventory(inv);

        ItemStack border = new ItemStack(Material.ORANGE_STAINED_GLASS_PANE);
        ItemMeta bm = border.getItemMeta();
        if (bm != null) bm.displayName(Component.text(" "));
        border.setItemMeta(bm);
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 18; i < 27; i++) inv.setItem(i, border);

        inv.setItem(SLOT_1M, durationItem(Material.LIME_DYE, "1 minute"));
        inv.setItem(SLOT_5M, durationItem(Material.LIME_DYE, "5 minutes"));
        inv.setItem(SLOT_15M, durationItem(Material.YELLOW_DYE, "15 minutes"));
        inv.setItem(SLOT_1H, durationItem(Material.ORANGE_DYE, "1 heure"));
        inv.setItem(SLOT_6H, durationItem(Material.ORANGE_DYE, "6 heures"));
        inv.setItem(SLOT_1D, durationItem(Material.RED_DYE, "1 jour"));
        inv.setItem(SLOT_7D, durationItem(Material.RED_DYE, "7 jours"));
        inv.setItem(SLOT_30D, durationItem(Material.PURPLE_DYE, "30 jours"));

        ItemStack back = new ItemStack(Material.ARROW);
        back.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Retour au menu des sanctions").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK, back);

        viewer.openInventory(inv);
    }

    private ItemStack durationItem(Material mat, String label) {
        ItemStack i = new ItemStack(mat);
        i.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text(label).color(NamedTextColor.GOLD));
            m.lore(List.of(Component.text("Clic pour appliquer").color(NamedTextColor.GRAY)));
        });
        return i;
    }

    private SanctionHistoryStorage historyStorage;

    public void setHistoryStorage(SanctionHistoryStorage historyStorage) {
        this.historyStorage = historyStorage;
    }

    public void applyDuration(Player staff, Player target, String type, long durationMillis) {
        if (target == null || !target.isOnline()) return;
        long end = System.currentTimeMillis() + durationMillis;
        String reason = "Sanctionné par le staff";

        if (historyStorage != null) {
            String typeKey = SanctionDurationHolder.TYPE_BAN_TEMP.equals(type) ? "BAN_TEMP" : "MUTE_TEMP";
            historyStorage.add(new SanctionHistoryEntry(typeKey, target.getUniqueId(), target.getName(),
                    staff.getUniqueId(), staff.getName(), reason, durationMillis, System.currentTimeMillis()));
        }
        if (SanctionDurationHolder.TYPE_BAN_TEMP.equals(type)) {
            sanctionService.banTemporary(target, reason, end, staff.getName());
            staff.sendMessage(Component.text("Joueur " + target.getName() + " banni temporairement.").color(NamedTextColor.GREEN));
        } else {
            sanctionService.muteTemporary(target, end);
            staff.sendMessage(Component.text("Joueur " + target.getName() + " muté temporairement.").color(NamedTextColor.GREEN));
        }
    }

    public SanctionMenuGui getSanctionMenuGui() {
        return sanctionMenuGui;
    }
}
