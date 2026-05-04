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

        db.migrate("custom_jobs", 2, """
            ALTER TABLE custom_job_players ADD COLUMN prestige_stars INTEGER NOT NULL DEFAULT 0""");

        db.migrate("custom_jobs", 3, """
            CREATE TABLE IF NOT EXISTS custom_job_tickets (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid        TEXT NOT NULL,
                type        TEXT NOT NULL,
                expires_at  INTEGER NOT NULL,
                granted_by  TEXT NOT NULL,
                granted_at  INTEGER NOT NULL,
                consumed_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_cjt_uuid    ON custom_job_tickets(uuid);
            CREATE INDEX IF NOT EXISTS idx_cjt_expires ON custom_job_tickets(expires_at);
            CREATE TABLE IF NOT EXISTS custom_job_regulator (
                ts         INTEGER NOT NULL,
                job_id     TEXT NOT NULL,
                share      REAL NOT NULL,
                multiplier REAL NOT NULL,
                PRIMARY KEY(ts, job_id)
            )""");
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

    /** Reset level/xp to 1/0 and increment prestige_stars. Returns the new star count, or -1 on error. */
    public int prestige(String uuid, String jobId) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE custom_job_players SET level=1, xp=0, prestige_stars=prestige_stars+1 WHERE uuid=? AND job_id=?")) {
            ps.setString(1, uuid); ps.setString(2, jobId);
            if (ps.executeUpdate() == 0) return -1;
        } catch (SQLException e) { logger.warning("[Jobs] prestige: " + e.getMessage()); return -1; }
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT prestige_stars FROM custom_job_players WHERE uuid=? AND job_id=?")) {
            ps.setString(1, uuid); ps.setString(2, jobId);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getInt(1) : -1; }
        } catch (SQLException e) { return -1; }
    }

    /** Distribution {jobId: count} of unique players currently in each job. */
    public Map<String, Integer> jobDistribution() {
        Map<String, Integer> m = new LinkedHashMap<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT job_id, COUNT(DISTINCT uuid) AS n FROM custom_job_players GROUP BY job_id");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) m.put(rs.getString("job_id"), rs.getInt("n"));
        } catch (SQLException e) { logger.warning("[Jobs] jobDistribution: " + e.getMessage()); }
        return m;
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

    /**
     * Timeline d'XP gagné par jour pour un joueur sur un métier (last N days).
     * Retourne une liste {day_ts, xp, money, actions}, triée chronologiquement.
     */
    public List<Map<String, Object>> playerTimeline(String uuid, String jobId, int days) {
        List<Map<String, Object>> list = new ArrayList<>();
        long since = System.currentTimeMillis() - (days * 86_400_000L);
        // Date(timestamp/1000, 'unixepoch') marche aussi en MySQL via FROM_UNIXTIME ;
        // pour rester portable on bucketise côté Java.
        Map<Long, double[]> buckets = new TreeMap<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT timestamp, xp_gained, money_gained FROM custom_job_history " +
                "WHERE uuid=? AND job_id=? AND timestamp >= ? ORDER BY timestamp ASC")) {
            ps.setString(1, uuid); ps.setString(2, jobId); ps.setLong(3, since);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long ts = rs.getLong("timestamp");
                    long day = (ts / 86_400_000L) * 86_400_000L; // bucket UTC day
                    double[] b = buckets.computeIfAbsent(day, k -> new double[]{0, 0, 0});
                    b[0] += rs.getDouble("xp_gained");
                    b[1] += rs.getDouble("money_gained");
                    b[2] += 1;
                }
            }
        } catch (SQLException e) { logger.warning("[Jobs] playerTimeline: " + e.getMessage()); }

        for (var e : buckets.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("day_ts",  e.getKey());
            m.put("xp",      e.getValue()[0]);
            m.put("money",   e.getValue()[1]);
            m.put("actions", (long) e.getValue()[2]);
            list.add(m);
        }
        return list;
    }

    /** Top des cibles (matériau/entité) pour un joueur sur un métier. */
    public List<Map<String, Object>> playerTopTargets(String uuid, String jobId, int limit) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT target, COUNT(*) AS actions, SUM(xp_gained) AS xp, SUM(money_gained) AS money " +
                "FROM custom_job_history WHERE uuid=? AND job_id=? GROUP BY target ORDER BY actions DESC LIMIT ?")) {
            ps.setString(1, uuid); ps.setString(2, jobId); ps.setInt(3, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("target",  rs.getString("target"));
                    m.put("actions", rs.getLong("actions"));
                    m.put("xp",      rs.getDouble("xp"));
                    m.put("money",   rs.getDouble("money"));
                    list.add(m);
                }
            }
        } catch (SQLException e) { logger.warning("[Jobs] playerTopTargets: " + e.getMessage()); }
        return list;
    }

    /**
     * XP/heure moyenne sur les N derniers jours (basé sur l'historique).
     * Utile pour calculer la projection de progression côté portail.
     */
    public double playerXpPerHour(String uuid, String jobId, int days) {
        long since = System.currentTimeMillis() - (days * 86_400_000L);
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT COALESCE(SUM(xp_gained), 0) AS total_xp, " +
                "       COALESCE(MAX(timestamp), 0) AS last_ts, " +
                "       COALESCE(MIN(timestamp), 0) AS first_ts " +
                "FROM custom_job_history WHERE uuid=? AND job_id=? AND timestamp >= ?")) {
            ps.setString(1, uuid); ps.setString(2, jobId); ps.setLong(3, since);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    double xp = rs.getDouble("total_xp");
                    long span = rs.getLong("last_ts") - rs.getLong("first_ts");
                    if (span <= 0) return 0;
                    double hours = span / 3_600_000.0;
                    return hours > 0 ? xp / hours : 0;
                }
            }
        } catch (SQLException e) { logger.warning("[Jobs] playerXpPerHour: " + e.getMessage()); }
        return 0;
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
        m.put("uuid",           rs.getString("uuid"));
        m.put("job_id",         rs.getString("job_id"));
        m.put("xp",             rs.getDouble("xp"));
        m.put("level",          rs.getInt("level"));
        m.put("total_earned",   rs.getDouble("total_earned"));
        m.put("joined_at",      rs.getLong("joined_at"));
        try { m.put("prestige_stars", rs.getInt("prestige_stars")); }
        catch (SQLException ignored) { m.put("prestige_stars", 0); }
        return m;
    }
}
