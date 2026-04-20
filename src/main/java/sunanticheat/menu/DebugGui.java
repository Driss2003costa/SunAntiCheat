package sunanticheat.menu;

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
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.alerts.StaffAlertService;
import sunanticheat.discord.DiscordWebhook;

import java.util.List;

/**
 * GUI de debug : boutons de test (Discord webhook, alerte en jeu, etc.).
 */
public class DebugGui {

    public static final int SLOT_TEST_DISCORD = 11;
    public static final int SLOT_TEST_ALERT = 13;
    public static final int SLOT_TEST_REPORT_DISCORD = 15;
    public static final int SLOT_BACK = 22;

    private static final int GUI_SIZE = 27;

    private final JavaPlugin plugin;
    private final DiscordWebhook discordWebhook;
    private final StaffAlertService staffAlertService;

    public DebugGui(JavaPlugin plugin, DiscordWebhook discordWebhook, StaffAlertService staffAlertService) {
        this.plugin = plugin;
        this.discordWebhook = discordWebhook;
        this.staffAlertService = staffAlertService;
    }

    public void open(Player player) {
        Holder holder = new Holder();
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE,
                Component.text("SunAntiCheat — Debug").color(NamedTextColor.DARK_GRAY).decorate(TextDecoration.BOLD));
        holder.setInventory(inv);

        ItemStack border = new ItemStack(Material.GRAY_STAINED_GLASS_PANE);
        ItemMeta bm = border.getItemMeta();
        if (bm != null) bm.displayName(Component.text(" "));
        border.setItemMeta(bm);
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 18; i < GUI_SIZE; i++) inv.setItem(i, border);
        inv.setItem(9, border);
        inv.setItem(17, border);

        boolean discordOk = discordWebhook != null && discordWebhook.isEnabled();
        inv.setItem(SLOT_TEST_DISCORD, item(Material.EMERALD_BLOCK, "Test Discord Webhook",
                discordOk ? NamedTextColor.GREEN : NamedTextColor.RED,
                discordOk ? "Envoie un message test sur le channel Discord" : "Webhook non configuré (config + enabled)"));

        inv.setItem(SLOT_TEST_ALERT, item(Material.GOLD_BLOCK, "Test alerte en jeu",
                NamedTextColor.GOLD,
                "Envoie une alerte test à tous les staff (permission sunguard.alerts)"));

        inv.setItem(SLOT_TEST_REPORT_DISCORD, item(Material.PAPER, "Test report Discord",
                discordOk ? NamedTextColor.GREEN : NamedTextColor.GRAY,
                discordOk ? "Simule l'envoi d'un report sur Discord" : "Webhook désactivé"));

        ItemStack back = new ItemStack(Material.ARROW);
        back.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Menu principal").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK, back);

        player.openInventory(inv);
    }

    private static ItemStack item(Material mat, String name, NamedTextColor color, String lore) {
        ItemStack i = new ItemStack(mat);
        i.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text(name).color(color).decorate(TextDecoration.BOLD));
            m.lore(List.of(Component.text(lore).color(NamedTextColor.GRAY)));
        });
        return i;
    }

    public void onTestDiscord(Player player) {
        player.sendMessage(Component.text("Envoi Discord manuel désactivé (seuls MV-Inv scan et player scan sont autorisés).").color(NamedTextColor.GRAY));
    }

    public void onTestAlert(Player player) {
        if (plugin.getServer().getOnlinePlayers().stream().noneMatch(p -> p.hasPermission(sunanticheat.Permissions.ALERTS))) {
            player.sendMessage(Component.text("Aucun staff avec la permission sunguard.alerts en ligne.").color(NamedTextColor.GRAY));
            return;
        }
        if (staffAlertService != null) {
            staffAlertService.alertXRay(player, "Test debug — indice fictif");
            player.sendMessage(Component.text("Alerte test envoyée aux staff.").color(NamedTextColor.GREEN));
        } else {
            player.sendMessage(Component.text("Service d'alertes non disponible.").color(NamedTextColor.RED));
        }
    }

    public void onTestReportDiscord(Player player) {
        player.sendMessage(Component.text("Report Discord désactivé (seuls MV-Inv scan et player scan sont autorisés).").color(NamedTextColor.GRAY));
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
