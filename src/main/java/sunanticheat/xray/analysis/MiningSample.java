package sunanticheat.xray.analysis;

/**
 * Échantillon d'un minage de minerai précieux : timestamp + position + monde + région + type.
 * Servira à reconstituer veines, beeline et carte des pioches du joueur.
 */
public record MiningSample(
        long timestamp,
        OreType oreType,
        String world,
        String region,
        int x,
        int y,
        int z
) {

    public enum OreType {
        DIAMOND, IRON, GOLD, ANCIENT_DEBRIS, EMERALD, LAPIS, REDSTONE, COPPER, COAL;

        public boolean isPrecious() {
            return this == DIAMOND || this == ANCIENT_DEBRIS || this == EMERALD;
        }
    }
}
