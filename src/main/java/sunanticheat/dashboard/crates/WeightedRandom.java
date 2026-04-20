package sunanticheat.dashboard.crates;

import java.util.List;
import java.util.Random;
import java.util.function.ToIntFunction;

/**
 * Utilitaire de tirage pond\u00e9r\u00e9. Parcours cumulatif dans [0, total).
 */
public final class WeightedRandom {

    private WeightedRandom() {}

    public static <T> T pick(List<T> items, ToIntFunction<T> weight, Random rng) {
        if (items == null || items.isEmpty()) return null;
        long total = 0L;
        for (T it : items) {
            int w = Math.max(0, weight.applyAsInt(it));
            total += w;
        }
        if (total <= 0L) {
            return items.get(rng.nextInt(items.size()));
        }
        long pick = (long) (rng.nextDouble() * total);
        long acc = 0L;
        for (T it : items) {
            int w = Math.max(0, weight.applyAsInt(it));
            acc += w;
            if (pick < acc) return it;
        }
        return items.get(items.size() - 1);
    }
}
