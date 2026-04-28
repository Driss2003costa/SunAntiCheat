package sunanticheat.dashboard.games;

import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.io.File;
import java.util.*;
import java.util.logging.Logger;

/**
 * Scanne les plugins de mini-jeux installés et extrait la liste de leurs arènes
 * + leur statut (PLAYING / WAITING / DISABLED).
 *
 * Stratégie defensive : pour chaque jeu connu, on tente plusieurs paths/formats
 * de config (les versions changent leur structure). En cas d'erreur, on log
 * un warning et on continue avec les autres jeux.
 *
 * Statut d'une arène :
 *   - DISABLED : le plugin n'est pas chargé
 *   - PLAYING  : au moins 1 joueur dans le monde de l'arène
 *   - WAITING  : 0 joueur dans le monde (ou monde inconnu mais plugin chargé)
 *
 * Pour détecter la "vraie" partie en cours (lobby vs jeu), on utiliserait
 * idéalement l'API du plugin par réflexion. Vu que chaque plugin a son propre
 * GameManager incompatible, on utilise le compteur de joueurs comme proxy.
 */
public final class GameArenaScanner {

    private final Logger logger;

    public GameArenaScanner(Logger logger) {
        this.logger = logger;
    }

    /** Scanne tous les jeux et retourne la liste agrégée des arènes. */
    public List<Arena> scanAll() {
        List<Arena> all = new ArrayList<>();
        all.addAll(scanCtf());
        all.addAll(scanSkywars());
        all.addAll(scanThimble());
        all.addAll(scanTntRun());
        return all;
    }

    /** Liste des jeux installés (un par game, peu importe le nombre d'arènes). */
    public List<Map<String, Object>> games() {
        List<Map<String, Object>> out = new ArrayList<>();
        out.add(gameMeta("CTF",     "kitbattle-ctf",   "Capture the Flag", "🚩"));
        out.add(gameMeta("Skywars", "Skywars",          "Skywars",          "☁️"));
        out.add(gameMeta("Thimble", "Thimble",          "Thimble (dive)",   "💧"));
        out.add(gameMeta("TntRun",  "TNT-Run",          "TNT Run",           "💣"));
        return out;
    }

    private Map<String, Object> gameMeta(String id, String pluginName, String label, String icon) {
        Plugin p = pluginByName(pluginName);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("label", label);
        m.put("icon", icon);
        m.put("pluginName", pluginName);
        m.put("installed", p != null);
        m.put("enabled", p != null && p.isEnabled());
        m.put("version", p != null ? p.getDescription().getVersion() : null);
        return m;
    }

    // ── CTF (kitbattle-ctf) ───────────────────────────────────────────────────
    /**
     * Format observé : `plugins/CTF/maps.yml` ou `plugins/kitbattle-ctf/maps.yml`
     * Structure (cf. log [CTF] Loaded map 'X' from maps.yml ...) :
     *   maps:
     *     test:
     *       redFlag: ...
     *       blueFlag: ...
     *       spawns: [ ... ]
     *       world: nom_du_monde   (parfois absent — déduit du flag)
     */
    @SuppressWarnings("unchecked")
    private List<Arena> scanCtf() {
        List<Arena> out = new ArrayList<>();
        Plugin p = pluginByName("kitbattle-ctf");
        if (p == null) p = pluginByName("CTF");
        if (p == null) return out;

        File dataFolder = p.getDataFolder();
        File mapsFile = firstExisting(
                new File(dataFolder, "maps.yml"),
                new File(dataFolder, "arenas.yml"),
                new File(dataFolder, "config/maps.yml")
        );
        if (mapsFile == null) return out;

        try {
            YamlConfiguration yml = YamlConfiguration.loadConfiguration(mapsFile);
            ConfigurationSection root = yml.getConfigurationSection("maps");
            if (root == null) root = yml; // certaines versions mettent les maps à la racine

            for (String key : root.getKeys(false)) {
                ConfigurationSection sec = root.getConfigurationSection(key);
                if (sec == null) continue;
                Arena a = new Arena();
                a.game = "CTF";
                a.gameLabel = "Capture the Flag";
                a.icon = "🚩";
                a.name = key;
                a.world = extractWorldName(sec);
                a.minPlayers = sec.getInt("minPlayers", sec.getInt("min-players", 2));
                a.maxPlayers = sec.getInt("maxPlayers", sec.getInt("max-players", 16));
                a.extra = "spawns: " + (sec.isList("spawns") ? sec.getList("spawns").size() : 0)
                        + ", redFlag: " + sec.contains("redFlag")
                        + ", blueFlag: " + sec.contains("blueFlag");
                computeStatus(a);
                out.add(a);
            }
        } catch (Throwable t) {
            logger.warning("[Games] CTF scan : " + t.getMessage());
        }
        return out;
    }

