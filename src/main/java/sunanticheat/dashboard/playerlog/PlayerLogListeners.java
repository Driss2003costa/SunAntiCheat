package sunanticheat.dashboard.playerlog;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerKickEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Listeners Bukkit qui peuplent le PlayerLog selon les catégories activées.
 *
 * Catégories couvertes :
 *   - LOGIN     (PlayerJoinEvent / PlayerQuitEvent / PlayerKickEvent)
 *   - DEATH     (PlayerDeathEvent)
 *   - CHAT      (AsyncPlayerChatEvent / PlayerCommandPreprocessEvent)
 *   - CONTAINER (InventoryOpenEvent / InventoryCloseEvent)
 *   - TELEPORT  (PlayerTeleportEvent — filtre les TPs <8 blocs pour éviter le bruit)
 *
 * Volontairement PAS de BlockBreak/BlockPlace (volumineux + déjà tracké via
 * blocklog.yml legacy si besoin).
 *
 * Volontairement minimaliste : chaque handler est court, le formatage humain
 * est fait côté frontend.
 */
@SuppressWarnings("deprecation")
public final class PlayerLogListeners implements Listener {

    /** Commandes ignorées dans le log CHAT (réduction du bruit). */
    private static final Set<String> IGNORED_CMDS = Set.of(
            "help", "list", "rules", "ping", "msg-list", "tabcomplete"
    );

    /** Téléport <= 8 blocs ignoré (évite le spam pour les enderpearl, /sit, etc.). */
    private static final double MIN_TP_DISTANCE_SQ = 64.0;

    private final JavaPlugin plugin;
    private final PlayerLogService service;

    public PlayerLogListeners(JavaPlugin plugin, PlayerLogService service) {
        this.plugin = plugin;
        this.service = service;
    }

    public void register() {
        Bukkit.getPluginManager().registerEvents(this, plugin);
    }

    // ── LOGIN ────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onJoin(PlayerJoinEvent ev) {
        Player p = ev.getPlayer();
        Map<String, Object> meta = new LinkedHashMap<>();
        try {
            if (p.getAddress() != null && p.getAddress().getAddress() != null) {
                meta.put("ip", p.getAddress().getAddress().getHostAddress());
            }
            meta.put("firstJoin", !p.hasPlayedBefore());
        } catch (Throwable ignored) {}
        service.logWithPayload(p, "LOGIN", "JOIN", null, meta);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent ev) {
        Player p = ev.getPlayer();
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("reason", ev.getReason() != null ? ev.getReason().name() : "QUIT");
        service.logWithPayload(p, "LOGIN", "QUIT", null, meta);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onKick(PlayerKickEvent ev) {
        Player p = ev.getPlayer();
        Map<String, Object> meta = new LinkedHashMap<>();
        if (ev.getReason() != null) meta.put("reason", ev.getReason());
        service.logWithPayload(p, "LOGIN", "KICK", null, meta);
    }

    // ── DEATH ────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.MONITOR)
    public void onDeath(PlayerDeathEvent ev) {
        Player victim = ev.getEntity();
        Player killer = victim.getKiller();
        Map<String, Object> meta = new LinkedHashMap<>();
        try {
            if (killer != null) {
                meta.put("killerType", "PLAYER");
                meta.put("killerUuid", killer.getUniqueId().toString());
                if (killer.getInventory().getItemInMainHand() != null) {
                    meta.put("weapon", killer.getInventory().getItemInMainHand().getType().name());
                }
            } else if (victim.getLastDamageCause() != null) {
                meta.put("cause", victim.getLastDamageCause().getCause().name());
                if (victim.getLastDamageCause().getEntity() != null) {
                    meta.put("killerType", victim.getLastDamageCause().getEntity().getType().name());
                }
            }
            meta.put("deathMessage", ev.getDeathMessage());
        } catch (Throwable ignored) {}

        service.logWithPayload(victim, "DEATH", "DEATH",
                killer != null ? killer.getName() : null, meta);
    }

    // ── CHAT ─────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncPlayerChatEvent ev) {
        // Truncate message à 256 chars pour éviter de polluer la DB
        String msg = ev.getMessage();
        if (msg != null && msg.length() > 256) msg = msg.substring(0, 256) + "…";
        service.log(ev.getPlayer(), "CHAT", "CHAT_MESSAGE", msg);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent ev) {
        String full = ev.getMessage();
        if (full == null || full.isEmpty()) return;
        String cmd = full.startsWith("/") ? full.substring(1) : full;
        int sp = cmd.indexOf(' ');
        String head = sp == -1 ? cmd : cmd.substring(0, sp);
        if (IGNORED_CMDS.contains(head.toLowerCase())) return;
        String args = sp == -1 ? null : cmd.substring(sp + 1);
        // Anonymise les commandes potentiellement sensibles (login/register)
        if (head.equalsIgnoreCase("login") || head.equalsIgnoreCase("register")
            || head.equalsIgnoreCase("changepassword") || head.equalsIgnoreCase("l")) {
            args = "***";
        }
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("command", head);
        if (args != null) meta.put("args", args.length() > 200 ? args.substring(0, 200) + "…" : args);
        service.logWithPayload(ev.getPlayer(), "CHAT", "COMMAND", "/" + head, meta);
    }

    // ── CONTAINER ────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onContainerOpen(InventoryOpenEvent ev) {
        if (!(ev.getPlayer() instanceof Player p)) return;
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("type", ev.getInventory().getType().name());
        meta.put("size", ev.getInventory().getSize());
        InventoryHolder holder = ev.getInventory().getHolder();
        if (holder != null) {
            try {
                Location loc = ev.getInventory().getLocation();
                if (loc != null && loc.getWorld() != null) {
                    meta.put("blockWorld", loc.getWorld().getName());
                    meta.put("blockX", loc.getBlockX());
                    meta.put("blockY", loc.getBlockY());
                    meta.put("blockZ", loc.getBlockZ());
                    Block b = loc.getBlock();
                    if (b != null) meta.put("blockType", b.getType().name());
                }
            } catch (Throwable ignored) {}
        }
        service.logWithPayload(p, "CONTAINER", "OPEN", ev.getInventory().getType().name(), meta);
    }

    // ── TELEPORT ─────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent ev) {
        Location from = ev.getFrom();
        Location to = ev.getTo();
        if (from == null || to == null) return;
        // Filtre les petits déplacements (enderpearl <8 blocs, /sit, etc.)
        if (from.getWorld() != null && to.getWorld() != null
            && from.getWorld().equals(to.getWorld())
            && from.distanceSquared(to) < MIN_TP_DISTANCE_SQ) {
            return;
        }
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("cause", ev.getCause() != null ? ev.getCause().name() : "UNKNOWN");
        if (from.getWorld() != null) {
            meta.put("fromWorld", from.getWorld().getName());
            meta.put("fromX", from.getBlockX());
            meta.put("fromY", from.getBlockY());
            meta.put("fromZ", from.getBlockZ());
        }
        if (to.getWorld() != null) {
            meta.put("toWorld", to.getWorld().getName());
            meta.put("toX", to.getBlockX());
            meta.put("toY", to.getBlockY());
            meta.put("toZ", to.getBlockZ());
        }
        String target = (from.getWorld() != null && to.getWorld() != null
                && !from.getWorld().equals(to.getWorld()))
                ? from.getWorld().getName() + " → " + to.getWorld().getName()
                : (ev.getCause() != null ? ev.getCause().name() : null);
        service.logWithPayload(ev.getPlayer(), "TELEPORT", "TP", target, meta);
    }
}
