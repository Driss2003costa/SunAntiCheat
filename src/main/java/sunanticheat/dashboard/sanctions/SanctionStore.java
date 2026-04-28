package sunanticheat.dashboard.sanctions;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Store SQL des sanctions modernes (kick/ban/mute/warn) issues du dashboard.
 *
 * Schema : table `sanctions` indexée sur ts/target/issued_by/active.
 * Templates : stockés en JSON dans kv_blobs scope=sanction_templates.
 *
 * Design séparé du système GUI legacy (sunanticheat.sanction.*) — les deux
 * cohabitent. Le legacy gère le menu in-game ; ce store est utilisé par le
 * dashboard et le ban listener.
 */
public final class SanctionStore {

    private static final Gson GSON = new GsonBuilder().serializeNulls().create();

    private final Database db;
    private final BlobStorage blobs;
    private final Logger logger;

    public SanctionStore(Database db, BlobStorage blobs, Logger logger) {
        this.db = db;
        this.blobs = blobs;
        this.logger = logger;
        initSchema();
        ensureDefaultTemplates();
    }

    private void initSchema() {
        db.migrate("sanctions", 1, """
            CREATE TABLE IF NOT EXISTS sanctions (
                id              VARCHAR(64)  NOT NULL PRIMARY KEY,
                type            VARCHAR(16)  NOT NULL,
                severity        VARCHAR(16)  NOT NULL,
                category        VARCHAR(64),
                target_uuid     VARCHAR(64),
                target_name     VARCHAR(64) NOT NULL,
                target_ip       VARCHAR(64),
                issued_by       VARCHAR(64) NOT NULL,
                issued_at       BIGINT      NOT NULL,
                expires_at      BIGINT,
                reason          TEXT,
                evidence_url    VARCHAR(512),
                notes           TEXT,
                silent          INTEGER     NOT NULL DEFAULT 0,
                revoked         INTEGER     NOT NULL DEFAULT 0,
                revoked_by      VARCHAR(64),
                revoked_at      BIGINT,
                revoke_reason   TEXT,
                template_id     VARCHAR(64)
            );
            CREATE INDEX idx_sanctions_target_lc ON sanctions(LOWER(target_name));
            CREATE INDEX idx_sanctions_uuid      ON sanctions(target_uuid);
            CREATE INDEX idx_sanctions_ip        ON sanctions(target_ip);
            CREATE INDEX idx_sanctions_issued_by ON sanctions(issued_by);
            CREATE INDEX idx_sanctions_at        ON sanctions(issued_at);
            CREATE INDEX idx_sanctions_active    ON sanctions(revoked, expires_at);
            """);
    }

    private void ensureDefaultTemplates() {
        String existing = blobs.read("sanction_templates");
        if (existing == null || existing.isBlank() || existing.equals("[]")) {
            blobs.write("sanction_templates", GSON.toJson(SanctionTemplate.defaults()));
            logger.info("[Sanctions] " + SanctionTemplate.defaults().size() + " templates par défaut initialisés");
        }
    }

    // ── Templates ────────────────────────────────────────────────────────────

    public synchronized List<SanctionTemplate> listTemplates() {
        try {
            String json = blobs.read("sanction_templates");
            if (json == null || json.isBlank()) return SanctionTemplate.defaults();
            List<SanctionTemplate> out = GSON.fromJson(json, new TypeToken<List<SanctionTemplate>>(){}.getType());
            return out != null ? out : SanctionTemplate.defaults();
        } catch (Exception e) {
            return SanctionTemplate.defaults();
        }
    }

    public synchronized void saveTemplates(List<SanctionTemplate> templates) {
        blobs.write("sanction_templates", GSON.toJson(templates));
    }

    public synchronized SanctionTemplate getTemplate(String id) {
        for (SanctionTemplate t : listTemplates()) if (t.id.equals(id)) return t;
        return null;
    }

    // ── Sanctions CRUD ───────────────────────────────────────────────────────

