package sunanticheat.xray;

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
import org.bukkit.plugin.java.JavaPlugin;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * GUI anti-x-ray : indice composite (%-précieux + ratio diamant/pierre), seuil min blocs, niveaux renforcés.
 */
public class XRayGui {

    private static final int GUI_SIZE = 54;
    public static final int SLOT_BACK = 49;

    private final JavaPlugin plugin;
    private final XRayTracker tracker;

    public XRayGui(JavaPlugin plugin, XRayTracker tracker) {
        this.plugin = plugin;
        this.tracker = tracker;
    }

    private int minBlocksForIndex() {
        return Math.max(1, plugin.getConfig().getInt("xray.min-blocks-for-index", 150));
    }

    private double diamondPerThousandSuspicious() {
        return plugin.getConfig().getDouble("xray.diamond-per-thousand-common-suspicious", 2.5);
    }

    private double valuableVeryHigh() {
        return plugin.getConfig().getDouble("xray.valuable-percent-very-high", 65);
    }

    private double valuableHigh() {
        return plugin.getConfig().getDouble("xray.valuable-percent-high", 45);
    }

    private double valuableMedium() {
        return plugin.getConfig().getDouble("xray.valuable-percent-medium", 22);
    }

    private boolean useCompositeIndex() {
        return plugin.getConfig().getBoolean("xray.use-composite-index", true);
    }

    public void open(Player viewer) {
        XRayGuiHolder holder = new XRayGuiHolder();
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE, Component.text("Anti X-Ray - Suspicion")
                .color(NamedTextColor.DARK_GRAY)
                .decorate(TextDecoration.BOLD));

        // Remplir les bords avec du verre gris (optionnel)
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

        // Têtes : du plus suspect au moins suspect (score composite)
        Stream<OfflinePlayer> online = Bukkit.getOnlinePlayers().stream().map(p -> (OfflinePlayer) p);
        Stream<OfflinePlayer> offlineWithStats = tracker.getAllStats().keySet().stream()
                .filter(uuid -> Bukkit.getPlayer(uuid) == null)
                .map(Bukkit::getOfflinePlayer);
        List<OfflinePlayer> all = new ArrayList<>(Stream.concat(online, offlineWithStats).distinct().toList());
        int minBlocks = minBlocksForIndex();
        double diamondThreshold = diamondPerThousandSuspicious();
        all.sort(Comparator.comparingDouble((OfflinePlayer p) -> computeCompositeScore(tracker.getStats(p.getUniqueId()), minBlocks, diamondThreshold)).reversed());

