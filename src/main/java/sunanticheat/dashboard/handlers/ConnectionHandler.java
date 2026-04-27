package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import sunanticheat.connection.ConnectionLogStorage;
import sunanticheat.connection.ConnectionLogStorage.ConnectionSession;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET /api/connections/player/{name}?limit=20 — historique des connexions d'un joueur
 */
public final class ConnectionHandler {

    private final ConnectionLogStorage storage;

    public ConnectionHandler(ConnectionLogStorage storage) {
        this.storage = storage;
    }

    public void player(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                       String name) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int limit = Math.max(1, Math.min(100, HttpHelper.queryInt(ex, "limit", 20)));

        OfflinePlayer op = Bukkit.getOfflinePlayer(name);
        List<ConnectionSession> sessions = storage.getSessions(op.getUniqueId(), limit);

        List<Map<String, Object>> sessionList = new ArrayList<>();
        for (ConnectionSession s : sessions) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ip", s.getIp());
            m.put("joinTime", s.getJoinTime());
            m.put("leaveTime", s.getLeaveTime());
            long duration = s.getLeaveTime() > 0
                    ? (s.getLeaveTime() - s.getJoinTime()) / 1000
                    : (System.currentTimeMillis() - s.getJoinTime()) / 1000;
            m.put("durationSeconds", Math.max(0, duration));
            m.put("online", s.getLeaveTime() == 0);
            sessionList.add(m);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("playerName", op.getName() != null ? op.getName() : name);
        out.put("playerUuid", op.getUniqueId().toString());
        out.put("sessions", sessionList);
        out.put("count", sessionList.size());
        HttpHelper.json(ex, 200, out);
    }
}
