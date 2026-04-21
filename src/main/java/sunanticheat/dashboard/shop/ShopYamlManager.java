package sunanticheat.dashboard.shop;

import org.bukkit.Bukkit;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.format.DateTimeFormatter;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Lecture/écriture des shops EconomyShopGUI via manipulation directe des fichiers YAML.
 *
 * <p>Structure attendue (format EconomyShopGUI+) :
 * <pre>
 * shop:
 *   name: "&aMining Shop"
 *   icon: DIAMOND_PICKAXE
 *   size: 54
 * items:
 *   1:                    # clé = slot (ou identifiant libre)
 *     slot: 10
 *     type: MATERIAL      # MATERIAL | ITEMSADDER | ORAXEN | NEXO | MMOITEM | EXECUTABLEITEMS | SLIMEFUN
 *     material: DIAMOND
 *     buy: 100.0
 *     sell: 10.0
 *     amount: 1
 *     limit:
 *       player: 10
 *       global: 100
 *     stock: 0
 *     permission: 'shop.vip'
 *     commands:
 *       - 'give {player} diamond 1'
 *     enabled: true
 * </pre>
 *
 * <p>Chaque écriture crée un {@code .bak} horodaté dans {@code plugins/EconomyShopGUI/shops/.sunguard-backups/}
 * avant modification. Thread-safe pour opérations concurrentes (lock par section).
 */
public final class ShopYamlManager {

    private final File shopsDir;
    private final File backupsDir;
    private final Logger logger;

    public ShopYamlManager(File pluginsDir, Logger logger) {
        File egsui = new File(pluginsDir, "EconomyShopGUI");
        if (!egsui.isDirectory()) {
            egsui = new File(pluginsDir, "EconomyShopGUI-Premium");
        }
        this.shopsDir = new File(egsui, "shops");
        this.backupsDir = new File(shopsDir, ".sunguard-backups");
        this.logger = logger;
    }

    public boolean isReady() {
        return shopsDir.isDirectory();
    }

    /* ───────────────────────── Listing ───────────────────────── */

    /** Liste des sections (lecture rapide : ne charge pas les items). */
    public List<ShopSection> listSections() {
        if (!isReady()) return Collections.emptyList();
        File[] files = shopsDir.listFiles((dir, name) -> name.toLowerCase(Locale.ROOT).endsWith(".yml"));
        if (files == null) return Collections.emptyList();
        List<ShopSection> out = new ArrayList<>();
        for (File f : files) {
            try {
                ShopSection s = parseSection(f, false);
                if (s != null) out.add(s);
            } catch (Throwable t) {
                logger.warning("[Shop] Fichier ignoré " + f.getName() + " : " + t.getMessage());
            }
        }
        out.sort((a, b) -> a.id().compareToIgnoreCase(b.id()));
        return out;
    }

    /** Section détaillée, avec les items. */
    public ShopSection getSection(String id) {
        if (!isReady()) return null;
        File f = resolve(id);
        if (f == null) return null;
        try { return parseSection(f, true); }
        catch (Throwable t) {
            logger.warning("[Shop] Lecture échouée " + id + " : " + t.getMessage());
            return null;
        }
    }

    /* ───────────────────────── Mutations ───────────────────────── */

    /** Upsert d'un item. Retourne l'item écrit. */
    public synchronized ShopItem upsertItem(String sectionId, ShopItem item) throws IOException {
        if (!isReady()) throw new IOException("EconomyShopGUI n'est pas installé (répertoire shops/ introuvable)");
        File f = resolve(sectionId);
        if (f == null) throw new IOException("Section introuvable : " + sectionId);

        backup(f);
        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(f);
        ConfigurationSection items = yaml.getConfigurationSection("items");
        if (items == null) items = yaml.createSection("items");

        String key = String.valueOf(item.slot());
        // Si un autre key existait pour ce slot, on le supprime
        for (String k : new ArrayList<>(items.getKeys(false))) {
            int slotOfKey = items.getInt(k + ".slot", parseIntOrDefault(k, -1));
            if (slotOfKey == item.slot() && !k.equals(key)) {
                items.set(k, null);
            }
        }

        ConfigurationSection entry = items.createSection(key);
        writeItem(entry, item);
        yaml.save(f);
        return item;
    }

    /** Supprime l'item au slot donné. */
    public synchronized boolean deleteItem(String sectionId, int slot) throws IOException {
        if (!isReady()) throw new IOException("EconomyShopGUI absent");
        File f = resolve(sectionId);
        if (f == null) return false;

        backup(f);
        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(f);
        ConfigurationSection items = yaml.getConfigurationSection("items");
        if (items == null) return false;

        boolean removed = false;
        for (String k : new ArrayList<>(items.getKeys(false))) {
            int s = items.getInt(k + ".slot", parseIntOrDefault(k, -1));
            if (s == slot) {
                items.set(k, null);
                removed = true;
            }
        }
        if (removed) yaml.save(f);
        return removed;
    }