        int slot = 10;
        for (OfflinePlayer target : all) {
            if (slot >= 44) break;
            if (slot % 9 == 0 || slot % 9 == 8) slot++; // éviter les bords
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

    public static class XRayGuiHolder implements InventoryHolder {
        @Override
        public Inventory getInventory() {
            return null;
        }
    }

    /** Score pour le tri : combine % précieux et ratio diamant/pierre (plus élevé = plus suspect). */
    private double computeCompositeScore(BlockMiningStats s, int minBlocks, double diamondThreshold) {
        if (s == null || s.getTotal() < minBlocks) return 0;
        double pct = s.getValuablePercentage();
        double diamondPer1k = s.getDiamondPerThousandCommon();
        if (!useCompositeIndex()) return pct;
        double bonus = diamondPer1k >= diamondThreshold ? Math.min(30, (diamondPer1k - diamondThreshold) * 5) : 0;
        return pct + bonus;
    }

    private ItemStack createPlayerSkull(OfflinePlayer player) {
        UUID uuid = player.getUniqueId();
        ItemStack skull = new ItemStack(Material.PLAYER_HEAD);
        skull.editMeta(SkullMeta.class, meta -> {
            meta.setOwningPlayer(player);
            String name = player.getName() != null ? player.getName() : "Joueur";
            meta.displayName(Component.text(name).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));

            BlockMiningStats stats = tracker.getStats(uuid);
            long total = stats != null ? stats.getTotal() : 0;
            double pctDiamond = stats != null ? stats.getDiamondPercentage() : 0;
            double pctIron = stats != null ? stats.getIronPercentage() : 0;
            double pctGold = stats != null ? stats.getGoldPercentage() : 0;
            double pctValuable = stats != null ? stats.getValuablePercentage() : 0;
            long diamond = stats != null ? stats.getDiamondCount() : 0;
            long iron = stats != null ? stats.getIronCount() : 0;
            long gold = stats != null ? stats.getGoldCount() : 0;
            long netherrack = stats != null ? stats.getNetherrackCount() : 0;
            long netherite = stats != null ? stats.getAncientDebrisCount() : 0;
            long common = stats != null ? stats.getCommonCount() : 0;
            double pctNetherite = stats != null ? stats.getNetheriteVsNetherrackPercentage() : 0;
            double diamondPer1k = stats != null ? stats.getDiamondPerThousandCommon() : 0;

            int minBlocks = minBlocksForIndex();
            double diamondThreshold = diamondPerThousandSuspicious();
            double vVeryHigh = valuableVeryHigh();
            double vHigh = valuableHigh();
            double vMedium = valuableMedium();

            List<Component> lore = new ArrayList<>();
            lore.add(Component.empty());
            lore.add(Component.text("Pourcentages (sur total miné)").color(NamedTextColor.GRAY));
            lore.add(Component.text(String.format("→ Diamant: %.1f%% (%d)", pctDiamond, diamond)).color(NamedTextColor.AQUA));
            lore.add(Component.text(String.format("→ Fer (argent): %.1f%% (%d)", pctIron, iron)).color(NamedTextColor.WHITE));
            lore.add(Component.text(String.format("→ Or: %.1f%% (%d)", pctGold, gold)).color(NamedTextColor.GOLD));
            lore.add(Component.text(String.format("→ Netherite: %d (netherrack: %d) — %.1f%%", netherite, netherrack, pctNetherite)).color(NamedTextColor.DARK_GRAY));
            lore.add(Component.empty());
            lore.add(Component.text("Pierre / Deepslate / etc.: " + common).color(NamedTextColor.GRAY));
            lore.add(Component.text(String.format("Ratio diamant/pierre: %.2f pour 1000 blocs communs", diamondPer1k)).color(diamondPer1k >= diamondThreshold ? NamedTextColor.RED : NamedTextColor.GRAY));
            lore.add(Component.text("Total blocs suivis: " + total).color(NamedTextColor.AQUA));
            lore.add(Component.empty());

            int indice;
            String niveau;
            NamedTextColor couleurIndice;
            if (total < minBlocks) {
                indice = total > 0 ? (int) Math.round(pctValuable) : 0;
                niveau = "Données insuffisantes";
                couleurIndice = NamedTextColor.GRAY;
                lore.add(Component.text(String.format("Indice: %d/100 — %s (min. %d blocs)", indice, niveau, minBlocks)).color(couleurIndice).decorate(TextDecoration.BOLD));
            } else {
                if (useCompositeIndex()) {
                    boolean diamondSuspicious = diamondPer1k >= diamondThreshold;
                    if (pctValuable >= vVeryHigh || (diamondSuspicious && pctValuable >= vHigh) || diamondPer1k >= diamondThreshold * 2) {
                        niveau = "Très élevé";
                        indice = Math.min(100, (int) Math.round(pctValuable) + (diamondSuspicious ? 15 : 0));
                        couleurIndice = NamedTextColor.RED;
                    } else if (pctValuable >= vHigh || diamondSuspicious) {
                        niveau = "Élevé";
                        indice = Math.min(100, (int) Math.round(pctValuable) + (diamondSuspicious ? 10 : 0));
                        couleurIndice = NamedTextColor.RED;
                    } else if (pctValuable >= vMedium) {
                        niveau = "Moyen";
                        indice = (int) Math.round(pctValuable);
                        couleurIndice = NamedTextColor.YELLOW;
                    } else if (pctValuable >= 10) {
                        niveau = "Faible";
                        indice = (int) Math.round(pctValuable);
                        couleurIndice = NamedTextColor.GREEN;
                    } else {
                        niveau = "Négligeable";
                        indice = (int) Math.round(pctValuable);
                        couleurIndice = NamedTextColor.GREEN;
                    }
                } else {
                    indice = (int) Math.round(pctValuable);
                    niveau = indice >= 70 ? "Très élevé" : indice >= 50 ? "Élevé" : indice >= 25 ? "Moyen" : indice >= 10 ? "Faible" : "Négligeable";
                    couleurIndice = indice >= 50 ? NamedTextColor.RED : indice >= 25 ? NamedTextColor.YELLOW : NamedTextColor.GREEN;
                }
                lore.add(Component.text(String.format("Indice de triche: %d/100 — %s", Math.min(100, indice), niveau)).color(couleurIndice).decorate(TextDecoration.BOLD));
            }
            lore.add(Component.empty());
            if (total >= minBlocks) {
                if (pctValuable >= vHigh || (diamondPer1k >= diamondThreshold && pctValuable >= vMedium)) {
                    lore.add(Component.text("⚠ Suspicion élevée").color(NamedTextColor.RED));
                } else if (pctValuable >= vMedium || diamondPer1k >= diamondThreshold) {
                    lore.add(Component.text("⚠ À surveiller").color(NamedTextColor.YELLOW));
                } else {
                    lore.add(Component.text("✓ Ratio normal").color(NamedTextColor.GREEN));
                }
            }
            meta.lore(lore);
        });
        return skull;
    }
}
