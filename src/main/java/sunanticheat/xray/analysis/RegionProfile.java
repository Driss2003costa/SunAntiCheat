package sunanticheat.xray.analysis;

import java.util.Map;

/**
 * Profil d'une région ("pays") configurée par l'admin.
 *
 * La distribution des minerais varie selon la région : un serveur monde-roleplay
 * peut booster le diamant en Afrique du Sud, le fer en France, l'or en Amérique du Sud, etc.
 *
 *  - expectedValuablePercent : moyenne attendue du % minerais précieux sur la région
 *  - expectedDiamondPer1k    : moyenne attendue de diamants pour 1000 blocs communs
 *  - tolerance               : déviation tolérée avant suspicion (1.0 = ±100% au-dessus de la moyenne)
 *  - oreMultipliers          : multiplicateurs custom par type de minerai (vs vanilla)
 *  - matchWorlds             : noms de mondes qui appartiennent à cette région
 *  - matchBoundingBox        : null ou {x1,z1,x2,z2} dans le monde courant
 */
public final class RegionProfile {

    public final String id;
    public final String displayName;
    public final String emoji;
    public final double expectedValuablePercent;
    public final double expectedDiamondPer1k;
    public final double tolerance;
    public final Map<String, Double> oreMultipliers;
    public final java.util.List<String> matchWorlds;
    public final BoundingBox matchBoundingBox;

    public RegionProfile(String id,
                         String displayName,
                         String emoji,
                         double expectedValuablePercent,
                         double expectedDiamondPer1k,
                         double tolerance,
                         Map<String, Double> oreMultipliers,
                         java.util.List<String> matchWorlds,
                         BoundingBox matchBoundingBox) {
        this.id = id;
        this.displayName = displayName;
        this.emoji = emoji;
        this.expectedValuablePercent = expectedValuablePercent;
        this.expectedDiamondPer1k = expectedDiamondPer1k;
        this.tolerance = Math.max(0.05, tolerance);
        this.oreMultipliers = oreMultipliers != null ? oreMultipliers : Map.of();
        this.matchWorlds = matchWorlds != null ? matchWorlds : java.util.List.of();
        this.matchBoundingBox = matchBoundingBox;
    }

    /**
     * Profil par défaut "vanilla" — utilisé quand aucune région ne matche.
     * Ratios indicatifs basés sur la génération vanilla 1.21 (deepslate).
     */
    public static RegionProfile vanillaDefault() {
        return new RegionProfile(
                "vanilla",
                "Standard (vanilla)",
                "🌍",
                14.0,   // ~14% précieux est déjà beaucoup en vanilla
                1.2,    // ~1.2 diamant pour 1000 communs (deepslate Y<16)
                1.5,    // tolérance ±150% (large pour éviter faux positifs)
                Map.of(),
                java.util.List.of(),
                null
        );
    }

    public boolean matches(String worldName, int x, int z) {
        if (matchWorlds.contains(worldName)) return true;
        if (matchBoundingBox != null && matchBoundingBox.contains(x, z)) return true;
        return false;
    }

    /** Boîte rectangulaire dans le plan XZ (coordonnées monde). */
    public record BoundingBox(int x1, int z1, int x2, int z2) {
        public boolean contains(int x, int z) {
            int minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
            int minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
            return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
        }
    }
}
