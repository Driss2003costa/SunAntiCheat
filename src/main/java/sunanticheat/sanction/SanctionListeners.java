package sunanticheat.sanction;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerQuitEvent;

/**
 * Mute : annule les messages chat si le joueur est muet.
 * Freeze : annule les déplacements si le joueur est gelé.
 */
public class SanctionListeners implements Listener {

    private final SanctionService sanctionService;

    public SanctionListeners(SanctionService sanctionService) {
        this.sanctionService = sanctionService;
    }

    @SuppressWarnings("deprecation")
    @EventHandler(priority = EventPriority.LOWEST)
    public void onChat(AsyncPlayerChatEvent event) {
        Player p = event.getPlayer();
        if (sanctionService.getMuteStorage().isMuted(p.getUniqueId())) {
            event.setCancelled(true);
            p.sendMessage(Component.text("Vous êtes muet et ne pouvez pas parler.").color(NamedTextColor.RED));
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onMove(PlayerMoveEvent event) {
        if (!sanctionService.isFrozen(event.getPlayer().getUniqueId())) return;
        // Bloquer changement de bloc (x, y, z)
        if (event.getFrom().getBlockX() != event.getTo().getBlockX()
                || event.getFrom().getBlockY() != event.getTo().getBlockY()
                || event.getFrom().getBlockZ() != event.getTo().getBlockZ()) {
            event.setCancelled(true);
        }
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        // Optionnel : garder le freeze en mémoire (pas persisté), le joueur reste gelé au prochain join
        // Ici on ne retire pas le freeze au quit pour que le statut reste si on veut le persister plus tard
    }
}
