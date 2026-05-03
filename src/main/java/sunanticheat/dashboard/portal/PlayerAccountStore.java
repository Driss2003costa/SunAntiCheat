package sunanticheat.dashboard.portal;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.LinkedHashMap;
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
        return m;
    }
}