    // ── Skywars ───────────────────────────────────────────────────────────────
    /**
     * Format Wild Skywars / Skywars / etc. — souvent un dossier `arenas/` avec
     * 1 .yml par arène, OU un seul `arenas.yml` avec section `arenas`.
     */
    private List<Arena> scanSkywars() {
        List<Arena> out = new ArrayList<>();
        Plugin p = pluginByName("Skywars");
        if (p == null) p = pluginByName("SkyWars");
        if (p == null) p = pluginByName("WildSkywars");
        if (p == null) return out;

        File dataFolder = p.getDataFolder();

        // Cas 1 : fichier unique `arenas.yml`
        File single = firstExisting(
                new File(dataFolder, "arenas.yml"),
                new File(dataFolder, "data/arenas.yml")
        );
        if (single != null) {
            parseSkywarsBundle(single, out);
        }

        // Cas 2 : dossier `arenas/` avec 1 yml par arène
        File arenasDir = firstExisting(
                new File(dataFolder, "arenas"),
                new File(dataFolder, "maps"),
                new File(dataFolder, "data/arenas")
        );
        if (arenasDir != null && arenasDir.isDirectory()) {
            File[] files = arenasDir.listFiles((d, n) -> n.endsWith(".yml"));
            if (files != null) for (File f : files) parseSkywarsArenaFile(f, out);
        }
        return out;
    }

    private void parseSkywarsBundle(File file, List<Arena> out) {
        try {
            YamlConfiguration yml = YamlConfiguration.loadConfiguration(file);
            ConfigurationSection root = yml.getConfigurationSection("arenas");
            if (root == null) return;
            for (String key : root.getKeys(false)) {
                ConfigurationSection sec = root.getConfigurationSection(key);
                if (sec == null) continue;
                Arena a = baseSkywarsArena(key, sec);
                computeStatus(a);
                out.add(a);
            }
        } catch (Throwable t) {
            logger.warning("[Games] Skywars bundle scan : " + t.getMessage());
        }
    }

    private void parseSkywarsArenaFile(File file, List<Arena> out) {
        try {
            YamlConfiguration yml = YamlConfiguration.loadConfiguration(file);
            String name = yml.getString("name", file.getName().replace(".yml", ""));
            Arena a = baseSkywarsArena(name, yml);
            computeStatus(a);
            out.add(a);
        } catch (Throwable t) {
            logger.warning("[Games] Skywars file " + file.getName() + " : " + t.getMessage());
        }
    }

    private Arena baseSkywarsArena(String name, ConfigurationSection sec) {
        Arena a = new Arena();
        a.game = "Skywars";
        a.gameLabel = "Skywars";
        a.icon = "☁️";
        a.name = name;
        a.world = extractWorldName(sec);
        a.minPlayers = sec.getInt("minPlayers", sec.getInt("min-players", sec.getInt("minplayers", 2)));
        a.maxPlayers = sec.getInt("maxPlayers", sec.getInt("max-players", sec.getInt("maxplayers", 8)));
        ConfigurationSection spawns = sec.getConfigurationSection("spawns");
        a.extra = "spawns: " + (spawns != null ? spawns.getKeys(false).size()
                              : sec.isList("spawns") ? sec.getList("spawns").size() : "?");
        return a;
    }

    // ── Thimble ───────────────────────────────────────────────────────────────
    private List<Arena> scanThimble() {
        List<Arena> out = new ArrayList<>();
        Plugin p = pluginByName("Thimble");
        if (p == null) return out;

        File dataFolder = p.getDataFolder();
        File arenasDir = firstExisting(
                new File(dataFolder, "arenas"),
                new File(dataFolder, "data")
        );
        if (arenasDir != null && arenasDir.isDirectory()) {
            File[] files = arenasDir.listFiles((d, n) -> n.endsWith(".yml") || n.endsWith(".json"));
            if (files != null) for (File f : files) {
                if (f.getName().endsWith(".yml")) parseThimbleArenaFile(f, out);
            }
        }

        // Fallback : arenas.yml avec section
        File single = firstExisting(
                new File(dataFolder, "arenas.yml"),
                new File(dataFolder, "config.yml")
        );
        if (single != null) {
            try {
                YamlConfiguration yml = YamlConfiguration.loadConfiguration(single);
                ConfigurationSection sec = yml.getConfigurationSection("arenas");
                if (sec != null) for (String key : sec.getKeys(false)) {
                    ConfigurationSection arenaSec = sec.getConfigurationSection(key);
                    if (arenaSec != null) out.add(baseThimbleArena(key, arenaSec));
                }
            } catch (Throwable t) {
                logger.warning("[Games] Thimble bundle scan : " + t.getMessage());
            }
        }
        return out;
    }

    private void parseThimbleArenaFile(File file, List<Arena> out) {
        try {
            YamlConfiguration yml = YamlConfiguration.loadConfiguration(file);
            String name = yml.getString("name", file.getName().replace(".yml", ""));
            Arena a = baseThimbleArena(name, yml);
            computeStatus(a);
            out.add(a);
        } catch (Throwable t) {
            logger.warning("[Games] Thimble file " + file.getName() + " : " + t.getMessage());
        }
    }

