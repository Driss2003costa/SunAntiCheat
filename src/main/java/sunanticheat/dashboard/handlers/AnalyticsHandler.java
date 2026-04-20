package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.analytics.SnapshotStore;

import java.io.IOException;
import java.util.Map;

public final class AnalyticsHandler {

    private final SnapshotStore store;

    public AnalyticsHandler(SnapshotStore store) {
        this.store = store;
    }

    /** GET /api/analytics/connections?days=7 */
    public void connections(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 7);
        HttpHelper.json(ex, 200, store.connectionsPerDay(days));
    }

    /** GET /api/analytics/session-duration?days=7 */
    public void sessionDuration(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 7);
        HttpHelper.json(ex, 200, store.avgSessionPerDay(days));
    }

    /** GET /api/analytics/new-players?days=7 */
    public void newPlayers(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 7);
        HttpHelper.json(ex, 200, store.firstJoinsPerDay(days));
    }

    /** GET /api/analytics/tps?days=7 */
    public void tps(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 7);
        HttpHelper.json(ex, 200, store.tpsPerDay(days));
    }

    /** GET /api/analytics/ram?days=7 */
    public void ram(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 7);
        HttpHelper.json(ex, 200, store.ramPerDay(days));
    }

    /** GET /api/analytics/alerts?days=7 */
    public void alertsChart(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 7);
        HttpHelper.json(ex, 200, store.alertsPerDay(days));
    }
}
