package sunanticheat.dashboard.audit;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import sunanticheat.dashboard.db.Database;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Store SQLite des entries d'audit (append-only, query par filtre).
 *
 * Pourquoi SQLite ? Avant, on chargeait 50 000 entries en RAM + on réécrivait tout le JSON
 * à chaque save. Avec SQLite : insertion O(1), query indexée par timestamp/user/action,
 * scaling jusqu'à des millions de lignes sans toucher la RAM.
 *
 * Migration auto : si `dashboard/audit_log.json` existe au boot, on importe son contenu
 * dans SQLite et on renomme le fichier en `.json.bak`.
 *
 * Limite : 50 000 entries (DELETE FIFO du plus ancien quand on dépasse).
 */
public final class AuditStore {

    private static final int MAX_ENTRIES = 50_000;
    private static final int CLEANUP_EVERY = 100;   // tous les 100 inserts on check la rotation

    private final Database db;
    private final Logger logger;
    private final Gson gson = new GsonBuilder().serializeNulls().create();
    private int insertsSinceCleanup = 0;

    public AuditStore(Database db, Logger logger, File legacyDataFolder) {
        this.db = db;
        this.logger = logger;
        initSchema();
        importLegacyJson(legacyDataFolder);
    }

    private void initSchema() {
        // VARCHAR / BIGINT / LONGTEXT pour MySQL ; SQLite ignore les tailles
        db.migrate("audit", 1, """
            CREATE TABLE IF NOT EXISTS audit (
                id        VARCHAR(64)  NOT NULL PRIMARY KEY,
                ts        BIGINT       NOT NULL,
                user      VARCHAR(64),
                role      VARCHAR(32),
                action    VARCHAR(64)  NOT NULL,
                target    VARCHAR(255),
                details   TEXT,
                ip        VARCHAR(64),
                meta_json LONGTEXT
            );
            CREATE INDEX idx_audit_ts     ON audit(ts);
            CREATE INDEX idx_audit_user   ON audit(user);
            CREATE INDEX idx_audit_action ON audit(action);
            """);
    }

