package sunanticheat.dashboard.analytics;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.alerts.AlertStore;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enregistre les sessions joueurs, first-joins et snapshots TPS/RAM périodiques.
 */
public final class AnalyticsRecorder implements Listener {

    private final JavaPlugin plugin;
    private final SnapshotStore store;
    private final AlertStore alertStore;
    private final Map<UUID, Long> loginTimes = new ConcurrentHashMap<>();

    public AnalyticsRecorder(JavaPlugin plugin, SnapshotStore store, AlertStore alertStore) {
        this.plugin = plugin;
        this.store = store;
        this.alertStore = alertStore;
    }

    public void start() {
        // Snapshot toutes les 5 minutes
        Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::recordSnapshot, 6000L, 6000L);
        // Sauvegarde toutes les 10 minutes
        Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, store::save, 12000L, 12000L);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        loginTimes.put(player.getUniqueId(), System.currentTimeMillis());

        if (!player.hasPlayedBefore()) {
            store.recordFirstJoin(player.getName(), player.getUniqueId().toString());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        Long loginTime = loginTimes.remove(event.getPlayer().getUniqueId());
        if (loginTime != null) {
            long duration = System.currentTimeMillis() - loginTime;
            store.recordSession(event.getPlayer().getName(), duration);
        }
    }

    /** Appelé par DashboardModule quand une alerte est émise. */
    public void recordAlert(String type) {
        store.recordAlert(type);
        alertStore.push(type, "", "", "");
    }

    private void recordSnapshot() {
        double tps = Bukkit.getTPS()[0];
        Runtime rt = Runtime.getRuntime();
        int ram = (int) ((rt.totalMemory() - rt.freeMemory()) / 1024 / 1024);
        int players = Bukkit.getOnlinePlayers().size();
        int chunks = Bukkit.getWorlds().stream().mapToInt(w -> w.getLoadedChunks().length).sum();
        store.addSnapshot(new AnalyticsSnapshot(System.currentTimeMillis(), players, tps, ram, chunks));
    }
}
