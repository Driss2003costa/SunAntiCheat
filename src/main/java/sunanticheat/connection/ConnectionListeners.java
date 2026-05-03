package sunanticheat.connection;

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import java.util.UUID;

/**
 * Enregistre les connexions/déconnexions pour l'historique.
 */
public class ConnectionListeners implements Listener {

    private final ConnectionLogStorage storage;
    private final GeoIpCache geoIpCache;

    public ConnectionListeners(ConnectionLogStorage storage, GeoIpCache geoIpCache) {
        this.storage = storage;
        this.geoIpCache = geoIpCache;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        String ip = "?";
        if (event.getPlayer().getAddress() != null && event.getPlayer().getAddress().getAddress() != null) {
            ip = event.getPlayer().getAddress().getAddress().getHostAddress();
        }
        final String finalIp = ip;
        final UUID uuid = event.getPlayer().getUniqueId();
        storage.onJoin(uuid, event.getPlayer().getName(), finalIp);

        geoIpCache.lookupAsync(finalIp).thenAccept(result -> {
            if (result != null) {
                storage.updateGeoIp(uuid, result.countryCode(), result.country());
            }
        });
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        storage.onQuit(event.getPlayer().getUniqueId());
    }
}
