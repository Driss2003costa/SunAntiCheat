package sunanticheat.firstjoin;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Exécute une ou plusieurs commandes lors de la toute première connexion d'un joueur.
 */
public class FirstJoinListener implements Listener {

    private final JavaPlugin plugin;

    public FirstJoinListener(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        boolean enabled = plugin.getConfig().getBoolean("first-join.enabled", false);
        if (!enabled) {
            return;
        }

        Player player = event.getPlayer();
        if (player.hasPlayedBefore()) {
            return;
        }

        List<String> commands = loadCommands(plugin);
        if (commands.isEmpty()) {
            plugin.getLogger().warning("first-join est activé mais aucune commande n'est configurée.");
            return;
        }

        long delayTicks = Math.max(0L, plugin.getConfig().getLong("first-join.delay-ticks", 20L));
        Bukkit.getScheduler().runTaskLater(plugin, () -> runCommands(player, commands), delayTicks);
    }

    private void runCommands(Player player, List<String> commands) {
        if (!player.isOnline()) {
            return;
        }

        for (String rawCommand : commands) {
            String prepared = rawCommand.replace("%player%", player.getName()).trim();
            if (prepared.isEmpty()) {
                continue;
            }

            if (prepared.startsWith("/")) {
                prepared = prepared.substring(1).trim();
            }
            if (prepared.isEmpty()) {
                continue;
            }

            // Log explicite pour éviter la confusion si Multiverse n'est pas présent.
            if (prepared.toLowerCase(Locale.ROOT).startsWith("mvtp ")
                    && !Bukkit.getPluginManager().isPluginEnabled("Multiverse-Core")) {
                plugin.getLogger().warning("Commande mvtp ignorée pour " + player.getName()
                        + " : Multiverse-Core n'est pas installé/actif.");
                continue;
            }

            boolean success = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), prepared);
            if (!success) {
                plugin.getLogger().warning("Échec exécution commande first-join: " + prepared);
            }
        }
    }

    private List<String> loadCommands(JavaPlugin plugin) {
        List<String> list = new ArrayList<>();

        List<String> configured = plugin.getConfig().getStringList("first-join.commands");
        for (String entry : configured) {
            if (entry != null && !entry.trim().isEmpty()) {
                list.add(entry.trim());
            }
        }

        if (!list.isEmpty()) {
            return list;
        }

        String single = plugin.getConfig().getString("first-join.command", "mvtp spawn");
        if (single != null && !single.trim().isEmpty()) {
            list.add(single.trim());
        }
        return list;
    }
}
