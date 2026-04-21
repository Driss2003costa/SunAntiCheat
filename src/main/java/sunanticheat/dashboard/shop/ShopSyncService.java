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

    /** Exporte les shops du store vers plugins/EconomyShopGUI(-Premium)/shops.yml, puis recharge ESG. */
    public SyncResult syncToESG() {
        try {
            File folder = getESGFolder();
            if (folder == null) {
                return new SyncResult(false, "EconomyShopGUI n'est pas installé", null);
            }
            File shopsFile = new File(folder, "shops.yml");

            // Backup
            if (shopsFile.exists()) {
                try {
                    String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(new Date());
                    File backup = new File(folder, "shops.yml.backup-" + stamp);
                    Files.copy(shopsFile.toPath(), backup.toPath(), StandardCopyOption.REPLACE_EXISTING);
                } catch (IOException ioe) {
                    logger.warning("[Dashboard/Shop] Backup échoué: " + ioe.getMessage());
                }
            }

            YamlConfiguration yaml = new YamlConfiguration();

            for (Shop shop : store.listShops()) {
                if (shop == null || !shop.enabled) continue;
                if (shop.name == null || shop.name.isBlank()) continue;

                ConfigurationSection sec = yaml.createSection(shop.name);
                sec.set("displayName", shop.displayName != null ? shop.displayName : shop.name);
                sec.set("displayItem", shop.iconMaterial != null && !shop.iconMaterial.isBlank()
                        ? shop.iconMaterial : "CHEST");
                sec.set("rows", Math.max(1, Math.min(6, shop.rows)));
                sec.set("commandToOpen", shop.commandToOpen != null && !shop.commandToOpen.isBlank()
                        ? List.of(shop.commandToOpen) : List.of());
                sec.set("permission", shop.permission != null ? shop.permission : "");

                ConfigurationSection itemsSec = sec.createSection("items");

                List<ShopItem> items = shop.items != null ? new ArrayList<>(shop.items) : new ArrayList<>();
                items.removeIf(i -> i == null);
                items.sort(Comparator.comparingInt(i -> i.slot));

                for (ShopItem item : items) {
                    // Slots ESG en 1-indexé
                    ConfigurationSection iSec = itemsSec.createSection(String.valueOf(item.slot + 1));
                    iSec.set("material", item.material != null ? item.material : "STONE");
                    iSec.set("amount", Math.max(1, item.amount));
                    if (item.displayName != null && !item.displayName.isBlank()) {
                        iSec.set("name", item.displayName);
                    }
                    if (item.lore != null && !item.lore.isEmpty()) {
                        iSec.set("lore", item.lore);
                    }
                    if (item.buyPrice != null) iSec.set("buyPrice", item.buyPrice);
                    if (item.sellPrice != null) iSec.set("sellPrice", item.sellPrice);
                    iSec.set("stock", item.stockLimit);
                    iSec.set("limit", item.buyLimit);
                    iSec.set("priceType", item.priceType != null ? item.priceType : "MONEY");
                    iSec.set("permission", item.permission != null ? item.permission : "");
                    if (item.commandsOnBuy != null && !item.commandsOnBuy.isEmpty()) {
                        iSec.set("commands", item.commandsOnBuy);
                    }
                    if (item.customModelData > 0) iSec.set("customModelData", item.customModelData);
                    if (item.enchantments != null && !item.enchantments.isEmpty()) {
                        iSec.set("enchantments", item.enchantments);
                    }
                }
            }

            try {
                yaml.save(shopsFile);
            } catch (IOException ioe) {
                return new SyncResult(false, "Erreur I/O : " + ioe.getMessage(), null);
            }

            reloadESG();
            return new SyncResult(true, "Shops synchronisés et ESG rechargé", shopsFile.getAbsolutePath());
        } catch (Throwable t) {
            logger.warning("[Dashboard/Shop] syncToESG erreur: " + t.getMessage());
            return new SyncResult(false, "Erreur : " + t.getMessage(), null);
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
