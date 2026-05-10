package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.portal.PlayerJwtUtil;
import sunanticheat.dashboard.quests.Quest;
import sunanticheat.dashboard.quests.QuestStore;

import java.io.IOException;
import java.util.*;

public final class QuestHandler {

    private final QuestStore store;
    private final PlayerJwtUtil playerJwt;
    private final sunanticheat.dashboard.quests.QuestTemplateLoader templates;

    public QuestHandler(QuestStore store, PlayerJwtUtil playerJwt,
                        sunanticheat.dashboard.quests.QuestTemplateLoader templates) {
        this.store = store;
        this.playerJwt = playerJwt;
        this.templates = templates;
    }

    public void publicList(HttpExchange ex) throws IOException {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Quest q : store.all()) {
            if (!q.isEnabled() || q.isExpired()) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",          q.getId());
            m.put("title",       q.getTitle());
            m.put("description", q.getDescription());
            if (q.getTitleEn() != null)       m.put("titleEn", q.getTitleEn());
            if (q.getDescriptionEn() != null) m.put("descriptionEn", q.getDescriptionEn());
            m.put("icon",        q.getIcon());
            m.put("color",       q.getColor());
            m.put("type",        q.getType().name());
            m.put("target",      q.getTarget());
            m.put("goal",        q.getGoal());
            m.put("rewardLabel", q.getRewardLabel());
            if (q.getRewardLabelEn() != null) m.put("rewardLabelEn", q.getRewardLabelEn());
            m.put("repeatable",  q.isRepeatable());
            m.put("completions", store.completedFor(q.getId()).size());
            m.put("inProgress",  store.progressFor(q.getId()).size());
            if (q.getEndsAt() != null) m.put("endsAt", q.getEndsAt());
            out.add(m);
        }
        HttpHelper.json(ex, 200, Map.of("quests", out));
    }

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        List<Map<String, Object>> out = new ArrayList<>();
        for (Quest q : store.all()) {
            Map<String, Object> m = toMap(q);
            m.put("completions", store.completedFor(q.getId()).size());
            m.put("inProgress", store.progressFor(q.getId()).size());
            out.add(m);
        }
        HttpHelper.json(ex, 200, Map.of("quests", out));
    }

    @SuppressWarnings("unchecked")
    public void create(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        Quest.Type type;
        try { type = Quest.Type.valueOf(((String) body.getOrDefault("type", "BREAK_BLOCK")).toUpperCase()); }
        catch (Exception e) { type = Quest.Type.BREAK_BLOCK; }

        Long endsAt = body.get("endsAt") instanceof Number ? ((Number) body.get("endsAt")).longValue() : null;
        Quest q = store.add(
                (String) body.get("title"),
                (String) body.getOrDefault("description", ""),
                (String) body.get("titleEn"),
                (String) body.get("descriptionEn"),
                (String) body.getOrDefault("icon", "⭐"),
                (String) body.getOrDefault("color", "#8B5CF6"),
                type,
                (String) body.getOrDefault("target", "ANY"),
                ((Number) body.getOrDefault("goal", 1)).intValue(),
                (String) body.get("rewardCommand"),
                (String) body.getOrDefault("rewardLabel", ""),
                (String) body.get("rewardLabelEn"),
                Boolean.TRUE.equals(body.getOrDefault("enabled", true)),
                Boolean.TRUE.equals(body.get("repeatable")),
                endsAt
        );
        HttpHelper.json(ex, 200, toMap(q));
    }

    /** GET /api/quests/templates — bibliothèque de quêtes pré-faites (admin). */
    public void listTemplates(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        HttpHelper.json(ex, 200, templates.publicView());
    }

    /** POST /api/quests/from-template — instancie une quête à partir d'un template. */
    @SuppressWarnings("unchecked")
    public void createFromTemplate(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null || body.get("templateId") == null) {
            HttpHelper.error(ex, 400, "templateId requis"); return;
        }
        String templateId = body.get("templateId").toString();
        Map<String, Object> payload = templates.toQuestPayload(templateId);
        if (payload == null) { HttpHelper.error(ex, 404, "template introuvable"); return; }

        // Overrides optionnels (si l'admin a customisé avant le clic "ajouter")
        for (String key : List.of("title","titleEn","description","descriptionEn","icon","color",
                "type","target","goal","rewardCommand","rewardLabel","rewardLabelEn","repeatable","endsAt")) {
            if (body.containsKey(key)) payload.put(key, body.get(key));
        }

        Quest.Type type;
        try { type = Quest.Type.valueOf(payload.getOrDefault("type", "BREAK_BLOCK").toString().toUpperCase()); }
        catch (Exception e) { type = Quest.Type.BREAK_BLOCK; }

        Long endsAt = payload.get("endsAt") instanceof Number
                ? ((Number) payload.get("endsAt")).longValue() : null;

        Quest q = store.add(
                (String) payload.get("title"),
                (String) payload.getOrDefault("description", ""),
                (String) payload.get("titleEn"),
                (String) payload.get("descriptionEn"),
                (String) payload.getOrDefault("icon", "⭐"),
                (String) payload.getOrDefault("color", "#8B5CF6"),
                type,
                (String) payload.getOrDefault("target", "ANY"),
                ((Number) payload.getOrDefault("goal", 1)).intValue(),
                (String) payload.get("rewardCommand"),
                (String) payload.getOrDefault("rewardLabel", ""),
                (String) payload.get("rewardLabelEn"),
                true,
                Boolean.TRUE.equals(payload.get("repeatable")),
                endsAt
        );
        HttpHelper.json(ex, 200, toMap(q));
    }

    @SuppressWarnings("unchecked")
    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        Quest q = store.update(id, body);
        if (q == null) { HttpHelper.error(ex, 404, "quête introuvable"); return; }
        HttpHelper.json(ex, 200, toMap(q));
    }

    public void delete(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        boolean ok = store.delete(id);
        HttpHelper.json(ex, ok ? 200 : 404, Map.of("ok", ok));
    }

    public void playerProgress(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String uuid) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        HttpHelper.json(ex, 200, Map.of("progress", store.playerProgress(uuid)));
    }

    public void publicPlayerProgress(HttpExchange ex) throws IOException {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            HttpHelper.error(ex, 401, "Non authentifié"); return;
        }
        String uuid;
        try {
            uuid = playerJwt.validate(header.substring(7)).getSubject();
        } catch (Exception e) {
            HttpHelper.error(ex, 401, "Token invalide ou expiré"); return;
        }
        HttpHelper.json(ex, 200, Map.of("progress", store.playerProgress(uuid)));
    }

    private static Map<String, Object> toMap(Quest q) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", q.getId());
        m.put("title", q.getTitle());
        m.put("description", q.getDescription());
        m.put("titleEn", q.getTitleEn());
        m.put("descriptionEn", q.getDescriptionEn());
        m.put("icon", q.getIcon());
        m.put("color", q.getColor());
        m.put("type", q.getType().name());
        m.put("target", q.getTarget());
        m.put("goal", q.getGoal());
        m.put("rewardCommand", q.getRewardCommand());
        m.put("rewardLabel", q.getRewardLabel());
        m.put("rewardLabelEn", q.getRewardLabelEn());
        m.put("enabled", q.isEnabled());
        m.put("repeatable", q.isRepeatable());
        m.put("createdAt", q.getCreatedAt());
        if (q.getEndsAt() != null) m.put("endsAt", q.getEndsAt());
        return m;
    }
}
