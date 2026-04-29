package sunanticheat.dashboard.handlers;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.pve.PveManager;
import sunanticheat.dashboard.sanctions.SanctionCategory;
import sunanticheat.dashboard.sanctions.SanctionEntry;
import sunanticheat.dashboard.sanctions.SanctionService;
import sunanticheat.dashboard.sanctions.SanctionType;
import sunanticheat.dashboard.sanctions.Severity;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public final class ServerHandler {

    private final JavaPlugin plugin;
    private final List<String> allowedCommands;
    private final long startedAt = System.currentTimeMillis();
    private SanctionService sanctionService;
    private PveManager pveManager;

    public ServerHandler(JavaPlugin plugin, List<String> allowedCommands) {
        this.plugin = plugin;
        this.allowedCommands = allowedCommands;
    }

    public void setSanctionService(SanctionService s) { this.sanctionService = s; }
    public void setPveManager(PveManager p) { this.pveManager = p; }

    /** GET /api/server/status */
    public void status(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;

        var future = new CompletableFuture<Map<String, Object>>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            double[] tps = Bukkit.getTPS();
            Runtime rt = Runtime.getRuntime();
            long usedMb = (rt.totalMemory() - rt.freeMemory()) / 1024 / 1024;
            long maxMb = rt.maxMemory() / 1024 / 1024;
            long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();

            future.complete(Map.of(
                    "tps1m", round(tps[0]),
                    "tps5m", round(tps[1]),
                    "tps15m", round(tps[2]),
                    "playersOnline", Bukkit.getOnlinePlayers().size(),
                    "playersMax", Bukkit.getMaxPlayers(),
                    "ramUsedMb", usedMb,
                    "ramMaxMb", maxMb,
                    "uptimeMs", uptimeMs,
                    "version", Bukkit.getVersion(),
                    "worlds", Bukkit.getWorlds().size()
            ));
        });

        HttpHelper.json(ex, 200, future.join());
    }

    /** GET /api/server/players */
    public void players(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;

        var future = new CompletableFuture<List<Map<String, Object>>>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            List<Map<String, Object>> list = new ArrayList<>();
            for (Player p : Bukkit.getOnlinePlayers()) {
                list.add(Map.of(
                        "name", p.getName(),
                        "uuid", p.getUniqueId().toString(),
                        "world", p.getWorld().getName(),
                        "ping", p.getPing(),
                        "gameMode", p.getGameMode().name(),
                        "health", p.getHealth(),
                        "x", (int) p.getLocation().getX(),
                        "y", (int) p.getLocation().getY(),
                        "z", (int) p.getLocation().getZ()
                ));
            }
            future.complete(list);
        });

        HttpHelper.json(ex, 200, future.join());
    }

    /** GET /api/server/worlds */
    public void worlds(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;

        var future = new CompletableFuture<List<Map<String, Object>>>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            List<Map<String, Object>> list = new ArrayList<>();
            for (World w : Bukkit.getWorlds()) {
                list.add(Map.of(
                        "name", w.getName(),
                        "environment", w.getEnvironment().name(),
                        "players", w.getPlayers().size(),
                        "loadedChunks", w.getLoadedChunks().length,
                        "seed", w.getSeed(),
                        "time", w.getTime(),
                        "pvp", w.getPVP(),
                        "pve", pveManager == null || pveManager.isEnabled(w.getName()),
                        "difficulty", w.getDifficulty().name()
                ));
            }
            future.complete(list);
        });

        HttpHelper.json(ex, 200, future.join());
    }

    /** POST /api/server/command — MOD+ (whitelist restrictive via config) */
    public void command(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requirePermission(ex, user, Permission.SERVER_COMMAND)) return;

        JsonObject req;
        try { req = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }

        String cmd = req.has("command") ? req.get("command").getAsString().trim() : "";
        if (cmd.startsWith("/")) cmd = cmd.substring(1);

        if (cmd.isEmpty()) { HttpHelper.error(ex, 400, "Commande vide"); return; }

        if (!isAllowed(cmd)) {
            HttpHelper.error(ex, 403, "Commande non autorisée (voir config dashboard.allowed-commands)");
            return;
        }

        // On exécute la commande via le ConsoleSender natif.
        // La sortie est déjà capturée par ConsoleLogCapture → WebSocket "console".
        final String finalCmd = cmd;
        var done = new CompletableFuture<Void>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            plugin.getLogger().info("[Dashboard] Commande exécutée par " + user.username() + ": " + finalCmd);
            Bukkit.dispatchCommand(Bukkit.getConsoleSender(), finalCmd);
            done.complete(null);
        });
        done.join();

        HttpHelper.json(ex, 200, Map.of("command", finalCmd, "output", List.of()));
    }

    /**
     * POST /api/server/kick — kick un joueur en ligne.
     * Body : { uuid?: string, player?: string, reason: string }
     * Permission : MODERATE_PLAYERS (MOD+ par défaut).
     */
    public void kick(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requirePermission(ex, user, Permission.MODERATE_PLAYERS)) return;

        JsonObject req;
        try { req = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
        if (req == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        String uuid   = req.has("uuid")   ? req.get("uuid").getAsString()   : null;
        String pname  = req.has("player") ? req.get("player").getAsString() : null;
        String reason = req.has("reason") ? req.get("reason").getAsString() : "Aucune raison";

        if ((uuid == null || uuid.isBlank()) && (pname == null || pname.isBlank())) {
            HttpHelper.error(ex, 400, "uuid ou player requis"); return;
        }

        // Résout le nom (le SanctionService a besoin du nom)
        String resolvedName = pname;
        String resolvedUuid = uuid;
        Player online = null;
        if (uuid != null && !uuid.isBlank()) {
            try { online = Bukkit.getPlayer(java.util.UUID.fromString(uuid)); } catch (Exception ignored) {}
        }
        if (online == null && pname != null) online = Bukkit.getPlayerExact(pname);
        if (online == null) { HttpHelper.error(ex, 404, "Joueur introuvable / hors-ligne"); return; }
        resolvedName = online.getName();
        resolvedUuid = online.getUniqueId().toString();

        // Délègue au SanctionService → l'écran stylisé est appliqué + entrée en DB + audit
        if (sanctionService != null) {
            sanctionService.issue(SanctionType.KICK, Severity.LOW, SanctionCategory.OTHER.name(),
                    resolvedUuid, resolvedName, null,
                    user.username(), 0L, reason, null, null, false, null);
        } else {
            online.kickPlayer(reason);
            plugin.getLogger().info("[Dashboard] Kick par " + user.username() + " : " + resolvedName + " — " + reason);
        }

        HttpHelper.json(ex, 200, Map.of("success", true, "reason", reason, "player", resolvedName));
    }

    /**
     * POST /api/server/ban — ban un joueur (utilise BanList Bukkit).
     * Body : { uuid?: string, player?: string, reason: string, durationMs?: number }
     * durationMs absent ou 0 = ban permanent. Sinon ban temporaire.
     * Permission : MODERATE_PLAYERS (MOD+ par défaut).
     */
    public void ban(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requirePermission(ex, user, Permission.MODERATE_PLAYERS)) return;

        JsonObject req;
        try { req = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
        if (req == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        String uuid   = req.has("uuid")   ? req.get("uuid").getAsString()   : null;
        String pname  = req.has("player") ? req.get("player").getAsString() : null;
        String reason = req.has("reason") ? req.get("reason").getAsString() : "Aucune raison";
        long durationMs = req.has("durationMs") && !req.get("durationMs").isJsonNull()
                ? req.get("durationMs").getAsLong() : 0L;

        if ((uuid == null || uuid.isBlank()) && (pname == null || pname.isBlank())) {
            HttpHelper.error(ex, 400, "uuid ou player requis"); return;
        }

        // Résout le nom canonique
        String targetName = pname;
        String targetUuid = uuid;
        if (uuid != null && !uuid.isBlank()) {
            try {
                var off = Bukkit.getOfflinePlayer(java.util.UUID.fromString(uuid));
                if (off != null && off.getName() != null) targetName = off.getName();
            } catch (Exception ignored) {}
        }
        if ((targetName == null || targetName.isBlank()) && pname != null) targetName = pname;
        if (targetName == null || targetName.isBlank()) { HttpHelper.error(ex, 404, "Joueur introuvable"); return; }

        // Délègue au SanctionService si dispo (le screen stylisé + DB + listener login)
        if (sanctionService != null) {
            SanctionEntry entry = sanctionService.issue(SanctionType.BAN, Severity.HIGH,
                    SanctionCategory.OTHER.name(),
                    targetUuid, targetName, null,
                    user.username(), durationMs, reason, null, null, false, null);
            HttpHelper.json(ex, 200, Map.of(
                    "success", true,
                    "player", targetName,
                    "reason", reason,
                    "permanent", durationMs == 0,
                    "sanctionId", entry.id
            ));
            return;
        }

        // ── Fallback (sanctionService absent) : ancien comportement Bukkit BanList ─
        @SuppressWarnings("deprecation")
        java.util.Date expires = (durationMs > 0)
                ? new java.util.Date(System.currentTimeMillis() + durationMs)
                : null;
        @SuppressWarnings("deprecation")
        Object _ignored = Bukkit.getBanList(org.bukkit.BanList.Type.NAME)
                .addBan(targetName, reason, expires, user.username());
        Player p = Bukkit.getPlayerExact(targetName);
        if (p != null) p.kickPlayer("§cVous avez été banni : §f" + reason);
        plugin.getLogger().info("[Dashboard] Ban (fallback) par " + user.username() + " : " + targetName);
        HttpHelper.json(ex, 200, Map.of(
                "success", true,
                "player", targetName,
                "reason", reason,
                "permanent", durationMs == 0
        ));
    }

    /** POST /api/server/worlds/{name}/pve — toggle PvE d'un monde (MOD+) */
    public void togglePve(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String worldName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.WORLD_PVP)) return;

        World w = Bukkit.getWorld(worldName);
        if (w == null) { HttpHelper.error(ex, 404, "Monde introuvable"); return; }

        boolean newState = (pveManager != null) ? pveManager.toggle(worldName) : true;
        plugin.getLogger().info("[Dashboard] PvE " + worldName + " → " + newState + " (par " + u.username() + ")");
        HttpHelper.json(ex, 200, Map.of("world", worldName, "pve", newState));
    }

    /** POST /api/server/worlds/{name}/pvp — toggle PvP d'un monde (MOD+) */
    public void togglePvp(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String worldName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.WORLD_PVP)) return;

        var future = new CompletableFuture<Map<String, Object>>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            World w = Bukkit.getWorld(worldName);
            if (w == null) { future.complete(Map.of("error", "Monde introuvable")); return; }
            boolean newState = !w.getPVP();
            w.setPVP(newState);
            plugin.getLogger().info("[Dashboard] PvP " + worldName + " → " + newState + " (par " + u.username() + ")");
            future.complete(Map.of("world", worldName, "pvp", newState));
        });

        Map<String, Object> result = future.join();
        if (result.containsKey("error")) HttpHelper.error(ex, 404, (String) result.get("error"));
        else HttpHelper.json(ex, 200, result);
    }

    private boolean isAllowed(String cmd) {
        String lower = cmd.toLowerCase(Locale.ROOT);
        for (String allowed : allowedCommands) {
            if (lower.equals(allowed.toLowerCase(Locale.ROOT)) || lower.startsWith(allowed.toLowerCase(Locale.ROOT) + " ")) {
                return true;
            }
        }
        return false;
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
