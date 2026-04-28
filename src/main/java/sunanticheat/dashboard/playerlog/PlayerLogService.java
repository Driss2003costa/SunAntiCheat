package sunanticheat.dashboard.playerlog;

import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.*;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Logger;

/**
 * Service async qui reçoit les `PlayerLogEntry` depuis les listeners et les
 * batch-insère en DB sur un thread dédié.
 *
 * Pourquoi async :
 *   - Listeners Bukkit sur main thread → INSERT sync = freeze possible
 *   - Volume potentiellement élevé (chat, conteneur)
 *   - Pas critique si on perd 1-2 entrées au shutdown brutal
 *
 * Catégories activables/désactivables dynamiquement via `enabled`. Si false,
 * `log(...)` est un no-op silencieux.
 */
public final class PlayerLogService {

    private static final int QUEUE_CAPACITY = 50_000;
    private static final int BATCH_SIZE = 100;
    private static final long FLUSH_INTERVAL_MS = 2_000;

    private final JavaPlugin plugin;
    private final PlayerLogStore store;
    private final Logger logger;
    private final Set<String> enabledCategories;

    private final LinkedBlockingQueue<PlayerLogEntry> queue = new LinkedBlockingQueue<>(QUEUE_CAPACITY);
    private final AtomicLong dropped = new AtomicLong();

    private Thread worker;
    private BukkitTask purgeTask;
    private volatile boolean stopping = false;

    public PlayerLogService(JavaPlugin plugin, PlayerLogStore store, Set<String> enabledCategories) {
        this.plugin = plugin;
        this.store = store;
        this.logger = plugin.getLogger();
        this.enabledCategories = enabledCategories != null ? enabledCategories : Set.of();
    }

    public boolean isCategoryEnabled(String cat) {
        return enabledCategories.contains(cat);
    }

    public PlayerLogStore store() { return store; }

    /** Démarre le worker async et le purge scheduler. */
    public void start() {
        worker = new Thread(this::workerLoop, "sunguard-playerlog-worker");
        worker.setDaemon(true);
        worker.start();

        // Purge auto toutes les 6h
        purgeTask = plugin.getServer().getScheduler().runTaskTimerAsynchronously(plugin,
                store::purgeOld, 20L * 60 * 60, 20L * 60 * 60 * 6);
    }

    public void stop() {
        stopping = true;
        if (purgeTask != null) { purgeTask.cancel(); purgeTask = null; }
        // Flush final
        flushOnce();
        if (worker != null) {
            worker.interrupt();
            worker = null;
        }
    }

    private void workerLoop() {
        while (!stopping && !Thread.currentThread().isInterrupted()) {
            try {
                Thread.sleep(FLUSH_INTERVAL_MS);
                flushOnce();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Throwable ignored) {}
        }
    }

    private void flushOnce() {
        if (queue.isEmpty()) return;
        List<PlayerLogEntry> batch = new ArrayList<>(BATCH_SIZE);
        queue.drainTo(batch, BATCH_SIZE);
        if (!batch.isEmpty()) {
            try { store.insertBatch(batch); }
            catch (Throwable t) { logger.warning("[PlayerLog] flush erreur : " + t.getMessage()); }
        }
    }

    /** Méthode primaire — appelée par les listeners. Non-bloquante. */
    public void log(PlayerLogEntry entry) {
        if (entry == null || entry.category == null) return;
        if (!enabledCategories.contains(entry.category)) return;
        if (!queue.offer(entry)) dropped.incrementAndGet();
    }

    // ── Builders pratiques pour les listeners ────────────────────────────────

    public void log(Player player, String category, String action) {
        if (player == null) return;
        log(builder(player, category, action).build());
    }

    public void log(Player player, String category, String action, String target) {
        if (player == null) return;
        log(builder(player, category, action).target(target).build());
    }

    public void logWithPayload(Player player, String category, String action,
                                String target, Map<String, Object> payload) {
        if (player == null) return;
        log(builder(player, category, action).target(target).payload(payload).build());
    }

    /** Builder pour les cas plus complexes. */
    public Builder builder(Player p, String category, String action) {
        return new Builder(p, category, action);
    }

    public static final class Builder {
        private final PlayerLogEntry e;
        Builder(Player p, String category, String action) {
            e = PlayerLogEntry.of(
                    p.getUniqueId().toString(),
                    p.getName(),
                    category,
                    action);
            Location loc = p.getLocation();
            if (loc != null && loc.getWorld() != null) {
                e.world = loc.getWorld().getName();
                e.x = loc.getBlockX();
                e.y = loc.getBlockY();
                e.z = loc.getBlockZ();
            }
        }
        public Builder target(String t) { e.target = t; return this; }
        public Builder payload(Map<String, Object> p) { e.payload = p; return this; }
        public Builder at(String world, int x, int y, int z) {
            e.world = world; e.x = x; e.y = y; e.z = z; return this;
        }
        public PlayerLogEntry build() { return e; }
    }

    public long getDroppedCount() { return dropped.get(); }
    public int getQueueSize() { return queue.size(); }
}
