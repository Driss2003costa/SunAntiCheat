package sunanticheat.dashboard.jobs;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Stockage SQL des données Jobs (Jobs Reborn).
 *
 * Deux tables :
 *  - `jobs_payments` : chaque paiement reçu par un joueur (append-only, indexé)
 *  - `jobs_events`   : join / leave / levelup d'un joueur sur un job
 *
 * Les jobs eux-mêmes (config) ne sont PAS stockés ici — on les lit en live
 * depuis Jobs Reborn API (`Jobs.getJobs()`).
 *
 * Rétention : 90 jours sur jobs_payments (purge au boot).
 */
public final class JobsStore {

    private static final long RETENTION_MS = 90L * 86400 * 1000;

    private final Database db;
    private final Logger logger;

    public JobsStore(Database db, Logger logger) {
        this.db = db;
        this.logger = logger;
        initSchema();
        purgeOld();
    }

    private void initSchema() {
        db.migrate("jobs", 1, """
            CREATE TABLE IF NOT EXISTS jobs_payments (
                id          VARCHAR(64) NOT NULL PRIMARY KEY,
                ts          BIGINT      NOT NULL,
                player_uuid VARCHAR(64),
                player_name VARCHAR(64),
                job_name    VARCHAR(64) NOT NULL,
                amount      DOUBLE      NOT NULL,
                exp         DOUBLE      NOT NULL,
                action_type VARCHAR(64)
            );
            CREATE INDEX idx_jobs_pay_ts     ON jobs_payments(ts);
            CREATE INDEX idx_jobs_pay_player ON jobs_payments(player_uuid);
            CREATE INDEX idx_jobs_pay_job    ON jobs_payments(job_name);
            CREATE TABLE IF NOT EXISTS jobs_events (
                id          VARCHAR(64) NOT NULL PRIMARY KEY,
                ts          BIGINT      NOT NULL,
                player_uuid VARCHAR(64),
                player_name VARCHAR(64),
                job_name    VARCHAR(64) NOT NULL,
                event_type  VARCHAR(16) NOT NULL,
                level       INTEGER
            );
            CREATE INDEX idx_jobs_evt_ts     ON jobs_events(ts);
            CREATE INDEX idx_jobs_evt_player ON jobs_events(player_uuid);
            """);
    }

