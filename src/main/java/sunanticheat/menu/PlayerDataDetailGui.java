package sunanticheat.menu;

import net.milkbowl.vault.economy.Economy;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.attribute.Attribute;
import org.bukkit.inventory.meta.SkullMeta;
import sunanticheat.client.ClientInfo;
import sunanticheat.client.ClientInfoTracker;
import sunanticheat.connection.ConnectionLogStorage;
import sunanticheat.connection.ConnectionLogStorage.ConnectionSession;
import sunanticheat.freecam.FreecamTracker;
import sunanticheat.playtime.PlaytimeTracker;
import sunanticheat.sanction.SanctionService;
import sunanticheat.xray.BlockMiningStats;
import sunanticheat.xray.XRayTracker;

import java.net.InetSocketAddress;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * GUI détaillée : maximum de données utiles sur un joueur (vie, position, playtime, client, X-Ray, freecam, etc.).
 */
public class PlayerDataDetailGui {

    private static final int GUI_SIZE = 54;
    private static final int SLOT_HEAD = 4;
    private static final int SLOT_BACK = 49;
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.systemDefault());

    private final ClientInfoTracker clientInfoTracker;
    private final PlaytimeTracker playtimeTracker;
    private final SanctionService sanctionService;
    private final XRayTracker xRayTracker;
    private final FreecamTracker freecamTracker;
    private final ConnectionLogStorage connectionLog;
    private final Economy economy;
    private PlayerDataListGui listGui;

    public PlayerDataDetailGui(ClientInfoTracker clientInfoTracker, PlaytimeTracker playtimeTracker,
                               SanctionService sanctionService, XRayTracker xRayTracker, FreecamTracker freecamTracker) {
        this(clientInfoTracker, playtimeTracker, sanctionService, xRayTracker, freecamTracker, null, null);
    }

    public PlayerDataDetailGui(ClientInfoTracker clientInfoTracker, PlaytimeTracker playtimeTracker,
                               SanctionService sanctionService, XRayTracker xRayTracker, FreecamTracker freecamTracker,
                               ConnectionLogStorage connectionLog) {
        this(clientInfoTracker, playtimeTracker, sanctionService, xRayTracker, freecamTracker, connectionLog, null);
    }

    public PlayerDataDetailGui(ClientInfoTracker clientInfoTracker, PlaytimeTracker playtimeTracker,
                               SanctionService sanctionService, XRayTracker xRayTracker, FreecamTracker freecamTracker,
                               ConnectionLogStorage connectionLog, Economy economy) {
        this.clientInfoTracker = clientInfoTracker;
        this.playtimeTracker = playtimeTracker;
        this.sanctionService = sanctionService;
        this.xRayTracker = xRayTracker;
        this.freecamTracker = freecamTracker;
        this.connectionLog = connectionLog;
        this.economy = economy;
    }

    public void setListGui(PlayerDataListGui listGui) {
        this.listGui = listGui;
    }

    public void open(Player viewer, Player target) {
        if (target == null || !target.isOnline()) {
            viewer.sendMessage(Component.text("Ce joueur n'est plus en ligne.").color(NamedTextColor.RED));
            return;
        }
        PlayerDataDetailHolder holder = new PlayerDataDetailHolder(target.getUniqueId());
        String title = "Fiche: " + target.getName();
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE,
                Component.text(title).color(NamedTextColor.DARK_AQUA).decorate(TextDecoration.BOLD));
        holder.setInventory(inv);

        ItemStack border = new ItemStack(Material.GRAY_STAINED_GLASS_PANE);
        ItemMeta bMeta = border.getItemMeta();
        if (bMeta != null) bMeta.displayName(Component.text(" "));
        border.setItemMeta(bMeta);
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 45; i < GUI_SIZE; i++) inv.setItem(i, border);
        for (int r = 1; r < 5; r++) {
            inv.setItem(r * 9, border);
            inv.setItem(r * 9 + 8, border);
        }

        // Tête
        ItemStack head = new ItemStack(Material.PLAYER_HEAD);
        head.editMeta(SkullMeta.class, m -> m.setOwningPlayer(target));
        inv.setItem(SLOT_HEAD, head);

        // Ligne 1 (10-16): Identité & réseau
        inv.setItem(10, item(Material.NAME_TAG, "Nom", target.getName()));
        inv.setItem(11, item(Material.PAPER, "UUID", target.getUniqueId().toString().substring(0, 8) + "..."));
        String ip = "—";
        if (target.getAddress() != null && target.getAddress().getAddress() != null) {
            ip = target.getAddress().getAddress().getHostAddress();
        }
        inv.setItem(12, item(Material.COMPARATOR, "IP", ip));
        int ping = 0;
        try {
            ping = target.getPing();
        } catch (Throwable ignored) { }
        inv.setItem(13, item(Material.REPEATER, "Ping", ping + " ms"));
        inv.setItem(14, item(Material.WRITABLE_BOOK, "Nom affiché", PlainTextComponentSerializer.plainText().serialize(target.displayName())));

        // Ligne 2 (19-25): Vie & gameplay
        double maxHp = target.getAttribute(Attribute.GENERIC_MAX_HEALTH) != null ? target.getAttribute(Attribute.GENERIC_MAX_HEALTH).getValue() : 20.0;
        inv.setItem(19, item(Material.RED_DYE, "Vie", String.format("%.1f / %.1f", target.getHealth(), maxHp)));
        inv.setItem(20, item(Material.COOKED_BEEF, "Faim", target.getFoodLevel() + "/20 (saturation " + (int) target.getSaturation() + ")"));
        inv.setItem(21, item(Material.EXPERIENCE_BOTTLE, "Niveau", target.getLevel() + " (total XP: " + target.getTotalExperience() + ")"));
        inv.setItem(22, item(Material.GRASS_BLOCK, "Mode", target.getGameMode().name()));
        inv.setItem(23, item(Material.COMMAND_BLOCK, "OP", target.isOp() ? "Oui" : "Non"));
        if (economy != null) {
            try {
                double balance = economy.getBalance(target);
                inv.setItem(24, item(Material.GOLD_INGOT, "Argent", economy.format(balance)));
            } catch (Throwable ignored) {
                inv.setItem(24, item(Material.GOLD_INGOT, "Argent", "—"));
            }
        }

        // Ligne 3 (28-34): Position & dates
        Location loc = target.getLocation();
        inv.setItem(28, item(Material.MAP, "Monde", loc.getWorld() != null ? loc.getWorld().getName() : "—"));
        inv.setItem(29, item(Material.STONE, "Position", String.format("%d, %d, %d", loc.getBlockX(), loc.getBlockY(), loc.getBlockZ())));
        long first = target.getFirstPlayed();
        long lastSeen = target.getLastSeen();
        inv.setItem(30, item(Material.CLOCK, "1ère connexion", first > 0 ? DATE_FMT.format(Instant.ofEpochMilli(first)) : "—"));
        inv.setItem(31, item(Material.CLOCK, "Dernière connexion", lastSeen > 0 ? DATE_FMT.format(Instant.ofEpochMilli(lastSeen)) : "—"));

        // Ligne 4 (37-43): Playtime, client, mods
        if (playtimeTracker != null) {
            long sec = playtimeTracker.getTotalPlaytimeSeconds(target.getUniqueId());
            inv.setItem(37, item(Material.CLOCK, "Temps de jeu", PlaytimeTracker.formatPlaytime(sec)));
        }
        ClientInfo info = clientInfoTracker != null ? clientInfoTracker.getOrCreate(target.getUniqueId()) : null;
        String brand = info != null && info.getClientBrand() != null ? info.getClientBrand() : "vanilla";
        inv.setItem(38, item(Material.COMPASS, "Client", brand));
        String premium = info != null && info.getPremium() != null
                ? (Boolean.TRUE.equals(info.getPremium()) ? "Premium" : "Crack/Hors-ligne")
                : "?";
        inv.setItem(39, item(Material.GOLD_INGOT, "Compte", premium));
        int modCount = info != null ? info.getMods().size() : 0;
        int packCount = info != null ? info.getResourcePacks().size() : 0;
        inv.setItem(40, item(Material.BOOK, "Mods", modCount + " mod(s)"));
        inv.setItem(41, item(Material.PAINTING, "Packs", packCount + " pack(s)"));

        // Sanctions
        boolean muted = sanctionService != null && sanctionService.getMuteStorage().isMuted(target.getUniqueId());
        boolean frozen = sanctionService != null && sanctionService.isFrozen(target.getUniqueId());
        inv.setItem(42, item(Material.GRAY_DYE, "Mute", muted ? "Oui" : "Non"));
        inv.setItem(43, item(Material.ICE, "Freeze", frozen ? "Oui" : "Non"));

        // X-Ray & Freecam
        BlockMiningStats xray = xRayTracker != null ? xRayTracker.getStats(target.getUniqueId()) : null;
        if (xray != null) {
            String xrayStr = "Total: " + xray.getTotal() + " | Diamant %: " + String.format("%.1f", xray.getDiamondPercentage())
                    + " | Précieux %: " + String.format("%.1f", xray.getValuablePercentage())
                    + " | D/1000: " + String.format("%.1f", xray.getDiamondPerThousandCommon());
            inv.setItem(46, item(Material.DIAMOND_ORE, "X-Ray stats", xrayStr));
        }
        if (freecamTracker != null) {
            var fc = freecamTracker.getStats(target.getUniqueId());
            if (fc != null) {
                inv.setItem(47, item(Material.SPYGLASS, "Freecam", "Valides: " + fc.getValid() + " | Suspectes: " + fc.getSuspicious()));
            }
        }
        // Historique sanctions + Inventaire + Ramassages
        inv.setItem(48, item(Material.BOOK, "Historique sanctions", "Voir les sanctions reçues par ce joueur"));
        inv.setItem(50, item(Material.CHEST, "Voir inventaire", "Ouvrir l'inventaire complet (lecture seule)"));
        inv.setItem(53, item(Material.HOPPER, "Historique ramassages", "Items ramassés (48 dernières heures)"));

        // Effets, déplacements
        int effects = target.getActivePotionEffects().size();
        inv.setItem(36, item(Material.POTION, "Effets", effects + " effet(s) actif(s)"));
        String move = "Sneak: " + target.isSneaking() + " | Sprint: " + target.isSprinting() + " | Fly: " + target.isFlying();
        inv.setItem(44, item(Material.LEATHER_BOOTS, "Déplacement", move));
        inv.setItem(45, item(Material.FEATHER, "Vitesse", String.format("Marche: %.2f | Vol: %.2f", target.getWalkSpeed(), target.getFlySpeed())));

        // Lit spawn
        Location bed = target.getRespawnLocation();
        if (bed != null && bed.getWorld() != null) {
            inv.setItem(52, item(Material.RED_BED, "Spawn lit", bed.getWorld().getName() + " " + bed.getBlockX() + "," + bed.getBlockY() + "," + bed.getBlockZ()));
        }
        // Historique connexions
        if (connectionLog != null) {
            List<ConnectionSession> sessions = connectionLog.getSessions(target.getUniqueId(), 5);
            if (!sessions.isEmpty()) {
                StringBuilder sb = new StringBuilder();
                for (ConnectionSession s : sessions) {
                    if (sb.length() > 0) sb.append(" | ");
                    sb.append(s.getIp()).append(" ").append(DATE_FMT.format(Instant.ofEpochMilli(s.getJoinTime())));
                }
                inv.setItem(51, item(Material.ENDER_PEARL, "Connexions", sb.toString()));
            }
        }

        // Retour
        ItemStack back = new ItemStack(Material.ARROW);
        back.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Liste des joueurs").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK, back);

        viewer.openInventory(inv);
    }

    public void openList(Player viewer) {
        if (listGui != null) listGui.open(viewer);
    }

    private ItemStack item(Material mat, String name, String value) {
        ItemStack i = new ItemStack(mat);
        i.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text(name).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));
            List<Component> lore = new ArrayList<>();
            if (value != null && value.length() > 40) {
                for (int start = 0; start < value.length(); start += 35) {
                    int end = Math.min(start + 35, value.length());
                    lore.add(Component.text(value.substring(start, end)).color(NamedTextColor.GRAY));
                }
            } else {
                lore.add(Component.text(value != null ? value : "—").color(NamedTextColor.GRAY));
            }
            m.lore(lore);
        });
        return i;
    }

    public PlayerDataListGui getListGui() {
        return listGui;
    }
}
