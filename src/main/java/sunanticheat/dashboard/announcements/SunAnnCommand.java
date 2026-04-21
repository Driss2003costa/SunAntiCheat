package sunanticheat.dashboard.announcements;

import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Commande interne /sunann click {annId} {variantId} — invoquée par le
 * ClickEvent.runCommand des annonces. Enregistre le clic puis dispatche
 * la vraie commande configurée (au nom du joueur).
 */
public final class SunAnnCommand implements CommandExecutor {

    private final JavaPlugin plugin;
    private final AnnouncementStore store;

    public SunAnnCommand(JavaPlugin plugin, AnnouncementStore store) {
        this.plugin = plugin;
        this.store = store;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) return true;
        if ("click".equalsIgnoreCase(args[0]) && args.length == 3) {
            final String annId = args[1];
            final String variantId = args[2];
            store.recordClick(annId, variantId);

            Announcement a = store.get(annId);
            if (a == null || a.variants == null) return true;
            AnnouncementVariant variant = null;
            for (AnnouncementVariant v : a.variants) {
                if (variantId.equals(v.id)) { variant = v; break; }
            }
            if (variant == null) return true;

            final String cmd = variant.clickCommand;
            if (cmd != null && !cmd.isEmpty() && sender instanceof Player) {
                // Exécution sur main thread au nom du joueur
                Bukkit.getScheduler().runTask(plugin, () -> {
                    try {
                        Bukkit.dispatchCommand(sender, cmd);
                    } catch (Throwable t) {
                        plugin.getLogger().warning("[Announcements] click cmd fail: " + t.getMessage());
                    }
                });
            }
        }
        return true;
    }
}
