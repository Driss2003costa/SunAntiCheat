package sunanticheat.menu;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.freecam.FreecamGui;
import sunanticheat.pickup.ItemPickupHistoryGui;
import sunanticheat.xray.XRayGui;

import java.util.List;

/**
 * Menu principal SunAntiCheat (54 slots) : Anti X-Ray, Freecam, Fiche joueur, Infos client, Sanctions, Reports.
 */
public class MainMenuGui {

    private static final int GUI_SIZE = 54;

    public static final int SLOT_XRAY = 10;
    public static final int SLOT_FREECAM = 12;
    public static final int SLOT_PLAYER_DATA = 14;
    public static final int SLOT_CLIENT_INFO = 16;
    public static final int SLOT_SANCTIONS = 19;
    public static final int SLOT_REPORTS = 21;
    public static final int SLOT_DEBUG = 23;

    private final MainMenuHolder holder = new MainMenuHolder();
    private JavaPlugin plugin;
    private final XRayGui xRayGui;
    private final PlayerListGui playerListGui;
    private final FreecamGui freecamGui;
    private final ClientInfoGui clientInfoGui;
    private sunanticheat.sanction.SanctionPlayerListGui sanctionPlayerListGui;
    private PlayerDataListGui playerDataListGui;
    private sunanticheat.sanction.SanctionHistoryGui sanctionHistoryGui;
    private sunanticheat.report.ReportListGui reportListGui;
    private ItemPickupHistoryGui itemPickupHistoryGui;
    private DebugGui debugGui;

    public void setPlugin(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public void setDebugGui(DebugGui debugGui) {
        this.debugGui = debugGui;
    }

    public MainMenuGui(XRayGui xRayGui, PlayerListGui playerListGui, FreecamGui freecamGui, ClientInfoGui clientInfoGui) {
        this.xRayGui = xRayGui;
        this.playerListGui = playerListGui;
        this.freecamGui = freecamGui;
        this.clientInfoGui = clientInfoGui;
    }

    public void setSanctionPlayerListGui(sunanticheat.sanction.SanctionPlayerListGui gui) {
        this.sanctionPlayerListGui = gui;
    }

    public void setPlayerDataListGui(PlayerDataListGui gui) {
        this.playerDataListGui = gui;
    }

    public void setSanctionHistoryGui(sunanticheat.sanction.SanctionHistoryGui gui) {
        this.sanctionHistoryGui = gui;
    }

    public void setReportListGui(sunanticheat.report.ReportListGui gui) {
        this.reportListGui = gui;
    }

    public void setItemPickupHistoryGui(ItemPickupHistoryGui gui) {
        this.itemPickupHistoryGui = gui;
    }

    public MainMenuHolder getHolder() {
        return holder;
    }

    public void open(Player player) {
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE, Component.text("SunAntiCheat - Menu")
                .color(NamedTextColor.DARK_GRAY)
                .decorate(TextDecoration.BOLD));
        holder.setInventory(inv);

        ItemStack border = new ItemStack(Material.GRAY_STAINED_GLASS_PANE);
        ItemMeta borderMeta = border.getItemMeta();
        if (borderMeta != null) borderMeta.displayName(Component.text(" "));
        border.setItemMeta(borderMeta);

        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 45; i < GUI_SIZE; i++) inv.setItem(i, border);
        for (int row = 1; row < 5; row++) {
            inv.setItem(row * 9, border);
            inv.setItem(row * 9 + 8, border);
        }

        inv.setItem(SLOT_XRAY, item(Material.DIAMOND_ORE, "Anti X-Ray", NamedTextColor.GOLD,
                "Statistiques de minage et indice de suspicion par joueur"));
        inv.setItem(SLOT_FREECAM, item(Material.SPYGLASS, "Anti Freecam", NamedTextColor.GOLD,
                "Détection freecam : actions hors champ de vision"));
        inv.setItem(SLOT_PLAYER_DATA, item(Material.PLAYER_HEAD, "Fiche joueur", NamedTextColor.AQUA,
                "Vie, position, playtime, client, X-Ray… Données complètes par joueur"));
        inv.setItem(SLOT_CLIENT_INFO, item(Material.NAME_TAG, "Infos client", NamedTextColor.GOLD,
                "Premium/crack, client (Forge/Fabric), mods et packs"));
        inv.setItem(SLOT_SANCTIONS, item(Material.NETHERITE_SWORD, "Sanctions", NamedTextColor.DARK_RED,
                "Kick, ban, mute, freeze… Menu complet de sanctions"));
        inv.setItem(SLOT_REPORTS, item(Material.PAPER, "Reports", NamedTextColor.YELLOW,
                "Voir les signalements des joueurs"));

        if (plugin != null && plugin.getConfig().getBoolean("debug.enabled", false) && debugGui != null) {
            inv.setItem(SLOT_DEBUG, item(Material.COMMAND_BLOCK, "Debug", NamedTextColor.LIGHT_PURPLE,
                    "Tests : Discord webhook, alertes…"));
        }

        player.openInventory(inv);
    }

    private static ItemStack item(Material mat, String name, net.kyori.adventure.text.format.TextColor color, String lore) {
        ItemStack i = new ItemStack(mat);
        i.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text(name).color(color).decorate(TextDecoration.BOLD));
            m.lore(List.of(Component.text(lore).color(NamedTextColor.GRAY)));
        });
        return i;
    }

    public XRayGui getXRayGui() {
        return xRayGui;
    }

    public PlayerListGui getPlayerListGui() {
        return playerListGui;
    }

    public FreecamGui getFreecamGui() {
        return freecamGui;
    }

    public ClientInfoGui getClientInfoGui() {
        return clientInfoGui;
    }

    public sunanticheat.sanction.SanctionPlayerListGui getSanctionPlayerListGui() {
        return sanctionPlayerListGui;
    }

    public PlayerDataListGui getPlayerDataListGui() {
        return playerDataListGui;
    }

    public sunanticheat.sanction.SanctionHistoryGui getSanctionHistoryGui() {
        return sanctionHistoryGui;
    }

    public sunanticheat.report.ReportListGui getReportListGui() {
        return reportListGui;
    }

    public ItemPickupHistoryGui getItemPickupHistoryGui() {
        return itemPickupHistoryGui;
    }

    public DebugGui getDebugGui() {
        return debugGui;
    }

    /** Ouvre directement le menu des sanctions pour un joueur cible (ex. depuis une alerte). */
    public void openSanctionMenuFor(Player viewer, Player target) {
        if (sanctionPlayerListGui != null && sanctionPlayerListGui.getSanctionMenuGui() != null) {
            sanctionPlayerListGui.getSanctionMenuGui().open(viewer, target);
        }
    }
}
