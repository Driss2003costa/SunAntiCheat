package sunanticheat.report;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Commande /report <joueur> <raison> — enregistre un signalement. Cooldown par rapporteur.
 */
public class ReportCommand implements CommandExecutor, TabCompleter {

    private final JavaPlugin plugin;
    private final ReportStorage storage;
    private final java.util.function.Consumer<ReportEntry> onDiscordReport;
    private final Map<UUID, Long> lastReportTime = new ConcurrentHashMap<>();

    public ReportCommand(JavaPlugin plugin, ReportStorage storage, java.util.function.Consumer<ReportEntry> onDiscordReport) {
        this.plugin = plugin;
        this.storage = storage;
        this.onDiscordReport = onDiscordReport;
    }

    public long getCooldownMinutes() {
        return Math.max(0, plugin.getConfig().getLong("reports.cooldown-minutes", 5));
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player reporter)) {
            sender.sendMessage(Component.text("Cette commande est réservée aux joueurs.").color(NamedTextColor.RED));
            return true;
        }
        if (!reporter.hasPermission("sunguard.report")) {
            reporter.sendMessage(Component.text("Vous n'avez pas la permission de signaler.").color(NamedTextColor.RED));
            return true;
        }
        if (args.length < 2) {
            reporter.sendMessage(Component.text("Usage: /report <joueur> <raison>").color(NamedTextColor.YELLOW));
            return true;
        }
        Player reported = Bukkit.getPlayerExact(args[0]);
        if (reported == null || !reported.isOnline()) {
            reporter.sendMessage(Component.text("Joueur introuvable ou hors ligne.").color(NamedTextColor.RED));
            return true;
        }
        if (reported.getUniqueId().equals(reporter.getUniqueId())) {
            reporter.sendMessage(Component.text("Vous ne pouvez pas vous signaler vous-même.").color(NamedTextColor.RED));
            return true;
        }
        long cooldownMs = getCooldownMinutes() * 60 * 1000;
        long now = System.currentTimeMillis();
        if (now - lastReportTime.getOrDefault(reporter.getUniqueId(), 0L) < cooldownMs) {
            reporter.sendMessage(Component.text("Veuillez attendre avant de signaler à nouveau.").color(NamedTextColor.RED));
            return true;
        }
        StringBuilder reason = new StringBuilder(args[1]);
        for (int i = 2; i < args.length; i++) reason.append(" ").append(args[i]);
        ReportEntry entry = new ReportEntry(reporter.getUniqueId(), reporter.getName(), reported.getUniqueId(), reported.getName(), reason.toString(), now);
        storage.add(entry);
        lastReportTime.put(reporter.getUniqueId(), now);
        reporter.sendMessage(Component.text("Signalement enregistré. Le staff en prendra connaissance.").color(NamedTextColor.GREEN));
        if (onDiscordReport != null) onDiscordReport.accept(entry);
        return true;
    }

    @Override
    public @Nullable List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command, @NotNull String alias, @NotNull String[] args) {
        if (args.length == 1 && sender.hasPermission("sunguard.report")) {
            String prefix = args[0].toLowerCase();
            List<String> names = new ArrayList<>();
            for (Player p : Bukkit.getOnlinePlayers()) {
                if (p != sender && p.getName().toLowerCase().startsWith(prefix)) {
                    names.add(p.getName());
                }
            }
            return names;
        }
        return List.of();
    }
}
