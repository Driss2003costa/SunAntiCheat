package sunanticheat.playtime;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
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
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Commande /playtime [joueur] : affiche le temps de jeu (soi-même ou un autre joueur).
 */
public class PlaytimeCommand implements CommandExecutor, TabCompleter {

    private final PlaytimeTracker tracker;

    public PlaytimeCommand(PlaytimeTracker tracker) {
        this.tracker = tracker;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        // /sunplaytime top [n] — Top 5 (ou n) des playtimes
        if (args.length >= 1 && "top".equalsIgnoreCase(args[0])) {
            if (!sender.hasPermission("sunguard.playtime")) {
                sender.sendMessage(Component.text("Vous n'avez pas la permission d'utiliser cette commande.").color(NamedTextColor.RED));
                return true;
            }
            int limit = 5;
            if (args.length >= 2) {
                try {
                    limit = Math.min(50, Math.max(1, Integer.parseInt(args[1])));
                } catch (NumberFormatException ignored) {
                }
            }
            List<Map.Entry<UUID, Long>> top = tracker.getTopPlaytimes(limit);
            sender.sendMessage(Component.text("——— Top " + limit + " temps de jeu ———").color(NamedTextColor.GOLD));
            if (top.isEmpty()) {
                sender.sendMessage(Component.text("Aucune donnée enregistrée.").color(NamedTextColor.GRAY));
            } else {
                int rank = 1;
                for (Map.Entry<UUID, Long> e : top) {
                    String name = resolveName(e.getKey());
                    String timeStr = PlaytimeTracker.formatPlaytime(e.getValue());
                    Component line = Component.text(rank + ". ").color(NamedTextColor.GRAY)
                            .append(Component.text(name).color(NamedTextColor.WHITE))
                            .append(Component.text(" — ").color(NamedTextColor.DARK_GRAY))
                            .append(Component.text(timeStr).color(NamedTextColor.GREEN));
                    sender.sendMessage(line);
                    rank++;
                }
            }
            return true;
        }

        // /sunplaytime [joueur] — Temps de jeu d'un joueur
        Player target;
        if (args.length >= 1) {
            if (!sender.hasPermission("sunguard.playtime.others")) {
                sender.sendMessage(Component.text("Vous n'avez pas la permission de voir le temps de jeu des autres.").color(NamedTextColor.RED));
                return true;
            }
            target = Bukkit.getPlayerExact(args[0]);
            if (target == null) {
                sender.sendMessage(Component.text("Joueur introuvable ou hors ligne.").color(NamedTextColor.RED));
                return true;
            }
        } else {
            if (!(sender instanceof Player player)) {
                sender.sendMessage(Component.text("Usage: /sunplaytime [joueur|top [n]]").color(NamedTextColor.RED));
                return true;
            }
            if (!sender.hasPermission("sunguard.playtime")) {
                sender.sendMessage(Component.text("Vous n'avez pas la permission d'utiliser cette commande.").color(NamedTextColor.RED));
                return true;
            }
            target = player;
        }

        long seconds = tracker.getTotalPlaytimeSeconds(target.getUniqueId());
        String formatted = PlaytimeTracker.formatPlaytime(seconds);
        sender.sendMessage(Component.text("Temps de jeu de " + target.getName() + ": ").color(NamedTextColor.GRAY)
                .append(Component.text(formatted).color(NamedTextColor.GREEN)));
        return true;
    }

    private static String resolveName(UUID uuid) {
        OfflinePlayer off = Bukkit.getOfflinePlayer(uuid);
        String name = off.getName();
        return name != null && !name.isEmpty() ? name : uuid.toString();
    }

    @Override
    public @Nullable List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command, @NotNull String alias, @NotNull String[] args) {
        if (args.length == 1) {
            String prefix = args[0].toLowerCase();
            List<String> out = new ArrayList<>();
            if ("top".startsWith(prefix) && sender.hasPermission("sunguard.playtime")) {
                out.add("top");
            }
            if (sender.hasPermission("sunguard.playtime.others")) {
                Bukkit.getOnlinePlayers().stream()
                        .map(Player::getName)
                        .filter(n -> n.toLowerCase().startsWith(prefix))
                        .sorted()
                        .forEach(out::add);
            }
            return out.stream().sorted().collect(Collectors.toList());
        }
        if (args.length == 2 && "top".equalsIgnoreCase(args[0]) && sender.hasPermission("sunguard.playtime")) {
            String p = args[1];
            List<String> nums = List.of("5", "10", "15", "20");
            if (p.isEmpty()) return new ArrayList<>(nums);
            return nums.stream().filter(n -> n.startsWith(p)).collect(Collectors.toList());
        }
        return Collections.emptyList();
    }
}
