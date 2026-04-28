package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.playerlog.PlayerLogEntry;
import sunanticheat.dashboard.playerlog.PlayerLogStore;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Endpoints /api/players/:name/log/* — log d'activité par joueur.
 *
 *  GET  /api/players/:name/log/categories         → grille principale (compteurs par cat)
 *  GET  /api/players/:name/log?category=&since=&limit=&offset=  → timeline filtrée
 *  POST /api/players/:name/log/clear              → vide pour ce joueur (ADMIN)
 */
public final class PlayerLogHandler {

    private final PlayerLogStore store;

    public PlayerLogHandler(PlayerLogStore store) {
        this.store = store;
    }

    public void categories(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                            String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        long sinceDays = HttpHelper.queryInt(ex, "days", 30);
        long sinceMs = System.currentTimeMillis() - sinceDays * 86_400_000L;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("playerName", playerName);
        out.put("days", sinceDays);
        out.put("categories", store.categoryCounts(playerName, sinceMs));
        out.put("totalEntries", store.count(playerName, null, sinceMs));
        HttpHelper.json(ex, 200, out);
    }

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                      String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        String category = HttpHelper.queryParam(ex, "category");
        long sinceDays = HttpHelper.queryInt(ex, "days", 30);
        int limit = Math.max(1, Math.min(500, HttpHelper.queryInt(ex, "limit", 200)));
        int offset = Math.max(0, HttpHelper.queryInt(ex, "offset", 0));
        long sinceMs = System.currentTimeMillis() - sinceDays * 86_400_000L;

        List<PlayerLogEntry> entries = store.list(playerName, category, sinceMs, limit, offset);
        int total = store.count(playerName, category, sinceMs);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entries", entries);
        out.put("total", total);
        out.put("limit", limit);
        out.put("offset", offset);
        out.put("hasMore", offset + entries.size() < total);
        HttpHelper.json(ex, 200, out);
    }

    public void clear(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                       String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        int n = store.clearForPlayer(playerName);
        HttpHelper.json(ex, 200, Map.of("success", true, "deleted", n));
    }
}
