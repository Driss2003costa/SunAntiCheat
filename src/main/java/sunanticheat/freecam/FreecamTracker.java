package sunanticheat.freecam;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Statistiques par joueur pour la détection freecam :
 * - actions "valides" (bloc dans le champ de vision + à portée)
 * - actions "suspectes" (bloc hors champ ou hors portée = possible freecam)
 */
public class FreecamTracker {

    private final Map<UUID, FreecamStats> statsByPlayer = new ConcurrentHashMap<>();

    public FreecamStats getOrCreate(UUID uuid) {
        return statsByPlayer.computeIfAbsent(uuid, k -> new FreecamStats());
    }

    public void recordValidAction(UUID uuid) {
        getOrCreate(uuid).valid++;
    }

    public void recordSuspiciousAction(UUID uuid) {
        getOrCreate(uuid).suspicious++;
    }

    public FreecamStats getStats(UUID uuid) {
        return statsByPlayer.get(uuid);
    }

    public Map<UUID, FreecamStats> getAllStats() {
        return Map.copyOf(statsByPlayer);
    }

    public static final class FreecamStats {
        private long valid;
        private long suspicious;

        public long getValid() { return valid; }
        public long getSuspicious() { return suspicious; }
        public long getTotal() { return valid + suspicious; }

        /** Pourcentage d'actions suspectes (0–100). Élevé = possible freecam. */
        public double getSuspicionPercentage() {
            long total = getTotal();
            return total == 0 ? 0 : 100.0 * suspicious / total;
        }
    }
}
