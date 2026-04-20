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

    /** POST /api/server/command  — ADMIN seulement */
    public void command(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

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

    /** POST /api/server/worlds/{name}/pvp — toggle PvP d'un monde */
    public void togglePvp(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String worldName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

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
