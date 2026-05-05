package sunanticheat.dashboard.social;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.*;
import java.util.logging.Logger;

public final class FriendStore {

    private final Database db;
    private final Logger logger;

    public FriendStore(Database db, Logger logger) {
        this.db = db;
        this.logger = logger;
        migrate();
    }

    private void migrate() {
        db.migrate("social_friends", 1, """
            CREATE TABLE IF NOT EXISTS friend_requests (
                id            TEXT NOT NULL PRIMARY KEY,
                sender_uuid   TEXT NOT NULL,
                receiver_uuid TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'pending',
                created_at    INTEGER NOT NULL,
                updated_at    INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS friendships (
                id          TEXT NOT NULL PRIMARY KEY,
                user_uuid   TEXT NOT NULL,
                friend_uuid TEXT NOT NULL,
                created_at  INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_fr_sender   ON friend_requests(sender_uuid);
            CREATE INDEX IF NOT EXISTS idx_fr_receiver ON friend_requests(receiver_uuid);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_fr_pair ON friend_requests(sender_uuid, receiver_uuid, status);
            CREATE INDEX IF NOT EXISTS idx_fs_user     ON friendships(user_uuid);
            CREATE INDEX IF NOT EXISTS idx_fs_friend   ON friendships(friend_uuid)""");
    }

    // ── Requests ─────────────────────────────────────────────────────────────

