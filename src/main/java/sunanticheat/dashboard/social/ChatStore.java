package sunanticheat.dashboard.social;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.*;
import java.util.logging.Logger;

public final class ChatStore {

    private final Database db;
    private final Logger logger;

    public ChatStore(Database db, Logger logger) {
        this.db = db;
        this.logger = logger;
        migrate();
    }

    private void migrate() {
        db.migrate("social_chat", 1, """
            CREATE TABLE IF NOT EXISTS chat_conversations (
                id              TEXT NOT NULL PRIMARY KEY,
                participant1    TEXT NOT NULL,
                participant2    TEXT NOT NULL,
                last_message_at INTEGER NOT NULL,
                created_at      INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id              TEXT NOT NULL PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                sender_uuid     TEXT NOT NULL,
                content         TEXT NOT NULL,
                read_at         INTEGER,
                created_at      INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_pair ON chat_conversations(participant1, participant2);
            CREATE INDEX IF NOT EXISTS idx_conv_p1  ON chat_conversations(participant1);
            CREATE INDEX IF NOT EXISTS idx_conv_p2  ON chat_conversations(participant2);
            CREATE INDEX IF NOT EXISTS idx_msg_conv ON chat_messages(conversation_id, created_at)""");
    }

    public Map<String, Object> getOrCreateConversation(String uuid1, String uuid2) {
        // Normalize order for uniqueness
        String p1 = uuid1.compareTo(uuid2) < 0 ? uuid1 : uuid2;
        String p2 = uuid1.compareTo(uuid2) < 0 ? uuid2 : uuid1;

        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM chat_conversations WHERE participant1=? AND participant2=?")) {
            ps.setString(1, p1); ps.setString(2, p2);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return convRow(rs);
            }
        } catch (SQLException e) {
            logger.warning("[ChatStore] getConversation: " + e.getMessage());
            return null;
        }

        String id = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT INTO chat_conversations(id,participant1,participant2,last_message_at,created_at) VALUES(?,?,?,?,?)")) {
            ps.setString(1, id); ps.setString(2, p1); ps.setString(3, p2); ps.setLong(4, now); ps.setLong(5, now);
            ps.executeUpdate();
            Map<String, Object> m = convMap(id, p1, p2, now, now);
            return m;
        } catch (SQLException e) {
            logger.warning("[ChatStore] createConversation: " + e.getMessage());
            return null;
        }
    }

    public Map<String, Object> getConversationById(String convId) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM chat_conversations WHERE id=?")) {
            ps.setString(1, convId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return convRow(rs);
            }
        } catch (SQLException e) {
            logger.warning("[ChatStore] getConversationById: " + e.getMessage());
        }
        return null;
    }

    public boolean isParticipant(String convId, String uuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT 1 FROM chat_conversations WHERE id=? AND (participant1=? OR participant2=?)")) {
            ps.setString(1, convId); ps.setString(2, uuid); ps.setString(3, uuid);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        } catch (SQLException e) { return false; }
    }

    public Map<String, Object> sendMessage(String convId, String senderUuid, String content) {
        if (content == null || content.isBlank() || content.length() > 1000) return null;
        String id = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();
        try {
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "INSERT INTO chat_messages(id,conversation_id,sender_uuid,content,created_at) VALUES(?,?,?,?,?)")) {
                ps.setString(1, id); ps.setString(2, convId); ps.setString(3, senderUuid);
                ps.setString(4, content.trim()); ps.setLong(5, now);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "UPDATE chat_conversations SET last_message_at=? WHERE id=?")) {
                ps.setLong(1, now); ps.setString(2, convId); ps.executeUpdate();
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id); m.put("conversation_id", convId); m.put("sender_uuid", senderUuid);
            m.put("content", content.trim()); m.put("read_at", null); m.put("created_at", now);
            return m;
        } catch (SQLException e) {
            logger.warning("[ChatStore] sendMessage: " + e.getMessage());
            return null;
        }
    }

    public List<Map<String, Object>> getMessages(String convId, int limit, Long beforeTs) {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = beforeTs != null
                ? "SELECT * FROM chat_messages WHERE conversation_id=? AND created_at<? ORDER BY created_at DESC LIMIT ?"
                : "SELECT * FROM chat_messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT ?";
        try (PreparedStatement ps = db.conn().prepareStatement(sql)) {
            ps.setString(1, convId);
            if (beforeTs != null) { ps.setLong(2, beforeTs); ps.setInt(3, limit); }
            else                  { ps.setInt(2, limit); }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getString("id"));
                    m.put("conversation_id", rs.getString("conversation_id"));
                    m.put("sender_uuid", rs.getString("sender_uuid"));
                    m.put("content", rs.getString("content"));
                    long readAt = rs.getLong("read_at");
                    m.put("read_at", rs.wasNull() ? null : readAt);
                    m.put("created_at", rs.getLong("created_at"));
                    list.add(m);
                }
            }
        } catch (SQLException e) {
            logger.warning("[ChatStore] getMessages: " + e.getMessage());
        }
        Collections.reverse(list);
        return list;
    }

    public List<Map<String, Object>> getNewMessages(String convId, long afterTs) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT * FROM chat_messages WHERE conversation_id=? AND created_at>? ORDER BY created_at ASC LIMIT 100")) {
            ps.setString(1, convId); ps.setLong(2, afterTs);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getString("id"));
                    m.put("conversation_id", rs.getString("conversation_id"));
                    m.put("sender_uuid", rs.getString("sender_uuid"));
                    m.put("content", rs.getString("content"));
                    long readAt = rs.getLong("read_at");
                    m.put("read_at", rs.wasNull() ? null : readAt);
                    m.put("created_at", rs.getLong("created_at"));
                    list.add(m);
                }
            }
        } catch (SQLException e) {
            logger.warning("[ChatStore] getNewMessages: " + e.getMessage());
        }
        return list;
    }

    public void markRead(String convId, String readerUuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "UPDATE chat_messages SET read_at=? WHERE conversation_id=? AND sender_uuid!=? AND read_at IS NULL")) {
            ps.setLong(1, System.currentTimeMillis()); ps.setString(2, convId); ps.setString(3, readerUuid);
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.warning("[ChatStore] markRead: " + e.getMessage());
        }
    }

    public List<Map<String, Object>> getConversations(String userUuid) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT c.*, p1.username AS username1, p2.username AS username2, " +
                "(SELECT content FROM chat_messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) AS last_msg, " +
                "(SELECT COUNT(*) FROM chat_messages WHERE conversation_id=c.id AND sender_uuid!=? AND read_at IS NULL) AS unread " +
                "FROM chat_conversations c " +
                "LEFT JOIN player_accounts p1 ON p1.uuid=c.participant1 " +
                "LEFT JOIN player_accounts p2 ON p2.uuid=c.participant2 " +
                "WHERE c.participant1=? OR c.participant2=? " +
                "ORDER BY c.last_message_at DESC")) {
            ps.setString(1, userUuid); ps.setString(2, userUuid); ps.setString(3, userUuid);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = convRow(rs);
                    m.put("username1", rs.getString("username1"));
                    m.put("username2", rs.getString("username2"));
                    m.put("last_msg", rs.getString("last_msg"));
                    m.put("unread", rs.getInt("unread"));
                    list.add(m);
                }
            }
        } catch (SQLException e) {
            logger.warning("[ChatStore] getConversations: " + e.getMessage());
        }
        return list;
    }

    public int totalUnread(String userUuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT COUNT(*) FROM chat_messages m " +
                "JOIN chat_conversations c ON c.id=m.conversation_id " +
                "WHERE (c.participant1=? OR c.participant2=?) AND m.sender_uuid!=? AND m.read_at IS NULL")) {
            ps.setString(1, userUuid); ps.setString(2, userUuid); ps.setString(3, userUuid);
            try (ResultSet rs = ps.executeQuery()) { if (rs.next()) return rs.getInt(1); }
        } catch (SQLException e) {
            logger.warning("[ChatStore] totalUnread: " + e.getMessage());
        }
        return 0;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static Map<String, Object> convRow(ResultSet rs) throws SQLException {
        return convMap(rs.getString("id"), rs.getString("participant1"),
                rs.getString("participant2"), rs.getLong("last_message_at"), rs.getLong("created_at"));
    }

    private static Map<String, Object> convMap(String id, String p1, String p2, long lastMsg, long createdAt) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id); m.put("participant1", p1); m.put("participant2", p2);
        m.put("last_message_at", lastMsg); m.put("created_at", createdAt);
        return m;
    }
}
