package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.playtime.PlaytimeTracker;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * GET /api/playtime/top?limit=20    — classement des joueurs par temps de jeu
 * GET /api/playtime/player/{name}   — temps de jeu d'un joueur
 */
public final class PlaytimeHandler {

    private final PlaytimeTracker tracker;

    public PlaytimeHandler(PlaytimeTracker tracker) {
        this.tracker = tracker;
    }

    public void top(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int limit = Math.max(1, Math.min(200, HttpHelper.queryInt(ex, "limit", 20)));
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<UUID, Long> e : tracker.getTopPlaytimes(limit)) {
            OfflinePlayer op = Bukkit.getOfflinePlayer(e.getKey());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("playerUuid", e.getKey().toString());
            m.put("playerName", op.getName() != null ? op.getName() : "?");
            m.put("seconds", e.getValue());
            m.put("formatted", PlaytimeTracker.formatPlaytime(e.getValue()));
            m.put("online", op.isOnline());
            out.add(m);
        }
        HttpHelper.json(ex, 200, out);
    }

    public void player(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                       String name) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        OfflinePlayer op = Bukkit.getOfflinePlayerIfCached(name);
        if (op == null) op = Bukkit.getOfflinePlayer(name);
        long seconds = tracker.getTotalPlaytimeSeconds(op.getUniqueId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("playerUuid", op.getUniqueId().toString());
        m.put("playerName", op.getName() != null ? op.getName() : name);
        m.put("seconds", seconds);
        m.put("formatted", PlaytimeTracker.formatPlaytime(seconds));
        m.put("online", op.isOnline());
        HttpHelper.json(ex, 200, m);
    }
}
