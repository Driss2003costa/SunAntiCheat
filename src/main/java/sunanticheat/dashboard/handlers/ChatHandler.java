package sunanticheat.dashboard.handlers;

import com.google.gson.reflect.TypeToken;
import com.sun.net.httpserver.HttpExchange;
import io.jsonwebtoken.Claims;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.portal.PlayerJwtUtil;
import sunanticheat.dashboard.social.ChatStore;
import sunanticheat.dashboard.social.FriendStore;

import java.io.IOException;
import java.util.List;
import java.util.Map;

public final class ChatHandler {

    private final ChatStore chatStore;
    private final FriendStore friendStore;
    private final PlayerJwtUtil playerJwt;

    public ChatHandler(ChatStore chatStore, FriendStore friendStore, PlayerJwtUtil playerJwt) {
        this.chatStore   = chatStore;
        this.friendStore = friendStore;
        this.playerJwt   = playerJwt;
    }

    /** GET /api/public/messages */
    public void listConversations(HttpExchange ex) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        List<Map<String, Object>> convs = chatStore.getConversations(uuid);
        // Détermine l'interlocuteur et ajoute son username directement
        for (Map<String, Object> c : convs) {
            String p1 = (String) c.get("participant1");
            String p2 = (String) c.get("participant2");
            c.put("other_uuid",     uuid.equals(p1) ? p2 : p1);
            c.put("other_username", uuid.equals(p1) ? c.get("username2") : c.get("username1"));
            c.remove("username1"); c.remove("username2");
        }
        HttpHelper.json(ex, 200, Map.of("conversations", convs,
                "total_unread", chatStore.totalUnread(uuid)));
    }

    /** POST /api/public/messages/open — body: {target_uuid} */
    public void openConversation(HttpExchange ex) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        Map<String, String> body = parseBody(ex);
        if (body == null) { HttpHelper.error(ex, 400, "Corps JSON requis"); return; }
        String targetUuid = body.get("target_uuid");
        if (targetUuid == null || targetUuid.isBlank()) {
            HttpHelper.error(ex, 400, "target_uuid requis"); return;
        }
        if (uuid.equals(targetUuid)) { HttpHelper.error(ex, 400, "Impossible de vous écrire à vous-même"); return; }

        // Seuls les amis peuvent s'écrire
        if (!friendStore.areFriends(uuid, targetUuid)) {
            HttpHelper.error(ex, 403, "Vous devez être amis pour envoyer un message"); return;
        }

        Map<String, Object> conv = chatStore.getOrCreateConversation(uuid, targetUuid);
        if (conv == null) { HttpHelper.error(ex, 500, "Erreur création conversation"); return; }
        HttpHelper.json(ex, 200, conv);
    }

    /** GET /api/public/messages/:convId — ?before=<ts>&limit=50 */
    public void getMessages(HttpExchange ex, String convId) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        if (!chatStore.isParticipant(convId, uuid)) {
            HttpHelper.error(ex, 403, "Accès interdit"); return;
        }
        int limit = Math.min(HttpHelper.queryInt(ex, "limit", 50), 100);
        String beforeStr = HttpHelper.queryParam(ex, "before");
        Long beforeTs = null;
        if (beforeStr != null) {
            try { beforeTs = Long.parseLong(beforeStr); } catch (NumberFormatException ignored) {}
        }
        List<Map<String, Object>> messages = chatStore.getMessages(convId, limit, beforeTs);
        chatStore.markRead(convId, uuid);
        HttpHelper.json(ex, 200, Map.of("messages", messages));
    }

    /** GET /api/public/messages/:convId/poll — ?after=<ts> (long-polling light) */
    public void pollMessages(HttpExchange ex, String convId) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        if (!chatStore.isParticipant(convId, uuid)) {
            HttpHelper.error(ex, 403, "Accès interdit"); return;
        }
        String afterStr = HttpHelper.queryParam(ex, "after");
        long afterTs = 0;
        if (afterStr != null) {
            try { afterTs = Long.parseLong(afterStr); } catch (NumberFormatException ignored) {}
        }
        List<Map<String, Object>> newMsgs = chatStore.getNewMessages(convId, afterTs);
        if (!newMsgs.isEmpty()) chatStore.markRead(convId, uuid);
        HttpHelper.json(ex, 200, Map.of("messages", newMsgs,
                "unread", chatStore.totalUnread(uuid)));
    }

    /** POST /api/public/messages/:convId/send — body: {content} */
    public void sendMessage(HttpExchange ex, String convId) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        if (!chatStore.isParticipant(convId, uuid)) {
            HttpHelper.error(ex, 403, "Accès interdit"); return;
        }
        Map<String, String> body = parseBody(ex);
        if (body == null) { HttpHelper.error(ex, 400, "Corps JSON requis"); return; }
        String content = body.get("content");
        if (content == null || content.isBlank()) {
            HttpHelper.error(ex, 400, "Contenu requis"); return;
        }
        if (content.length() > 1000) {
            HttpHelper.error(ex, 400, "Message trop long (max 1000 caractères)"); return;
        }
        Map<String, Object> msg = chatStore.sendMessage(convId, uuid, content);
        if (msg == null) { HttpHelper.error(ex, 500, "Erreur envoi message"); return; }
        HttpHelper.json(ex, 200, msg);
    }

    /** POST /api/public/messages/:convId/read */
    public void markRead(HttpExchange ex, String convId) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        if (!chatStore.isParticipant(convId, uuid)) {
            HttpHelper.error(ex, 403, "Accès interdit"); return;
        }
        chatStore.markRead(convId, uuid);
        HttpHelper.json(ex, 200, Map.of("ok", true, "unread", chatStore.totalUnread(uuid)));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String auth(HttpExchange ex) throws IOException {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            HttpHelper.error(ex, 401, "Non authentifié"); return null;
        }
        try {
            Claims claims = playerJwt.validate(header.substring(7));
            return claims.getSubject();
        } catch (Exception e) {
            HttpHelper.error(ex, 401, "Token invalide ou expiré"); return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> parseBody(HttpExchange ex) throws IOException {
        try {
            String raw = HttpHelper.body(ex);
            if (raw == null || raw.isBlank()) return null;
            return HttpHelper.GSON.fromJson(raw, new TypeToken<Map<String, String>>(){}.getType());
        } catch (Exception e) { return null; }
    }
}
