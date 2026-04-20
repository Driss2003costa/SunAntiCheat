package sunanticheat.connection;

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

/**
 * Enregistre les connexions/déconnexions pour l'historique.
 */
public class ConnectionListeners implements Listener {

    private final ConnectionLogStorage storage;

    public ConnectionListeners(ConnectionLogStorage storage) {
        this.storage = storage;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        String ip = "?";
        if (event.getPlayer().getAddress() != null && event.getPlayer().getAddress().getAddress() != null) {
            ip = event.getPlayer().getAddress().getAddress().getHostAddress();
        }
        storage.onJoin(event.getPlayer().getUniqueId(), event.getPlayer().getName(), ip);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        storage.onQuit(event.getPlayer().getUniqueId());
    }
}
