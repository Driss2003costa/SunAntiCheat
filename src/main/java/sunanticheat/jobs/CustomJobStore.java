package sunanticheat.jobs;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.*;
import java.util.logging.Logger;

public final class CustomJobStore {

    private final Database db;
    private final Logger logger;

    public CustomJobStore(Database db, Logger logger) {
        this.db = db;
        this.logger = logger;
        migrate();
    }

    private void migrate() {
        db.migrate("custom_jobs", 1, """
            CREATE TABLE IF NOT EXISTS custom_job_players (
                uuid        TEXT NOT NULL,
                job_id      TEXT NOT NULL,
                xp          REAL NOT NULL DEFAULT 0,
                level       INTEGER NOT NULL DEFAULT 1,
                total_earned REAL NOT NULL DEFAULT 0,
                joined_at   INTEGER NOT NULL,
                PRIMARY KEY(uuid, job_id)
            );
            CREATE TABLE IF NOT EXISTS custom_job_history (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid         TEXT NOT NULL,
                player_name  TEXT NOT NULL,
                job_id       TEXT NOT NULL,
                action_type  TEXT NOT NULL,
                target       TEXT NOT NULL,
                xp_gained    REAL NOT NULL,
                money_gained REAL NOT NULL,
                timestamp    INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_cjh_uuid ON custom_job_history(uuid);
            CREATE INDEX IF NOT EXISTS idx_cjh_job  ON custom_job_history(job_id)""");
    }

    // ── Player job data ───────────────────────────────────────────────────────

    public boolean hasJob(String uuid, String jobId) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT 1 FROM custom_job_players WHERE uuid=? AND job_id=?")) {
            ps.setString(1, uuid); ps.setString(2, jobId);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        } catch (SQLException e) { logger.warning("[Jobs] hasJob: " + e.getMessage()); return false; }
    }

    public void joinJob(String uuid, String jobId) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT OR IGNORE INTO custom_job_players(uuid,job_id,xp,level,total_earned,joined_at) VALUES(?,?,0,1,0,?)")) {
            ps.setString(1, uuid); ps.setString(2, jobId); ps.setLong(3, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (SQLException e) { logger.warning("[Jobs] joinJob: " + e.getMessage()); }
    }

    public void leaveJob(String uuid, String jobId) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "DELETE FROM custom_job_players WHERE uuid=? AND job_id=?")) {
            ps.setString(1, uuid); ps.setString(2, jobId);
            ps.executeUpdate();
        } catch (SQLException e) { logger.warning("[Jobs] leaveJob: " + e.getMessage()); }
    }

    public Map<String, Object> getPlayerJob(String uuid, String jobId) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM custom_job_players WHERE uuid=? AND job_id=?")) {
            ps.setString(1, uuid); ps.setString(2, jobId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return rowToMap(rs);
            }
        } catch (SQLException e) { logger.warning("[Jobs] getPlayerJob: " + e.getMessage()); return null; }
    }

    public List<Map<String, Object>> getPlayerJobs(String uuid) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM custom_job_players WHERE uuid=? ORDER BY job_id")) {
            ps.setString(1, uuid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(rowToMap(rs));
            }
        } catch (SQLException e) { logger.warning("[Jobs] getPlayerJobs: " + e.getMessage()); }
        return list;
    }

    public void addXpAndEarnings(String uuid, String jobId, double xp, double money) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE custom_job_players SET xp=xp+?, total_earned=total_earned+? WHERE uuid=? AND job_id=?")) {
            ps.setDouble(1, xp); ps.setDouble(2, money);
            ps.setString(3, uuid); ps.setString(4, jobId);
            ps.executeUpdate();
        } catch (SQLException e) { logger.warning("[Jobs] addXpAndEarnings: " + e.getMessage()); }
    }

    public void setLevel(String uuid, String jobId, int level) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE custom_job_players SET level=? WHERE uuid=? AND job_id=?")) {
            ps.setInt(1, level); ps.setString(2, uuid); ps.setString(3, jobId);
            ps.executeUpdate();
        } catch (SQLException e) { logger.warning("[Jobs] setLevel: " + e.getMessage()); }
    }

    // ── History ───────────────────────────────────────────────────────────────

    public void recordHistory(String uuid, String playerName, String jobId,
                               String actionType, String target,
                               double xpGained, double moneyGained) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT INTO custom_job_history(uuid,player_name,job_id,action_type,target,xp_gained,money_gained,timestamp) VALUES(?,?,?,?,?,?,?,?)")) {
            ps.setString(1, uuid); ps.setString(2, playerName); ps.setString(3, jobId);
            ps.setString(4, actionType); ps.setString(5, target);
            ps.setDouble(6, xpGained); ps.setDouble(7, moneyGained);
            ps.setLong(8, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (SQLException e) { logger.warning("[Jobs] recordHistory: " + e.getMessage()); }
    }

    // ── Leaderboard & stats ───────────────────────────────────────────────────

    public List<Map<String, Object>> leaderboard(String jobId, int limit) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM custom_job_players WHERE job_id=? ORDER BY level DESC, xp DESC LIMIT ?")) {
            ps.setString(1, jobId); ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(rowToMap(rs));
            }
        } catch (SQLException e) { logger.warning("[Jobs] leaderboard: " + e.getMessage()); }
        return list;
    }

    public List<Map<String, Object>> jobStats(String jobId) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT COUNT(*) as player_count, AVG(level) as avg_level, SUM(total_earned) as total_paid " +
                "FROM custom_job_players WHERE job_id=?")) {
            ps.setString(1, jobId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("player_count", rs.getInt("player_count"));
                    m.put("avg_level",    rs.getDouble("avg_level"));
                    m.put("total_paid",   rs.getDouble("total_paid"));
                    list.add(m);
                }
            }
        } catch (SQLException e) { logger.warning("[Jobs] jobStats: " + e.getMessage()); }
        return list;
    }

    public List<Map<String, Object>> recentHistory(String jobId, int limit) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM custom_job_history WHERE job_id=? ORDER BY timestamp DESC LIMIT ?")) {
            ps.setString(1, jobId); ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",          rs.getInt("id"));
                    m.put("uuid",        rs.getString("uuid"));
                    m.put("player_name", rs.getString("player_name"));
                    m.put("job_id",      rs.getString("job_id"));
                    m.put("action_type", rs.getString("action_type"));
                    m.put("target",      rs.getString("target"));
                    m.put("xp_gained",   rs.getDouble("xp_gained"));
                    m.put("money_gained",rs.getDouble("money_gained"));
                    m.put("timestamp",   rs.getLong("timestamp"));
                    list.add(m);
                }
            }
        } catch (SQLException e) { logger.warning("[Jobs] recentHistory: " + e.getMessage()); }
        return list;
    }

    // ── helper ────────────────────────────────────────────────────────────────

    private static Map<String, Object> rowToMap(ResultSet rs) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("uuid",         rs.getString("uuid"));
        m.put("job_id",       rs.getString("job_id"));
        m.put("xp",           rs.getDouble("xp"));
        m.put("level",        rs.getInt("level"));
        m.put("total_earned", rs.getDouble("total_earned"));
        m.put("joined_at",    rs.getLong("joined_at"));
        return m;
    }
}