    private void importLegacyJson(File dataFolder) {
        File legacy = new File(dataFolder, "dashboard/audit_log.json");
        if (!legacy.exists()) return;
        try {
            // Si la table contient déjà des données, on n'écrase pas → c'est qu'un import a déjà eu lieu
            try (PreparedStatement ps = db.conn().prepareStatement("SELECT COUNT(*) FROM audit");
                 ResultSet rs = ps.executeQuery()) {
                if (rs.next() && rs.getInt(1) > 0) {
                    logger.info("[Audit] Table déjà peuplée, skip import legacy JSON");
                    File bak = new File(legacy.getAbsolutePath() + ".bak");
                    if (!bak.exists()) legacy.renameTo(bak);
                    return;
                }
            }
            String json = Files.readString(legacy.toPath(), StandardCharsets.UTF_8);
            Type type = new TypeToken<List<AuditEntry>>() {}.getType();
            List<AuditEntry> list = gson.fromJson(json, type);
            if (list == null || list.isEmpty()) {
                legacy.renameTo(new File(legacy.getAbsolutePath() + ".bak"));
                return;
            }
            db.conn().setAutoCommit(false);
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "REPLACE INTO audit(id, ts, user, role, action, target, details, ip, meta_json) "
                  + "VALUES(?,?,?,?,?,?,?,?,?)")) {
                int n = 0;
                for (AuditEntry e : list) {
                    if (e == null) continue;
                    bindEntry(ps, e);
                    ps.addBatch();
                    n++;
                    if (n % 1000 == 0) ps.executeBatch();
                }
                ps.executeBatch();
                db.conn().commit();
                logger.info("[Audit] Importé " + n + " entries depuis " + legacy.getName());
            } catch (SQLException e) {
                db.conn().rollback();
                throw e;
            } finally {
                db.conn().setAutoCommit(true);
            }
            legacy.renameTo(new File(legacy.getAbsolutePath() + ".bak"));
        } catch (IOException | SQLException e) {
            logger.log(Level.WARNING, "[Audit] Échec import legacy JSON", e);
        }
    }

    private void bindEntry(PreparedStatement ps, AuditEntry e) throws SQLException {
        ps.setString(1, e.id != null ? e.id : UUID.randomUUID().toString());
        ps.setLong  (2, e.timestamp);
        ps.setString(3, e.user);
        ps.setString(4, e.role);
        ps.setString(5, e.action != null ? e.action : "UNKNOWN");
        ps.setString(6, e.target);
        ps.setString(7, e.details);
        ps.setString(8, e.ip);
        ps.setString(9, e.meta != null && !e.meta.isEmpty() ? gson.toJson(e.meta) : null);
    }

    public synchronized void append(AuditEntry e) {
        if (e == null) return;
        try (PreparedStatement ps = db.conn().prepareStatement(
                "REPLACE INTO audit(id, ts, user, role, action, target, details, ip, meta_json) "
              + "VALUES(?,?,?,?,?,?,?,?,?)")) {
            bindEntry(ps, e);
            ps.executeUpdate();
        } catch (SQLException ex) {
            logger.log(Level.WARNING, "[Audit] insert erreur", ex);
            return;
        }
        insertsSinceCleanup++;
        if (insertsSinceCleanup >= CLEANUP_EVERY) {
            insertsSinceCleanup = 0;
            rotateIfNeeded();
        }
    }

    private void rotateIfNeeded() {
        // Approche portable : on récupère le timestamp du Nème (= MAX_ENTRIES) plus récent
        // et on supprime tout ce qui est plus ancien.
        try {
            long cutoff = -1;
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "SELECT ts FROM audit ORDER BY ts DESC LIMIT 1 OFFSET ?")) {
                ps.setInt(1, MAX_ENTRIES);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) cutoff = rs.getLong(1);
                }
            }
            if (cutoff < 0) return;
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "DELETE FROM audit WHERE ts < ?")) {
                ps.setLong(1, cutoff);
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Audit] rotation erreur", e);
        }
    }

    /** Liste les entries filtrées, antichronologique. */
    public synchronized List<AuditEntry> list(String userFilter, String actionFilter,
                                                String targetFilter, long sinceTs,
                                                int limit, int offset) {
        StringBuilder sql = new StringBuilder("SELECT id, ts, user, role, action, target, details, ip, meta_json "
            + "FROM audit WHERE 1=1 ");
        List<Object> args = new ArrayList<>();
        if (sinceTs > 0)                                     { sql.append("AND ts >= ? "); args.add(sinceTs); }
        if (userFilter   != null && !userFilter.isBlank())   { sql.append("AND LOWER(user) = LOWER(?) "); args.add(userFilter); }
        if (actionFilter != null && !actionFilter.isBlank()) { sql.append("AND action LIKE ? "); args.add("%" + actionFilter.toUpperCase() + "%"); }
        if (targetFilter != null && !targetFilter.isBlank()) { sql.append("AND LOWER(target) LIKE ? "); args.add("%" + targetFilter.toLowerCase() + "%"); }
        sql.append("ORDER BY ts DESC LIMIT ? OFFSET ?");
        args.add(Math.max(1, limit));
        args.add(Math.max(0, offset));

        List<AuditEntry> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(sql.toString())) {
            for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(readRow(rs));
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Audit] list erreur", e);
        }
        return out;
    }

    private AuditEntry readRow(ResultSet rs) throws SQLException {
        AuditEntry e = new AuditEntry();
        e.id        = rs.getString("id");
        e.timestamp = rs.getLong("ts");
        e.user      = rs.getString("user");
        e.role      = rs.getString("role");
        e.action    = rs.getString("action");
        e.target    = rs.getString("target");
        e.details   = rs.getString("details");
        e.ip        = rs.getString("ip");
        String mj   = rs.getString("meta_json");
        if (mj != null && !mj.isBlank()) {
            try { e.meta = gson.fromJson(mj, new TypeToken<Map<String, Object>>(){}.getType()); }
            catch (Exception ignore) { e.meta = null; }
        }
        return e;
    }

    public synchronized int totalCount() {
        try (PreparedStatement ps = db.conn().prepareStatement("SELECT COUNT(*) FROM audit");
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getInt(1) : 0;
        } catch (SQLException e) {
            return 0;
        }
    }

    /** Filtré par les mêmes critères que list(), pour la pagination. */
    public synchronized int filteredCount(String userFilter, String actionFilter,
                                          String targetFilter, long sinceTs) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM audit WHERE 1=1 ");
        List<Object> args = new ArrayList<>();
        if (sinceTs > 0)                                     { sql.append("AND ts >= ? "); args.add(sinceTs); }
        if (userFilter   != null && !userFilter.isBlank())   { sql.append("AND LOWER(user) = LOWER(?) "); args.add(userFilter); }
        if (actionFilter != null && !actionFilter.isBlank()) { sql.append("AND action LIKE ? "); args.add("%" + actionFilter.toUpperCase() + "%"); }
        if (targetFilter != null && !targetFilter.isBlank()) { sql.append("AND LOWER(target) LIKE ? "); args.add("%" + targetFilter.toLowerCase() + "%"); }
        try (PreparedStatement ps = db.conn().prepareStatement(sql.toString())) {
            for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getInt(1) : 0; }
        } catch (SQLException e) { return 0; }
    }

    public synchronized Set<String> distinctActions() {
        Set<String> out = new TreeSet<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT DISTINCT action FROM audit ORDER BY action");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String a = rs.getString(1);
                if (a != null) out.add(a);
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Audit] distinctActions erreur", e);
        }
        return out;
    }

    /** No-op : SQLite commit immédiat. Conservé pour compatibilité avec l'ancienne API. */
    public synchronized void save() { /* SQLite WAL flush at commit */ }
}
