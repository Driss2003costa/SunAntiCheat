package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.db.Database;
import sunanticheat.dashboard.portal.PortalActivityStore;

import java.io.IOException;
import java.sql.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class PortalActivityHandler {

    private final PortalActivityStore store;
    private final Database db;
    private final Logger   logger;

    public PortalActivityHandler(PortalActivityStore store, Database db, Logger logger) {
        this.store  = store;
        this.db     = db;
        this.logger = logger;
    }

    /** GET /api/portal/activity/logins */
    public void logins(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        String uuidFilter  = HttpHelper.queryParam(ex, "uuid");
        boolean successOnly = "1".equals(HttpHelper.queryParam(ex, "success"));
        int limit  = HttpHelper.queryInt(ex, "limit",  100);
        int offset = HttpHelper.queryInt(ex, "offset", 0);
        List<Map<String, Object>> rows = store.listLogins(uuidFilter, successOnly, limit, offset);
        HttpHelper.json(ex, 200, Map.of("logins", rows, "count", rows.size()));
    }

    /** GET /api/portal/activity/pageviews */
    public void pageViews(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        String uuidFilter  = HttpHelper.queryParam(ex, "uuid");
        String routeFilter = HttpHelper.queryParam(ex, "route");
        int limit  = HttpHelper.queryInt(ex, "limit",  200);
        int offset = HttpHelper.queryInt(ex, "offset", 0);
        List<Map<String, Object>> rows = store.listPageViews(uuidFilter, routeFilter, limit, offset);
        HttpHelper.json(ex, 200, Map.of("pageviews", rows, "count", rows.size()));
    }

    /** GET /api/portal/activity/referrals */
    public void referrals(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int limit  = HttpHelper.queryInt(ex, "limit",  100);
        int offset = HttpHelper.queryInt(ex, "offset", 0);

        List<Map<String, Object>> rows = new ArrayList<>();
        String sql = """
            SELECT ru.created_at, ru.code_used, ru.validated, ru.validated_at,
                   pa_ref.username  AS referred_name,
                   pa_own.username  AS referrer_name,
                   ru.referrer_uuid, ru.referred_uuid
            FROM referral_uses ru
            LEFT JOIN player_accounts pa_ref ON pa_ref.uuid = ru.referred_uuid
            LEFT JOIN player_accounts pa_own ON pa_own.uuid = ru.referrer_uuid
            ORDER BY ru.created_at DESC
            LIMIT ? OFFSET ?
            """;
        try (PreparedStatement ps = db.conn().prepareStatement(sql)) {
            ps.setInt(1, Math.max(1, limit));
            ps.setInt(2, Math.max(0, offset));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("ts",            rs.getLong("created_at"));
                    row.put("code",          rs.getString("code_used"));
                    row.put("validated",     rs.getInt("validated") == 1);
                    row.put("validated_at",  rs.getObject("validated_at"));
                    row.put("referred_uuid", rs.getString("referred_uuid"));
                    row.put("referred_name", rs.getString("referred_name"));
                    row.put("referrer_uuid", rs.getString("referrer_uuid"));
                    row.put("referrer_name", rs.getString("referrer_name"));
                    rows.add(row);
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[PortalActivity] referrals query", e);
        }

        List<Map<String, Object>> topReferrers = new ArrayList<>();
        String topSql = """
            SELECT pa.username, COUNT(*) AS cnt
            FROM referral_uses ru
            LEFT JOIN player_accounts pa ON pa.uuid = ru.referrer_uuid
            GROUP BY ru.referrer_uuid
            ORDER BY cnt DESC
            LIMIT 10
            """;
        try (PreparedStatement ps = db.conn().prepareStatement(topSql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String name = rs.getString("username");
                topReferrers.add(Map.of(
                    "username", name != null ? name : "?",
                    "count",    rs.getLong("cnt")));
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[PortalActivity] topReferrers query", e);
        }

        HttpHelper.json(ex, 200, Map.of(
            "referrals",     rows,
            "count",         rows.size(),
            "top_referrers", topReferrers));
    }

    /** GET /api/portal/activity/stats */
    public void stats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        HttpHelper.json(ex, 200, store.stats());
    }
}
