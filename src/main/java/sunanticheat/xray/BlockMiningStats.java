package sunanticheat.xray;

import java.util.EnumSet;
import java.util.Set;
import org.bukkit.Material;

/**
 * Statistiques de minage par joueur.
 * Compteurs séparés pour diamant, fer (argent), or et blocs communs.
 */
public final class BlockMiningStats {

    private static final Set<Material> DIAMOND_ORES = EnumSet.of(
            Material.DIAMOND_ORE,
            Material.DEEPSLATE_DIAMOND_ORE
    );
    private static final Set<Material> IRON_ORES = EnumSet.of(
            Material.IRON_ORE,
            Material.DEEPSLATE_IRON_ORE
    );
    private static final Set<Material> GOLD_ORES = EnumSet.of(
            Material.GOLD_ORE,
            Material.DEEPSLATE_GOLD_ORE,
            Material.NETHER_GOLD_ORE
    );

    private static final Set<Material> COMMON_BLOCKS = EnumSet.of(
            Material.STONE,
            Material.DEEPSLATE,
            Material.ANDESITE,
            Material.DIORITE,
            Material.GRANITE,
            Material.TUFF,
            Material.DIRT,
            Material.GRAVEL,
            Material.COBBLESTONE,
            Material.COBBLED_DEEPSLATE,
            Material.BASALT,
            Material.BLACKSTONE
    );

    public static boolean isNetherrack(Material type) {
        return type == Material.NETHERRACK;
    }

    public static boolean isAncientDebris(Material type) {
        return type == Material.ANCIENT_DEBRIS;
    }

    public static boolean isDiamondOre(Material type) {
        return DIAMOND_ORES.contains(type);
    }

    public static boolean isIronOre(Material type) {
        return IRON_ORES.contains(type);
    }

    public static boolean isGoldOre(Material type) {
        return GOLD_ORES.contains(type);
    }

    public static boolean isCommonBlock(Material type) {
        return COMMON_BLOCKS.contains(type);
    }

    private long diamondCount;
    private long ironCount;
    private long goldCount;
    private long netherrackCount;
    private long ancientDebrisCount;
    private long commonCount;

    public void addDiamond() { diamondCount++; }
    public void addIron() { ironCount++; }
    public void addGold() { goldCount++; }
    public void addNetherrack() { netherrackCount++; }
    public void addAncientDebris() { ancientDebrisCount++; }
    public void addCommon() { commonCount++; }

    public long getDiamondCount() { return diamondCount; }
    public long getIronCount() { return ironCount; }
    public long getGoldCount() { return goldCount; }
    public long getNetherrackCount() { return netherrackCount; }
    public long getAncientDebrisCount() { return ancientDebrisCount; }
    public long getCommonCount() { return commonCount; }

    /** Charge les valeurs depuis un snapshot (fichier log). */
    public void setFromSnapshot(long diamond, long iron, long gold, long netherrack, long ancientDebris, long common) {
        this.diamondCount = diamond;
        this.ironCount = iron;
        this.goldCount = gold;
        this.netherrackCount = netherrack;
        this.ancientDebrisCount = ancientDebris;
        this.commonCount = common;
    }

    public long getTotal() {
        return diamondCount + ironCount + goldCount + netherrackCount + ancientDebrisCount + commonCount;
    }

    /** Pourcentage de diamant par rapport au total (diamant + fer + or + commun). */
    public double getDiamondPercentage() {
        long total = getTotal();
        return total == 0 ? 0 : 100.0 * diamondCount / total;
    }

    /** Pourcentage de fer (argent) par rapport au total. */
    public double getIronPercentage() {
        long total = getTotal();
        return total == 0 ? 0 : 100.0 * ironCount / total;
    }

    /** Pourcentage d'or par rapport au total. */
    public double getGoldPercentage() {
        long total = getTotal();
        return total == 0 ? 0 : 100.0 * goldCount / total;
    }

    /** Pourcentage total minerais précieux (diamant+fer+or+netherite) pour la suspicion. */
    public double getValuablePercentage() {
        long total = getTotal();
        return total == 0 ? 0 : 100.0 * (diamondCount + ironCount + goldCount + ancientDebrisCount) / total;
    }

    /** Pourcentage netherite (Ancient Debris) par rapport à netherrack + ancient debris (minage Nether). */
    public double getNetheriteVsNetherrackPercentage() {
        long netherTotal = netherrackCount + ancientDebrisCount;
        return netherTotal == 0 ? 0 : 100.0 * ancientDebrisCount / netherTotal;
    }

    /** Diamants pour 1000 blocs communs (pierre, etc.). En vanilla ce ratio est très bas ; élevé = suspect x-ray. */
    public double getDiamondPerThousandCommon() {
        if (commonCount == 0) return diamondCount > 0 ? 1000.0 : 0;
        return 1000.0 * diamondCount / commonCount;
    }
}
