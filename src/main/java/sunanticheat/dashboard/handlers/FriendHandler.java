package sunanticheat.dashboard.handlers;

import com.google.gson.reflect.TypeToken;
import com.sun.net.httpserver.HttpExchange;
import io.jsonwebtoken.Claims;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.portal.PlayerJwtUtil;
import sunanticheat.dashboard.quests.QuestStore;
import sunanticheat.dashboard.social.FriendStore;

import java.io.IOException;
import java.util.List;
import java.util.Map;

public final class FriendHandler {

    private final FriendStore friendStore;
    private final PlayerJwtUtil playerJwt;
    private final QuestStore questStore;

    public FriendHandler(FriendStore friendStore, PlayerJwtUtil playerJwt, QuestStore questStore) {
        this.friendStore = friendStore;
        this.playerJwt   = playerJwt;
        this.questStore  = questStore;
    }

    /** GET /api/public/friends */
    public void list(HttpExchange ex) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        HttpHelper.json(ex, 200, Map.of("friends", friendStore.getFriends(uuid)));
    }

    /** GET /api/public/friends/requests/incoming */
    public void incoming(HttpExchange ex) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        HttpHelper.json(ex, 200, Map.of("requests", friendStore.getIncomingRequests(uuid)));
    }

    /** GET /api/public/friends/requests/outgoing */
    public void outgoing(HttpExchange ex) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        HttpHelper.json(ex, 200, Map.of("requests", friendStore.getOutgoingRequests(uuid)));
    }

    /** POST /api/public/friends/request/:targetUuid */
    public void sendRequest(HttpExchange ex, String targetUuid) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        if (targetUuid == null || targetUuid.isBlank()) { HttpHelper.error(ex, 400, "targetUuid requis"); return; }

        Map<String, Object> req = friendStore.sendRequest(uuid, targetUuid);
        if (req == null) {
            HttpHelper.json(ex, 409, Map.of("error", "conflict",
                    "message", "Demande déjà envoyée, vous êtes déjà amis, ou action invalide."));
            return;
        }
        HttpHelper.json(ex, 200, req);
    }

    /** POST /api/public/friends/accept/:requestId */
    public void accept(HttpExchange ex, String requestId) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;

        boolean ok = friendStore.acceptRequest(requestId, uuid);
        if (!ok) { HttpHelper.error(ex, 400, "Demande introuvable ou non autorisée"); return; }

        // Quest : FRIEND_COUNT
        int count = friendStore.getFriendCount(uuid);
        questStore.checkSocialQuest(uuid, sunanticheat.dashboard.quests.Quest.Type.FRIEND_COUNT, count);

        HttpHelper.json(ex, 200, Map.of("ok", true, "friend_count", count));
    }

    /** POST /api/public/friends/decline/:requestId */
    public void decline(HttpExchange ex, String requestId) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        boolean ok = friendStore.declineRequest(requestId, uuid);
        if (!ok) { HttpHelper.error(ex, 400, "Demande introuvable ou non autorisée"); return; }
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    /** POST /api/public/friends/cancel/:requestId */
    public void cancel(HttpExchange ex, String requestId) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        boolean ok = friendStore.cancelRequest(requestId, uuid);
        if (!ok) { HttpHelper.error(ex, 400, "Demande introuvable ou non autorisée"); return; }
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    /** DELETE /api/public/friends/:friendUuid */
    public void remove(HttpExchange ex, String friendUuid) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        boolean ok = friendStore.removeFriend(uuid, friendUuid);
        if (!ok) { HttpHelper.error(ex, 404, "Amitié introuvable"); return; }
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    /** GET /api/public/friends/search?q= */
    public void search(HttpExchange ex) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        String q = HttpHelper.queryParam(ex, "q");
        if (q == null || q.trim().length() < 2) {
            HttpHelper.json(ex, 200, Map.of("users", List.of()));
            return;
        }
        List<Map<String, Object>> users = friendStore.searchUsers(q.trim(), uuid, 20);
        // Enrichit avec la relation
        for (Map<String, Object> u : users) {
            String targetUuid = (String) u.get("uuid");
            u.put("relation", friendStore.getRelation(uuid, targetUuid));
        }
        HttpHelper.json(ex, 200, Map.of("users", users));
    }

    /** GET /api/public/friends/relation/:targetUuid */
    public void relation(HttpExchange ex, String targetUuid) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        String rel = friendStore.getRelation(uuid, targetUuid);
        Map<String, Object> resp = new java.util.LinkedHashMap<>();
        resp.put("relation", rel);
        resp.put("friend_count", friendStore.getFriendCount(targetUuid));
        if ("request_sent".equals(rel)) {
            resp.put("request_id", friendStore.getPendingRequestId(uuid, targetUuid));
        } else if ("request_received".equals(rel)) {
            resp.put("request_id", friendStore.getPendingRequestId(targetUuid, uuid));
        }
        HttpHelper.json(ex, 200, resp);
    }

    // ── Auth helper ───────────────────────────────────────────────────────────

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
}
