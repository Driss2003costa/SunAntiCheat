package sunanticheat.jobs.tickets;

import sunanticheat.dashboard.db.Database;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Tickets temporaires distribuables par les admins pour donner des bonus
 * limités dans le temps : extra slot, xp boost, bypass heatmap.
 *
 * Stockage SQL ; petit cache mémoire {uuid → Set<type>} pour éviter une
 * requête à chaque action de joueur. Refresh paresseux (TTL 30s).
 */
public final class JobTicketService {

    public static final String TYPE_EXTRA_SLOT     = "extra_slot";
    public static final String TYPE_XP_BOOST_25    = "xp_boost_25";
    public static final String TYPE_BYPASS_HEATMAP = "bypass_heatmap";
    public static final Set<String> ALL_TYPES = Set.of(
            TYPE_EXTRA_SLOT, TYPE_XP_BOOST_25, TYPE_BYPASS_HEATMAP);

    private static final long CACHE_TTL_MS = 30_000;

    private final Database db;
    private final Logger logger;

    private record CachedTickets(Set<String> types, long until) {}
    private final Map<String, CachedTickets> cache = new ConcurrentHashMap<>();

    public JobTicketService(Database db, Logger logger) {
        this.db = db;
        this.logger = logger;
    }

    /** Active ticket types for the player, computed (with cache) at the current time. */
    public Set<String> activeTypes(String uuid) {
        long now = System.currentTimeMillis();
        CachedTickets c = cache.get(uuid);
        if (c != null && c.until > now) return c.types;

        Set<String> types = ConcurrentHashMap.newKeySet();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT type FROM custom_job_tickets WHERE uuid=? AND expires_at > ? AND consumed_at IS NULL")) {
            ps.setString(1, uuid);
            ps.setLong(2, now);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) types.add(rs.getString(1));
            }
        } catch (SQLException e) { logger.warning("[Tickets] activeTypes: " + e.getMessage()); }

        cache.put(uuid, new CachedTickets(types, now + CACHE_TTL_MS));
        return types;
    }

    public boolean has(String uuid, String type) { return activeTypes(uuid).contains(type); }

    /** Active tickets details for the portal (sorted by expiry asc). */
    public List<Map<String, Object>> listActive(String uuid) {
        long now = System.currentTimeMillis();
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT id,type,expires_at,granted_by,granted_at FROM custom_job_tickets " +
                "WHERE uuid=? AND expires_at > ? AND consumed_at IS NULL " +
                "ORDER BY expires_at ASC")) {
            ps.setString(1, uuid);
            ps.setLong(2, now);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",         rs.getInt("id"));
                    m.put("type",       rs.getString("type"));
                    m.put("expires_at", rs.getLong("expires_at"));
                    m.put("granted_by", rs.getString("granted_by"));
                    m.put("granted_at", rs.getLong("granted_at"));
                    list.add(m);
                }
            }
        } catch (SQLException e) { logger.warning("[Tickets] listActive: " + e.getMessage()); }
        return list;
    }

    /** All non-expired tickets across the server (admin overview). */
    public List<Map<String, Object>> listAllActive(int limit) {
        long now = System.currentTimeMillis();
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT id,uuid,type,expires_at,granted_by,granted_at FROM custom_job_tickets " +
                "WHERE expires_at > ? AND consumed_at IS NULL " +
                "ORDER BY granted_at DESC LIMIT ?")) {
            ps.setLong(1, now);
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",         rs.getInt("id"));
                    m.put("uuid",       rs.getString("uuid"));
                    m.put("type",       rs.getString("type"));
                    m.put("expires_at", rs.getLong("expires_at"));
                    m.put("granted_by", rs.getString("granted_by"));
                    m.put("granted_at", rs.getLong("granted_at"));
                    list.add(m);
                }
            }
        } catch (SQLException e) { logger.warning("[Tickets] listAllActive: " + e.getMessage()); }
        return list;
    }

    /** Issue a ticket. Duration in milliseconds. Returns the new ticket id, or -1 on error. */
    public int grant(String uuid, String type, long durationMs, String grantedBy) {
        if (!ALL_TYPES.contains(type)) return -1;
        long now = System.currentTimeMillis();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT INTO custom_job_tickets(uuid,type,expires_at,granted_by,granted_at) VALUES(?,?,?,?,?)",
                java.sql.Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, uuid);
            ps.setString(2, type);
            ps.setLong(3, now + durationMs);
            ps.setString(4, grantedBy == null ? "system" : grantedBy);
            ps.setLong(5, now);
            ps.executeUpdate();
            cache.remove(uuid);
            try (ResultSet keys = ps.getGeneratedKeys()) {
                return keys.next() ? keys.getInt(1) : 0;
            }
        } catch (SQLException e) {
            logger.warning("[Tickets] grant: " + e.getMessage());
            return -1;
        }
    }

    /** Revoke a ticket by id. Returns true if a row was affected. */
    public boolean revoke(int id) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE custom_job_tickets SET consumed_at=? WHERE id=? AND consumed_at IS NULL")) {
            ps.setLong(1, System.currentTimeMillis());
            ps.setInt(2, id);
            int n = ps.executeUpdate();
            if (n > 0) cache.clear();
            return n > 0;
        } catch (SQLException e) {
            logger.warning("[Tickets] revoke: " + e.getMessage());
            return false;
        }
    }

    /** Drop the cached row for a player (useful on grant/revoke). */
    public void invalidate(String uuid) { cache.remove(uuid); }
}
