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

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public final class ServerHandler {

    private final JavaPlugin plugin;
    private final List<String> allowedCommands;
    private final long startedAt = System.currentTimeMillis();

    public ServerHandler(JavaPlugin plugin, List<String> allowedCommands) {
        this.plugin = plugin;
        this.allowedCommands = allowedCommands;
    }

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

        var future = new CompletableFuture<Boolean>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            Player target = null;
            if (uuid != null && !uuid.isBlank()) {
                try { target = Bukkit.getPlayer(java.util.UUID.fromString(uuid)); } catch (Exception ignored) {}
            }
            if (target == null && pname != null) target = Bukkit.getPlayerExact(pname);
            if (target == null) { future.complete(false); return; }
            target.kickPlayer(reason);
            plugin.getLogger().info("[Dashboard] Kick par " + user.username() + " : " + target.getName() + " — " + reason);
            future.complete(true);
        });

        if (!future.join()) { HttpHelper.error(ex, 404, "Joueur introuvable / hors-ligne"); return; }
        HttpHelper.json(ex, 200, Map.of("success", true, "reason", reason));
    }

    /**
     * POST /api/server/ban — ban un joueur (utilise BanList Bukkit).
     * Body : { uuid?: string, player?: string, reason: string, durationMs?: number }
     * durationMs absent ou 0 = ban permanent. Sinon ban temporaire.
     * Permission : MODERATE_PLAYERS (MOD+ par défaut).
     */
    @SuppressWarnings("deprecation")
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

        var future = new CompletableFuture<String>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            String targetName = pname;
            if (uuid != null && !uuid.isBlank()) {
                try {
                    var off = Bukkit.getOfflinePlayer(java.util.UUID.fromString(uuid));
                    if (off != null && off.getName() != null) targetName = off.getName();
                } catch (Exception ignored) {}
            }
            if (targetName == null || targetName.isBlank()) { future.complete(null); return; }

            java.util.Date expires = (durationMs > 0)
                    ? new java.util.Date(System.currentTimeMillis() + durationMs)
                    : null;

            // BanList.Type.NAME (legacy mais marche partout)
            Bukkit.getBanList(org.bukkit.BanList.Type.NAME)
                    .addBan(targetName, reason, expires, user.username());

            // Kick si online
            Player p = Bukkit.getPlayerExact(targetName);
            if (p != null) p.kickPlayer("§cVous avez été banni : §f" + reason);

            plugin.getLogger().info("[Dashboard] Ban par " + user.username() + " : " + targetName +
                    " (durée " + (durationMs > 0 ? durationMs + "ms" : "permanent") + ") — " + reason);
            future.complete(targetName);
        });

        String banned = future.join();
        if (banned == null) { HttpHelper.error(ex, 404, "Joueur introuvable"); return; }
        HttpHelper.json(ex, 200, Map.of(
                "success", true,
                "player", banned,
                "reason", reason,
                "permanent", durationMs == 0
        ));
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
