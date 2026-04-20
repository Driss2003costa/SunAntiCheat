package sunanticheat.playtime;

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

/**
 * Enregistre l'heure de connexion au join et ajoute la session au total au quit.
 */
public class PlaytimeListeners implements Listener {

    private final PlaytimeTracker tracker;

    public PlaytimeListeners(PlaytimeTracker tracker) {
        this.tracker = tracker;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        tracker.onJoin(event.getPlayer());
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        tracker.onQuit(event.getPlayer());
    }
}
