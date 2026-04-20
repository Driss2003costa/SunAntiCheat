package sunanticheat.weaponmechanics;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.potion.PotionEffect;
import org.bukkit.scheduler.BukkitTask;
import sunanticheat.Permissions;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Toutes les N secondes, parcourt les profils Multiverse-Inventories sur disque pour un monde
 * (ex. spawn). Si un inventaire sauvegardé contient une arme WeaponMechanics, vide inventaire,
 * armure, offhand, ender chest et potions dans le fichier JSON (format MV 5+).
 */
public final class MultiverseInventoriesSpawnWeaponFileScanner implements Runnable {

    /** Clés alignées sur {@code org.mvplugins.multiverse.inventories.util.DataStrings} / Sharables. */
    private static final String[] INVENTORY_KEYS = {
            "inventoryContents",
            "armorContents",
            "offHandItem",
            "enderChestContents",
            "potions"
    };

    private final JavaPlugin plugin;
    private final Gson gsonCompact = new GsonBuilder().disableHtmlEscaping().create();
    private BukkitTask task;

    public MultiverseInventoriesSpawnWeaponFileScanner(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public void start() {
        stop();
        if (!plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.enabled", false)) {
            return;
        }
        long ticks = Math.max(20L, plugin.getConfig().getLong("multiverse-inventories-spawn-wm-scan.interval-seconds", 5L) * 20L);
        this.task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this, ticks, ticks);
    }

    public void stop() {
        if (task != null) {
            task.cancel();
            task = null;
        }
    }

    public void reload() {
        start();
    }

