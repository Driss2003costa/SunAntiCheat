package sunanticheat.xray.analysis;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Charge les profils de région depuis config.yml (section xray.regions) et résout
 * une position monde → région ("pays").
 *
 * Ordre de résolution :
 *  1. première région dont la bounding-box contient (x,z)
 *  2. première région dont matchWorlds contient le monde
 *  3. profil "vanilla" par défaut
 */
public final class RegionResolver {

    private final JavaPlugin plugin;
    private List<RegionProfile> profiles = new ArrayList<>();
    private RegionProfile defaultProfile = RegionProfile.vanillaDefault();

    public RegionResolver(JavaPlugin plugin) {
        this.plugin = plugin;
        reload();
    }

    public synchronized void reload() {
        List<RegionProfile> loaded = new ArrayList<>();
        ConfigurationSection root = plugin.getConfig().getConfigurationSection("xray.regions");
        if (root != null) {
            for (String id : root.getKeys(false)) {
                ConfigurationSection s = root.getConfigurationSection(id);
                if (s == null) continue;
                String name = s.getString("display-name", id);
                String emoji = s.getString("emoji", "🏳");
                double valPct = s.getDouble("expected-valuable-percent", 14.0);
                double diaPerK = s.getDouble("expected-diamond-per-1k", 1.2);
                double tol = s.getDouble("tolerance", 1.5);
                List<String> worlds = s.getStringList("worlds");

                Map<String, Double> mults = new HashMap<>();
                ConfigurationSection mSec = s.getConfigurationSection("ore-multipliers");
                if (mSec != null) {
                    for (String k : mSec.getKeys(false)) {
                        mults.put(k.toUpperCase(), mSec.getDouble(k, 1.0));
                    }
                }
                RegionProfile.BoundingBox bbox = null;
                ConfigurationSection bb = s.getConfigurationSection("bounding-box");
                if (bb != null && bb.contains("x1") && bb.contains("z1") && bb.contains("x2") && bb.contains("z2")) {
                    bbox = new RegionProfile.BoundingBox(
                            bb.getInt("x1"), bb.getInt("z1"),
                            bb.getInt("x2"), bb.getInt("z2"));
                }
                loaded.add(new RegionProfile(id, name, emoji, valPct, diaPerK, tol, mults, worlds, bbox));
            }
        }
        this.profiles = loaded;
    }

    public synchronized RegionProfile resolve(String world, int x, int z) {
        // 1) bbox match (plus précis, prioritaire)
        for (RegionProfile p : profiles) {
            if (p.matchBoundingBox != null && p.matchBoundingBox.contains(x, z)
                    && (p.matchWorlds.isEmpty() || p.matchWorlds.contains(world))) {
                return p;
            }
        }
        // 2) world match (sans bbox)
        for (RegionProfile p : profiles) {
            if (p.matchBoundingBox == null && p.matchWorlds.contains(world)) {
                return p;
            }
        }
        return defaultProfile;
    }

    public synchronized List<RegionProfile> all() {
        List<RegionProfile> out = new ArrayList<>(profiles);
        out.add(defaultProfile);
        return out;
    }

    public RegionProfile defaultProfile() { return defaultProfile; }

    /** Ratios "vanilla" vs configuration : utile pour exporter en JSON. */
    public Map<String, Object> exportProfile(RegionProfile p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id);
        m.put("displayName", p.displayName);
        m.put("emoji", p.emoji);
        m.put("expectedValuablePercent", p.expectedValuablePercent);
        m.put("expectedDiamondPer1k", p.expectedDiamondPer1k);
        m.put("tolerance", p.tolerance);
        m.put("oreMultipliers", p.oreMultipliers);
        m.put("worlds", p.matchWorlds);
        if (p.matchBoundingBox != null) {
            m.put("boundingBox", Map.of(
                    "x1", p.matchBoundingBox.x1(),
                    "z1", p.matchBoundingBox.z1(),
                    "x2", p.matchBoundingBox.x2(),
                    "z2", p.matchBoundingBox.z2()));
        }
        return m;
    }
}