    private void purgeOld() {
        long cutoff = System.currentTimeMillis() - RETENTION_MS;
        try (PreparedStatement ps = db.conn().prepareStatement("DELETE FROM jobs_payments WHERE ts < ?")) {
            ps.setLong(1, cutoff);
            int n = ps.executeUpdate();
            if (n > 0) logger.info("[Jobs] Purge: " + n + " paiements > 90j supprimés");
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Jobs] purge erreur", e);
        }
    }

    // ── Inserts ──────────────────────────────────────────────────────────────

    public synchronized void recordPayment(String playerUuid, String playerName, String jobName,
                                           double amount, double exp, String actionType) {
        if (jobName == null) return;
        try (PreparedStatement ps = db.conn().prepareStatement(
                "REPLACE INTO jobs_payments(id, ts, player_uuid, player_name, job_name, amount, exp, action_type) "
              + "VALUES(?,?,?,?,?,?,?,?)")) {
            ps.setString(1, UUID.randomUUID().toString());
            ps.setLong  (2, System.currentTimeMillis());
            ps.setString(3, playerUuid);
            ps.setString(4, playerName);
            ps.setString(5, jobName);
            ps.setDouble(6, amount);
            ps.setDouble(7, exp);
            ps.setString(8, actionType);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Jobs] recordPayment erreur", e);
        }
    }

    public synchronized void recordEvent(String playerUuid, String playerName, String jobName,
                                         String eventType, int level) {
        if (jobName == null || eventType == null) return;
        try (PreparedStatement ps = db.conn().prepareStatement(
                "REPLACE INTO jobs_events(id, ts, player_uuid, player_name, job_name, event_type, level) "
              + "VALUES(?,?,?,?,?,?,?)")) {
            ps.setString(1, UUID.randomUUID().toString());
            ps.setLong  (2, System.currentTimeMillis());
            ps.setString(3, playerUuid);
            ps.setString(4, playerName);
            ps.setString(5, jobName);
            ps.setString(6, eventType);
            ps.setInt   (7, level);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Jobs] recordEvent erreur", e);
        }
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    /** Historique paginé (events + payments groupés ?), ici juste events. */
    public synchronized List<Map<String, Object>> history(int limit, int offset) {
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT ts, player_uuid, player_name, job_name, event_type, level "
              + "FROM jobs_events ORDER BY ts DESC LIMIT ? OFFSET ?")) {
            ps.setInt(1, Math.max(1, limit));
            ps.setInt(2, Math.max(0, offset));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("timestamp", rs.getLong("ts"));
                    m.put("playerUuid", rs.getString("player_uuid"));
                    m.put("playerName", rs.getString("player_name"));
                    m.put("jobName", rs.getString("job_name"));
                    m.put("eventType", rs.getString("event_type"));
                    m.put("level", rs.getInt("level"));
                    out.add(m);
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Jobs] history erreur", e);
        }
        return out;
    }

    /** Total gagné par job (server-wide), depuis N jours. */
    public synchronized List<Map<String, Object>> totalsByJob(int sinceDays) {
        long since = System.currentTimeMillis() - sinceDays * 86400_000L;
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT job_name, "
              + "       COUNT(*)     AS payments_count, "
              + "       COUNT(DISTINCT player_uuid) AS unique_players, "
              + "       COALESCE(SUM(amount), 0) AS total_money, "
              + "       COALESCE(SUM(exp), 0)    AS total_exp "
              + "FROM jobs_payments WHERE ts >= ? "
              + "GROUP BY job_name ORDER BY total_money DESC")) {
            ps.setLong(1, since);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("jobName", rs.getString("job_name"));
                    m.put("payments", rs.getInt("payments_count"));
                    m.put("uniquePlayers", rs.getInt("unique_players"));
                    m.put("totalMoney", round(rs.getDouble("total_money")));
                    m.put("totalExp", round(rs.getDouble("total_exp")));
                    out.add(m);
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Jobs] totalsByJob erreur", e);
        }
        return out;
    }

    /** Top joueurs par revenus (cross-jobs), depuis N jours. */
    public synchronized List<Map<String, Object>> topPlayers(int sinceDays, int limit) {
        long since = System.currentTimeMillis() - sinceDays * 86400_000L;
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT player_uuid, player_name, "
              + "       COALESCE(SUM(amount), 0) AS total_money, "
              + "       COUNT(*)                AS payments_count "
              + "FROM jobs_payments WHERE ts >= ? "
              + "GROUP BY player_uuid, player_name "
              + "ORDER BY total_money DESC LIMIT ?")) {
            ps.setLong(1, since);
            ps.setInt(2, Math.max(1, limit));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("playerUuid", rs.getString("player_uuid"));
                    m.put("playerName", rs.getString("player_name"));
                    m.put("totalMoney", round(rs.getDouble("total_money")));
                    m.put("payments", rs.getInt("payments_count"));
                    out.add(m);
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Jobs] topPlayers erreur", e);
        }
        return out;
    }

    /** Détails revenus d'un joueur (par job). */
    public synchronized List<Map<String, Object>> playerEarnings(String playerName, int sinceDays) {
        long since = System.currentTimeMillis() - sinceDays * 86400_000L;
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT job_name, "
              + "       COALESCE(SUM(amount), 0) AS total_money, "
              + "       COALESCE(SUM(exp), 0)    AS total_exp, "
              + "       COUNT(*) AS payments_count "
              + "FROM jobs_payments WHERE LOWER(player_name) = LOWER(?) AND ts >= ? "
              + "GROUP BY job_name ORDER BY total_money DESC")) {
            ps.setString(1, playerName);
            ps.setLong  (2, since);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("jobName", rs.getString("job_name"));
                    m.put("totalMoney", round(rs.getDouble("total_money")));
                    m.put("totalExp", round(rs.getDouble("total_exp")));
                    m.put("payments", rs.getInt("payments_count"));
                    out.add(m);
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Jobs] playerEarnings erreur", e);
        }
        return out;
    }

    /** Revenus globaux par jour (N derniers jours, tous jobs confondus). */
    public synchronized Map<String, Object> moneyOverTime(int days) {
        List<String> labels = new ArrayList<>();
        List<Double> data = new ArrayList<>();
        long now = System.currentTimeMillis();
        for (int i = days - 1; i >= 0; i--) {
            long start = now - (i + 1) * 86400_000L;
            long end   = now - i * 86400_000L;
            double total = 0;
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "SELECT COALESCE(SUM(amount), 0) FROM jobs_payments WHERE ts >= ? AND ts < ?")) {
                ps.setLong(1, start);
                ps.setLong(2, end);
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) total = rs.getDouble(1); }
            } catch (SQLException e) {
                logger.log(Level.WARNING, "[Jobs] moneyOverTime erreur", e);
            }
            labels.add(java.time.LocalDate.now().minusDays(i).toString().substring(5)); // MM-DD
            data.add(round(total));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("labels", labels);
        out.put("data", data);
        return out;
    }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
