package sunanticheat.dashboard.sanctions;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.Set;
import java.util.UUID;

/**
 * Listeners qui appliquent les sanctions persistantes :
 *
 *   - AsyncPlayerPreLoginEvent : refuse la connexion si BAN ou IP_BAN actif
 *   - AsyncPlayerChatEvent     : annule le message + warn si MUTE actif
 *   - PlayerCommandPreprocessEvent : bloque /msg, /me, /tell, /pm, /r, /w
 *     pendant un mute (sinon le mute est trivialement contournable)
 *   - Scheduler 60s : marque les sanctions expirées comme révoquées (auto-unban)
 */
public final class SanctionListeners implements Listener {

    /** Commandes considérées comme "chat alternatif" et bloquées si muet. */
    private static final Set<String> CHAT_COMMANDS = Set.of(
            "/me", "/msg", "/tell", "/whisper", "/w", "/pm", "/r", "/reply",
            "/say", "/broadcast", "/bcast", "/yell", "/shout"
    );

    private final JavaPlugin plugin;
    private final SanctionService service;
    private BukkitTask expiryTask;

    public SanctionListeners(JavaPlugin plugin, SanctionService service) {
        this.plugin = plugin;
        this.service = service;
    }

    public void start() {
        Bukkit.getPluginManager().registerEvents(this, plugin);
        // Auto-unban scheduler : toutes les 60s on marque les expirés comme révoqués
        expiryTask = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, () -> {
            int n = service.store().markExpired();
            if (n > 0) {
                plugin.getLogger().info("[Sanctions] Auto-unban : " + n + " sanction(s) expirée(s)");
                service.rebuildMuteCache();
            }
        }, 20L * 60, 20L * 60);
    }

    public void stop() {
        if (expiryTask != null) { expiryTask.cancel(); expiryTask = null; }
    }

    // ── Login : refuse si banni ──────────────────────────────────────────────

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onPreLogin(AsyncPlayerPreLoginEvent ev) {
        UUID uuid = ev.getUniqueId();
        String name = ev.getName();
        String ip = ev.getAddress() != null ? ev.getAddress().getHostAddress() : null;

        SanctionEntry ban = service.findActiveBan(uuid, name, ip);
        if (ban == null) return;

        // Disallow avec le screen stylisé
        ev.disallow(AsyncPlayerPreLoginEvent.Result.KICK_BANNED,
                service.formatter().formatBan(ban));
    }

    // ── Chat : annule si muet ────────────────────────────────────────────────

    @SuppressWarnings("deprecation")
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onChat(AsyncPlayerChatEvent ev) {
        Player p = ev.getPlayer();
        SanctionEntry mute = service.activeMute(p.getUniqueId());
        if (mute == null) return;
        ev.setCancelled(true);
        // Renvoie le rappel au joueur (sur main thread)
        Bukkit.getScheduler().runTask(plugin, () ->
                p.sendMessage(service.formatter().formatMutedMessage(mute)));
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent ev) {
        Player p = ev.getPlayer();
        SanctionEntry mute = service.activeMute(p.getUniqueId());
        if (mute == null) return;
        // Récupère la première partie de la commande (avant l'espace)
        String full = ev.getMessage();
        int sp = full.indexOf(' ');
        String cmd = (sp == -1 ? full : full.substring(0, sp)).toLowerCase();
        if (CHAT_COMMANDS.contains(cmd)) {
            ev.setCancelled(true);
            p.sendMessage(service.formatter().formatMutedMessage(mute));
        }
    }
}
