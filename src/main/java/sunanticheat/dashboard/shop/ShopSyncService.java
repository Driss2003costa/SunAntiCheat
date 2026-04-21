package sunanticheat.dashboard.shop;

import org.bukkit.Bukkit;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Service de synchronisation entre le ShopStore interne et le fichier shops.yml
 * de EconomyShopGUI (ou EconomyShopGUI-Premium).
 */
public final class ShopSyncService {

    public static record SyncResult(boolean success, String message, String filePath) {}

    private final JavaPlugin plugin;
    private final ShopStore store;
    private final Logger logger;

    public ShopSyncService(JavaPlugin plugin, ShopStore store, Logger logger) {
        this.plugin = plugin;
        this.store = store;
        this.logger = logger;
    }

    /** Détecte le dossier d'ESG (Premium prioritaire, puis free). Retourne null si absent. */
    private File getESGFolder() {
        try {
            File pluginsDir = plugin.getDataFolder().getParentFile();
            if (pluginsDir == null) return null;
            File premium = new File(pluginsDir, "EconomyShopGUI-Premium");
            if (premium.exists() && premium.isDirectory()) return premium;
            File free = new File(pluginsDir, "EconomyShopGUI");
            if (free.exists() && free.isDirectory()) return free;
        } catch (Throwable t) {
            logger.warning("[Dashboard/Shop] getESGFolder: " + t.getMessage());
        }
        return null;
    }

    private boolean isPremium() {
        File f = getESGFolder();
        return f != null && "EconomyShopGUI-Premium".equals(f.getName());
    }

    /**
     * Exporte chaque shop vers :
     *  - plugins/EconomyShopGUI(-Premium)/shops/{name}.yml  (items du shop)
     *  - plugins/EconomyShopGUI-Premium/sections/{name}.yml (entrée menu /shop, Premium uniquement)
     *  - plugins/EconomyShopGUI/menu.yml                    (Free uniquement, à implémenter si besoin)
     * Puis recharge ESG.
     */
    public SyncResult syncToESG() {
        try {
            File folder = getESGFolder();
            if (folder == null) {
                return new SyncResult(false, "EconomyShopGUI n'est pas installé", null);
            }

            File shopsDir = new File(folder, "shops");
            File sectionsDir = new File(folder, "sections");
            if (!shopsDir.exists()) shopsDir.mkdirs();
            if (isPremium() && !sectionsDir.exists()) sectionsDir.mkdirs();

            String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(new Date());
            int shopsWritten = 0;
            boolean premium = isPremium();

            for (Shop shop : store.listShops()) {
                if (shop == null || !shop.enabled) continue;
                if (shop.name == null || shop.name.isBlank()) continue;

                // ── Backup + écriture shops/{name}.yml (items) ────────────────────
                File shopFile = new File(shopsDir, shop.name + ".yml");
                backup(shopFile, stamp);

                YamlConfiguration shopYaml = new YamlConfiguration();
                buildShopItemsYaml(shopYaml, shop, premium);
                shopYaml.save(shopFile);

                // ── Écriture sections/{name}.yml (Premium) pour apparaitre dans /shop ──
                if (premium) {
                    File sectionFile = new File(sectionsDir, shop.name + ".yml");
                    backup(sectionFile, stamp);
                    YamlConfiguration sectionYaml = new YamlConfiguration();
                    buildSectionYaml(sectionYaml, shop);
                    sectionYaml.save(sectionFile);
                }

                shopsWritten++;
            }

            // ── Free version : on met à jour menu.yml avec tous les shops ─────────
            if (!premium) {
                File menuFile = new File(folder, "menu.yml");
                backup(menuFile, stamp);
                YamlConfiguration menuYaml = YamlConfiguration.loadConfiguration(
                        menuFile.exists() ? menuFile : new File(folder, "menu.yml.empty"));
                // On repart propre sur la section "items" des shops
                menuYaml.set("items", null);
                ConfigurationSection itemsSec = menuYaml.createSection("items");
                int slotCursor = 10;
                for (Shop shop : store.listShops()) {
                    if (shop == null || !shop.enabled || shop.name == null || shop.name.isBlank()) continue;
                    ConfigurationSection iSec = itemsSec.createSection(String.valueOf(slotCursor));
                    iSec.set("material", shop.iconMaterial != null ? shop.iconMaterial : "CHEST");
                    iSec.set("displayName", shop.displayName != null ? shop.displayName : shop.name);
                    iSec.set("shop", shop.name);
                    if (shop.description != null && !shop.description.isBlank()) {
                        iSec.set("lore", List.of("&7" + shop.description, "", "&eClique pour ouvrir"));
                    }
                    slotCursor++;
                    if (slotCursor % 9 == 8) slotCursor += 2; // saute les bords
                }
                menuYaml.save(menuFile);
            }

            reloadESG();
            return new SyncResult(true,
                    shopsWritten + " shops synchronisés vers " + (premium ? "Premium" : "Free") + " et ESG rechargé",
                    folder.getAbsolutePath());
        } catch (Throwable t) {
            logger.warning("[Dashboard/Shop] syncToESG erreur: " + t.getMessage());
            t.printStackTrace();
            return new SyncResult(false, "Erreur : " + t.getMessage(), null);
        }
    }

