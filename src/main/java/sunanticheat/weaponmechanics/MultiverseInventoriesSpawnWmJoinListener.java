package sunanticheat.weaponmechanics;

import org.bukkit.Bukkit;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.Permissions;

import java.util.Locale;
import java.util.UUID;

/**
 * Déclenche le scan MV-Inv spawn + sweep WM en jeu : connexion, déco (fichier seul), entrée monde spawn,
 * téléportation vers le spawn (même monde inclus), commandes configurables (/spawn, /mvtp spawn, etc.).
 */
public final class MultiverseInventoriesSpawnWmJoinListener implements Listener {

    private final JavaPlugin plugin;
    private final MultiverseInventoriesSpawnWeaponFileScanner scanner;

    public MultiverseInventoriesSpawnWmJoinListener(JavaPlugin plugin, MultiverseInventoriesSpawnWeaponFileScanner scanner) {
        this.plugin = plugin;
        this.scanner = scanner;
    }

    private boolean mvScanEnabled() {
        return plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.enabled", false);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onJoin(PlayerJoinEvent event) {
        if (!mvScanEnabled()) return;
        if (!plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.analyze-on-login", true)) return;
        if (event.getPlayer().hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) return;
        long delay = Math.max(0L, plugin.getConfig().getLong("multiverse-inventories-spawn-wm-scan.analyze-on-login-delay-ticks", 40L));
        UUID id = event.getPlayer().getUniqueId();
        String name = event.getPlayer().getName();
        scanner.scheduleFileScanAndLiveSweep(id, name, delay);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onQuit(PlayerQuitEvent event) {
        if (!mvScanEnabled()) return;
        if (!plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.analyze-on-quit", true)) return;
        if (event.getPlayer().hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) return;
        UUID id = event.getPlayer().getUniqueId();
        String name = event.getPlayer().getName();
        long delay = Math.max(1L, plugin.getConfig().getLong("multiverse-inventories-spawn-wm-scan.analyze-on-quit-delay-ticks", 60L));
        Bukkit.getScheduler().runTaskLaterAsynchronously(plugin, () -> scanner.scanStoredProfilesForPlayer(id, name), delay);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onEnterSpawnWorld(PlayerChangedWorldEvent event) {
        if (!mvScanEnabled()) return;
        if (!plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.analyze-on-enter-spawn-world", true)) return;
        if (event.getPlayer().hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) return;
        String configured = plugin.getConfig().getString("multiverse-inventories-spawn-wm-scan.world", "spawn");
        if (configured == null || configured.isBlank()) return;
        if (!configured.equalsIgnoreCase(event.getPlayer().getWorld().getName())) return;
        long delay = Math.max(0L, plugin.getConfig().getLong(
                "multiverse-inventories-spawn-wm-scan.analyze-on-enter-spawn-world-delay-ticks", 5L));
        UUID id = event.getPlayer().getUniqueId();
        String name = event.getPlayer().getName();
        scanner.scheduleFileScanAndLiveSweep(id, name, delay);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent event) {
        if (!mvScanEnabled()) return;
        if (!plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.analyze-on-teleport-to-spawn", true)) return;
        if (event.getPlayer().hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) return;
        if (event.getTo() == null || event.getTo().getWorld() == null) return;
        String configured = plugin.getConfig().getString("multiverse-inventories-spawn-wm-scan.world", "spawn");
        if (configured == null || !configured.equalsIgnoreCase(event.getTo().getWorld().getName())) return;
        long delay = Math.max(0L, plugin.getConfig().getLong(
                "multiverse-inventories-spawn-wm-scan.analyze-on-teleport-delay-ticks", 3L));
        scanner.scheduleFileScanAndLiveSweep(event.getPlayer().getUniqueId(), event.getPlayer().getName(), delay);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent event) {
        if (!mvScanEnabled()) return;
        if (!plugin.getConfig().getBoolean("multiverse-inventories-spawn-wm-scan.analyze-on-commands", true)) return;
        if (event.getPlayer().hasPermission(Permissions.BYPASS_MV_INV_SPAWN_WM_SCAN)) return;
        String msg = event.getMessage().trim();
        if (msg.startsWith("/")) msg = msg.substring(1).trim();
        if (msg.isEmpty()) return;
        String lower = msg.toLowerCase(Locale.ROOT);
        boolean match = false;
        for (String prefix : plugin.getConfig().getStringList("multiverse-inventories-spawn-wm-scan.trigger-command-prefixes")) {
            if (prefix == null) continue;
            String pref = prefix.trim().toLowerCase(Locale.ROOT);
            if (pref.isEmpty()) continue;
            if (pref.startsWith("/")) pref = pref.substring(1).trim();
            if (pref.isEmpty()) continue;
            if (lower.equals(pref) || lower.startsWith(pref + " ")) {
                match = true;
                break;
            }
        }
        if (!match) return;
        long delay = Math.max(0L, plugin.getConfig().getLong(
                "multiverse-inventories-spawn-wm-scan.analyze-after-command-delay-ticks", 2L));
        scanner.scheduleFileScanAndLiveSweep(event.getPlayer().getUniqueId(), event.getPlayer().getName(), delay);
    }
}
