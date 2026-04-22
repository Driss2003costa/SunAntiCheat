package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.quests.Quest;
import sunanticheat.dashboard.quests.QuestStore;

import java.io.IOException;
import java.util.*;

public final class QuestHandler {

    private final QuestStore store;

    public QuestHandler(QuestStore store) { this.store = store; }

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

        Quest q = store.add(
                (String) body.get("title"),
                (String) body.getOrDefault("description", ""),
                (String) body.getOrDefault("icon", "⭐"),
                (String) body.getOrDefault("color", "#8B5CF6"),
                type,
                (String) body.getOrDefault("target", "ANY"),
                ((Number) body.getOrDefault("goal", 1)).intValue(),
                (String) body.get("rewardCommand"),
                (String) body.getOrDefault("rewardLabel", ""),
                Boolean.TRUE.equals(body.getOrDefault("enabled", true)),
                Boolean.TRUE.equals(body.get("repeatable"))
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

    private static Map<String, Object> toMap(Quest q) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", q.getId());
        m.put("title", q.getTitle());
        m.put("description", q.getDescription());
        m.put("icon", q.getIcon());
        m.put("color", q.getColor());
        m.put("type", q.getType().name());
        m.put("target", q.getTarget());
        m.put("goal", q.getGoal());
        m.put("rewardCommand", q.getRewardCommand());
        m.put("rewardLabel", q.getRewardLabel());
        m.put("enabled", q.isEnabled());
        m.put("repeatable", q.isRepeatable());
        m.put("createdAt", q.getCreatedAt());
        return m;
    }
}
