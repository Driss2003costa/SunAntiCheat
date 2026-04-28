package sunanticheat.dashboard.playerlog;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Store SQL des entrées du log d'activité joueur.
 *
 * Schema : table `player_log` indexée sur (player_uuid, ts DESC) pour récupérer
 * en O(log N) l'historique d'un joueur même avec des millions de lignes.
 *
 * Rétention : configurable, purge périodique (au boot + scheduler).
 */
public final class PlayerLogStore {

    private static final Gson GSON = new GsonBuilder().serializeNulls().create();

    private final Database db;
    private final Logger logger;
    private final long retentionMs;

    public PlayerLogStore(Database db, Logger logger, int retentionDays) {
        this.db = db;
        this.logger = logger;
        this.retentionMs = (long) retentionDays * 86_400_000L;
        initSchema();
        purgeOld();
    }

    private void initSchema() {
        db.migrate("player_log", 1, """
            CREATE TABLE IF NOT EXISTS player_log (
                id           VARCHAR(64)  NOT NULL PRIMARY KEY,
                ts           BIGINT       NOT NULL,
                player_uuid  VARCHAR(64)  NOT NULL,
                player_name  VARCHAR(64)  NOT NULL,
                category     VARCHAR(32)  NOT NULL,
                action       VARCHAR(64)  NOT NULL,
                world        VARCHAR(64),
                x            INTEGER,
                y            INTEGER,
                z            INTEGER,
                target       VARCHAR(255),
                payload      LONGTEXT
            );
            CREATE INDEX idx_pl_player_ts ON player_log(player_uuid, ts);
            CREATE INDEX idx_pl_ts        ON player_log(ts);
            CREATE INDEX idx_pl_category  ON player_log(category);
            CREATE INDEX idx_pl_action    ON player_log(action);
            """);
    }

    public synchronized void purgeOld() {
        if (retentionMs <= 0) return;
        long cutoff = System.currentTimeMillis() - retentionMs;
        try (PreparedStatement ps = db.conn().prepareStatement("DELETE FROM player_log WHERE ts < ?")) {
            ps.setLong(1, cutoff);
            int n = ps.executeUpdate();
            if (n > 0) logger.info("[PlayerLog] Purge : " + n + " entrée(s) > rétention supprimée(s)");
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[PlayerLog] purge erreur", e);
        }
    }

