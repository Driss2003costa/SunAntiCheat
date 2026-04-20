package sunanticheat.security;

import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.Permissions;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Bloque les commandes sensibles pour les non-staff et alerte en temps réel les OP connectés.
 */
public final class RiskyCommandListener implements Listener {

    private static final List<String> DEFAULT_RISKY_PREFIXES = List.of(
            "pl",
            "plugins",
            "ver",
            "version",
            "about",
            "help plugins",
            "bukkit:",
            "minecraft:",
            "paper:",
            "spigot:"
    );

    private final JavaPlugin plugin;

    public RiskyCommandListener(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onPlayerCommand(PlayerCommandPreprocessEvent event) {
        FileConfiguration cfg = plugin.getConfig();
        if (!cfg.getBoolean("security.risky-commands.enabled", true)) {
            return;
        }

        Player player = event.getPlayer();
        if (isStaff(player)) {
            return;
        }

        String raw = event.getMessage();
        if (raw == null || raw.isBlank()) {
            return;
        }
        String normalized = raw.trim();
        if (normalized.startsWith("/")) {
            normalized = normalized.substring(1).trim();
        }
        if (normalized.isBlank()) {
            return;
        }

        String lower = normalized.toLowerCase(Locale.ROOT);
        String matchedPrefix = matchRiskyPrefix(lower, riskyPrefixes(cfg));
        if (matchedPrefix == null) {
            return;
        }

        event.setCancelled(true);
        player.sendMessage("§cCette commande est bloquée.");

        String detail = "[Security] Commande risquée bloquée: joueur=" + player.getName()
                + ", cmd=/" + normalized + ", match=" + matchedPrefix;
        plugin.getLogger().warning(detail);

        String notify = "§c[Security] §f" + player.getName() + " §7a tenté: §e/" + normalized;
        notifyOpsInChat(notify);
    }

    private static boolean isStaff(CommandSender sender) {
        if (!(sender instanceof Player p)) {
            return true;
        }
        return p.isOp()
                || p.hasPermission(Permissions.ALERTS)
                || p.hasPermission(Permissions.BYPASS_RISKY_COMMAND_BLOCK);
    }

    private static String matchRiskyPrefix(String commandLine, List<String> prefixes) {
        for (String prefix : prefixes) {
            String p = prefix.toLowerCase(Locale.ROOT);
            if (commandLine.equals(p) || commandLine.startsWith(p + " ")) {
                return prefix;
            }
            // Cas namespace direct, ex: "bukkit:plugins".
            if (p.endsWith(":") && commandLine.startsWith(p)) {
                return prefix;
            }
        }
        return null;
    }

    private static List<String> riskyPrefixes(FileConfiguration cfg) {
        List<String> fromConfig = cfg.getStringList("security.risky-commands.blocked-prefixes");
        Set<String> values = new LinkedHashSet<>();
        if (fromConfig != null) {
            for (String entry : fromConfig) {
                if (entry == null) continue;
                String cleaned = entry.trim();
                if (cleaned.startsWith("/")) cleaned = cleaned.substring(1).trim();
                if (!cleaned.isEmpty()) values.add(cleaned);
            }
        }
        if (values.isEmpty()) {
            values.addAll(DEFAULT_RISKY_PREFIXES);
        }
        return new ArrayList<>(values);
    }

    private static void notifyOpsInChat(String message) {
        for (Player online : Bukkit.getOnlinePlayers()) {
            if (online.isOp()) {
                online.sendMessage(message);
            }
        }
    }
}