    /**
     * Construit le YAML du contenu d'un shop au format ESG attendu.
     * Premium : pages.page1.gui-rows + pages.page1.items.{slot}
     * Free    : clé racine {slot}.* + settings (rows, title, etc.)
     */
    private void buildShopItemsYaml(YamlConfiguration yaml, Shop shop, boolean premium) {
        List<ShopItem> items = shop.items != null ? new ArrayList<>(shop.items) : new ArrayList<>();
        items.removeIf(i -> i == null);
        items.sort(Comparator.comparingInt(i -> i.slot));
        int rows = Math.max(1, Math.min(6, shop.rows));

        if (premium) {
            ConfigurationSection page = yaml.createSection("pages.page1");
            page.set("gui-rows", rows);
            page.set("title", shop.displayName != null ? shop.displayName : shop.name);
            ConfigurationSection itemsSec = page.createSection("items");
            for (ShopItem item : items) {
                ConfigurationSection iSec = itemsSec.createSection(String.valueOf(item.slot + 1));
                iSec.set("material", item.material != null ? item.material : "STONE");
                if (item.amount > 1) iSec.set("amount", item.amount);
                if (item.buyPrice != null) iSec.set("buy", item.buyPrice);
                if (item.sellPrice != null) iSec.set("sell", item.sellPrice);
                if (item.displayName != null && !item.displayName.isBlank()) iSec.set("name", item.displayName);
                if (item.lore != null && !item.lore.isEmpty()) iSec.set("lore", item.lore);
                if (item.permission != null && !item.permission.isBlank()) iSec.set("permission", item.permission);
                if (item.buyLimit > 0) iSec.set("buy-limit", item.buyLimit);
                if (item.sellLimit > 0) iSec.set("sell-limit", item.sellLimit);
                if (item.stockLimit > 0) iSec.set("stock", item.stockLimit);
                if (item.customModelData > 0) iSec.set("model-data", item.customModelData);
                if (item.enchantments != null && !item.enchantments.isEmpty()) {
                    iSec.set("enchantments", item.enchantments);
                }
                if (item.commandsOnBuy != null && !item.commandsOnBuy.isEmpty()) {
                    iSec.set("commands", item.commandsOnBuy);
                }
            }
        } else {
            // Free : settings en haut, puis chaque slot en clé racine
            yaml.set("displayName", shop.displayName != null ? shop.displayName : shop.name);
            yaml.set("rows", rows);
            if (shop.permission != null && !shop.permission.isBlank()) yaml.set("permission", shop.permission);

            for (ShopItem item : items) {
                ConfigurationSection iSec = yaml.createSection(String.valueOf(item.slot + 1));
                iSec.set("material", item.material != null ? item.material : "STONE");
                iSec.set("type", "item");
                if (item.buyPrice != null) iSec.set("buyPrice", item.buyPrice);
                if (item.sellPrice != null) iSec.set("sellPrice", item.sellPrice);
                if (item.displayName != null && !item.displayName.isBlank()) iSec.set("name", item.displayName);
                if (item.lore != null && !item.lore.isEmpty()) iSec.set("lore", item.lore);
                if (item.permission != null && !item.permission.isBlank()) iSec.set("permission", item.permission);
                iSec.set("stock", item.stockLimit);
                iSec.set("limit", item.buyLimit);
                if (item.amount > 1) iSec.set("amount", item.amount);
                if (item.customModelData > 0) iSec.set("modelData", item.customModelData);
                if (item.commandsOnBuy != null && !item.commandsOnBuy.isEmpty()) {
                    iSec.set("commands", item.commandsOnBuy);
                }
            }
        }
    }

    /** Construit le YAML d'une section ESG Premium pour le menu principal /shop. */
    private void buildSectionYaml(YamlConfiguration yaml, Shop shop) {
        yaml.set("enable", true);
        yaml.set("slot", 9 + Math.max(0, shop.order));  // ligne 2 + offset
        yaml.set("title", shop.displayName != null ? shop.displayName : shop.name);
        yaml.set("hidden", false);
        yaml.set("sub-section", false);
        yaml.set("display-item", false);

        ConfigurationSection fill = yaml.createSection("fill-item");
        fill.set("material", "AIR");

        ConfigurationSection nav = yaml.createSection("nav-bar");
        nav.set("mode", "INHERIT");

        ConfigurationSection item = yaml.createSection("item");
        item.set("material", shop.iconMaterial != null && !shop.iconMaterial.isBlank() ? shop.iconMaterial : "CHEST");
        item.set("displayname", shop.displayName != null ? shop.displayName : shop.name);
        if (shop.description != null && !shop.description.isBlank()) {
            item.set("lore", List.of("&7" + shop.description, "", "&eClique pour ouvrir"));
        }
        if (shop.permission != null && !shop.permission.isBlank()) {
            yaml.set("permission", shop.permission);
        }
    }

