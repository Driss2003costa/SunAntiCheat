package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.violations.ViolationPointsService;

import java.io.IOException;
import java.util.*;

/**
 * Endpoints violation-points :
 *   GET  /api/violations/top            → top 50 joueurs par points (MODERATE_PLAYERS)
 *   GET  /api/players/{name}/violations → points + historique d'un joueur (MODERATE_PLAYERS)
 *   POST /api/violations/{uuid}/reset   → reset points (ADMIN)
 */
public final class ViolationPointsHandler {

    private final ViolationPointsService service;

    public ViolationPointsHandler(ViolationPointsService service) {
        this.service = service;
    }

    public void top(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.MODERATE_PLAYERS)) return;

        int limit = 50;
        String q = ex.getRequestURI().getQuery();
        if (q != null) {
            for (String param : q.split("&")) {
                if (param.startsWith("limit=")) {
                    try { limit = Math.min(100, Integer.parseInt(param.substring(6))); } catch (NumberFormatException ignored) {}
                }
            }
        }
        HttpHelper.json(ex, 200, Map.of("offenders", service.store().topOffenders(limit)));
    }

    public void playerViolations(HttpExchange ex, JwtUtil jwt,
                                  Map<String, DashboardUser> users, String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.MODERATE_PLAYERS)) return;

        @SuppressWarnings("deprecation")
        OfflinePlayer off = Bukkit.getOfflinePlayer(playerName);
        if (off.getUniqueId() == null) {
            HttpHelper.json(ex, 200, Map.of("playerName", playerName, "total", 0, "events", List.of()));
            return;
        }
        String uuid = off.getUniqueId().toString();
        int total = service.getPoints(uuid);
        List<Map<String, Object>> events = service.store().eventsForPlayer(uuid, 50);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("playerName", playerName);
        result.put("uuid",       uuid);
        result.put("total",      total);
        result.put("events",     events);
        HttpHelper.json(ex, 200, result);
    }

    public void reset(HttpExchange ex, JwtUtil jwt,
                      Map<String, DashboardUser> users, String uuid) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.MODERATE_PLAYERS)) return;

        service.resetPlayer(uuid);
        sunanticheat.dashboard.audit.Audit.log(u, ex, "VIOLATION_POINTS_RESET", uuid,
                "Points de violation réinitialisés par " + u.username());
        HttpHelper.json(ex, 200, Map.of("ok", true, "uuid", uuid));
    }
}
