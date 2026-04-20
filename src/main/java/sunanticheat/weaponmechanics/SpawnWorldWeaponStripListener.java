package sunanticheat.weaponmechanics;

import org.bukkit.GameMode;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.potion.PotionEffect;
import sunanticheat.Permissions;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Dans les mondes spawn (Multiverse, ex. {@code spawn}), si le joueur possède une arme
 * (vanilla ou WeaponMechanics), vide l'inventaire et retire tous les effets de potion.
 */
public final class SpawnWorldWeaponStripListener implements Listener {

    private final JavaPlugin plugin;

    public SpawnWorldWeaponStripListener(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    private boolean enabled() {
        return plugin.getConfig().getBoolean("spawn-world-weapon-strip.enabled", false);
    }

    private boolean isStripWorld(World world) {
        if (world == null) return false;
        String name = world.getName();
        List<String> worlds = plugin.getConfig().getStringList("spawn-world-weapon-strip.worlds");
        if (worlds.isEmpty()) {
            String single = plugin.getConfig().getString("spawn-world-weapon-strip.world", "spawn");
            if (single != null && !single.isBlank()) {
                return name.equalsIgnoreCase(single.trim());
            }
            return false;
        }
        for (String w : worlds) {
            if (w != null && name.equalsIgnoreCase(w.trim())) return true;
        }
        return false;
    }

    private boolean shouldSkip(Player player) {
        if (player == null || !player.isOnline()) return true;
        if (player.hasPermission(Permissions.BYPASS_SPAWN_WEAPON_STRIP)) return true;
        if (plugin.getConfig().getBoolean("spawn-world-weapon-strip.only-survival", false)
                && player.getGameMode() != GameMode.SURVIVAL) {
            return true;
        }
        return false;
    }

    private long joinDelayTicks() {
        return Math.max(1L, plugin.getConfig().getLong("spawn-world-weapon-strip.join-delay-ticks", 25L));
    }

    private long teleportDelayTicks() {
        return Math.max(1L, plugin.getConfig().getLong("spawn-world-weapon-strip.teleport-delay-ticks", 2L));
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onJoin(PlayerJoinEvent event) {
        if (!enabled()) return;
        Player player = event.getPlayer();
        if (shouldSkip(player)) return;
        if (!isStripWorld(player.getWorld())) return;
        long delay = joinDelayTicks();
        plugin.getServer().getScheduler().runTaskLater(plugin, () -> tryStrip(player), delay);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onWorldChange(PlayerChangedWorldEvent event) {
        if (!enabled()) return;
        Player player = event.getPlayer();
        if (shouldSkip(player)) return;
        if (!isStripWorld(player.getWorld())) return;
        plugin.getServer().getScheduler().runTaskLater(plugin, () -> tryStrip(player), teleportDelayTicks());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent event) {
        if (!enabled()) return;
        Player player = event.getPlayer();
        if (shouldSkip(player)) return;
        if (event.getTo() == null || event.getTo().getWorld() == null) return;
        if (!isStripWorld(event.getTo().getWorld())) return;
        plugin.getServer().getScheduler().runTaskLater(plugin, () -> tryStrip(player), teleportDelayTicks());
    }

    private void tryStrip(Player player) {
        if (!enabled() || player == null || !player.isOnline()) return;
        if (shouldSkip(player)) return;
        if (!isStripWorld(player.getWorld())) return;
        if (!CombatItemProbe.playerCarriesWeapon(player)) return;

        PlayerInventory inv = player.getInventory();
        inv.clear();
        inv.setArmorContents(new ItemStack[4]);
        inv.setItemInOffHand(null);

        for (PotionEffect effect : new ArrayList<>(player.getActivePotionEffects())) {
            player.removePotionEffect(effect.getType());
        }

        try {
            player.updateInventory();
        } catch (Exception ignored) {}

        if (plugin.getConfig().getBoolean("spawn-world-weapon-strip.notify-player", true)) {
            String msg = plugin.getConfig().getString("spawn-world-weapon-strip.message",
                    "&cLes armes ne sont pas autorisées sur ce spawn : inventaire et effets de potion retirés.");
            player.sendMessage(org.bukkit.ChatColor.translateAlternateColorCodes('&', msg));
        }

        if (plugin.getConfig().getBoolean("spawn-world-weapon-strip.log", true)) {
            plugin.getLogger().info("[Spawn strip] " + player.getName() + " — inventaire vidé (arme détectée, monde "
                    + player.getWorld().getName().toLowerCase(Locale.ROOT) + ")");
        }
    }
}
