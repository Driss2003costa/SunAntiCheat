package sunanticheat.xray;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

public class XRayCommand implements CommandExecutor, TabCompleter {

    private final XRayGui gui;
    private final XRayTracker tracker;

    public XRayCommand(XRayGui gui, XRayTracker tracker) {
        this.gui = gui;
        this.tracker = tracker;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (args.length >= 1 && "reset".equalsIgnoreCase(args[0])) {
            if (!sender.hasPermission("sunguard.xray.reset")) {
                sender.sendMessage("§cVous n'avez pas la permission de réinitialiser les scores X-Ray.");
                return true;
            }
            if (args.length < 2) {
                sender.sendMessage("§eUsage: /xray reset <joueur1> [joueur2] ...");
                return true;
            }
            List<UUID> toReset = new ArrayList<>();
            List<String> notFound = new ArrayList<>();
            for (int i = 1; i < args.length; i++) {
                String name = args[i];
                Player online = Bukkit.getPlayer(name);
                OfflinePlayer off = (online != null) ? online : Bukkit.getOfflinePlayer(name);
                if (off.getUniqueId() != null) {
                    toReset.add(off.getUniqueId());
                } else {
                    notFound.add(name);
                }
            }
            int cleared = tracker.resetStats(toReset);
            sender.sendMessage("§aScore(s) X-Ray réinitialisé(s) pour §f" + cleared + "§a joueur(s).");
            if (!notFound.isEmpty()) {
                sender.sendMessage("§cJoueur(s) non trouvé(s): §f" + String.join(", ", notFound));
            }
            return true;
        }

        if (!(sender instanceof Player player)) {
            sender.sendMessage("Cette commande est réservée aux joueurs.");
            return true;
        }
        if (!player.hasPermission("sunguard.xray.gui")) {
            player.sendMessage("§cVous n'avez pas la permission d'ouvrir le menu anti-x-ray.");
            return true;
        }
        gui.open(player);
        return true;
    }

    @Override
    public @Nullable List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command, @NotNull String alias, @NotNull String[] args) {
        if (args.length == 1) {
            if (sender.hasPermission("sunguard.xray.gui") || sender.hasPermission("sunguard.xray.reset")) {
                return Collections.singletonList("reset");
            }
            return Collections.emptyList();
        }
        if (args.length >= 2 && "reset".equalsIgnoreCase(args[0]) && sender.hasPermission("sunguard.xray.reset")) {
            String last = args[args.length - 1].toLowerCase();
            return Bukkit.getOnlinePlayers().stream()
                    .map(Player::getName)
                    .filter(n -> n.toLowerCase().startsWith(last))
                    .sorted()
                    .collect(Collectors.toList());
        }
        return Collections.emptyList();
    }
}
