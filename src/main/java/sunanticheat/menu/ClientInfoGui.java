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
import org.bukkit.inventory.meta.SkullMeta;
import sunanticheat.client.ClientInfo;
import sunanticheat.client.ClientInfoTracker;
import sunanticheat.playtime.PlaytimeTracker;

import java.util.ArrayList;
import java.util.List;

/**
 * GUI : liste des joueurs (têtes) → clic ouvre le détail (compte premium/crack, client, mods, packs).
 */
public class ClientInfoGui {

    private static final int LIST_SIZE = 54;
    public static final int SLOT_BACK_LIST = 49;
    private static final int DETAIL_SIZE = 45;
    public static final int SLOT_BACK_DETAIL = 22;
    private static final int MAX_LORE_MODS = 12;
    private static final int MAX_LORE_PACKS = 8;

    private final ClientInfoListHolder listHolder = new ClientInfoListHolder();
    private final ClientInfoTracker tracker;
    private PlaytimeTracker playtimeTracker;

    public ClientInfoGui(ClientInfoTracker tracker) {
        this.tracker = tracker;
    }

    public void setPlaytimeTracker(PlaytimeTracker playtimeTracker) {
        this.playtimeTracker = playtimeTracker;
    }

    public ClientInfoListHolder getListHolder() {
        return listHolder;
    }

    public void open(Player viewer) {
        Inventory inv = Bukkit.createInventory(listHolder, LIST_SIZE,
                Component.text("Infos client — Joueurs").color(NamedTextColor.DARK_GRAY).decorate(TextDecoration.BOLD));
        listHolder.setInventory(inv);

        ItemStack border = new ItemStack(Material.GRAY_STAINED_GLASS_PANE);
        ItemMeta borderMeta = border.getItemMeta();
        if (borderMeta != null) borderMeta.displayName(Component.text(" "));
        border.setItemMeta(borderMeta);
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 45; i < LIST_SIZE; i++) inv.setItem(i, border);
        for (int row = 1; row < 5; row++) {
            inv.setItem(row * 9, border);
            inv.setItem(row * 9 + 8, border);
        }

