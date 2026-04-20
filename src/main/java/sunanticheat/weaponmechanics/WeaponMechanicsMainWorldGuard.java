package sunanticheat.weaponmechanics;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.server.PluginEnableEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;
import sunanticheat.Permissions;
import sunanticheat.alerts.ViolationLogService;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Détecte la possession d'armes WeaponMechanics dans un monde cible (ex. {@code world})
 * et envoie un rapport Discord (optionnellement une alerte staff).
 */
public final class WeaponMechanicsMainWorldGuard implements Runnable, Listener {

    private final JavaPlugin plugin;
    private final ViolationLogService violationLog;
    private BukkitTask task;
    private boolean eventsRegistered;

    private final Map<UUID, Long> lastAlertMs = new ConcurrentHashMap<>();

    public WeaponMechanicsMainWorldGuard(JavaPlugin plugin, ViolationLogService violationLog) {
        this.plugin = plugin;
        this.violationLog = violationLog;
    }

    public void start() {
        cancelTimer();
        if (!plugin.getConfig().getBoolean("weapon-mechanics-main-world.enabled", false)) {
            return;
        }
        if (!eventsRegistered) {
            Bukkit.getPluginManager().registerEvents(this, plugin);
            eventsRegistered = true;
        }
        long interval = Math.max(20L, plugin.getConfig().getLong("weapon-mechanics-main-world.check-interval-ticks", 100L));
        this.task = Bukkit.getScheduler().runTaskTimer(plugin, this, interval, interval);
    }

    public void stop() {
        cancelTimer();
    }

    private void cancelTimer() {
        if (task != null) {
            task.cancel();
            task = null;
        }
    }

    /** Après reload config : redémarre la tâche périodique. */
    public void reloadSchedule() {
        WeaponMechanicsItemProbe.resetReflectionCache();
        cancelTimer();
        if (!plugin.getConfig().getBoolean("weapon-mechanics-main-world.enabled", false)) {
            return;
        }
        if (!eventsRegistered) {
            Bukkit.getPluginManager().registerEvents(this, plugin);
            eventsRegistered = true;
        }
        long interval = Math.max(20L, plugin.getConfig().getLong("weapon-mechanics-main-world.check-interval-ticks", 100L));
        this.task = Bukkit.getScheduler().runTaskTimer(plugin, this, interval, interval);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onWeaponMechanicsPluginEnabled(PluginEnableEvent event) {
        if ("WeaponMechanics".equalsIgnoreCase(event.getPlugin().getName())) {
            WeaponMechanicsItemProbe.resetReflectionCache();
        }
    }

    private boolean disabled() {
        return !plugin.getConfig().getBoolean("weapon-mechanics-main-world.enabled", false);
    }

    private String targetWorldName() {
        return plugin.getConfig().getString("weapon-mechanics-main-world.world", "world");
    }

    private long cooldownMs() {
        return Math.max(60_000L, plugin.getConfig().getLong("weapon-mechanics-main-world.cooldown-minutes", 15) * 60_000L);
    }

    @Override
    public void run() {
        if (disabled()) return;
        String wname = targetWorldName();
        World w = Bukkit.getWorld(wname);
        if (w == null) return;
        for (Player p : w.getPlayers()) {
            checkPlayer(p, "scan-périodique");
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onJoin(PlayerJoinEvent event) {
        if (disabled()) return;
        Player p = event.getPlayer();
        if (p.getWorld() == null || !targetWorldName().equalsIgnoreCase(p.getWorld().getName())) return;
        Bukkit.getScheduler().runTaskLater(plugin, () -> checkPlayer(p, "connexion"), 15L);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onWorldChange(PlayerChangedWorldEvent event) {
        if (disabled()) return;
        Player p = event.getPlayer();
        if (p.getWorld() == null || !targetWorldName().equalsIgnoreCase(p.getWorld().getName())) return;
        Bukkit.getScheduler().runTaskLater(plugin, () -> checkPlayer(p, "changement de monde"), 2L);
    }

    private void checkPlayer(Player player, String trigger) {
        if (disabled() || player == null || !player.isOnline()) return;
        if (player.hasPermission(Permissions.BYPASS_WM_MAIN_WORLD)) return;
        if (player.getWorld() == null || !targetWorldName().equalsIgnoreCase(player.getWorld().getName())) return;

        PlayerInventory inv = player.getInventory();
        if (!containsWeapon(inv)) return;

        UUID uuid = player.getUniqueId();
        long now = System.currentTimeMillis();
        if (now - lastAlertMs.getOrDefault(uuid, 0L) < cooldownMs()) return;
        lastAlertMs.put(uuid, now);

        String itemHint = describeWeapons(inv);
        String loc = formatLocation(player);
        String detail = trigger + " | " + loc + (itemHint.isEmpty() ? "" : " | Items: " + itemHint);

        if (violationLog != null && plugin.getConfig().getBoolean("weapon-mechanics-main-world.log-violation", true)) {
            violationLog.log("WeaponMechanics (monde interdit)", player.getName(), detail);
        }

        if (plugin.getConfig().getBoolean("weapon-mechanics-main-world.alert-staff", true)) {
            broadcastStaffAlert(player, detail);
        }

    }

    private static String formatLocation(Player p) {
        var loc = p.getLocation();
        var w = loc.getWorld();
        String wn = w != null ? w.getName() : "?";
        return String.format("%s %.0f %.0f %.0f", wn, loc.getX(), loc.getY(), loc.getZ());
    }

    private static boolean containsWeapon(PlayerInventory inv) {
        for (ItemStack s : inv.getContents()) {
            if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(s)) return true;
        }
        for (ItemStack s : inv.getArmorContents()) {
            if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(s)) return true;
        }
        if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(inv.getItemInOffHand())) return true;
        return false;
    }

    private static String describeWeapons(PlayerInventory inv) {
        StringBuilder sb = new StringBuilder();
        appendIfWeapon(sb, inv.getItemInMainHand(), "main");
        appendIfWeapon(sb, inv.getItemInOffHand(), "off");
        for (int i = 0; i < inv.getContents().length; i++) {
            ItemStack s = inv.getContents()[i];
            if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(s)) {
                if (sb.length() > 0) sb.append(", ");
                sb.append("slot").append(i).append(":").append(s.getType().name());
            }
        }
        for (ItemStack s : inv.getArmorContents()) {
            if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(s)) {
                if (sb.length() > 0) sb.append(", ");
                sb.append("armure:").append(s.getType().name());
            }
        }
        return sb.toString();
    }

    private static void appendIfWeapon(StringBuilder sb, ItemStack s, String label) {
        if (!WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(s)) return;
        if (sb.length() > 0) sb.append(", ");
        sb.append(label).append(":").append(s.getType().name());
    }

    private void broadcastStaffAlert(Player target, String detail) {
        String name = target.getName();
        Component msg = Component.text("[SunGuard] ")
                .color(NamedTextColor.DARK_GRAY)
                .append(Component.text("WeaponMechanics en ").color(NamedTextColor.RED))
                .append(Component.text(targetWorldName()).color(NamedTextColor.GOLD))
                .append(Component.text(": ").color(NamedTextColor.GRAY))
                .append(Component.text(name).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD))
                .append(Component.text(" — " + detail).color(NamedTextColor.GRAY))
                .append(Component.text(" [TP]").color(NamedTextColor.GREEN).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/tp " + name)))
                .append(Component.text(" [Sanctions]").color(NamedTextColor.YELLOW).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/sunguard sanction " + name)));
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (p.hasPermission(Permissions.ALERTS)) {
                p.sendMessage(msg);
            }
        }
    }
}
