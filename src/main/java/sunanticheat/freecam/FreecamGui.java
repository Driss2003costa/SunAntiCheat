package sunanticheat.freecam;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.SkullMeta;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * GUI Freecam : têtes des joueurs avec % d'actions suspectes (hors champ de vision / portée).
 */
public class FreecamGui {

    private static final int GUI_SIZE = 54;
    public static final int SLOT_BACK = 49;
    private final FreecamTracker tracker;

    public FreecamGui(FreecamTracker tracker) {
        this.tracker = tracker;
    }

    public void open(Player viewer) {
        FreecamGuiHolder holder = new FreecamGuiHolder();
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE, Component.text("Anti Freecam - Suspicion")
                .color(NamedTextColor.DARK_GRAY)
                .decorate(TextDecoration.BOLD));

        ItemStack border = new ItemStack(Material.GRAY_STAINED_GLASS_PANE);
        var borderMeta = border.getItemMeta();
        if (borderMeta != null) {
            borderMeta.displayName(Component.text(" "));
            border.setItemMeta(borderMeta);
        }
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 45; i < 54; i++) inv.setItem(i, border);
        for (int row = 1; row < 5; row++) {
            inv.setItem(row * 9, border);
            inv.setItem(row * 9 + 8, border);
        }

        Stream<OfflinePlayer> online = Bukkit.getOnlinePlayers().stream().map(p -> (OfflinePlayer) p);
        Stream<OfflinePlayer> offlineWithStats = tracker.getAllStats().keySet().stream()
                .filter(uuid -> Bukkit.getPlayer(uuid) == null)
                .map(Bukkit::getOfflinePlayer);
        List<OfflinePlayer> all = new ArrayList<>(Stream.concat(online, offlineWithStats).distinct().toList());
        all.sort(Comparator.comparingDouble((OfflinePlayer p) -> {
            FreecamTracker.FreecamStats s = tracker.getStats(p.getUniqueId());
            return s != null ? s.getSuspicionPercentage() : 0;
        }).reversed());

        int slot = 10;
        for (OfflinePlayer target : all) {
            if (slot >= 44) break;
            if (slot % 9 == 0 || slot % 9 == 8) slot++;
            inv.setItem(slot, createPlayerSkull(target));
            slot++;
        }

        ItemStack back = new ItemStack(Material.ARROW);
        back.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text("Retour").color(NamedTextColor.WHITE));
            m.lore(List.of(Component.text("Menu principal").color(NamedTextColor.GRAY)));
        });
        inv.setItem(SLOT_BACK, back);

        viewer.openInventory(inv);
    }

    public static class FreecamGuiHolder implements InventoryHolder {
        @Override
        public Inventory getInventory() {
            return null;
        }
    }

    private ItemStack createPlayerSkull(OfflinePlayer player) {
        UUID uuid = player.getUniqueId();
        ItemStack skull = new ItemStack(Material.PLAYER_HEAD);
        skull.editMeta(SkullMeta.class, meta -> {
            meta.setOwningPlayer(player);
            String name = player.getName() != null ? player.getName() : "Joueur";
            meta.displayName(Component.text(name).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));

            FreecamTracker.FreecamStats stats = tracker.getStats(uuid);
            long total = stats != null ? stats.getTotal() : 0;
            long suspicious = stats != null ? stats.getSuspicious() : 0;
            long valid = stats != null ? stats.getValid() : 0;
            double pct = stats != null ? stats.getSuspicionPercentage() : 0;

            List<Component> lore = new ArrayList<>();
            lore.add(Component.empty());
            lore.add(Component.text("Actions hors champ de vision / portée").color(NamedTextColor.GRAY));
            lore.add(Component.text("(cassage ou clic droit sur bloc « derrière » ou trop loin)").color(NamedTextColor.DARK_GRAY));
            lore.add(Component.empty());
            lore.add(Component.text(String.format("→ Suspectes: %d", suspicious)).color(NamedTextColor.RED));
            lore.add(Component.text(String.format("→ Valides: %d", valid)).color(NamedTextColor.GREEN));
            lore.add(Component.text("Total actions: " + total).color(NamedTextColor.AQUA));
            lore.add(Component.empty());
            lore.add(Component.text(String.format("Indice freecam: %.0f%%", pct)).color(pct >= 30 ? NamedTextColor.RED : pct >= 15 ? NamedTextColor.YELLOW : NamedTextColor.GREEN).decorate(TextDecoration.BOLD));
            lore.add(Component.empty());
            if (pct >= 50) {
                lore.add(Component.text("⚠ Très suspect (freecam probable)").color(NamedTextColor.RED));
            } else if (pct >= 25) {
                lore.add(Component.text("⚠ À surveiller").color(NamedTextColor.YELLOW));
            } else if (total > 0) {
                lore.add(Component.text("✓ Comportement normal").color(NamedTextColor.GREEN));
            }
            meta.lore(lore);
        });
        return skull;
    }
}
