package sunanticheat.playtime;

import org.bukkit.entity.Player;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Suivi du temps de jeu : temps total persisté + session en cours (depuis le join).
 */
public class PlaytimeTracker {

    private final PlaytimeStorage storage;
    private final Map<UUID, Long> joinTimeMillis = new ConcurrentHashMap<>();

    public PlaytimeTracker(PlaytimeStorage storage) {
        this.storage = storage;
    }

    public PlaytimeStorage getStorage() {
        return storage;
    }

    public void onJoin(Player player) {
        joinTimeMillis.put(player.getUniqueId(), System.currentTimeMillis());
    }

    public void onQuit(Player player) {
        Long join = joinTimeMillis.remove(player.getUniqueId());
        if (join != null) {
            long sessionSeconds = (System.currentTimeMillis() - join) / 1000;
            if (sessionSeconds > 0) {
                storage.addSeconds(player.getUniqueId(), sessionSeconds);
                storage.save();
            }
        }
    }

    /**
     * Retourne le temps de jeu total (persisté + session en cours si en ligne).
     */
    public long getTotalPlaytimeSeconds(UUID uuid) {
        long stored = storage.getTotalSeconds(uuid);
        Long join = joinTimeMillis.get(uuid);
        if (join != null) {
            stored += (System.currentTimeMillis() - join) / 1000;
        }
        return stored;
    }

    /**
     * Retourne le top N des joueurs par temps de jeu total (persisté + session en cours).
     * Ordre décroissant. Chaque entrée : UUID → secondes.
     */
    public List<Map.Entry<UUID, Long>> getTopPlaytimes(int limit) {
        Map<UUID, Long> all = new java.util.HashMap<>(storage.getAll());
        for (Map.Entry<UUID, Long> e : joinTimeMillis.entrySet()) {
            long sessionSec = (System.currentTimeMillis() - e.getValue()) / 1000;
            all.merge(e.getKey(), sessionSec, Long::sum);
        }
        return all.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(Math.max(1, limit))
                .collect(Collectors.toList());
    }

    /**
     * Formate des secondes en "Xd Xh Xm" ou "Xh Xm" ou "Xm".
     */
    public static String formatPlaytime(long totalSeconds) {
        if (totalSeconds < 0) totalSeconds = 0;
        long days = totalSeconds / 86400;
        long hours = (totalSeconds % 86400) / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        StringBuilder sb = new StringBuilder();
        if (days > 0) sb.append(days).append("j ");
        if (hours > 0 || days > 0) sb.append(hours).append("h ");
        sb.append(minutes).append("m");
        return sb.toString().trim();
    }
}