        ItemStack back = new ItemStack(Material.ARROW);
        back.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Menu principal").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK_LIST, back);

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
            ClientInfo info = tracker.getInfo(player.getUniqueId());
            String brand = info != null && info.getClientBrand() != null ? info.getClientBrand() : "?";
            List<Component> lore = new ArrayList<>();
            lore.add(Component.text("Client: " + brand).color(NamedTextColor.GRAY));
            if (playtimeTracker != null) {
                long sec = playtimeTracker.getTotalPlaytimeSeconds(player.getUniqueId());
                lore.add(Component.text("Temps de jeu: " + PlaytimeTracker.formatPlaytime(sec)).color(NamedTextColor.DARK_AQUA));
            }
            lore.add(Component.text("Clic pour détail (compte, mods, packs)").color(NamedTextColor.DARK_GRAY));
            meta.displayName(Component.text(player.getName()).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));
            meta.lore(lore);
        });
        return skull;
    }

    public void openDetail(Player viewer, Player target) {
        ClientInfoDetailHolder holder = new ClientInfoDetailHolder(target.getUniqueId());
        String name = target.getName();
        Inventory inv = Bukkit.createInventory(holder, DETAIL_SIZE,
                Component.text("Client: " + name).color(NamedTextColor.DARK_GRAY).decorate(TextDecoration.BOLD));
        holder.setInventory(inv);

        ClientInfo info = tracker.getOrCreate(target.getUniqueId());

        // Tête du joueur (slot 4)
        ItemStack head = new ItemStack(Material.PLAYER_HEAD);
        head.editMeta(SkullMeta.class, m -> m.setOwningPlayer(target));
        inv.setItem(4, head);

        // Compte : Premium ou Crack possible (slot 10)
        ItemStack compte = new ItemStack(Material.GOLD_INGOT);
        String compteText = info.getPremium() == null ? "Inconnu"
                : Boolean.TRUE.equals(info.getPremium()) ? "Premium (authentifié Mojang)" : "Serveur hors-ligne (crack possible)";
        compte.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Compte").color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));
            m.lore(List.of(Component.text(compteText).color(NamedTextColor.GRAY)));
        });
        inv.setItem(10, compte);

        // Marque client (slot 12)
        String brand = info.getClientBrand() != null ? info.getClientBrand() : "vanilla";
        ItemStack clientItem = new ItemStack(Material.COMPASS);
        clientItem.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Client").color(NamedTextColor.YELLOW).decorate(TextDecoration.BOLD));
            m.lore(List.of(Component.text(brand).color(NamedTextColor.GRAY)));
        });
        inv.setItem(12, clientItem);

        // Temps de jeu (slot 13)
        if (playtimeTracker != null) {
            long totalSeconds = playtimeTracker.getTotalPlaytimeSeconds(target.getUniqueId());
            String playtimeStr = PlaytimeTracker.formatPlaytime(totalSeconds);
            ItemStack playtimeItem = new ItemStack(Material.CLOCK);
            playtimeItem.editMeta(ItemMeta.class, m -> {
                m.displayName(Component.text("Temps de jeu").color(NamedTextColor.AQUA).decorate(TextDecoration.BOLD));
                m.lore(List.of(Component.text(playtimeStr).color(NamedTextColor.GRAY)));
            });
            inv.setItem(13, playtimeItem);
        }

        // Mods (slot 14)
        List<String> mods = info.getMods();
        ItemStack modsItem = new ItemStack(Material.BOOK);
        List<Component> modLore = new ArrayList<>();
        if (mods.isEmpty()) {
            modLore.add(Component.text("Non communiqué").color(NamedTextColor.DARK_GRAY));
            modLore.add(Component.text("(mod SunGuard côté client pour lister)").color(NamedTextColor.DARK_GRAY));
        } else {
            modLore.add(Component.text("Nombre: " + mods.size()).color(NamedTextColor.GRAY));
            int show = Math.min(mods.size(), MAX_LORE_MODS);
            for (int i = 0; i < show; i++) {
                modLore.add(Component.text("• " + mods.get(i)).color(NamedTextColor.WHITE));
            }
            if (mods.size() > MAX_LORE_MODS) {
                modLore.add(Component.text("... et " + (mods.size() - MAX_LORE_MODS) + " autre(s)").color(NamedTextColor.DARK_GRAY));
            }
        }
        modsItem.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Mods").color(NamedTextColor.AQUA).decorate(TextDecoration.BOLD));
            m.lore(modLore);
        });
        inv.setItem(14, modsItem);

        // Packs de ressources (slot 16)
        List<String> packs = info.getResourcePacks();
        ItemStack packsItem = new ItemStack(Material.PAINTING);
        List<Component> packLore = new ArrayList<>();
        if (packs.isEmpty()) {
            packLore.add(Component.text("Non communiqué").color(NamedTextColor.DARK_GRAY));
        } else {
            packLore.add(Component.text("Nombre: " + packs.size()).color(NamedTextColor.GRAY));
            int show = Math.min(packs.size(), MAX_LORE_PACKS);
            for (int i = 0; i < show; i++) {
                packLore.add(Component.text("• " + packs.get(i)).color(NamedTextColor.WHITE));
            }
            if (packs.size() > MAX_LORE_PACKS) {
                packLore.add(Component.text("... et " + (packs.size() - MAX_LORE_PACKS) + " autre(s)").color(NamedTextColor.DARK_GRAY));
            }
        }
        packsItem.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Packs de ressources").color(NamedTextColor.LIGHT_PURPLE).decorate(TextDecoration.BOLD));
            m.lore(packLore);
        });
        inv.setItem(16, packsItem);

        // Bordure
        ItemStack border = new ItemStack(Material.GRAY_STAINED_GLASS_PANE);
        border.editMeta(ItemMeta.class, m -> m.displayName(Component.text(" ")));
        for (int i = 18; i < 27; i++) inv.setItem(i, border);
        for (int i = 27; i < DETAIL_SIZE; i++) inv.setItem(i, border);

        ItemStack backDetail = new ItemStack(Material.ARROW);
        backDetail.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Liste des joueurs").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK_DETAIL, backDetail);

        viewer.openInventory(inv);
    }
}
