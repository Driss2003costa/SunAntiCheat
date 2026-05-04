package sunanticheat.jobs.polish;

import org.bukkit.entity.Player;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Suit les actions enchaînées d'un joueur sur un même métier.
 *
 * Règles :
 *  - Une action <2.5 s après la précédente sur le même métier incrémente le combo
 *  - Le combo se réinitialise au-delà de 2.5 s
 *  - Multiplicateur appliqué : 1.0 + (combo * 0.05) capé à x3.0
 *  - Affichage géré par {@link JobActionBarService}
 */
public final class ComboTracker {

    private static final long COMBO_WINDOW_MS = 2500L;
    private static final double COMBO_INCREMENT = 0.05;
    private static final double COMBO_MAX_MULT  = 3.0;
    private static final int    COMBO_MAX_COUNT = 40;

    private final ConcurrentMap<UUID, ComboState> states = new ConcurrentHashMap<>();

    public ComboState onAction(Player player, String jobId) {
        UUID id = player.getUniqueId();
        long now = System.currentTimeMillis();
        ComboState s = states.compute(id, (k, prev) -> {
            if (prev == null || !prev.jobId.equalsIgnoreCase(jobId) || now - prev.lastAt > COMBO_WINDOW_MS) {
                return new ComboState(jobId, 1, now);
            }
            int next = Math.min(COMBO_MAX_COUNT, prev.count + 1);
            return new ComboState(jobId, next, now);
        });
        return s;
    }

    public ComboState peek(UUID id) {
        ComboState s = states.get(id);
        if (s == null) return null;
        if (System.currentTimeMillis() - s.lastAt > COMBO_WINDOW_MS) {
            states.remove(id);
            return null;
        }
        return s;
    }

    public void clear(UUID id) { states.remove(id); }

    public static double multiplier(int comboCount) {
        return Math.min(COMBO_MAX_MULT, 1.0 + (comboCount - 1) * COMBO_INCREMENT);
    }

    public record ComboState(String jobId, int count, long lastAt) {
        public double multiplier() { return ComboTracker.multiplier(count); }
    }
}
