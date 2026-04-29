package sunanticheat.dashboard.violations;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Persiste les points de violation par joueur et l'historique des événements.
 *
 * Table `violation_points` : score courant par UUID.
 * Table `violation_events` : historique de chaque point ajouté.
 */
public final class ViolationPointsStore {

    private final Database db;
    private final Logger logger;

    public ViolationPointsStore(Database db, Logger logger) {
        this.db = db;
        this.logger = logger;
        initSchema();
    }

    private void initSchema() {
        db.migrate("violation_points_v1", 1, """
            CREATE TABLE IF NOT EXISTS violation_points (
                uuid        VARCHAR(64) NOT NULL PRIMARY KEY,
                name        VARCHAR(64) NOT NULL,
                total       INTEGER     NOT NULL DEFAULT 0,
                last_event  BIGINT      NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS violation_events (
                id          VARCHAR(64) NOT NULL PRIMARY KEY,
                uuid        VARCHAR(64) NOT NULL,
                name        VARCHAR(64) NOT NULL,
                check_type  VARCHAR(32) NOT NULL,
                pts_added   INTEGER     NOT NULL,
                total_after INTEGER     NOT NULL,
                ts          BIGINT      NOT NULL
            );
            CREATE INDEX idx_vpts_total ON violation_points(total);
            CREATE INDEX idx_ve_uuid    ON violation_events(uuid);
            CREATE INDEX idx_ve_ts      ON violation_events(ts)
            """);
    }

    /** Ajoute des points et insère un événement. Retourne le nouveau total. */
    public synchronized int addPoints(String uuid, String name, String checkType, int pts) {
        long now = System.currentTimeMillis();
        try {
            try (PreparedStatement up = db.conn().prepareStatement(
                    "UPDATE violation_points SET name=?, total=total+?, last_event=? WHERE uuid=?")) {
                up.setString(1, name);
                up.setInt(2, pts);
                up.setLong(3, now);
                up.setString(4, uuid);
                if (up.executeUpdate() == 0) {
                    try (PreparedStatement ins = db.conn().prepareStatement(
                            "INSERT INTO violation_points(uuid,name,total,last_event) VALUES(?,?,?,?)")) {
                        ins.setString(1, uuid);
                        ins.setString(2, name);
                        ins.setInt(3, pts);
                        ins.setLong(4, now);
                        ins.executeUpdate();
                    }
                }
            }
            int newTotal = getPoints(uuid);
            try (PreparedStatement ins = db.conn().prepareStatement(
                    "INSERT INTO violation_events(id,uuid,name,check_type,pts_added,total_after,ts) VALUES(?,?,?,?,?,?,?)")) {
                ins.setString(1, java.util.UUID.randomUUID().toString());
                ins.setString(2, uuid);
                ins.setString(3, name);
                ins.setString(4, checkType);
                ins.setInt(5, pts);
                ins.setInt(6, newTotal);
                ins.setLong(7, now);
                ins.executeUpdate();
            }
            return newTotal;
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[ViolationPoints] addPoints erreur", e);
            return 0;
        }
    }

    public synchronized int getPoints(String uuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT total FROM violation_points WHERE uuid=?")) {
            ps.setString(1, uuid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt("total");
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[ViolationPoints] getPoints erreur", e);
        }
        return 0;
    }

    public synchronized void resetPoints(String uuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE violation_points SET total=0, last_event=? WHERE uuid=?")) {
            ps.setLong(1, System.currentTimeMillis());
            ps.setString(2, uuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[ViolationPoints] resetPoints erreur", e);
        }
    }

    /** Top N joueurs par points (décroissant). */
    public synchronized List<Map<String, Object>> topOffenders(int limit) {
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT uuid, name, total, last_event FROM violation_points " +
                "WHERE total > 0 ORDER BY total DESC LIMIT ?")) {
            ps.setInt(1, Math.max(1, limit));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("uuid",      rs.getString("uuid"));
                    m.put("name",      rs.getString("name"));
                    m.put("total",     rs.getInt("total"));
                    m.put("lastEvent", rs.getLong("last_event"));
                    out.add(m);
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[ViolationPoints] topOffenders erreur", e);
        }
        return out;
    }

    /** Historique des événements pour un joueur (plus récents en premier). */
    public synchronized List<Map<String, Object>> eventsForPlayer(String uuid, int limit) {
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT id, check_type, pts_added, total_after, ts FROM violation_events " +
                "WHERE uuid=? ORDER BY ts DESC LIMIT ?")) {
            ps.setString(1, uuid);
            ps.setInt(2, Math.max(1, limit));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",         rs.getString("id"));
                    m.put("checkType",  rs.getString("check_type"));
                    m.put("ptsAdded",   rs.getInt("pts_added"));
                    m.put("totalAfter", rs.getInt("total_after"));
                    m.put("ts",         rs.getLong("ts"));
                    out.add(m);
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[ViolationPoints] eventsForPlayer erreur", e);
        }
        return out;
    }
}
