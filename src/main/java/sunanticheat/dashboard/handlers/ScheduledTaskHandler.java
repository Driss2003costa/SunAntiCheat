package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.tasks.ScheduledTask;
import sunanticheat.dashboard.tasks.ScheduledTaskStore;

import java.io.IOException;
import java.util.*;

public final class ScheduledTaskHandler {

    private final JavaPlugin plugin;
    private final ScheduledTaskStore store;

    public ScheduledTaskHandler(JavaPlugin plugin, ScheduledTaskStore store) {
        this.plugin = plugin;
        this.store = store;
    }

    // GET /api/tasks
    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        List<Map<String, Object>> out = new ArrayList<>();
        for (ScheduledTask t : store.getAll()) out.add(toMap(t));
        out.sort((a, b) -> Long.compare((long) b.get("createdAt"), (long) a.get("createdAt")));
        HttpHelper.json(ex, 200, out);
    }

    // POST /api/tasks
    @SuppressWarnings("unchecked")
    public void create(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.TASKS_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        ScheduledTask t = store.add(
                (String) body.get("name"),
                (String) body.get("command"),
                (List<String>) body.get("times"),
                body.get("enabled") == null || (boolean) body.get("enabled"),
                (String) body.get("color"),
                (String) body.get("icon"));
        HttpHelper.json(ex, 201, toMap(t));
    }

    // PATCH /api/tasks/{id}
    @SuppressWarnings("unchecked")
    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.TASKS_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        Boolean enabled = body.containsKey("enabled") ? (Boolean) body.get("enabled") : null;
        ScheduledTask t = store.update(id,
                (String) body.get("name"),
                (String) body.get("command"),
                (List<String>) body.get("times"),
                enabled,
                (String) body.get("color"),
                (String) body.get("icon"));
        if (t == null) { HttpHelper.error(ex, 404, "Tâche introuvable"); return; }
        HttpHelper.json(ex, 200, toMap(t));
    }

    // DELETE /api/tasks/{id}
    public void delete(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.TASKS_MANAGE)) return;
        boolean ok = store.delete(id);
        if (!ok) { HttpHelper.error(ex, 404, "Tâche introuvable"); return; }
        HttpHelper.noContent(ex);
    }

    // POST /api/tasks/{id}/run
    public void run(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.TASKS_MANAGE)) return;
        boolean ok = store.runNow(plugin, id);
        if (!ok) { HttpHelper.error(ex, 404, "Tâche introuvable"); return; }
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    private static Map<String, Object> toMap(ScheduledTask t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("name", t.getName());
        m.put("command", t.getCommand());
        m.put("times", t.getTimes());
        m.put("enabled", t.isEnabled());
        m.put("color", t.getColor());
        m.put("icon", t.getIcon());
        m.put("lastRun", t.getLastRun());
        m.put("createdAt", t.getCreatedAt());
        return m;
    }
}
