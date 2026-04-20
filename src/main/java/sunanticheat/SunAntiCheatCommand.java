package sunanticheat;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.bukkit.World;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import org.bukkit.configuration.file.FileConfiguration;
import sunanticheat.Permissions;
import sunanticheat.blocklog.BlockLogInspectionMode;
import sunanticheat.blocklog.BlockLogStore;
import sunanticheat.menu.MainMenuGui;
import sunanticheat.weaponmechanics.WorldContainerWeaponMechanicsScanner;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Commande /sunguard : menu principal, reload, blocklog, sanction, reports, rollback.
 */
public class SunAntiCheatCommand implements CommandExecutor, TabCompleter {

    private final SunAntiCheat plugin;
    private final MainMenuGui mainMenuGui;
    private final BlockLogInspectionMode blockLogInspectionMode;
    private final BlockLogStore blockLogStore;

    public SunAntiCheatCommand(SunAntiCheat plugin, MainMenuGui mainMenuGui, BlockLogInspectionMode blockLogInspectionMode) {
        this(plugin, mainMenuGui, blockLogInspectionMode, null);
    }

    public SunAntiCheatCommand(SunAntiCheat plugin, MainMenuGui mainMenuGui, BlockLogInspectionMode blockLogInspectionMode, BlockLogStore blockLogStore) {
        this.plugin = plugin;
        this.mainMenuGui = mainMenuGui;
        this.blockLogInspectionMode = blockLogInspectionMode;
        this.blockLogStore = blockLogStore;
    }