    private Arena baseThimbleArena(String name, ConfigurationSection sec) {
        Arena a = new Arena();
        a.game = "Thimble";
        a.gameLabel = "Thimble";
        a.icon = "💧";
        a.name = name;
        a.world = extractWorldName(sec);
        a.minPlayers = sec.getInt("minPlayers", sec.getInt("min-players", 2));
        a.maxPlayers = sec.getInt("maxPlayers", sec.getInt("max-players", 8));
        return a;
    }

    // ── TNT Run ───────────────────────────────────────────────────────────────
    private List<Arena> scanTntRun() {
        List<Arena> out = new ArrayList<>();
        Plugin p = pluginByName("TNT-Run");
        if (p == null) p = pluginByName("TNTRun");
        if (p == null) p = pluginByName("tnt-run");
        if (p == null) return out;

        File dataFolder = p.getDataFolder();
        // Format typique : arenas/<name>.yml
        File arenasDir = firstExisting(
                new File(dataFolder, "arenas"),
                new File(dataFolder, "maps"),
                new File(dataFolder, "data/arenas")
        );
        if (arenasDir != null && arenasDir.isDirectory()) {
            File[] files = arenasDir.listFiles((d, n) -> n.endsWith(".yml"));
            if (files != null) for (File f : files) {
                try {
                    YamlConfiguration yml = YamlConfiguration.loadConfiguration(f);
                    String name = yml.getString("name", f.getName().replace(".yml", ""));
                    Arena a = new Arena();
                    a.game = "TntRun";
                    a.gameLabel = "TNT Run";
                    a.icon = "💣";
                    a.name = name;
                    a.world = extractWorldName(yml);
                    a.minPlayers = yml.getInt("minPlayers", yml.getInt("min-players", 2));
                    a.maxPlayers = yml.getInt("maxPlayers", yml.getInt("max-players", 16));
                    computeStatus(a);
                    out.add(a);
                } catch (Throwable t) {
                    logger.warning("[Games] TntRun file " + f.getName() + " : " + t.getMessage());
                }
            }
        }
        // Cas alternatif : config.yml avec section arenas
        File single = firstExisting(
                new File(dataFolder, "arenas.yml"),
                new File(dataFolder, "config.yml")
        );
        if (single != null && out.isEmpty()) {
            try {
                YamlConfiguration yml = YamlConfiguration.loadConfiguration(single);
                ConfigurationSection sec = yml.getConfigurationSection("arenas");
                if (sec != null) for (String key : sec.getKeys(false)) {
                    ConfigurationSection arenaSec = sec.getConfigurationSection(key);
                    if (arenaSec == null) continue;
                    Arena a = new Arena();
                    a.game = "TntRun";
                    a.gameLabel = "TNT Run";
                    a.icon = "💣";
                    a.name = key;
                    a.world = extractWorldName(arenaSec);
                    a.minPlayers = arenaSec.getInt("minPlayers", arenaSec.getInt("min-players", 2));
                    a.maxPlayers = arenaSec.getInt("maxPlayers", arenaSec.getInt("max-players", 16));
                    computeStatus(a);
                    out.add(a);
                }
            } catch (Throwable t) {
                logger.warning("[Games] TntRun bundle scan : " + t.getMessage());
            }
        }
        return out;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void computeStatus(Arena a) {
        if (a.world != null && !a.world.isBlank()) {
            World w = Bukkit.getWorld(a.world);
            if (w != null) {
                int n = w.getPlayers().size();
                a.currentPlayers = n;
                a.status = (n > 0) ? "PLAYING" : "WAITING";
                if (n > 0) {
                    StringBuilder names = new StringBuilder();
                    for (Player pl : w.getPlayers()) {
                        if (names.length() > 0) names.append(", ");
                        names.append(pl.getName());
                        if (names.length() > 100) { names.append("…"); break; }
                    }
                    a.players = names.toString();
                }
                return;
            }
        }
        a.status = "WAITING";
        a.currentPlayers = 0;
    }

    /** Lit un nom de world depuis une section yaml en testant plusieurs clés. */
    private static String extractWorldName(ConfigurationSection sec) {
        for (String key : new String[]{"world", "World", "world-name", "worldName", "map.world"}) {
            String v = sec.getString(key);
            if (v != null && !v.isBlank()) return v;
        }
        // Tentatives via location strings (ex: "world,0,0,0")
        for (String key : new String[]{"spawn", "lobby", "redFlag", "blueFlag", "center"}) {
            String v = sec.getString(key);
            if (v != null && v.contains(",")) {
                String firstPart = v.split(",")[0].trim();
                if (!firstPart.isBlank()) return firstPart;
            }
            // Section avec sous-champ world ?
            ConfigurationSection sub = sec.getConfigurationSection(key);
            if (sub != null) {
                String w = sub.getString("world");
                if (w != null && !w.isBlank()) return w;
            }
        }
        return null;
    }

    private static File firstExisting(File... candidates) {
        for (File f : candidates) if (f != null && f.exists()) return f;
        return null;
    }

    private static Plugin pluginByName(String name) {
        return Bukkit.getPluginManager().getPlugin(name);
    }
}