    public synchronized void insert(SanctionEntry e) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "REPLACE INTO sanctions(id, type, severity, category, target_uuid, target_name, target_ip, "
              + "issued_by, issued_at, expires_at, reason, evidence_url, notes, silent, revoked, revoked_by, "
              + "revoked_at, revoke_reason, template_id) "
              + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
            bind(ps, e);
            ps.executeUpdate();
        } catch (SQLException ex) {
            logger.log(Level.WARNING, "[Sanctions] insert erreur", ex);
        }
    }

    private void bind(PreparedStatement ps, SanctionEntry e) throws SQLException {
        ps.setString(1, e.id);
        ps.setString(2, e.type);
        ps.setString(3, e.severity);
        ps.setString(4, e.category);
        ps.setString(5, e.targetUuid);
        ps.setString(6, e.targetName);
        ps.setString(7, e.targetIp);
        ps.setString(8, e.issuedBy);
        ps.setLong  (9, e.issuedAt);
        if (e.expiresAt == null) ps.setNull(10, Types.BIGINT);
        else                     ps.setLong(10, e.expiresAt);
        ps.setString(11, e.reason);
        ps.setString(12, e.evidenceUrl);
        ps.setString(13, e.notes);
        ps.setInt   (14, e.silent ? 1 : 0);
        ps.setInt   (15, e.revoked ? 1 : 0);
        ps.setString(16, e.revokedBy);
        if (e.revokedAt == null) ps.setNull(17, Types.BIGINT);
        else                     ps.setLong(17, e.revokedAt);
        ps.setString(18, e.revokeReason);
        ps.setString(19, e.templateId);
    }

    public synchronized SanctionEntry get(String id) {
        try (PreparedStatement ps = db.conn().prepareStatement("SELECT * FROM sanctions WHERE id = ?")) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return read(rs);
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Sanctions] get erreur", e);
        }
        return null;
    }

    /** Liste paginée, filtres optionnels. */
    public synchronized List<SanctionEntry> list(String targetName, String type, String issuedBy,
                                                  Boolean activeOnly, int limit, int offset) {
        StringBuilder sql = new StringBuilder("SELECT * FROM sanctions WHERE 1=1 ");
        List<Object> args = new ArrayList<>();
        if (targetName != null && !targetName.isBlank()) {
            sql.append("AND LOWER(target_name) = LOWER(?) ");
            args.add(targetName);
        }
        if (type != null && !type.isBlank()) {
            sql.append("AND type = ? ");
            args.add(type);
        }
        if (issuedBy != null && !issuedBy.isBlank()) {
            sql.append("AND LOWER(issued_by) = LOWER(?) ");
            args.add(issuedBy);
        }
        if (Boolean.TRUE.equals(activeOnly)) {
            sql.append("AND revoked = 0 AND (expires_at IS NULL OR expires_at > ?) ");
            args.add(System.currentTimeMillis());
        }
        sql.append("ORDER BY issued_at DESC LIMIT ? OFFSET ?");
        args.add(Math.max(1, limit));
        args.add(Math.max(0, offset));

        List<SanctionEntry> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(sql.toString())) {
            for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(read(rs));
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Sanctions] list erreur", e);
        }
        return out;
    }

    public synchronized int count(String targetName, String type, String issuedBy, Boolean activeOnly) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM sanctions WHERE 1=1 ");
        List<Object> args = new ArrayList<>();
        if (targetName != null && !targetName.isBlank()) { sql.append("AND LOWER(target_name) = LOWER(?) "); args.add(targetName); }
        if (type != null && !type.isBlank())             { sql.append("AND type = ? "); args.add(type); }
        if (issuedBy != null && !issuedBy.isBlank())     { sql.append("AND LOWER(issued_by) = LOWER(?) "); args.add(issuedBy); }
        if (Boolean.TRUE.equals(activeOnly)) {
            sql.append("AND revoked = 0 AND (expires_at IS NULL OR expires_at > ?) ");
            args.add(System.currentTimeMillis());
        }
        try (PreparedStatement ps = db.conn().prepareStatement(sql.toString())) {
            for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getInt(1) : 0; }
        } catch (SQLException e) { return 0; }
    }

    /** Sanction active (BAN/MUTE/IP_BAN non révoquée et non expirée) sur un joueur. */
    public synchronized SanctionEntry activeSanction(String uuid, String name, String ip, SanctionType type) {
        StringBuilder sql = new StringBuilder("SELECT * FROM sanctions WHERE type = ? AND revoked = 0 "
            + "AND (expires_at IS NULL OR expires_at > ?) AND (");
        List<Object> args = new ArrayList<>();
        args.add(type.name());
        args.add(System.currentTimeMillis());
        boolean any = false;
        if (uuid != null) { sql.append("target_uuid = ?"); args.add(uuid); any = true; }
        if (name != null) { if (any) sql.append(" OR "); sql.append("LOWER(target_name) = LOWER(?)"); args.add(name); any = true; }
        if (ip != null && type == SanctionType.IP_BAN) {
            if (any) sql.append(" OR ");
            sql.append("target_ip = ?");
            args.add(ip);
            any = true;
        }
        if (!any) return null;
        sql.append(") ORDER BY issued_at DESC LIMIT 1");
        try (PreparedStatement ps = db.conn().prepareStatement(sql.toString())) {
            for (int i = 0; i < args.size(); i++) ps.setObject(i + 1, args.get(i));
            try (ResultSet rs = ps.executeQuery()) { if (rs.next()) return read(rs); }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Sanctions] activeSanction erreur", e);
        }
        return null;
    }

    public synchronized boolean revoke(String id, String revokedBy, String reason) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE sanctions SET revoked = 1, revoked_by = ?, revoked_at = ?, revoke_reason = ? "
              + "WHERE id = ? AND revoked = 0")) {
            ps.setString(1, revokedBy);
            ps.setLong  (2, System.currentTimeMillis());
            ps.setString(3, reason);
            ps.setString(4, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Sanctions] revoke erreur", e);
            return false;
        }
    }

    /** Stats : nb sanctions par type, par sévérité, par admin, par catégorie, sur N jours. */
    public synchronized Map<String, Object> stats(int sinceDays) {
        long since = System.currentTimeMillis() - sinceDays * 86_400_000L;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalActive", count(null, null, null, true));
        out.put("totalAll", count(null, null, null, false));

        out.put("byType",     groupCount("SELECT type, COUNT(*) FROM sanctions WHERE issued_at >= ? GROUP BY type", since));
        out.put("bySeverity", groupCount("SELECT severity, COUNT(*) FROM sanctions WHERE issued_at >= ? GROUP BY severity", since));
        out.put("byCategory", groupCount("SELECT category, COUNT(*) FROM sanctions WHERE issued_at >= ? GROUP BY category", since));
        out.put("byAdmin",    groupCount("SELECT issued_by, COUNT(*) FROM sanctions WHERE issued_at >= ? GROUP BY issued_by ORDER BY 2 DESC", since));
        out.put("topReasons", topReasons(since));
        out.put("daily",      daily(sinceDays));
        return out;
    }

    private List<Map<String, Object>> groupCount(String sql, long since) {
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(sql)) {
            ps.setLong(1, since);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("key", rs.getString(1));
                    m.put("count", rs.getInt(2));
                    out.add(m);
                }
            }
        } catch (SQLException ignored) {}
        return out;
    }

    private List<Map<String, Object>> topReasons(long since) {
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT reason, COUNT(*) c FROM sanctions WHERE issued_at >= ? AND reason IS NOT NULL "
              + "GROUP BY reason ORDER BY c DESC LIMIT 10")) {
            ps.setLong(1, since);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("reason", rs.getString(1));
                    m.put("count", rs.getInt(2));
                    out.add(m);
                }
            }
        } catch (SQLException ignored) {}
        return out;
    }

    private Map<String, Object> daily(int days) {
        List<String> labels = new ArrayList<>();
        List<Integer> data = new ArrayList<>();
        long now = System.currentTimeMillis();
        for (int i = days - 1; i >= 0; i--) {
            long start = now - (i + 1) * 86_400_000L;
            long end = now - i * 86_400_000L;
            int n = 0;
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "SELECT COUNT(*) FROM sanctions WHERE issued_at >= ? AND issued_at < ?")) {
                ps.setLong(1, start);
                ps.setLong(2, end);
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) n = rs.getInt(1); }
            } catch (SQLException ignored) {}
            labels.add(java.time.LocalDate.now().minusDays(i).toString().substring(5));
            data.add(n);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("labels", labels);
        out.put("data", data);
        return out;
    }

    /** Auto-revoke des sanctions expirées (idempotent — appelé par le scheduler). */
    public synchronized int markExpired() {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE sanctions SET revoked = 1, revoked_by = ?, revoked_at = ?, revoke_reason = ? "
              + "WHERE revoked = 0 AND expires_at IS NOT NULL AND expires_at <= ?")) {
            long now = System.currentTimeMillis();
            ps.setString(1, "system");
            ps.setLong  (2, now);
            ps.setString(3, "Expiration automatique");
            ps.setLong  (4, now);
            return ps.executeUpdate();
        } catch (SQLException e) {
            return 0;
        }
    }

    private SanctionEntry read(ResultSet rs) throws SQLException {
        SanctionEntry e = new SanctionEntry();
        e.id = rs.getString("id");
        e.type = rs.getString("type");
        e.severity = rs.getString("severity");
        e.category = rs.getString("category");
        e.targetUuid = rs.getString("target_uuid");
        e.targetName = rs.getString("target_name");
        e.targetIp = rs.getString("target_ip");
        e.issuedBy = rs.getString("issued_by");
        e.issuedAt = rs.getLong("issued_at");
        long exp = rs.getLong("expires_at");
        e.expiresAt = rs.wasNull() ? null : exp;
        e.reason = rs.getString("reason");
        e.evidenceUrl = rs.getString("evidence_url");
        e.notes = rs.getString("notes");
        e.silent = rs.getInt("silent") != 0;
        e.revoked = rs.getInt("revoked") != 0;
        e.revokedBy = rs.getString("revoked_by");
        long rev = rs.getLong("revoked_at");
        e.revokedAt = rs.wasNull() ? null : rev;
        e.revokeReason = rs.getString("revoke_reason");
        e.templateId = rs.getString("template_id");
        return e;
    }
}
