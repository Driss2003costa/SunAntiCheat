package sunanticheat.dashboard.alts;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Persiste les associations IP → UUID → Name pour la détection de comptes alternatifs.
 * Chaque connexion met à jour la table ; les alts se déduisent par IP commune.
 */
public final class AltAccountStore {

    private final Database db;
    private final Logger logger;

    public AltAccountStore(Database db, Logger logger) {
        this.db = db;
        this.logger = logger;
        initSchema();
    }

    private void initSchema() {
        db.migrate("alt_ip_accounts", 1, """
            CREATE TABLE IF NOT EXISTS alt_ip_accounts (
                ip          VARCHAR(64) NOT NULL,
                uuid        VARCHAR(64) NOT NULL,
                name        VARCHAR(64) NOT NULL,
                first_seen  BIGINT      NOT NULL,
                last_seen   BIGINT      NOT NULL,
                PRIMARY KEY (ip, uuid)
            );
            CREATE INDEX idx_alt_ip   ON alt_ip_accounts(ip);
            CREATE INDEX idx_alt_uuid ON alt_ip_accounts(uuid);
            CREATE INDEX idx_alt_name ON alt_ip_accounts(LOWER(name))
            """);
    }

    public synchronized void upsert(String ip, String uuid, String name) {
        if (ip == null || ip.equals("?") || uuid == null || name == null) return;
        long now = System.currentTimeMillis();
        try {
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "UPDATE alt_ip_accounts SET name=?, last_seen=? WHERE ip=? AND uuid=?")) {
                ps.setString(1, name);
                ps.setLong(2, now);
                ps.setString(3, ip);
                ps.setString(4, uuid);
                if (ps.executeUpdate() == 0) {
                    try (PreparedStatement ins = db.conn().prepareStatement(
                            "INSERT INTO alt_ip_accounts(ip,uuid,name,first_seen,last_seen) VALUES(?,?,?,?,?)")) {
                        ins.setString(1, ip);
                        ins.setString(2, uuid);
                        ins.setString(3, name);
                        ins.setLong(4, now);
                        ins.setLong(5, now);
                        ins.executeUpdate();
                    }
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[AltAccounts] upsert erreur", e);
        }
    }

    public synchronized List<String> getIpsForUuid(String uuid) {
        List<String> ips = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT DISTINCT ip FROM alt_ip_accounts WHERE uuid=?")) {
            ps.setString(1, uuid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) ips.add(rs.getString("ip"));
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[AltAccounts] getIpsForUuid erreur", e);
        }
        return ips;
    }

    /** Tous les comptes (hors uuid donné) ayant partagé une même IP. */
    public synchronized List<AltEntry> getAltsForPlayer(String uuid) {
        List<String> ips = getIpsForUuid(uuid);
        if (ips.isEmpty()) return List.of();
        List<AltEntry> result = new ArrayList<>();
        try {
            String ph = String.join(",", Collections.nCopies(ips.size(), "?"));
            String sql = "SELECT ip, uuid, name, first_seen, last_seen FROM alt_ip_accounts " +
                    "WHERE ip IN (" + ph + ") AND uuid != ? ORDER BY last_seen DESC";
            try (PreparedStatement ps = db.conn().prepareStatement(sql)) {
                int i = 1;
                for (String ip : ips) ps.setString(i++, ip);
                ps.setString(i, uuid);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        result.add(new AltEntry(
                                rs.getString("ip"), rs.getString("uuid"),
                                rs.getString("name"), rs.getLong("first_seen"),
                                rs.getLong("last_seen")));
                    }
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[AltAccounts] getAltsForPlayer erreur", e);
        }
        return result;
    }

    /** Tous les comptes utilisant une IP précise (hors excludeUuid). */
    public synchronized List<AltEntry> getAccountsForIp(String ip, String excludeUuid) {
        List<AltEntry> result = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT ip, uuid, name, first_seen, last_seen FROM alt_ip_accounts " +
                "WHERE ip=? AND uuid != ? ORDER BY last_seen DESC")) {
            ps.setString(1, ip);
            ps.setString(2, excludeUuid != null ? excludeUuid : "");
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new AltEntry(
                            rs.getString("ip"), rs.getString("uuid"),
                            rs.getString("name"), rs.getLong("first_seen"),
                            rs.getLong("last_seen")));
                }
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[AltAccounts] getAccountsForIp erreur", e);
        }
        return result;
    }

    /** Recherche de joueurs par préfixe/sous-chaîne de nom (insensible à la casse). */
    public synchronized List<AltEntry> searchByName(String query, int limit) {
        List<AltEntry> out = new ArrayList<>();
        if (query == null || query.isBlank()) return out;
        String pattern = "%" + query.toLowerCase() + "%";
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT ip, uuid, name, first_seen, last_seen FROM alt_ip_accounts " +
                "WHERE LOWER(name) LIKE ? GROUP BY uuid ORDER BY last_seen DESC LIMIT ?")) {
            ps.setString(1, pattern);
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(new AltEntry(
                        rs.getString("ip"), rs.getString("uuid"),
                        rs.getString("name"), rs.getLong("first_seen"),
                        rs.getLong("last_seen")));
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[AltAccounts] searchByName erreur", e);
        }
        return out;
    }

    public record AltEntry(String ip, String uuid, String name, long firstSeen, long lastSeen) {}
}
