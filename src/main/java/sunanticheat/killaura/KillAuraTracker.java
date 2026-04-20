package sunanticheat.killaura;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Suivi des coups (melee) par joueur pour détection Kill Aura : CPS et violations.
 */
public class KillAuraTracker {

    private static final int MAX_HIT_TIMESTAMPS = 30;
    private static final long ONE_SECOND_MS = 1000;

    private final Map<UUID, CopyOnWriteArrayList<Long>> hitTimestampsByPlayer = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> violationCountByPlayer = new ConcurrentHashMap<>();

    /** Enregistre un coup (appelé quand le joueur touche une entité). */
    public void recordHit(UUID playerUuid) {
        long now = System.currentTimeMillis();
        hitTimestampsByPlayer
                .computeIfAbsent(playerUuid, k -> new CopyOnWriteArrayList<>())
                .add(now);
        pruneOld(playerUuid, now);
    }

    /** Nombre de coups dans la dernière seconde (CPS). */
    public int getHitsInLastSecond(UUID playerUuid) {
        CopyOnWriteArrayList<Long> list = hitTimestampsByPlayer.get(playerUuid);
        if (list == null) return 0;
        long now = System.currentTimeMillis();
        pruneOld(playerUuid, now);
        long since = now - ONE_SECOND_MS;
        return (int) list.stream().filter(t -> t >= since).count();
    }

    private void pruneOld(UUID playerUuid, long now) {
        CopyOnWriteArrayList<Long> list = hitTimestampsByPlayer.get(playerUuid);
        if (list == null) return;
        long since = now - ONE_SECOND_MS;
        list.removeIf(t -> t < since);
        while (list.size() > MAX_HIT_TIMESTAMPS) {
            list.remove(0);
        }
    }

    /** Incrémente le compteur de violations et retourne la nouvelle valeur. */
    public int incrementViolations(UUID playerUuid) {
        return violationCountByPlayer.merge(playerUuid, 1, Integer::sum);
    }

    public int getViolationCount(UUID playerUuid) {
        return violationCountByPlayer.getOrDefault(playerUuid, 0);
    }

    /** Réinitialise le compteur de violations (ex. après alerte ou commande). */
    public void resetViolations(UUID playerUuid) {
        violationCountByPlayer.remove(playerUuid);
    }

    public void remove(UUID playerUuid) {
        hitTimestampsByPlayer.remove(playerUuid);
        violationCountByPlayer.remove(playerUuid);
    }
}