    private void openReportsGui(Player player) {
        if (mainMenuGui.getReportListGui() != null) {
            mainMenuGui.getReportListGui().open(player);
        }
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (args.length < 1) {
            if (!(sender instanceof Player player)) {
                sender.sendMessage("§cCette commande est réservée aux joueurs.");
                return true;
            }
            if (!player.hasPermission("sunguard.menu")) {
                player.sendMessage("§cVous n'avez pas la permission d'ouvrir le menu.");
                return true;
            }
            mainMenuGui.open(player);
            return true;
        }
        if ("blocklog".equalsIgnoreCase(args[0])) {
            if (!(sender instanceof Player player)) {
                sender.sendMessage("§cCette sous-commande est réservée aux joueurs.");
                return true;
            }
            if (!player.hasPermission("sunguard.blocklog.check")) {
                player.sendMessage("§cVous n'avez pas la permission d'utiliser le mode inspection blocs.");
                return true;
            }
            boolean nowOn = blockLogInspectionMode.toggle(player.getUniqueId());
            if (nowOn) {
                player.sendMessage("§aMode édition (inspection blocs) §2activé§a : clic droit sur un bloc pour voir son log.");
            } else {
                player.sendMessage("§eMode édition (inspection blocs) §cdésactivé§e.");
            }
            return true;
        }
        if ("sanction".equalsIgnoreCase(args[0])) {
            if (!(sender instanceof Player player)) {
                sender.sendMessage("§cCette sous-commande est réservée aux joueurs.");
                return true;
            }
            if (!player.hasPermission("sunguard.sanction.gui")) {
                player.sendMessage("§cVous n'avez pas la permission d'ouvrir le menu des sanctions.");
                return true;
            }
            if (args.length < 2) {
                player.sendMessage("§eUsage: /sunguard sanction <joueur>");
                return true;
            }
            Player target = plugin.getServer().getPlayerExact(args[1]);
            if (target == null || !target.isOnline()) {
                player.sendMessage("§cJoueur introuvable ou hors ligne.");
                return true;
            }
            mainMenuGui.openSanctionMenuFor(player, target);
            return true;
        }
        if ("reports".equalsIgnoreCase(args[0])) {
            if (!(sender instanceof Player player)) {
                sender.sendMessage("§cCette sous-commande est réservée aux joueurs.");
                return true;
            }
            if (!player.hasPermission("sunguard.report.view")) {
                player.sendMessage("§cVous n'avez pas la permission de voir les reports.");
                return true;
            }
            openReportsGui(player);
            return true;
        }
        if ("rollback".equalsIgnoreCase(args[0])) {
            if (!(sender instanceof Player player)) {
                sender.sendMessage("§cCette sous-commande est réservée aux joueurs.");
                return true;
            }
            if (!player.hasPermission("sunguard.blocklog.rollback")) {
                player.sendMessage("§cVous n'avez pas la permission de faire un rollback.");
                return true;
            }
            if (blockLogStore == null) {
                player.sendMessage("§cLe log des blocs est désactivé.");
                return true;
            }
            if (args.length < 2) {
                player.sendMessage("§eUsage: /sunguard rollback <joueur> [rayon] [minutes]");
                return true;
            }
            org.bukkit.OfflinePlayer target = plugin.getServer().getOfflinePlayerIfCached(args[1]);
            if (target == null) target = plugin.getServer().getOfflinePlayer(args[1]);
            if (target.getUniqueId() == null || !target.hasPlayedBefore()) {
                player.sendMessage("§cJoueur introuvable.");
                return true;
            }
            UUID targetUuid = target.getUniqueId();
            int radius = args.length >= 3 ? parseInt(args[2], 5) : 5;
            int minutes = args.length >= 4 ? parseInt(args[3], 60) : 60;
            radius = Math.max(1, Math.min(50, radius));
            minutes = Math.max(1, Math.min(60 * 24 * 7, minutes));
            long since = System.currentTimeMillis() - minutes * 60L * 1000;
            org.bukkit.Location loc = player.getLocation();
            String worldName = loc.getWorld() != null ? loc.getWorld().getName() : null;
            List<BlockLogStore.BlockLogRecord> records = blockLogStore.getEntriesForRollback(targetUuid, worldName, loc.getBlockX(), loc.getBlockY(), loc.getBlockZ(), radius, since);
            if (records.isEmpty()) {
                player.sendMessage("§eAucune action à annuler pour ce joueur dans la zone/période.");
                return true;
            }
            int count = blockLogStore.rollback(loc.getWorld(), records);
            player.sendMessage("§aRollback effectué : " + count + " action(s) annulée(s) pour " + (target.getName() != null ? target.getName() : args[1]) + ".");
            return true;
        }
        if ("reload".equalsIgnoreCase(args[0])) {
            if (!sender.hasPermission("sunguard.reload")) {
                sender.sendMessage("§cVous n'avez pas la permission de recharger la configuration.");
                return true;
            }
            plugin.reloadConfig();
            plugin.reloadWeaponMechanicsMainWorldGuard();
            sender.sendMessage("§aConfiguration rechargée.");
            return true;
        }
        if ("mvinvscan".equalsIgnoreCase(args[0])) {
            if (!sender.hasPermission(Permissions.MVINV_SCAN)) {
                sender.sendMessage("§cVous n'avez pas la permission d'analyser les inventaires Multiverse-Inventories (spawn).");
                return true;
            }
            if (plugin.getServer().getPluginManager().getPlugin("Multiverse-Inventories") == null
                    || !plugin.getServer().getPluginManager().isPluginEnabled("Multiverse-Inventories")) {
                sender.sendMessage("§cMultiverse-Inventories n'est pas chargé ou activé.");
                return true;
            }
            var scanner = plugin.getMultiverseInventoriesSpawnWeaponFileScanner();
            if (scanner == null) {
                sender.sendMessage("§cModule de scan non initialisé.");
                return true;
            }
            if (args.length >= 2) {
                String targetName = args[1];
                org.bukkit.entity.Player online = plugin.getServer().getPlayerExact(targetName);
                java.util.UUID id;
                String name;
                if (online != null) {
                    id = online.getUniqueId();
                    name = online.getName();
                } else {
                    org.bukkit.OfflinePlayer off = plugin.getServer().getOfflinePlayer(targetName);
                    if (!off.hasPlayedBefore()) {
                        sender.sendMessage("§cJoueur introuvable ou jamais connecté : §f" + targetName);
                        return true;
                    }
                    id = off.getUniqueId();
                    name = off.getName() != null ? off.getName() : targetName;
                }
                sender.sendMessage("§eAnalyse MV-Inv (spawn) pour §f" + name + " §7— fichier + inventaire en jeu si connecté sur spawn…");
                scanner.scheduleFileScanAndLiveSweep(id, name, 0L);
                sendDiscordMvScanReport(true, name, sender.getName());
                return true;
            }
            sender.sendMessage("§eAnalyse de §ftous §eles profils du monde spawn (Multiverse-Inventories)… §7(async)");
            scanner.runManualFullScanAsync(sender);
            sendDiscordMvScanReport(false, null, sender.getName());
            return true;
        }
        if ("chestscan".equalsIgnoreCase(args[0])) {
            if (!sender.hasPermission(Permissions.CHEST_SCAN)) {
                sender.sendMessage("§cVous n'avez pas la permission d'analyser les conteneurs WM.");
                return true;
            }
            if (args.length < 2 || args[1].isBlank()) {
                sender.sendMessage("§eUsage: /sunguard chestscan <monde1,monde2,...>");
                return true;
            }
            WorldContainerWeaponMechanicsScanner scanner = plugin.getWorldContainerWeaponMechanicsScanner();
            if (scanner == null) {
                sender.sendMessage("§cModule de scan des conteneurs non initialisé.");
                return true;
            }
            Set<World> targets = resolveWorlds(args[1]);
            if (targets.isEmpty()) {
                sender.sendMessage("§cAucun monde valide. Exemple: /sunguard chestscan world,spawn");
                return true;
            }
            sendDiscordChestScanReport(targets, sender.getName());
            scanner.startScan(sender, targets);
            return true;
        }
        if ("firstjoin".equalsIgnoreCase(args[0])) {
            if (!sender.hasPermission("sunguard.firstjoin.manage")) {
                sender.sendMessage("§cVous n'avez pas la permission de gérer le first join.");
                return true;
            }
            if (args.length < 2) {
                sender.sendMessage("§eUsage: /sunguard firstjoin <status|enable|disable|delay <ticks>|setcommand <cmd>|addcommand <cmd>|clearcommands>");
                return true;
            }
            FileConfiguration cfg = plugin.getConfig();
            String action = args[1].toLowerCase();
            if ("status".equals(action)) {
                boolean enabled = cfg.getBoolean("first-join.enabled", false);
                long delay = cfg.getLong("first-join.delay-ticks", 20L);
                List<String> cmds = cfg.getStringList("first-join.commands");
                if (cmds.isEmpty()) {
                    String single = cfg.getString("first-join.command", "");
                    if (!single.isBlank()) cmds = List.of(single);
                }
                sender.sendMessage("§6[FirstJoin] §fEnabled: " + enabled + " §7| §fDelay: " + delay + " ticks");
                if (cmds.isEmpty()) {
                    sender.sendMessage("§6[FirstJoin] §eAucune commande configurée.");
                } else {
                    sender.sendMessage("§6[FirstJoin] §fCommandes:");
                    for (String cmdLine : cmds) sender.sendMessage(" §7- §f" + cmdLine);
                }
                return true;
            }
            if ("enable".equals(action) || "disable".equals(action)) {
                boolean value = "enable".equals(action);
                cfg.set("first-join.enabled", value);
                plugin.saveConfig();
                sender.sendMessage("§aFirst join " + (value ? "activé" : "désactivé") + ".");
                return true;
            }
            if ("delay".equals(action)) {
                if (args.length < 3) {
                    sender.sendMessage("§eUsage: /sunguard firstjoin delay <ticks>");
                    return true;
                }
                int ticks = Math.max(0, parseInt(args[2], 20));
                cfg.set("first-join.delay-ticks", ticks);
                plugin.saveConfig();
                sender.sendMessage("§aDélai first join réglé à " + ticks + " ticks.");
                return true;
            }
            if ("setcommand".equals(action) || "addcommand".equals(action)) {
                if (args.length < 3) {
                    sender.sendMessage("§eUsage: /sunguard firstjoin " + action + " <commande>");
                    return true;
                }
                String cmdLine = String.join(" ", java.util.Arrays.copyOfRange(args, 2, args.length)).trim();
                if (cmdLine.startsWith("/")) cmdLine = cmdLine.substring(1).trim();
                if (cmdLine.isEmpty()) {
                    sender.sendMessage("§cCommande invalide.");
                    return true;
                }
                List<String> cmds = new ArrayList<>(cfg.getStringList("first-join.commands"));
                if ("setcommand".equals(action)) {
                    cmds.clear();
                }
                cmds.add(cmdLine);
                cfg.set("first-join.commands", cmds);
                cfg.set("first-join.command", cmdLine); // compat ancienne clé
                plugin.saveConfig();
                sender.sendMessage("§aCommande first join " + ("setcommand".equals(action) ? "définie" : "ajoutée") + " : §f" + cmdLine);
                return true;
            }
            if ("clearcommands".equals(action)) {
                cfg.set("first-join.commands", new ArrayList<>());
                cfg.set("first-join.command", "");
                plugin.saveConfig();
                sender.sendMessage("§aCommandes first join vidées.");
                return true;
            }
            sender.sendMessage("§eUsage: /sunguard firstjoin <status|enable|disable|delay <ticks>|setcommand <cmd>|addcommand <cmd>|clearcommands>");
            return true;
        }
        sender.sendMessage("§eUsage: /sunguard | /sunguard reload | /sunguard mvinvscan [joueur] | /sunguard chestscan <monde1,monde2,...> | /sunguard blocklog | /sunguard sanction <joueur> | /sunguard reports | /sunguard rollback <joueur> [rayon] [minutes] | /sunguard firstjoin ...");
        return true;
    }

