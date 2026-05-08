package sunanticheat.xray.analysis;

import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Store mémoire des profils X-Ray enrichis (par-Y, par-monde, par-région, time series, veines).
 * Ce store est complémentaire à {@link sunanticheat.xray.XRayTracker} qui reste le tracker
 * "léger" utilisé par la GUI ingame et la sauvegarde quotidienne.
 */
public final class XRayAnalysisStore {

    private final JavaPlugin plugin;
    private final RegionResolver regionResolver;
    private final Map<UUID, XRayPlayerProfile> profiles = new ConcurrentHashMap<>();

    public XRayAnalysisStore(JavaPlugin plugin, RegionResolver regionResolver) {
        this.plugin = plugin;
        this.regionResolver = regionResolver;
    }

    public RegionResolver regionResolver() { return regionResolver; }

    public XRayPlayerProfile getOrCreate(UUID uuid, String name) {
        XRayPlayerProfile p = profiles.computeIfAbsent(uuid, k -> new XRayPlayerProfile(k, name));
        if (name != null && !name.equals(p.playerName())) p.setPlayerName(name);
        return p;
    }

    public XRayPlayerProfile get(UUID uuid) { return profiles.get(uuid); }

    public Map<UUID, XRayPlayerProfile> all() { return profiles; }

    public boolean reset(UUID uuid) {
        return profiles.remove(uuid) != null;
    }

    public void recordBreak(Player player, Block block) {
        Material mat = block.getType();
        MiningSample.OreType type = classify(mat);
        boolean isCommon = isCommon(mat);
        boolean isNetherrack = mat == Material.NETHERRACK;
        if (type == null && !isCommon && !isNetherrack) return;

        UUID uuid = player.getUniqueId();
        XRayPlayerProfile profile = getOrCreate(uuid, player.getName());
        String world = block.getWorld() != null ? block.getWorld().getName() : "?";
        int x = block.getX(), y = block.getY(), z = block.getZ();
        RegionProfile region = regionResolver.resolve(world, x, z);
        profile.record(type, world, region.id, x, y, z, System.currentTimeMillis(), isCommon, isNetherrack);
    }

    public static MiningSample.OreType classify(Material m) {
        return switch (m) {
            case DIAMOND_ORE, DEEPSLATE_DIAMOND_ORE -> MiningSample.OreType.DIAMOND;
            case IRON_ORE, DEEPSLATE_IRON_ORE -> MiningSample.OreType.IRON;
            case GOLD_ORE, DEEPSLATE_GOLD_ORE, NETHER_GOLD_ORE -> MiningSample.OreType.GOLD;
            case ANCIENT_DEBRIS -> MiningSample.OreType.ANCIENT_DEBRIS;
            case EMERALD_ORE, DEEPSLATE_EMERALD_ORE -> MiningSample.OreType.EMERALD;
            case LAPIS_ORE, DEEPSLATE_LAPIS_ORE -> MiningSample.OreType.LAPIS;
            case REDSTONE_ORE, DEEPSLATE_REDSTONE_ORE -> MiningSample.OreType.REDSTONE;
            case COPPER_ORE, DEEPSLATE_COPPER_ORE -> MiningSample.OreType.COPPER;
            case COAL_ORE, DEEPSLATE_COAL_ORE -> MiningSample.OreType.COAL;
            default -> null;
        };
    }

    public static boolean isCommon(Material m) {
        return switch (m) {
            case STONE, DEEPSLATE, ANDESITE, DIORITE, GRANITE, TUFF,
                 DIRT, GRAVEL, COBBLESTONE, COBBLED_DEEPSLATE, BASALT, BLACKSTONE -> true;
            default -> false;
        };
    }

    /**
     * Retourne la région dominante d'un joueur (celle où il mine le plus).
     */
    public XRaySuspicionScorer.DominantRegion dominantRegion(XRayPlayerProfile profile) {
        Map<String, long[]> byRegion = profile.byRegionSnapshot();
        if (byRegion.isEmpty()) {
            return new XRaySuspicionScorer.DominantRegion(
                    regionResolver.defaultProfile().id,
                    regionResolver.defaultProfile(), 1.0);
        }
        String topId = null; long topCount = 0; long sum = 0;
        for (var e : byRegion.entrySet()) {
            long c = 0; for (long v : e.getValue()) c += v;
            sum += c;
            if (c > topCount) { topCount = c; topId = e.getKey(); }
        }
        if (topId == null) topId = regionResolver.defaultProfile().id;
        final String resolvedId = topId;
        RegionProfile rp = regionResolver.all().stream()
                .filter(p -> p.id.equals(resolvedId))
                .findFirst()
                .orElse(regionResolver.defaultProfile());
        double share = sum == 0 ? 1.0 : 1.0 * topCount / sum;
        return new XRaySuspicionScorer.DominantRegion(topId, rp, share);
    }
}
