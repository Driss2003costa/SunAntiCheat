package sunanticheat.dashboard.portal;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

public final class PlayerAccountStore {

    private final Database db;
    private final Logger logger;

    public PlayerAccountStore(Database db, Logger logger) {
        this.db = db;
        this.logger = logger;
        migrate();
    }

    private void migrate() {
        db.migrate("portal_accounts", 1, """
            CREATE TABLE IF NOT EXISTS player_accounts (
                uuid         TEXT NOT NULL PRIMARY KEY,
                username     TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                email        TEXT,
                created_at   INTEGER NOT NULL,
                last_login   INTEGER,
                role         TEXT NOT NULL DEFAULT 'PLAYER'
            );
            CREATE TABLE IF NOT EXISTS register_pins (
                uuid         TEXT NOT NULL PRIMARY KEY,
                username     TEXT NOT NULL,
                pin_hash     TEXT NOT NULL,
                expires_at   INTEGER NOT NULL,
                attempts     INTEGER NOT NULL DEFAULT 0
            )""");
        db.migrate("portal_accounts", 2,
            "ALTER TABLE player_accounts ADD COLUMN bio TEXT DEFAULT ''");
        // v3 : sanctions & contrôle d'accès portail (ban, restrictions par section,
        // reset forcé, compteur d'échecs login persistant).
        db.migrate("portal_accounts", 3, """
            ALTER TABLE player_accounts ADD COLUMN banned_until INTEGER;
            ALTER TABLE player_accounts ADD COLUMN ban_reason TEXT;
            ALTER TABLE player_accounts ADD COLUMN section_restrictions INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE player_accounts ADD COLUMN must_reset_password INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE player_accounts ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE player_accounts ADD COLUMN last_failed_login INTEGER""");
    }