    public Map<String, Object> sendRequest(String senderUuid, String receiverUuid) {
        if (senderUuid.equals(receiverUuid)) return null;
        if (areFriends(senderUuid, receiverUuid)) return null;
        if (pendingExists(senderUuid, receiverUuid) || pendingExists(receiverUuid, senderUuid)) return null;

        String id = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT INTO friend_requests(id,sender_uuid,receiver_uuid,status,created_at,updated_at) VALUES(?,?,?,?,?,?)")) {
            ps.setString(1, id); ps.setString(2, senderUuid); ps.setString(3, receiverUuid);
            ps.setString(4, "pending"); ps.setLong(5, now); ps.setLong(6, now);
            ps.executeUpdate();
            return requestMap(id, senderUuid, receiverUuid, "pending", now, now);
        } catch (SQLException e) {
            logger.warning("[FriendStore] sendRequest: " + e.getMessage());
            return null;
        }
    }

    public boolean acceptRequest(String requestId, String receiverUuid) {
        Map<String, Object> req = getRequest(requestId);
        if (req == null || !receiverUuid.equals(req.get("receiver_uuid"))) return false;
        if (!"pending".equals(req.get("status"))) return false;

        String senderUuid = (String) req.get("sender_uuid");
        long now = System.currentTimeMillis();
        try {
            db.conn().setAutoCommit(false);
            try {
                try (PreparedStatement ps = db.conn().prepareStatement(
                        "UPDATE friend_requests SET status='accepted', updated_at=? WHERE id=?")) {
                    ps.setLong(1, now); ps.setString(2, requestId); ps.executeUpdate();
                }
                String id1 = UUID.randomUUID().toString(), id2 = UUID.randomUUID().toString();
                try (PreparedStatement ps = db.conn().prepareStatement(
                        "INSERT INTO friendships(id,user_uuid,friend_uuid,created_at) VALUES(?,?,?,?),(?,?,?,?)")) {
                    ps.setString(1, id1); ps.setString(2, senderUuid); ps.setString(3, receiverUuid); ps.setLong(4, now);
                    ps.setString(5, id2); ps.setString(6, receiverUuid); ps.setString(7, senderUuid); ps.setLong(8, now);
                    ps.executeUpdate();
                }
                db.conn().commit();
                return true;
            } catch (SQLException e) {
                db.conn().rollback();
                throw e;
            } finally {
                db.conn().setAutoCommit(true);
            }
        } catch (SQLException e) {
            logger.warning("[FriendStore] acceptRequest: " + e.getMessage());
            return false;
        }
    }

    public boolean declineRequest(String requestId, String receiverUuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE friend_requests SET status='declined', updated_at=? WHERE id=? AND receiver_uuid=? AND status='pending'")) {
            ps.setLong(1, System.currentTimeMillis()); ps.setString(2, requestId); ps.setString(3, receiverUuid);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            logger.warning("[FriendStore] declineRequest: " + e.getMessage());
            return false;
        }
    }

    public boolean cancelRequest(String requestId, String senderUuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE friend_requests SET status='cancelled', updated_at=? WHERE id=? AND sender_uuid=? AND status='pending'")) {
            ps.setLong(1, System.currentTimeMillis()); ps.setString(2, requestId); ps.setString(3, senderUuid);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            logger.warning("[FriendStore] cancelRequest: " + e.getMessage());
            return false;
        }
    }

    public boolean removeFriend(String userUuid, String friendUuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "DELETE FROM friendships WHERE (user_uuid=? AND friend_uuid=?) OR (user_uuid=? AND friend_uuid=?)")) {
            ps.setString(1, userUuid); ps.setString(2, friendUuid);
            ps.setString(3, friendUuid); ps.setString(4, userUuid);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            logger.warning("[FriendStore] removeFriend: " + e.getMessage());
            return false;
        }
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getFriends(String userUuid) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT f.friend_uuid, f.created_at, p.username " +
                "FROM friendships f LEFT JOIN player_accounts p ON p.uuid=f.friend_uuid " +
                "WHERE f.user_uuid=? ORDER BY p.username ASC")) {
            ps.setString(1, userUuid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("uuid", rs.getString("friend_uuid"));
                    m.put("username", rs.getString("username"));
                    m.put("since", rs.getLong("created_at"));
                    list.add(m);
                }
            }
        } catch (SQLException e) {
            logger.warning("[FriendStore] getFriends: " + e.getMessage());
        }
        return list;
    }

    public int getFriendCount(String userUuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT COUNT(*) FROM friendships WHERE user_uuid=?")) {
            ps.setString(1, userUuid);
            try (ResultSet rs = ps.executeQuery()) { if (rs.next()) return rs.getInt(1); }
        } catch (SQLException e) {
            logger.warning("[FriendStore] getFriendCount: " + e.getMessage());
        }
        return 0;
    }

    public List<Map<String, Object>> getIncomingRequests(String receiverUuid) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT fr.*, p.username AS sender_name " +
                "FROM friend_requests fr LEFT JOIN player_accounts p ON p.uuid=fr.sender_uuid " +
                "WHERE fr.receiver_uuid=? AND fr.status='pending' ORDER BY fr.created_at DESC")) {
            ps.setString(1, receiverUuid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(requestRowNamed(rs, "sender_name", "sender_uuid"));
            }
        } catch (SQLException e) {
            logger.warning("[FriendStore] getIncomingRequests: " + e.getMessage());
        }
        return list;
    }

    public List<Map<String, Object>> getOutgoingRequests(String senderUuid) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT fr.*, p.username AS receiver_name " +
                "FROM friend_requests fr LEFT JOIN player_accounts p ON p.uuid=fr.receiver_uuid " +
                "WHERE fr.sender_uuid=? AND fr.status='pending' ORDER BY fr.created_at DESC")) {
            ps.setString(1, senderUuid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(requestRowNamed(rs, "receiver_name", "receiver_uuid"));
            }
        } catch (SQLException e) {
            logger.warning("[FriendStore] getOutgoingRequests: " + e.getMessage());
        }
        return list;
    }

    /** Returns: "self" | "friends" | "request_sent" | "request_received" | "none" */
    public String getRelation(String viewerUuid, String targetUuid) {
        if (viewerUuid.equals(targetUuid)) return "self";
        if (areFriends(viewerUuid, targetUuid)) return "friends";
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT id, sender_uuid FROM friend_requests WHERE ((sender_uuid=? AND receiver_uuid=?) OR (sender_uuid=? AND receiver_uuid=?)) AND status='pending' LIMIT 1")) {
            ps.setString(1, viewerUuid); ps.setString(2, targetUuid);
            ps.setString(3, targetUuid); ps.setString(4, viewerUuid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return viewerUuid.equals(rs.getString("sender_uuid")) ? "request_sent" : "request_received";
            }
        } catch (SQLException e) {
            logger.warning("[FriendStore] getRelation: " + e.getMessage());
        }
        return "none";
    }

    /** Returns the pending request id from viewer→target, or null. */
    public String getPendingRequestId(String senderUuid, String receiverUuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT id FROM friend_requests WHERE sender_uuid=? AND receiver_uuid=? AND status='pending' LIMIT 1")) {
            ps.setString(1, senderUuid); ps.setString(2, receiverUuid);
            try (ResultSet rs = ps.executeQuery()) { if (rs.next()) return rs.getString("id"); }
        } catch (SQLException e) {
            logger.warning("[FriendStore] getPendingRequestId: " + e.getMessage());
        }
        return null;
    }

    public List<Map<String, Object>> searchUsers(String query, String viewerUuid, int limit) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT uuid, username FROM player_accounts WHERE LOWER(username) LIKE LOWER(?) AND uuid != ? ORDER BY username ASC LIMIT ?")) {
            ps.setString(1, "%" + query + "%"); ps.setString(2, viewerUuid); ps.setInt(3, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("uuid", rs.getString("uuid"));
                    m.put("username", rs.getString("username"));
                    list.add(m);
                }
            }
        } catch (SQLException e) {
            logger.warning("[FriendStore] searchUsers: " + e.getMessage());
        }
        return list;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    public boolean areFriends(String a, String b) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT 1 FROM friendships WHERE user_uuid=? AND friend_uuid=? LIMIT 1")) {
            ps.setString(1, a); ps.setString(2, b);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        } catch (SQLException e) { return false; }
    }

    private boolean pendingExists(String from, String to) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT 1 FROM friend_requests WHERE sender_uuid=? AND receiver_uuid=? AND status='pending' LIMIT 1")) {
            ps.setString(1, from); ps.setString(2, to);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        } catch (SQLException e) { return false; }
    }

    private Map<String, Object> getRequest(String id) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM friend_requests WHERE id=?")) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                return requestMap(rs.getString("id"), rs.getString("sender_uuid"),
                        rs.getString("receiver_uuid"), rs.getString("status"),
                        rs.getLong("created_at"), rs.getLong("updated_at"));
            }
        } catch (SQLException e) {
            logger.warning("[FriendStore] getRequest: " + e.getMessage());
            return null;
        }
    }

    private static Map<String, Object> requestMap(String id, String sender, String receiver,
                                                   String status, long createdAt, long updatedAt) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id); m.put("sender_uuid", sender); m.put("receiver_uuid", receiver);
        m.put("status", status); m.put("created_at", createdAt); m.put("updated_at", updatedAt);
        return m;
    }

    private static Map<String, Object> requestRowNamed(ResultSet rs, String nameCol, String uuidCol) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", rs.getString("id"));
        m.put("sender_uuid", rs.getString("sender_uuid"));
        m.put("receiver_uuid", rs.getString("receiver_uuid"));
        m.put("status", rs.getString("status"));
        m.put("created_at", rs.getLong("created_at"));
        m.put("uuid", rs.getString(uuidCol));
        m.put("username", rs.getString(nameCol));
        return m;
    }
}
