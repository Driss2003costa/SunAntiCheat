package sunanticheat.dashboard.pve;

import org.bukkit.entity.Monster;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.projectiles.ProjectileSource;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Gère le toggle PvE par monde.
 * Quand PvE est désactivé pour un monde, les dégâts mobs→joueurs sont annulés.
 */
public class PveManager implements Listener {

    private final Set<String> pveDisabledWorlds = Collections.synchronizedSet(new HashSet<>());

    /** Toggle PvE pour un monde. Retourne le nouvel état (true = PvE activé). */
    public boolean toggle(String worldName) {
        if (pveDisabledWorlds.contains(worldName)) {
            pveDisabledWorlds.remove(worldName);
            return true;
        } else {
            pveDisabledWorlds.add(worldName);
            return false;
        }
    }

    public boolean isEnabled(String worldName) {
        return !pveDisabledWorlds.contains(worldName);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onDamage(EntityDamageByEntityEvent e) {
        if (!(e.getEntity() instanceof Player player)) return;
        if (!pveDisabledWorlds.contains(player.getWorld().getName())) return;

        var damager = e.getDamager();
        if (damager instanceof Monster) { e.setCancelled(true); return; }
        if (damager instanceof Projectile proj) {
            ProjectileSource src = proj.getShooter();
            if (src instanceof Monster) e.setCancelled(true);
        }
    }
}
