package sunanticheat.dashboard.alerts;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Buffer circulaire des 200 dernières alertes anti-cheat.
 * Thread-safe (synchronized).
 */
public final class AlertStore {

    private static final int MAX = 200;
    private final Deque<AlertEntry> deque = new ArrayDeque<>();

    /** Ajoute une alerte et notifie les abonnés WebSocket. */
    public synchronized void push(String type, String playerName, String world, String detail) {
        AlertEntry entry = new AlertEntry(System.currentTimeMillis(), type, playerName, world, detail);
        deque.addFirst(entry);
        while (deque.size() > MAX) deque.pollLast();
    }

    /** Retourne les N alertes les plus récentes. */
    public synchronized List<AlertEntry> getRecent(int limit) {
        List<AlertEntry> result = new ArrayList<>();
        int count = 0;
        for (AlertEntry e : deque) {
            if (count++ >= limit) break;
            result.add(e);
        }
        return result;
    }
}