    /** Déplace un item d'un slot source à un slot cible (swap si occupé). */
    public synchronized void moveItem(String sectionId, int fromSlot, int toSlot) throws IOException {
        if (!isReady()) throw new IOException("EconomyShopGUI absent");
        File f = resolve(sectionId);
        if (f == null) throw new IOException("Section introuvable : " + sectionId);

        backup(f);
        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(f);
        ConfigurationSection items = yaml.getConfigurationSection("items");
        if (items == null) throw new IOException("Section vide : " + sectionId);

        String fromKey = null, toKey = null;
        for (String k : items.getKeys(false)) {
            int s = items.getInt(k + ".slot", parseIntOrDefault(k, -1));
            if (s == fromSlot) fromKey = k;
            if (s == toSlot)   toKey = k;
        }
        if (fromKey == null) throw new IOException("Aucun item au slot " + fromSlot);

        items.set(fromKey + ".slot", toSlot);
        if (toKey != null && !toKey.equals(fromKey)) {
            items.set(toKey + ".slot", fromSlot);
        }
        yaml.save(f);
    }

    /** Créer une nouvelle section vide. */
    public synchronized ShopSection createSection(String id, String displayName, String icon, int size) throws IOException {
        if (!isReady()) throw new IOException("EconomyShopGUI absent");
        String safeId = id.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "");
        if (safeId.isEmpty()) throw new IOException("ID invalide");
        File f = new File(shopsDir, safeId + ".yml");
        if (f.exists()) throw new IOException("Section existe déjà : " + safeId);