    public boolean isRegistered(String uuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT 1 FROM player_accounts WHERE uuid = ?")) {
            ps.setString(1, uuid);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        } catch (SQLException e) {
            logger.warning("[Portal] DB error isRegistered: " + e.getMessage());
            return false;
        }
    }

    public void createAccount(String uuid, String username, String passwordHash) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT INTO player_accounts(uuid, username, password_hash, created_at) VALUES(?,?,?,?)")) {
            ps.setString(1, uuid);
            ps.setString(2, username);
            ps.setString(3, passwordHash);
            ps.setLong(4, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to create account: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> getByUsername(String username) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM player_accounts WHERE LOWER(username) = LOWER(?)")) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return mapRow(rs, true);
            }
        } catch (SQLException e) {
            logger.warning("[Portal] DB error getByUsername: " + e.getMessage());
            return null;
        }
    }

    public Map<String, Object> getByUuid(String uuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM player_accounts WHERE uuid = ?")) {
            ps.setString(1, uuid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return mapRow(rs, false);
            }
        } catch (SQLException e) {
            logger.warning("[Portal] DB error getByUuid: " + e.getMessage());
            return null;
        }
    }

    public void updateLastLogin(String uuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE player_accounts SET last_login = ? WHERE uuid = ?")) {
            ps.setLong(1, System.currentTimeMillis());
            ps.setString(2, uuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[Portal] DB error updateLastLogin: " + e.getMessage());
        }
    }

    // ── PIN methods ──────────────────────────────────────────────────────────

    public void upsertPin(String uuid, String username, String pinHash, long expiresAt) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "REPLACE INTO register_pins(uuid, username, pin_hash, expires_at, attempts) VALUES(?,?,?,?,0)")) {
            ps.setString(1, uuid);
            ps.setString(2, username);
            ps.setString(3, pinHash);
            ps.setLong(4, expiresAt);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to upsert PIN: " + e.getMessage(), e);
        }
    }

    public Map<String, Object> getPin(String uuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM register_pins WHERE uuid = ?")) {
            ps.setString(1, uuid);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("uuid",       rs.getString("uuid"));
                m.put("username",   rs.getString("username"));
                m.put("pin_hash",   rs.getString("pin_hash"));
                m.put("expires_at", rs.getLong("expires_at"));
                m.put("attempts",   rs.getInt("attempts"));
                return m;
            }
        } catch (SQLException e) {
            logger.warning("[Portal] DB error getPin: " + e.getMessage());
            return null;
        }
    }

    public void incrementPinAttempts(String uuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE register_pins SET attempts = attempts + 1 WHERE uuid = ?")) {
            ps.setString(1, uuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[Portal] DB error incrementAttempts: " + e.getMessage());
        }
    }

    public void deletePin(String uuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "DELETE FROM register_pins WHERE uuid = ?")) {
            ps.setString(1, uuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[Portal] DB error deletePin: " + e.getMessage());
        }
    }

    public void updateBio(String uuid, String bio) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE player_accounts SET bio = ? WHERE uuid = ?")) {
            ps.setString(1, bio != null ? bio : "");
            ps.setString(2, uuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[Portal] DB error updateBio: " + e.getMessage());
        }
    }

    public void updatePassword(String uuid, String passwordHash) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE player_accounts SET password_hash = ? WHERE uuid = ?")) {
            ps.setString(1, passwordHash);
            ps.setString(2, uuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[Portal] DB error updatePassword: " + e.getMessage());
        }
    }

    public void cleanExpiredPins() {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "DELETE FROM register_pins WHERE expires_at < ?")) {
            ps.setLong(1, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[Portal] DB error cleanExpiredPins: " + e.getMessage());
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static Map<String, Object> mapRow(ResultSet rs, boolean includeHash) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("uuid",       rs.getString("uuid"));
        m.put("username",   rs.getString("username"));
        if (includeHash) m.put("password_hash", rs.getString("password_hash"));
        m.put("email",      rs.getString("email"));
        m.put("created_at", rs.getLong("created_at"));
        m.put("last_login", rs.getLong("last_login"));
        m.put("role",       rs.getString("role"));
        String bio = rs.getString("bio");
        m.put("bio", bio != null ? bio : "");
        long bannedUntil = rs.getLong("banned_until");
        m.put("banned_until", rs.wasNull() ? null : bannedUntil);
        m.put("ban_reason",   rs.getString("ban_reason"));
        m.put("section_restrictions", rs.getInt("section_restrictions"));
        m.put("must_reset_password",  rs.getInt("must_reset_password") == 1);
        m.put("failed_login_count",   rs.getInt("failed_login_count"));
        long lastFailed = rs.getLong("last_failed_login");
        m.put("last_failed_login", rs.wasNull() ? null : lastFailed);
        return m;
    }

    // ── Sanctions & contrôle d'accès ─────────────────────────────────────────

    /** True si le compte est actuellement banni (permanent ou non expiré). */
    public boolean isBanned(Map<String, Object> account) {
        if (account == null) return false;
        Object bu = account.get("banned_until");
        if (bu == null) return false;
        long until = ((Number) bu).longValue();
        // 0 = permanent, sinon date d'expiration
        return until == 0 || until > System.currentTimeMillis();
    }

    /** Pose un ban (untilEpochMs = 0 pour permanent, null pour lever le ban). */
    public void setBan(String uuid, Long untilEpochMs, String reason) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE player_accounts SET banned_until = ?, ban_reason = ? WHERE uuid = ?")) {
            if (untilEpochMs == null) ps.setNull(1, Types.BIGINT);
            else                      ps.setLong(1, untilEpochMs);
            ps.setString(2, reason);
            ps.setString(3, uuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[Portal] DB error setBan: " + e.getMessage());
        }
    }

    public void setRestrictions(String uuid, int bitmask) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE player_accounts SET section_restrictions = ? WHERE uuid = ?")) {
            ps.setInt(1, bitmask);
            ps.setString(2, uuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[Portal] DB error setRestrictions: " + e.getMessage());
        }
    }

    public void setMustResetPassword(String uuid, boolean value) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE player_accounts SET must_reset_password = ? WHERE uuid = ?")) {
            ps.setInt(1, value ? 1 : 0);
            ps.setString(2, uuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[Portal] DB error setMustResetPassword: " + e.getMessage());
        }
    }

    /** Incrémente le compteur d'échecs et renvoie la nouvelle valeur. */
    public int incrementFailedLogin(String uuid) {
        try {
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "UPDATE player_accounts SET failed_login_count = failed_login_count + 1, " +
                    "last_failed_login = ? WHERE uuid = ?")) {
                ps.setLong(1, System.currentTimeMillis());
                ps.setString(2, uuid);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "SELECT failed_login_count FROM player_accounts WHERE uuid = ?")) {
                ps.setString(1, uuid);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? rs.getInt(1) : 0;
                }
            }
        } catch (SQLException e) {
            logger.warning("[Portal] DB error incrementFailedLogin: " + e.getMessage());
            return 0;
        }
    }

    public void resetFailedLogin(String uuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE player_accounts SET failed_login_count = 0 WHERE uuid = ?")) {
            ps.setString(1, uuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[Portal] DB error resetFailedLogin: " + e.getMessage());
        }
    }

    /** Liste paginée des comptes (admin). Filtre optionnel sur le pseudo. */
    public List<Map<String, Object>> listAccounts(String search, int limit, int offset) {
        List<Map<String, Object>> out = new ArrayList<>();
        String where = (search != null && !search.isBlank())
                ? "WHERE LOWER(username) LIKE LOWER(?)" : "";
        String sql = "SELECT * FROM player_accounts " + where +
                     " ORDER BY last_login DESC NULLS LAST LIMIT ? OFFSET ?";
        try (PreparedStatement ps = db.conn().prepareStatement(sql)) {
            int idx = 1;
            if (!where.isEmpty()) ps.setString(idx++, "%" + search.trim() + "%");
            ps.setInt(idx++, limit);
            ps.setInt(idx,   offset);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(mapRow(rs, false));
            }
        } catch (SQLException e) {
            // MySQL ne supporte pas "NULLS LAST" — on retombe sur un tri équivalent
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "SELECT * FROM player_accounts " + where +
                    " ORDER BY (last_login IS NULL), last_login DESC LIMIT ? OFFSET ?")) {
                int idx = 1;
                if (!where.isEmpty()) ps.setString(idx++, "%" + search.trim() + "%");
                ps.setInt(idx++, limit);
                ps.setInt(idx,   offset);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) out.add(mapRow(rs, false));
                }
            } catch (SQLException e2) {
                logger.warning("[Portal] DB error listAccounts: " + e2.getMessage());
            }
        }
        return out;
    }

    public int countAccounts(String search) {
        String where = (search != null && !search.isBlank())
                ? "WHERE LOWER(username) LIKE LOWER(?)" : "";
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT COUNT(*) FROM player_accounts " + where)) {
            if (!where.isEmpty()) ps.setString(1, "%" + search.trim() + "%");
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        } catch (SQLException e) {
            logger.warning("[Portal] DB error countAccounts: " + e.getMessage());
            return 0;
        }
    }
}