    private static int parseInt(String s, int def) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    @Override
    public @Nullable List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command, @NotNull String alias, @NotNull String[] args) {
        if (args.length == 1) {
            List<String> out = new ArrayList<>();
            if (sender.hasPermission("sunguard.reload") && "reload".toLowerCase().startsWith(args[0].toLowerCase())) {
                out.add("reload");
            }
            if (sender.hasPermission("sunguard.blocklog.check") && "blocklog".toLowerCase().startsWith(args[0].toLowerCase())) {
                out.add("blocklog");
            }
            if (sender.hasPermission("sunguard.sanction.gui") && "sanction".toLowerCase().startsWith(args[0].toLowerCase())) {
                out.add("sanction");
            }
            if (sender.hasPermission("sunguard.report.view") && "reports".toLowerCase().startsWith(args[0].toLowerCase())) {
                out.add("reports");
            }
            if (sender.hasPermission("sunguard.blocklog.rollback") && "rollback".toLowerCase().startsWith(args[0].toLowerCase())) {
                out.add("rollback");
            }
            if (sender.hasPermission("sunguard.firstjoin.manage") && "firstjoin".toLowerCase().startsWith(args[0].toLowerCase())) {
                out.add("firstjoin");
            }
            if (sender.hasPermission(Permissions.MVINV_SCAN) && "mvinvscan".toLowerCase().startsWith(args[0].toLowerCase())) {
                out.add("mvinvscan");
            }
            if (sender.hasPermission(Permissions.CHEST_SCAN) && "chestscan".startsWith(args[0].toLowerCase(Locale.ROOT))) {
                out.add("chestscan");
            }
            return out;
        }
        if (args.length == 2 && "chestscan".equalsIgnoreCase(args[0]) && sender.hasPermission(Permissions.CHEST_SCAN)) {
            String[] entered = args[1].split(",");
            String current = entered[entered.length - 1].trim().toLowerCase(Locale.ROOT);
            Set<String> already = new LinkedHashSet<>();
            for (int i = 0; i < entered.length - 1; i++) {
                String e = entered[i].trim().toLowerCase(Locale.ROOT);
                if (!e.isEmpty()) {
                    already.add(e);
                }
            }
            List<String> out = new ArrayList<>();
            for (World world : plugin.getServer().getWorlds()) {
                String worldName = world.getName();
                String lower = worldName.toLowerCase(Locale.ROOT);
                if (already.contains(lower)) continue;
                if (lower.startsWith(current)) {
                    StringBuilder proposal = new StringBuilder();
                    for (int i = 0; i < entered.length - 1; i++) {
                        if (i > 0) proposal.append(",");
                        proposal.append(entered[i].trim());
                    }
                    if (proposal.length() > 0) proposal.append(",");
                    proposal.append(worldName);
                    out.add(proposal.toString());
                }
            }
            return out;
        }
        if (args.length == 2 && "firstjoin".equalsIgnoreCase(args[0]) && sender.hasPermission("sunguard.firstjoin.manage")) {
            List<String> out = new ArrayList<>();
            for (String s : List.of("status", "enable", "disable", "delay", "setcommand", "addcommand", "clearcommands")) {
                if (s.startsWith(args[1].toLowerCase())) out.add(s);
            }
            return out;
        }
        if (args.length == 2 && "mvinvscan".equalsIgnoreCase(args[0]) && sender.hasPermission(Permissions.MVINV_SCAN)) {
            String prefix = args[1].toLowerCase();
            List<String> names = new ArrayList<>();
            for (org.bukkit.entity.Player p : plugin.getServer().getOnlinePlayers()) {
                if (p.getName().toLowerCase().startsWith(prefix)) {
                    names.add(p.getName());
                }
            }
            return names;
        }
        if (args.length == 2 && "sanction".equalsIgnoreCase(args[0]) && sender.hasPermission("sunguard.sanction.gui")) {
            String prefix = args[1].toLowerCase();
            List<String> names = new ArrayList<>();
            for (org.bukkit.entity.Player p : plugin.getServer().getOnlinePlayers()) {
                if (p.getName().toLowerCase().startsWith(prefix)) {
                    names.add(p.getName());
                }
            }
            return names;
        }
        if (args.length >= 2 && "rollback".equalsIgnoreCase(args[0]) && sender.hasPermission("sunguard.blocklog.rollback")) {
            if (args.length == 2) {
                String prefix = args[1].toLowerCase();
                List<String> names = new ArrayList<>();
                for (org.bukkit.entity.Player p : plugin.getServer().getOnlinePlayers()) {
                    if (p.getName().toLowerCase().startsWith(prefix)) names.add(p.getName());
                }
                return names;
            }
        }
        return Collections.emptyList();
    }

    private Set<World> resolveWorlds(String csv) {
        Set<World> result = new LinkedHashSet<>();
        for (String token : csv.split(",")) {
            String worldName = token.trim();
            if (worldName.isEmpty()) continue;
            World world = plugin.getServer().getWorld(worldName);
            if (world != null) {
                result.add(world);
            }
        }
        return result;
    }

    private void sendDiscordMvScanReport(boolean playerScan, String playerName, String requestedBy) {
        var webhook = plugin.getDiscordWebhook();
        if (webhook == null || !webhook.isEnabled()) return;
        if (!plugin.getConfig().getBoolean("discord.enabled", false)) return;
        if (playerScan && !plugin.getConfig().getBoolean("discord.player-scan-report", true)) return;
        if (!playerScan && !plugin.getConfig().getBoolean("discord.mvinvscan-report", true)) return;

        if (playerScan) {
            String desc = "**Statut** · :mag: `Scan démarré`\n"
                    + "**Demandeur** · `" + requestedBy + "`\n"
                    + "**Cible** · `" + playerName + "`\n\n"
                    + "__**Portée**__\n"
                    + "> • Fichier de profil Multiverse-Inventories\n"
                    + "> • Live sweep du monde spawn (si joueur en ligne)\n";
            webhook.sendEmbed("MV-Inv — Player Scan", desc, 0x3498DB);
            return;
        }
        String desc = "**Statut** · :mag: `Scan complet démarré`\n"
                + "**Demandeur** · `" + requestedBy + "`\n\n"
                + "__**Portée**__\n"
                + "> • Analyse de tous les profils Multiverse-Inventories du groupe spawn\n";
        webhook.sendEmbed("MV-Inv — Full Scan", desc, 0x3498DB);
    }

    private void sendDiscordChestScanReport(Set<World> worlds, String requestedBy) {
        var webhook = plugin.getDiscordWebhook();
        if (webhook == null || !webhook.isEnabled()) return;
        if (!plugin.getConfig().getBoolean("discord.enabled", false)) return;
        if (!plugin.getConfig().getBoolean("discord.chest-scan-report", true)) return;
        String worldList = worlds.stream().map(World::getName).sorted().reduce((a, b) -> a + ", " + b).orElse("-");
        String desc = "**Statut** · :mag: `Scan démarré`\n"
                + "**Demandeur** · `" + requestedBy + "`\n"
                + "**Mondes** · `" + worldList + "`\n\n"
                + "__**Portée**__\n"
                + "> • Conteneurs chargés (coffres, tonneaux, shulkers placés, hoppers, etc.)\n"
                + "> • Enderchests des joueurs en ligne dans ces mondes\n"
                + "> • Items WeaponMechanics imbriqués dans les shulkers-items\n\n"
                + "*Un rapport final sera publié dès la fin du scan.*";
        webhook.sendEmbed("Chest Scan — Démarrage", desc, 0x3498DB);
    }
}