    /** Insert single entry. Pas thread-safe par défaut — utilisé par PlayerLogService. */
    public void insert(PlayerLogEntry e) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "REPLACE INTO player_log(id, ts, player_uuid, player_name, category, action, "
              + "world, x, y, z, target, payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")) {
            bind(ps, e);
            ps.executeUpdate();
        } catch (SQLException ex) {
            logger.log(Level.WARNING, "[PlayerLog] insert erreur", ex);
        }
    }

    /** Batch insert pour le worker async. */
    public synchronized void insertBatch(List<PlayerLogEntry> entries) {
        if (entries.isEmpty()) return;
        try {
            db.conn().setAutoCommit(false);
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "REPLACE INTO player_log(id, ts, player_uuid, player_name, category, action, "
                  + "world, x, y, z, target, payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")) {
                for (PlayerLogEntry e : entries) {
                    bind(ps, e);
                    ps.addBatch();
                }
                ps.executeBatch();
                db.conn().commit();
            } catch (SQLException ex) {
                db.conn().rollback();
                throw ex;
            } finally {
                db.conn().setAutoCommit(true);
            }
        } catch (SQLException ex) {
            logger.log(Level.WARNING, "[PlayerLog] batch insert erreur", ex);
        }
    }

    private static void bind(PreparedStatement ps, PlayerLogEntry e) throws SQLException {
        ps.setString(1, e.id != null ? e.id : UUID.randomUUID().toString());
        ps.setLong  (2, e.timestamp);
        ps.setString(3, e.playerUuid);
        ps.setString(4, e.playerName);
        ps.setString(5, e.category);
        ps.setString(6, e.action);
        ps.setString(7, e.world);
        if (e.x == null) ps.setNull(8, Types.INTEGER); else ps.setInt(8, e.x);
        if (e.y == null) ps.setNull(9, Types.INTEGER); else ps.setInt(9, e.y);
        if (e.z == null) ps.setNull(10, Types.INTEGER); else ps.setInt(10, e.z);
        ps.setString(11, e.target);
        ps.setString(12, e.payload != null && !e.payload.isEmpty() ? GSON.toJson(e.payload) : null);
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    /** Comptage par catégorie pour un joueur (vue principale = grille des catégories). */
    public synchronized List<Map<String, Object>> categoryCounts(String playerName, long sinceMs) {
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT category, COUNT(*) c, MAX(ts) last_ts FROM player_log "
              + "WHERE LOWER(player_name) = LOWER(?) AND ts >= ? "
              + "GROUP BY category ORDER BY last_ts DESC")) {
            ps.setString(1, playerName);
            ps.setLong  (2, sinceMs);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("category", rs.getString("category"));
                    m.put("count", rs.getInt("c"));
                    m.put("lastAt", rs.getLong("last_ts"));
                    out.add(m);
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[PlayerLog] categoryCounts erreur", e);
        }
        return out;
    }

    /** Liste des entrées d'un joueur, filtrée par catégorie optionnelle. */
    public synchronized List<PlayerLogEntry> list(String playerName, String category,
                                                    long sinceMs, int limit, int offset) {
        StringBuilder sql = new StringBuilder(
                "SELECT id, ts, player_uuid, player_name, category, action, world, x, y, z, target, payload "
              + "FROM player_log WHERE LOWER(player_name) = LOWER(?) AND ts >= ? ");
        List<Object> args = new ArrayList<>();
        args.add(playerName);
        args.add(sinceMs);
        if (category != null && !category.isBlank()) {
            sql.append("AND category = ? ");
            args.add(category.toUpperCase());
        }
        sql.append("ORDER BY ts DESC LIMIT ? OFFSET ?");
        args.add(Math.max(1, limit));
        args.add(Math.max(0, offset));

        List<PlayerLogEntry> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(sql.toString())) {
            for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(read(rs));
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[PlayerLog] list erreur", e);
        }
        return out;
    }

    /** Total d'entrées d'un joueur (avec filtre catégorie optionnel). */
    public synchronized int count(String playerName, String category, long sinceMs) {
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*) FROM player_log WHERE LOWER(player_name) = LOWER(?) AND ts >= ? ");
        List<Object> args = new ArrayList<>();
        args.add(playerName);
        args.add(sinceMs);
        if (category != null && !category.isBlank()) {
            sql.append("AND category = ? ");
            args.add(category.toUpperCase());
        }
        try (PreparedStatement ps = db.conn().prepareStatement(sql.toString())) {
            for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getInt(1) : 0; }
        } catch (SQLException e) { return 0; }
    }

    public synchronized int clearForPlayer(String playerName) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "DELETE FROM player_log WHERE LOWER(player_name) = LOWER(?)")) {
            ps.setString(1, playerName);
            return ps.executeUpdate();
        } catch (SQLException e) {
            return 0;
        }
    }

    private PlayerLogEntry read(ResultSet rs) throws SQLException {
        PlayerLogEntry e = new PlayerLogEntry();
        e.id = rs.getString("id");
        e.timestamp = rs.getLong("ts");
        e.playerUuid = rs.getString("player_uuid");
        e.playerName = rs.getString("player_name");
        e.category = rs.getString("category");
        e.action = rs.getString("action");
        e.world = rs.getString("world");
        int x = rs.getInt("x"); e.x = rs.wasNull() ? null : x;
        int y = rs.getInt("y"); e.y = rs.wasNull() ? null : y;
        int z = rs.getInt("z"); e.z = rs.wasNull() ? null : z;
        e.target = rs.getString("target");
        String pj = rs.getString("payload");
        if (pj != null && !pj.isBlank()) {
            try { e.payload = GSON.fromJson(pj, new TypeToken<Map<String, Object>>(){}.getType()); }
            catch (Exception ignore) { e.payload = null; }
        }
        return e;
    }
}
