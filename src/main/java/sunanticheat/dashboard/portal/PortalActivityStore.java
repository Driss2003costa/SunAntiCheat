package sunanticheat.dashboard.portal;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Stocke les événements d'activité du portail joueur :
 *  - portal_logins    : chaque tentative de connexion (succès / échec)
 *  - portal_page_views: chaque appel API authentifié (proxy de navigation)
 *
 * Rétention : 100 000 entrées max par table (rotation FIFO).
 */
public final class PortalActivityStore {

    private static final int MAX_LOGINS    = 100_000;
    private static final int MAX_PAGEVIEWS = 200_000;
    private static final int CLEANUP_EVERY = 200;

    private final Database db;
    private final Logger   logger;
    private int loginsSinceClean    = 0;
    private int pageviewsSinceClean = 0;

    public PortalActivityStore(Database db, Logger logger) {
        this.db     = db;
        this.logger = logger;
        initSchema();
    }

    // ── Schema ────────────────────────────────────────────────────────────────

    private void initSchema() {
        db.migrate("portal_activity", 1, """
            CREATE TABLE IF NOT EXISTS portal_logins (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                ts       BIGINT      NOT NULL,
                uuid     VARCHAR(64),
                username VARCHAR(64) NOT NULL,
                ip       VARCHAR(64),
                success  TINYINT     NOT NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_pl_ts       ON portal_logins(ts);
            CREATE INDEX IF NOT EXISTS idx_pl_uuid     ON portal_logins(uuid);
            CREATE INDEX IF NOT EXISTS idx_pl_username ON portal_logins(username);

            CREATE TABLE IF NOT EXISTS portal_page_views (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                ts       BIGINT      NOT NULL,
                uuid     VARCHAR(64) NOT NULL,
                username VARCHAR(64),
                route    VARCHAR(255) NOT NULL,
                method   VARCHAR(8)  NOT NULL DEFAULT 'GET'
            );
            CREATE INDEX IF NOT EXISTS idx_ppv_ts    ON portal_page_views(ts);
            CREATE INDEX IF NOT EXISTS idx_ppv_uuid  ON portal_page_views(uuid);
            CREATE INDEX IF NOT EXISTS idx_ppv_route ON portal_page_views(route);
            """);
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    public synchronized void logLogin(String uuid, String username, String ip, boolean success) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT INTO portal_logins(ts, uuid, username, ip, success) VALUES(?,?,?,?,?)")) {
            ps.setLong  (1, System.currentTimeMillis());
            ps.setString(2, uuid);
            ps.setString(3, username);
            ps.setString(4, ip);
            ps.setInt   (5, success ? 1 : 0);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[PortalActivity] logLogin erreur", e);
            return;
        }
        if (++loginsSinceClean >= CLEANUP_EVERY) { loginsSinceClean = 0; rotateLogins(); }
    }

    public synchronized void logPageView(String uuid, String username, String route, String method) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT INTO portal_page_views(ts, uuid, username, route, method) VALUES(?,?,?,?,?)")) {
            ps.setLong  (1, System.currentTimeMillis());
            ps.setString(2, uuid);
            ps.setString(3, username);
            ps.setString(4, route);
            ps.setString(5, method);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[PortalActivity] logPageView erreur", e);
            return;
        }
        if (++pageviewsSinceClean >= CLEANUP_EVERY) { pageviewsSinceClean = 0; rotatePageViews(); }
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public synchronized List<Map<String, Object>> listLogins(
            String uuidFilter, boolean successOnly, int limit, int offset) {
        StringBuilder sql = new StringBuilder(
            "SELECT ts, uuid, username, ip, success FROM portal_logins WHERE 1=1 ");
        List<Object> args = new ArrayList<>();
        if (uuidFilter != null && !uuidFilter.isBlank()) {
            sql.append("AND (LOWER(uuid) = LOWER(?) OR LOWER(username) = LOWER(?)) ");
            args.add(uuidFilter); args.add(uuidFilter);
        }
        if (successOnly) { sql.append("AND success = 1 "); }
        sql.append("ORDER BY ts DESC LIMIT ? OFFSET ?");
        args.add(Math.max(1, limit)); args.add(Math.max(0, offset));
        return query(sql.toString(), args, rs -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("ts",       rs.getLong("ts"));
            row.put("uuid",     rs.getString("uuid"));
            row.put("username", rs.getString("username"));
            row.put("ip",       rs.getString("ip"));
            row.put("success",  rs.getInt("success") == 1);
            return row;
        });
    }

    public synchronized List<Map<String, Object>> listPageViews(
            String uuidFilter, String routeFilter, int limit, int offset) {
        StringBuilder sql = new StringBuilder(
            "SELECT ts, uuid, username, route, method FROM portal_page_views WHERE 1=1 ");
        List<Object> args = new ArrayList<>();
        if (uuidFilter != null && !uuidFilter.isBlank()) {
            sql.append("AND (LOWER(uuid) = LOWER(?) OR LOWER(username) = LOWER(?)) ");
            args.add(uuidFilter); args.add(uuidFilter);
        }
        if (routeFilter != null && !routeFilter.isBlank()) {
            sql.append("AND route LIKE ? ");
            args.add("%" + routeFilter + "%");
        }
        sql.append("ORDER BY ts DESC LIMIT ? OFFSET ?");
        args.add(Math.max(1, limit)); args.add(Math.max(0, offset));
        return query(sql.toString(), args, rs -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("ts",       rs.getLong("ts"));
            row.put("uuid",     rs.getString("uuid"));
            row.put("username", rs.getString("username"));
            row.put("route",    rs.getString("route"));
            row.put("method",   rs.getString("method"));
            return row;
        });
    }

    /** KPIs : DAU, MAU, top routes, top users (30 derniers jours). */
    public synchronized Map<String, Object> stats() {
        Map<String, Object> out = new LinkedHashMap<>();
        long now = System.currentTimeMillis();
        long day30 = now - 30L * 86_400_000L;
        long day1  = now -       86_400_000L;

        out.put("logins_today",   scalarLong("SELECT COUNT(*) FROM portal_logins WHERE ts >= ? AND success=1", day1));
        out.put("logins_30d",     scalarLong("SELECT COUNT(*) FROM portal_logins WHERE ts >= ? AND success=1", day30));
        out.put("failed_today",   scalarLong("SELECT COUNT(*) FROM portal_logins WHERE ts >= ? AND success=0", day1));
        out.put("pageviews_today",scalarLong("SELECT COUNT(*) FROM portal_page_views WHERE ts >= ?", day1));
        out.put("pageviews_30d",  scalarLong("SELECT COUNT(*) FROM portal_page_views WHERE ts >= ?", day30));

        // Unique active users today / 30d (by uuid in page_views)
        out.put("dau", scalarLong("SELECT COUNT(DISTINCT uuid) FROM portal_page_views WHERE ts >= ?", day1));
        out.put("mau", scalarLong("SELECT COUNT(DISTINCT uuid) FROM portal_page_views WHERE ts >= ?", day30));

        // DAU history 30j
        List<Map<String, Object>> dauHistory = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT (ts / 86400000) AS day_bucket, COUNT(DISTINCT uuid) AS cnt " +
                "FROM portal_page_views WHERE ts >= ? " +
                "GROUP BY day_bucket ORDER BY day_bucket ASC")) {
            ps.setLong(1, day30);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> pt = new LinkedHashMap<>();
                    pt.put("ts",  rs.getLong("day_bucket") * 86_400_000L);
                    pt.put("dau", rs.getLong("cnt"));
                    dauHistory.add(pt);
                }
            }
        } catch (SQLException e) { logger.log(Level.WARNING, "[PortalActivity] stats dau", e); }
        out.put("dau_history", dauHistory);

        // Top 10 routes 30d
        out.put("top_routes", query(
            "SELECT route, COUNT(*) AS cnt FROM portal_page_views WHERE ts >= ? " +
            "GROUP BY route ORDER BY cnt DESC LIMIT 10",
            List.of(day30),
            rs -> Map.of("route", rs.getString("route"), "count", rs.getLong("cnt"))));

        // Top 10 users 30d by pageviews
        out.put("top_users", query(
            "SELECT username, COUNT(*) AS cnt FROM portal_page_views WHERE ts >= ? AND username IS NOT NULL " +
            "GROUP BY username ORDER BY cnt DESC LIMIT 10",
            List.of(day30),
            rs -> Map.of("username", rs.getString("username"), "count", rs.getLong("cnt"))));

        return out;
    }

    // ── Rotation FIFO ─────────────────────────────────────────────────────────

    private void rotateLogins() {
        try {
            long cutoff = -1;
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "SELECT ts FROM portal_logins ORDER BY ts DESC LIMIT 1 OFFSET ?")) {
                ps.setInt(1, MAX_LOGINS);
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) cutoff = rs.getLong(1); }
            }
            if (cutoff < 0) return;
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "DELETE FROM portal_logins WHERE ts < ?")) {
                ps.setLong(1, cutoff); ps.executeUpdate();
            }
        } catch (SQLException e) { logger.log(Level.WARNING, "[PortalActivity] rotateLogins", e); }
    }

    private void rotatePageViews() {
        try {
            long cutoff = -1;
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "SELECT ts FROM portal_page_views ORDER BY ts DESC LIMIT 1 OFFSET ?")) {
                ps.setInt(1, MAX_PAGEVIEWS);
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) cutoff = rs.getLong(1); }
            }
            if (cutoff < 0) return;
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "DELETE FROM portal_page_views WHERE ts < ?")) {
                ps.setLong(1, cutoff); ps.executeUpdate();
            }
        } catch (SQLException e) { logger.log(Level.WARNING, "[PortalActivity] rotatePageViews", e); }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    @FunctionalInterface
    private interface RowMapper<T> { T map(ResultSet rs) throws SQLException; }

    private <T> List<T> query(String sql, List<Object> args, RowMapper<T> mapper) {
        List<T> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(sql)) {
            for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(mapper.map(rs)); }
        } catch (SQLException e) { logger.log(Level.WARNING, "[PortalActivity] query erreur", e); }
        return out;
    }

    private long scalarLong(String sql, long param) {
        try (PreparedStatement ps = db.conn().prepareStatement(sql)) {
            ps.setLong(1, param);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getLong(1) : 0; }
        } catch (SQLException e) { logger.log(Level.WARNING, "[PortalActivity] scalar erreur", e); return 0; }
    }
}
