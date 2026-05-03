package sunanticheat.jobs;

import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import net.kyori.adventure.text.Component;

import java.util.*;
import java.util.stream.Collectors;

public final class CustomJobCommand implements CommandExecutor, TabCompleter {

    private final CustomJobService service;
    private final CustomJobGui gui;

    public CustomJobCommand(CustomJobService service, CustomJobGui gui) {
        this.service = service;
        this.gui     = gui;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("§cCette commande est réservée aux joueurs.");
            return true;
        }

        if (args.length == 0) {
            gui.open(player);
            return true;
        }

        switch (args[0].toLowerCase()) {
            case "list" -> sendList(player);
            case "join" -> {
                if (args.length < 2) { player.sendMessage(Component.text("§cUsage : /job join <métier>")); return true; }
                if (!service.join(player, args[1])) {
                    player.sendMessage(Component.text(
                            service.getJob(args[1]) == null
                                ? "§cMétier introuvable."
                                : "§cTu es déjà dans ce métier."));
                }
            }
            case "leave", "quit" -> {
                if (args.length < 2) { player.sendMessage(Component.text("§cUsage : /job leave <métier>")); return true; }
                if (!service.leave(player, args[1])) {
                    player.sendMessage(Component.text(
                            service.getJob(args[1]) == null
                                ? "§cMétier introuvable."
                                : "§cTu n'es pas dans ce métier."));
                }
            }
            case "info" -> {
                String id = args.length >= 2 ? args[1] : null;
                sendInfo(player, id);
            }
            case "top" -> {
                if (args.length < 2) { player.sendMessage(Component.text("§cUsage : /job top <métier>")); return true; }
                sendTop(player, args[1]);
            }
            case "reload" -> {
                if (!player.hasPermission("sunanticheat.admin")) {
                    player.sendMessage(Component.text("§cPermission refusée."));
                    return true;
                }
                service.getJobs(); // config.reload() called via module
                player.sendMessage(Component.text("§aConfiguration des métiers rechargée."));
            }
            default -> gui.open(player);
        }
        return true;
    }

    private void sendList(Player player) {
        player.sendMessage(Component.text("§6§l== Métiers disponibles =="));
        String uuid = player.getUniqueId().toString();
        for (CustomJob job : service.getJobs().values()) {
            boolean joined = service.getStore().hasJob(uuid, job.id());
            String status = joined ? "§a[REJOINT] " : "§7";
            player.sendMessage(Component.text(status + "§e" + job.name()
                    + " §8(" + job.id() + ") §7- " + job.description()));
        }
    }

    private void sendInfo(Player player, String jobId) {
        String uuid = player.getUniqueId().toString();

        if (jobId == null) {
            // Show all joined jobs
            List<Map<String, Object>> pJobs = service.getStore().getPlayerJobs(uuid);
            if (pJobs.isEmpty()) {
                player.sendMessage(Component.text("§7Tu n'as rejoint aucun métier. /job pour ouvrir le menu."));
                return;
            }
            for (Map<String, Object> pj : pJobs) {
                String id = (String) pj.get("job_id");
                CustomJob job = service.getJob(id);
                if (job == null) continue;
                int level = ((Number) pj.get("level")).intValue();
                double xp = ((Number) pj.get("xp")).doubleValue();
                player.sendMessage(Component.text("§e" + job.name()
                        + " §7| Niv. §f" + level
                        + " §7| XP : §f" + Math.round(xp)));
            }
            return;
        }

        CustomJob job = service.getJob(jobId);
        if (job == null) { player.sendMessage(Component.text("§cMétier introuvable.")); return; }

        Map<String, Object> pj = service.getStore().getPlayerJob(uuid, jobId);
        player.sendMessage(Component.text("§6§l" + job.name()));
        player.sendMessage(Component.text("§7" + job.description()));
        if (pj != null) {
            int level = ((Number) pj.get("level")).intValue();
            double xp  = ((Number) pj.get("xp")).doubleValue();
            double earned = ((Number) pj.get("total_earned")).doubleValue();
            long xpNextLevel = !job.isMaxLevel(level) ? job.xpForLevel(level + 1) : 0;
            player.sendMessage(Component.text("§eNiveau : §f" + level
                    + (job.maxLevel() > 0 ? "§7/§f" + job.maxLevel() : "")));
            player.sendMessage(Component.text("§eXP : §f" + Math.round(xp)
                    + (xpNextLevel > 0 ? " §7/ §f" + xpNextLevel + " pour niveau " + (level+1) : " §7(niveau max)")));
            player.sendMessage(Component.text("§eGains totaux : §f" + String.format("%.2f", earned) + " $"));
            player.sendMessage(Component.text("§eMultiplicateur : §fx" + String.format("%.1f", job.rewardMultiplier(level))));
        } else {
            player.sendMessage(Component.text("§7Tu n'as pas rejoint ce métier. §a/job join " + jobId));
        }
    }

    private void sendTop(Player player, String jobId) {
        CustomJob job = service.getJob(jobId);
        if (job == null) { player.sendMessage(Component.text("§cMétier introuvable.")); return; }
        List<Map<String, Object>> top = service.getStore().leaderboard(jobId, 10);
        player.sendMessage(Component.text("§6§lTop §e" + job.name()));
        int rank = 1;
        for (Map<String, Object> row : top) {
            int level = ((Number) row.get("level")).intValue();
            double xp = ((Number) row.get("xp")).doubleValue();
            String uid = (String) row.get("uuid");
            String name = Optional.ofNullable(Bukkit.getOfflinePlayer(java.util.UUID.fromString(uid)).getName()).orElse(uid);
            player.sendMessage(Component.text("§7#" + rank + " §f" + name
                    + " §7| Niv. §f" + level + " §7| XP : §f" + Math.round(xp)));
            rank++;
        }
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command cmd, String alias, String[] args) {
        if (args.length == 1) {
            return List.of("list", "join", "leave", "info", "top", "reload").stream()
                    .filter(s -> s.startsWith(args[0].toLowerCase()))
                    .collect(Collectors.toList());
        }
        if (args.length == 2 && (args[0].equalsIgnoreCase("join")
                || args[0].equalsIgnoreCase("leave")
                || args[0].equalsIgnoreCase("info")
                || args[0].equalsIgnoreCase("top"))) {
            return service.getJobs().keySet().stream()
                    .filter(s -> s.startsWith(args[1].toLowerCase()))
                    .collect(Collectors.toList());
        }
        return List.of();
    }
}