    /** Backup d'un fichier avec timestamp (si existe). */
    private void backup(File file, String stamp) {
        if (!file.exists()) return;
        try {
            File bak = new File(file.getParentFile(), file.getName() + ".backup-" + stamp);
            Files.copy(file.toPath(), bak.toPath(), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ioe) {
            logger.warning("[Dashboard/Shop] Backup échoué: " + ioe.getMessage());
        }
    }

    /** Recharge ESG via la console — exécuté sur le main thread. */
    public void reloadESG() {
        try {
            Bukkit.getScheduler().runTask(plugin, () -> {
                try {
                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "esg reload");
                } catch (Throwable t) {
                    logger.warning("[Dashboard/Shop] reload ESG échoué: " + t.getMessage());
                }
            });
        } catch (Throwable t) {
            logger.warning("[Dashboard/Shop] reloadESG schedule: " + t.getMessage());
        }
    }

    /** Lit shops.yml d'ESG et renvoie une liste de maps (preview). Lecture seule. */
    public List<Map<String, Object>> importFromESG() {
        try {
            File folder = getESGFolder();
            if (folder == null) return List.of();
            File shopsFile = new File(folder, "shops.yml");
            if (!shopsFile.exists()) return List.of();

            YamlConfiguration yaml = YamlConfiguration.loadConfiguration(shopsFile);
            List<Map<String, Object>> out = new ArrayList<>();

            for (String shopKey : yaml.getKeys(false)) {
                ConfigurationSection sec = yaml.getConfigurationSection(shopKey);
                if (sec == null) continue;

                Map<String, Object> shopMap = new LinkedHashMap<>();
                shopMap.put("name", shopKey);
                shopMap.put("displayName", sec.getString("displayName", shopKey));
                shopMap.put("displayItem", sec.getString("displayItem", "CHEST"));
                shopMap.put("rows", sec.getInt("rows", 3));
                shopMap.put("permission", sec.getString("permission", ""));

                List<Map<String, Object>> items = new ArrayList<>();
                ConfigurationSection itemsSec = sec.getConfigurationSection("items");
                if (itemsSec != null) {
                    for (String slotKey : itemsSec.getKeys(false)) {
                        ConfigurationSection iSec = itemsSec.getConfigurationSection(slotKey);
                        if (iSec == null) continue;
                        Map<String, Object> item = new LinkedHashMap<>();
                        int slot1Indexed;
                        try { slot1Indexed = Integer.parseInt(slotKey); }
                        catch (NumberFormatException nfe) { slot1Indexed = 1; }
                        item.put("slot", Math.max(0, slot1Indexed - 1)); // 0-indexé
                        item.put("material", iSec.getString("material", "STONE"));
                        item.put("amount", iSec.getInt("amount", 1));
                        if (iSec.isSet("name")) item.put("name", iSec.getString("name"));
                        if (iSec.isList("lore")) item.put("lore", iSec.getStringList("lore"));
                        if (iSec.isSet("buyPrice")) item.put("buyPrice", iSec.getDouble("buyPrice"));
                        if (iSec.isSet("sellPrice")) item.put("sellPrice", iSec.getDouble("sellPrice"));
                        item.put("stock", iSec.getInt("stock", 0));
                        item.put("limit", iSec.getInt("limit", 0));
                        item.put("priceType", iSec.getString("priceType", "MONEY"));
                        item.put("permission", iSec.getString("permission", ""));
                        items.add(item);
                    }
                }
                shopMap.put("items", items);
                out.add(shopMap);
            }
            return out;
        } catch (Throwable t) {
            logger.warning("[Dashboard/Shop] importFromESG erreur: " + t.getMessage());
            return List.of();
        }
    }

    /** Infos sur la présence d'ESG pour l'endpoint esg-status. */
    public Map<String, Object> esgStatus() {
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            File folder = getESGFolder();
            boolean installed = folder != null;
            out.put("installed", installed);
            out.put("premium", isPremium());
            out.put("shopsFolder", folder != null ? folder.getAbsolutePath() : null);
            out.put("shopsFileExists", folder != null && new File(folder, "shops.yml").exists());

            String version = null;
            try {
                Plugin p = Bukkit.getPluginManager().getPlugin(
                        isPremium() ? "EconomyShopGUI-Premium" : "EconomyShopGUI");
                if (p != null) version = p.getDescription().getVersion();
            } catch (Throwable ignored) {}
            out.put("version", version);
        } catch (Throwable t) {
            logger.warning("[Dashboard/Shop] esgStatus: " + t.getMessage());
            out.put("installed", false);
            out.put("premium", false);
            out.put("shopsFolder", null);
            out.put("shopsFileExists", false);
            out.put("version", null);
        }
        return out;
    }
}