        YamlConfiguration yaml = new YamlConfiguration();
        yaml.set("shop.name", displayName != null ? displayName : safeId);
        yaml.set("shop.icon", icon != null ? icon : "CHEST");
        yaml.set("shop.size", Math.max(9, Math.min(54, size)));
        yaml.createSection("items");
        yaml.save(f);
        return new ShopSection(safeId, f.getName(),
                displayName != null ? displayName : safeId,
                icon != null ? icon : "CHEST",
                Math.max(9, Math.min(54, size)), 0, List.of());
    }

    /**
     * Déclenche un {@code /esgui reload} via la console serveur.
     * Exécution planifiée sur le thread principal (dispatchCommand est thread-unsafe).
     * @param plugin plugin appelant (pour scheduler)
     */
    public boolean reloadEconomyShopGUI(org.bukkit.plugin.Plugin plugin) {
        try {
            if (Bukkit.isPrimaryThread()) {
                return Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "esgui reload");
            }
            return Bukkit.getScheduler().callSyncMethod(plugin,
                    () -> Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "esgui reload")
            ).get();
        } catch (Throwable t) {
            logger.warning("[Shop] Reload EconomyShopGUI échoué : " + t.getMessage());
            return false;
        }
    }

    /* ───────────────────────── Parsing ───────────────────────── */

    private ShopSection parseSection(File f, boolean withItems) {
        String id = stripExt(f.getName());
        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(f);
        String name = yaml.getString("shop.name", id);
        String icon = yaml.getString("shop.icon", "CHEST");
        int size = yaml.getInt("shop.size", 54);

        ConfigurationSection itemsSec = yaml.getConfigurationSection("items");
        int count = itemsSec != null ? itemsSec.getKeys(false).size() : 0;

        List<ShopItem> items = List.of();
        if (withItems && itemsSec != null) {
            items = new ArrayList<>(count);
            for (String key : itemsSec.getKeys(false)) {
                ConfigurationSection entry = itemsSec.getConfigurationSection(key);
                if (entry == null) continue;
                items.add(readItem(key, entry));
            }
            items.sort((a, b) -> Integer.compare(a.slot(), b.slot()));
        }
        return new ShopSection(id, f.getName(), name, icon, size, count, items);
    }

    private ShopItem readItem(String key, ConfigurationSection e) {
        int slot = e.getInt("slot", parseIntOrDefault(key, -1));
        String type = e.getString("type", "MATERIAL").toUpperCase(Locale.ROOT);
        String source = switch (type) {
            case "ITEMSADDER" -> "ItemsAdder";
            case "ORAXEN"     -> "Oraxen";
            case "NEXO"       -> "Nexo";
            case "MMOITEM"    -> "MMOItems";
            case "EXECUTABLEITEMS" -> "ExecutableItems";
            case "SLIMEFUN"   -> "Slimefun";
            default           -> "Vanilla";
        };
        String nativeId = switch (type) {
            case "ITEMSADDER" -> e.getString("itemsadder", "");
            case "ORAXEN"     -> e.getString("oraxen", "");
            case "NEXO"       -> e.getString("nexo", "");
            case "MMOITEM"    -> e.getString("mmoitem-type", "") + ":" + e.getString("mmoitem-id", "");
            case "EXECUTABLEITEMS" -> e.getString("executableitem", "");
            case "SLIMEFUN"   -> e.getString("slimefun", "");
            default           -> e.getString("material", "STONE");
        };
        String material = e.getString("material", "STONE");
        String displayName = e.getString("name", null);
        List<String> lore = e.getStringList("lore");
        int amount = e.getInt("amount", 1);
        Double buy = e.isSet("buy") ? e.getDouble("buy") : (e.isSet("buy-price") ? e.getDouble("buy-price") : null);
        Double sell = e.isSet("sell") ? e.getDouble("sell") : (e.isSet("sell-price") ? e.getDouble("sell-price") : null);
        int limitPlayer = e.getInt("limit.player", e.getInt("limited-buys.player", 0));
        int limitServer = e.getInt("limit.global", e.getInt("limited-buys.global", 0));
        int stock = e.getInt("stock", 0);
        String permission = e.getString("permission", null);
        List<String> commands = e.getStringList("commands");
        boolean enabled = e.getBoolean("enabled", true);

        Map<String, Object> sourceData = new LinkedHashMap<>();
        for (String k : e.getKeys(false)) sourceData.put(k, e.get(k));

        return new ShopItem(slot, source, nativeId, material, displayName,
                lore, amount, buy, sell, limitPlayer, limitServer, stock,
                permission, commands, enabled, sourceData);
    }

    private void writeItem(ConfigurationSection entry, ShopItem item) {
        entry.set("slot", item.slot());
        entry.set("type", toType(item.source()));
        // Identifiants spécifiques au provider
        switch (item.source()) {
            case "ItemsAdder"     -> entry.set("itemsadder", item.nativeId());
            case "Oraxen"         -> entry.set("oraxen", item.nativeId());
            case "Nexo"           -> entry.set("nexo", item.nativeId());
            case "MMOItems"       -> {
                int sep = item.nativeId().indexOf(':');
                if (sep > 0) {
                    entry.set("mmoitem-type", item.nativeId().substring(0, sep));
                    entry.set("mmoitem-id",   item.nativeId().substring(sep + 1));
                }
            }
            case "ExecutableItems" -> entry.set("executableitem", item.nativeId());
            case "Slimefun"       -> entry.set("slimefun", item.nativeId());
            default               -> entry.set("material", item.nativeId());
        }
        if (item.material() != null && !item.material().isEmpty()) {
            entry.set("material", item.material());
        }
        if (item.displayName() != null && !item.displayName().isEmpty()) {
            entry.set("name", item.displayName());
        }
        if (item.lore() != null && !item.lore().isEmpty()) {
            entry.set("lore", item.lore());
        }
        entry.set("amount", Math.max(1, item.amount()));
        if (item.buyPrice() != null)  entry.set("buy",  item.buyPrice());
        else entry.set("buy", null);
        if (item.sellPrice() != null) entry.set("sell", item.sellPrice());
        else entry.set("sell", null);
        if (item.limitPerPlayerDay() > 0) entry.set("limit.player", item.limitPerPlayerDay());
        else entry.set("limit.player", null);
        if (item.limitServerDay() > 0)    entry.set("limit.global", item.limitServerDay());
        else entry.set("limit.global", null);
        if (item.stock() > 0) entry.set("stock", item.stock());
        else entry.set("stock", null);
        if (item.permission() != null && !item.permission().isEmpty()) {
            entry.set("permission", item.permission());
        } else entry.set("permission", null);
        if (item.commands() != null && !item.commands().isEmpty()) {
            entry.set("commands", item.commands());
        } else entry.set("commands", null);
        entry.set("enabled", item.enabled());
    }

    private static String toType(String source) {
        return switch (source) {
            case "ItemsAdder"      -> "ITEMSADDER";
            case "Oraxen"          -> "ORAXEN";
            case "Nexo"            -> "NEXO";
            case "MMOItems"        -> "MMOITEM";
            case "ExecutableItems" -> "EXECUTABLEITEMS";
            case "Slimefun"        -> "SLIMEFUN";
            default                -> "MATERIAL";
        };
    }

    /* ───────────────────────── Fichiers ───────────────────────── */

    private File resolve(String id) {
        if (id == null || id.isEmpty()) return null;
        String safe = id.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "");
        File f = new File(shopsDir, safe + ".yml");
        return f.isFile() ? f : null;
    }

    private void backup(File src) throws IOException {
        if (!backupsDir.isDirectory() && !backupsDir.mkdirs()) return;
        String stamp = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").format(LocalDateTime.now());
        File dst = new File(backupsDir, src.getName() + "." + stamp + ".bak");
        try {
            Files.copy(src.toPath(), dst.toPath(), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            logger.warning("[Shop] Backup échoué pour " + src.getName() + " : " + e.getMessage());
        }
        pruneOldBackups();
    }

    /** Conserve les 50 backups les plus récents. */
    private void pruneOldBackups() {
        File[] files = backupsDir.listFiles((d, n) -> n.endsWith(".bak"));
        if (files == null || files.length <= 50) return;
        List<File> list = new ArrayList<>(List.of(files));
        list.sort((a, b) -> Long.compare(b.lastModified(), a.lastModified()));
        for (int i = 50; i < list.size(); i++) {
            if (!list.get(i).delete()) logger.fine("[Shop] Backup non supprimé : " + list.get(i).getName());
        }
    }

    private static String stripExt(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static int parseIntOrDefault(String s, int def) {
        try { return Integer.parseInt(s); } catch (NumberFormatException e) { return def; }
    }
}