    /**
     * Scan async du fichier MV-Inv du joueur, puis sur le thread principal un contrôle inventaire réel
     * (API / PDC WeaponMechanics) s’il est dans le monde spawn.
     */
    /**
     * Scan fichier + sweep en jeu. Ne dépend pas de {@code enabled} : les écouteurs n’appellent cette méthode
     * que si le scan auto est activé ; la commande {@code /sunguard mvinvscan} doit fonctionner même avec {@code enabled: false}.
     */
    public void scheduleFileScanAndLiveSweep(UUID playerId, String playerName, long delayTicks) {
        long delay = Math.max(0L, delayTicks);
        Bukkit.getScheduler().runTaskLaterAsynchronously(plugin, () -> scanStoredProfilesForPlayer(playerId, playerName), delay);
        if (!plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.live-sweep-for-weaponmechanics", true)) {
            return;
        }
        long offset = Math.max(1L, plugin.getConfig().getLong(
                "multiverse-inventories-spawn-wm-scan.live-sweep-offset-after-scan-ticks", 3L));
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (playerId == null) return;
            Player p = Bukkit.getPlayer(playerId);
            if (p != null && p.isOnline() && !p.hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) {
                sweepLiveWeaponMechanicsInSpawn(p);
            }
        }, Math.max(1L, delay + offset));
    }

    public void scanStoredProfilesForPlayer(UUID playerId, String playerName) {
        Player onlineEarly = playerId != null ? Bukkit.getPlayer(playerId) : null;
        if (onlineEarly != null && onlineEarly.isOnline() && onlineEarly.hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) {
            return;
        }
        Plugin mv = Bukkit.getPluginManager().getPlugin("Multiverse-Inventories");
        if (mv == null || !mv.isEnabled()) {
            return;
        }

        String worldName = plugin.getConfig().getString("multiverse-inventories-spawn-wm-scan.world", "spawn");
        if (worldName == null || worldName.isBlank()) {
            return;
        }

        Path worldsDir = resolveWorldsDirectory(mv);
        if (worldsDir == null) {
            return;
        }

        Path worldFolder = worldsDir.resolve(worldName.trim());
        if (!Files.isDirectory(worldFolder)) {
            return;
        }

        boolean clearOnline = plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.clear-online-player-in-spawn", true);

        Set<Path> toScan = new LinkedHashSet<>();
        if (playerId != null) {
            Path byId = worldFolder.resolve(playerId + ".json");
            if (Files.isRegularFile(byId)) {
                toScan.add(byId);
            }
        }
        if (playerName != null && !playerName.isBlank()) {
            Path byName = worldFolder.resolve(playerName + ".json");
            if (Files.isRegularFile(byName)) {
                toScan.add(byName);
            }
        }

        for (Path path : toScan) {
            processFile(path, worldName, clearOnline);
        }
    }

    /** Détecte les armes WM via l’API / PDC sur l’inventaire en jeu et vide tout si le joueur est sur le spawn. */
    public void sweepLiveWeaponMechanicsInSpawn(Player p) {
        if (!plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.live-sweep-for-weaponmechanics", true)) {
            return;
        }
        if (p == null || !p.isOnline()) {
            return;
        }
        if (p.hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) {
            return;
        }
        String worldName = plugin.getConfig().getString("multiverse-inventories-spawn-wm-scan.world", "spawn");
        if (worldName == null || p.getWorld() == null || !worldName.equalsIgnoreCase(p.getWorld().getName())) {
            return;
        }
        if (!playerCarriesWeaponMechanics(p)) {
            return;
        }
        performFullSpawnClear(p);
        if (plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.log-live-sweep", true)) {
            plugin.getLogger().info("[MV-Inv scan] Inventaire vidé (WM en jeu, spawn) : " + p.getName());
        }
    }

    @Override
    public void run() {
        if (!plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.enabled", false)) {
            return;
        }
        scanSpawnWorldDirectory();
    }

    /**
     * Parcourt tous les profils JSON du monde configuré (ex. spawn), même si {@code enabled} est false
     * — pour une commande admin. Exécuter depuis un thread async.
     */
    public void scanSpawnWorldDirectory() {
        Plugin mv = Bukkit.getPluginManager().getPlugin("Multiverse-Inventories");
        if (mv == null || !mv.isEnabled()) {
            return;
        }

        String worldName = plugin.getConfig().getString("multiverse-inventories-spawn-wm-scan.world", "spawn");
        if (worldName == null || worldName.isBlank()) return;

        Path worldsDir = resolveWorldsDirectory(mv);
        if (worldsDir == null) return;

        Path worldFolder = worldsDir.resolve(worldName.trim());
        if (!Files.isDirectory(worldFolder)) return;

        boolean clearOnline = plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.clear-online-player-in-spawn", true);

        try (Stream<Path> stream = Files.list(worldFolder)) {
            stream.filter(p -> Files.isRegularFile(p))
                    .filter(p -> {
                        String n = p.getFileName().toString().toLowerCase(Locale.ROOT);
                        return n.endsWith(".json") || n.endsWith(".yml");
                    })
                    .forEach(path -> processFile(path, worldName, clearOnline));
        } catch (IOException e) {
            plugin.getLogger().warning("[MV-Inv scan] Impossible de lire " + worldFolder + ": " + e.getMessage());
        }
    }

    /** Lance {@link #scanSpawnWorldDirectory()} de façon asynchrone (I/O disque). */
    public void runManualFullScanAsync(CommandSender requestedBy) {
        String who = requestedBy instanceof Player p ? p.getName() : "Console";
        String world = plugin.getConfig().getString("multiverse-inventories-spawn-wm-scan.world", "spawn");
        plugin.getLogger().info("[MV-Inv scan] Analyse manuelle — monde « " + world + " » — demandée par " + who);
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> scanSpawnWorldDirectory());
    }

    private Path resolveWorldsDirectory(Plugin mv) {
        String custom = plugin.getConfig().getString("multiverse-inventories-spawn-wm-scan.data-folder", "");
        if (custom != null && !custom.isBlank()) {
            Path p = Path.of(custom.trim());
            if (Files.isDirectory(p)) return p.resolve("worlds");
            return null;
        }
        return mv.getDataFolder().toPath().resolve("worlds");
    }

    private void processFile(Path path, String worldName, boolean clearOnline) {
        String fileName = path.getFileName().toString();
        String baseName = fileName.contains(".")
                ? fileName.substring(0, fileName.lastIndexOf('.'))
                : fileName;

        if (fileName.toLowerCase(Locale.ROOT).endsWith(".yml")) {
            processYamlFile(path, worldName, clearOnline, baseName, fileName);
            return;
        }

        Player byBase = resolveOnlinePlayerByProfileBaseName(baseName);
        if (byBase != null && byBase.hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) {
            return;
        }

        String json;
        try {
            json = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return;
        }
        if (json.isBlank()) return;

        JsonObject root;
        try {
            root = JsonParser.parseString(json).getAsJsonObject();
        } catch (Exception e) {
            return;
        }

        boolean modified = false;
        if (looksLikeMvProfileSection(root) && savedProfileContainsWeaponMechanics(root, gsonCompact)) {
            clearInventorySection(root);
            modified = true;
        }
        for (Map.Entry<String, JsonElement> e : root.entrySet()) {
            if (!e.getValue().isJsonObject()) continue;
            JsonObject profile = e.getValue().getAsJsonObject();
            if (!looksLikeMvProfileSection(profile)) continue;
            if (savedProfileContainsWeaponMechanics(profile, gsonCompact)) {
                clearInventorySection(profile);
                modified = true;
            }
        }

        if (!modified) return;

        String out = gsonCompact.toJson(root);
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (clearOnline) {
                tryClearOnlinePlayer(baseName, worldName);
            }
            try {
                Files.writeString(path, out, StandardCharsets.UTF_8);
                plugin.getLogger().info("[MV-Inv scan] Inventaire spawn vidé (WM) : " + worldName + "/" + fileName);
            } catch (IOException ex) {
                plugin.getLogger().warning("[MV-Inv scan] Échec écriture " + path + ": " + ex.getMessage());
            }
        });
    }

    private void processYamlFile(Path path, String worldName, boolean clearOnline, String baseName, String fileName) {
        Player byBase = resolveOnlinePlayerByProfileBaseName(baseName);
        if (byBase != null && byBase.hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) {
            return;
        }
        YamlConfiguration cfg;
        try {
            cfg = YamlConfiguration.loadConfiguration(path.toFile());
        } catch (Exception e) {
            return;
        }
        boolean modified = false;
        for (String key : cfg.getKeys(false)) {
            if (!cfg.isConfigurationSection(key)) continue;
            ConfigurationSection sec = cfg.getConfigurationSection(key);
            if (sec == null || !looksLikeYamlMvProfileSection(sec)) continue;
            if (yamlSectionContainsWeaponMechanics(sec, gsonCompact)) {
                clearYamlInventorySection(sec);
                modified = true;
            }
        }
        if (!modified) return;
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (clearOnline) {
                tryClearOnlinePlayer(baseName, worldName);
            }
            try {
                cfg.save(path.toFile());
                plugin.getLogger().info("[MV-Inv scan] Inventaire spawn vidé (WM, yml) : " + worldName + "/" + fileName);
            } catch (Exception ex) {
                plugin.getLogger().warning("[MV-Inv scan] Échec écriture yml " + path + ": " + ex.getMessage());
            }
        });
    }

    private static Player resolveOnlinePlayerByProfileBaseName(String baseName) {
        Player p = Bukkit.getPlayerExact(baseName);
        if (p != null && p.isOnline()) {
            return p;
        }
        try {
            UUID u = UUID.fromString(baseName);
            return Bukkit.getPlayer(u);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private static boolean playerCarriesWeaponMechanics(Player p) {
        for (ItemStack it : p.getInventory().getStorageContents()) {
            if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(it)) {
                return true;
            }
        }
        for (ItemStack it : p.getInventory().getArmorContents()) {
            if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(it)) {
                return true;
            }
        }
        if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(p.getInventory().getItemInOffHand())) {
            return true;
        }
        for (ItemStack it : p.getEnderChest().getContents()) {
            if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(it)) {
                return true;
            }
        }
        return false;
    }

    private void performFullSpawnClear(Player p) {
        PlayerInventory inv = p.getInventory();
        inv.clear();
        inv.setArmorContents(new ItemStack[4]);
        inv.setItemInOffHand(null);
        try {
            p.getEnderChest().clear();
        } catch (Exception ignored) {}

        for (PotionEffect effect : new ArrayList<>(p.getActivePotionEffects())) {
            p.removePotionEffect(effect.getType());
        }
        try {
            p.updateInventory();
        } catch (Exception ignored) {}
    }

    private static boolean savedProfileContainsWeaponMechanics(JsonObject profile, Gson gson) {
        for (String key : INVENTORY_KEYS) {
            if (!profile.has(key)) continue;
            JsonElement e = profile.get(key);
            if (weaponMechanicsHintInElement(e, gson)) return true;
        }
        return false;
    }

    private static boolean weaponMechanicsHintInElement(JsonElement e, Gson gson) {
        return weaponMechanicsHintInElement(e, gson, 0);
    }

    private static boolean weaponMechanicsHintInElement(JsonElement e, Gson gson, int depth) {
        if (e == null || e.isJsonNull() || depth > 12) {
            return false;
        }
        if (e.isJsonPrimitive()) {
            JsonPrimitive p = e.getAsJsonPrimitive();
            if (p.isString()) {
                String s = p.getAsString();
                if (s.toLowerCase(Locale.ROOT).contains("weaponmechanic")) {
                    return true;
                }
                return itemStackFromMvStringMayBeWm(s);
            }
            return e.toString().toLowerCase(Locale.ROOT).contains("weaponmechanic");
        }
        if (e.isJsonObject()) {
            JsonObject o = e.getAsJsonObject();
            if (looksLikeSerializedItemMap(o)) {
                try {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> map = gson.fromJson(o, Map.class);
                    if (map != null && !map.isEmpty()) {
                        ItemStack st = ItemStack.deserialize(map);
                        if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(st)) {
                            return true;
                        }
                    }
                } catch (Throwable ignored) {}
            }
            for (String key : o.keySet()) {
                if (weaponMechanicsHintInElement(o.get(key), gson, depth + 1)) {
                    return true;
                }
            }
            return o.toString().toLowerCase(Locale.ROOT).contains("weaponmechanic");
        }
        if (e.isJsonArray()) {
            for (JsonElement c : e.getAsJsonArray()) {
                if (weaponMechanicsHintInElement(c, gson, depth + 1)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean looksLikeSerializedItemMap(JsonObject o) {
        return o.has("id") || o.has("type") || o.has("v") || o.has("Count") || o.has("count");
    }

    /**
     * Tente de désérialiser le format chaîne MV en ItemStack[] / ItemStack (Paper) pour une détection WM fiable.
     */
    private static boolean itemStackFromMvStringMayBeWm(String encoded) {
        if (encoded == null || encoded.isBlank()) return false;
        try {
            ItemStack single = ItemStack.deserializeBytes(encoded.getBytes(StandardCharsets.UTF_8));
            if (single != null && WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(single)) return true;
        } catch (Throwable ignored) {}
        try {
            // Parfois une seule ligne par slot ou format legacy
            for (String part : encoded.split(";")) {
                if (part.isBlank()) continue;
                try {
                    ItemStack s = ItemStack.deserializeBytes(part.getBytes(StandardCharsets.UTF_8));
                    if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(s)) return true;
                } catch (Throwable ignored2) {}
            }
        } catch (Throwable ignored) {}
        return false;
    }

    private static boolean looksLikeMvProfileSection(JsonObject o) {
        for (String key : INVENTORY_KEYS) {
            if (o.has(key)) return true;
        }
        return false;
    }

    private static boolean looksLikeYamlMvProfileSection(ConfigurationSection sec) {
        for (String key : INVENTORY_KEYS) {
            if (sec.contains(key)) return true;
        }
        return false;
    }

    /**
     * MV-Inv interprète l’absence de clé comme inventaire vide ; une chaîne {@code ""} peut être mal relue selon la version.
     */
    private static void clearInventorySection(JsonObject profile) {
        for (String key : INVENTORY_KEYS) {
            profile.remove(key);
        }
    }

    private static void clearYamlInventorySection(ConfigurationSection sec) {
        for (String key : INVENTORY_KEYS) {
            sec.set(key, null);
        }
    }

    private static boolean yamlSectionContainsWeaponMechanics(ConfigurationSection sec, Gson gson) {
        for (String key : INVENTORY_KEYS) {
            if (!sec.contains(key)) continue;
            Object val = sec.get(key);
            if (val == null) continue;
            try {
                if (val instanceof List<?> || val instanceof Map<?, ?>) {
                    String json = gson.toJson(val);
                    JsonElement parsed = JsonParser.parseString(json);
                    if (weaponMechanicsHintInElement(parsed, gson)) return true;
                } else {
                    if (weaponMechanicsHintInElement(new JsonPrimitive(String.valueOf(val)), gson)) return true;
                }
            } catch (Exception ignored) {}
        }
        return false;
    }

    private void tryClearOnlinePlayer(String playerNameFromFile, String configuredWorldName) {
        Player p = Bukkit.getPlayerExact(playerNameFromFile);
        if (p == null || !p.isOnline()) {
            try {
                UUID u = UUID.fromString(playerNameFromFile);
                p = Bukkit.getPlayer(u);
            } catch (IllegalArgumentException ignored) {}
        }
        if (p == null || !p.isOnline()) return;

        World w = p.getWorld();
        if (w == null || !configuredWorldName.equalsIgnoreCase(w.getName())) return;
        if (p.hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) return;

        performFullSpawnClear(p);
    }
}
