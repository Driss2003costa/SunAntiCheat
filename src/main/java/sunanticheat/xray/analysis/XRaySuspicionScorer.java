package sunanticheat.xray.analysis;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Calcule un score de suspicion 0..100 multi-facteurs et explique chaque sous-score.
 * Tient compte de la "région" du joueur (ratio de minerais attendu varie par pays).
 */
public final class XRaySuspicionScorer {

    public record Score(int total, String level, Map<String, Component> components, double expectedValuablePct, double expectedDiamondPer1k) {}

    public record Component(String label, double value, double maxScore, double score, String detail) {}

    /** Décrit la région dominante du joueur (issue de byRegion). */
    public record DominantRegion(String regionId, RegionProfile profile, double share) {}

    private static final double DEFAULT_BEELINE_THRESHOLD = 8.0;

    private XRaySuspicionScorer() {}

    /**
     * @param profile      le profil joueur (lecture)
     * @param region       la région dominante du joueur (où il mine le plus)
     * @param minBlocks    nombre minimum de blocs avant calcul fiable
     */
    public static Score compute(XRayPlayerProfile profile, RegionProfile region, int minBlocks) {
        long total = profile.total();
        long common = profile.totalCommon() + profile.netherrack();
        long valuable = profile.valuable();
        double valPct = total == 0 ? 0 : 100.0 * valuable / total;
        double diaPer1k = common == 0
                ? (profile.diamond() > 0 ? 1000.0 : 0)
                : 1000.0 * profile.diamond() / common;

        if (total < minBlocks) {
            Map<String, Component> empty = new LinkedHashMap<>();
            empty.put("insufficient", new Component(
                    "Données insuffisantes",
                    total, minBlocks, 0,
                    "Min. " + minBlocks + " blocs miné(s) avant analyse fiable"));
            return new Score(0, "INSUFFICIENT", empty,
                    region.expectedValuablePercent, region.expectedDiamondPer1k);
        }

        Map<String, Component> comps = new LinkedHashMap<>();

        // 1) Déviation % précieux vs profil régional (max 35 points)
        double expectedVal = region.expectedValuablePercent;
        double devVal = (valPct - expectedVal) / Math.max(1.0, expectedVal);
        double scoreVal = clamp(devVal / region.tolerance, 0, 1) * 35.0;
        comps.put("valuablePct", new Component(
                "% minerais précieux vs " + region.displayName,
                valPct, 35, scoreVal,
                String.format("%.2f%% mesuré, %.2f%% attendu (×%.2f tolérance)",
                        valPct, expectedVal, region.tolerance)));

        // 2) Ratio diamant/1000 communs (max 30 points)
        double expectedDia = region.expectedDiamondPer1k;
        double devDia = (diaPer1k - expectedDia) / Math.max(0.5, expectedDia);
        double scoreDia = clamp(devDia / region.tolerance, 0, 1) * 30.0;
        comps.put("diamondPer1k", new Component(
                "Diamant pour 1000 communs",
                diaPer1k, 30, scoreDia,
                String.format("%.2f mesuré, %.2f attendu", diaPer1k, expectedDia)));

        // 3) Beeline (distance médiane entre veines successives, max 20 points)
        double medianDist = medianBetweenSamples(profile.recentSamplesList());
        double beelineScore = 0;
        String beelineDetail;
        if (medianDist <= 0) {
            beelineDetail = "Pas assez de veines";
        } else if (medianDist < DEFAULT_BEELINE_THRESHOLD) {
            beelineScore = clamp(1.0 - medianDist / DEFAULT_BEELINE_THRESHOLD, 0, 1) * 20.0;
            beelineDetail = String.format("Médiane %.1f blocs entre veines (seuil %.0f)", medianDist, DEFAULT_BEELINE_THRESHOLD);
        } else {
            beelineDetail = String.format("Médiane %.1f blocs entre veines — normal", medianDist);
        }
        comps.put("beeline", new Component(
                "Beeline (chaînage de veines)",
                medianDist, 20, beelineScore, beelineDetail));

        // 4) Concentration anormale Y (max 15 points)
        // En vanilla 1.21, le diamant est concentré entre Y=-64 et Y=16 (deepslate).
        // Un joueur qui mine massivement à des Y > 30 = très suspect.
        Map<Integer, long[]> byY = profile.byYSnapshot();
        long diaInExpectedY = 0;
        long diaTotal = profile.diamond();
        for (var e : byY.entrySet()) {
            int y = e.getKey();
            long dia = e.getValue()[0];
            if (y <= 16) diaInExpectedY += dia;
        }
        double yShare = diaTotal == 0 ? 1.0 : 1.0 * diaInExpectedY / diaTotal;
        double scoreY = (1.0 - yShare) * 15.0;
        comps.put("yLevel", new Component(
                "Localisation Y des diamants",
                yShare * 100, 15, scoreY,
                String.format("%.0f%% des diamants entre Y=-64 et Y=16 (vanilla)", yShare * 100)));

        double sum = 0;
        for (Component c : comps.values()) sum += c.score;
        int total100 = (int) Math.round(clamp(sum, 0, 100));
        return new Score(total100, levelFor(total100), comps,
                region.expectedValuablePercent, region.expectedDiamondPer1k);
    }

    public static String levelFor(int score) {
        if (score >= 80) return "VERY_HIGH";
        if (score >= 55) return "HIGH";
        if (score >= 30) return "MEDIUM";
        if (score >= 10) return "LOW";
        return "NEGLIGIBLE";
    }

    private static double medianBetweenSamples(List<MiningSample> samples) {
        if (samples.size() < 2) return -1;
        double[] dists = new double[samples.size() - 1];
        for (int i = 1; i < samples.size(); i++) {
            MiningSample a = samples.get(i - 1), b = samples.get(i);
            if (!java.util.Objects.equals(a.world(), b.world())) { dists[i - 1] = 100; continue; }
            int dx = a.x() - b.x(), dy = a.y() - b.y(), dz = a.z() - b.z();
            dists[i - 1] = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        java.util.Arrays.sort(dists);
        return dists[dists.length / 2];
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }
}
