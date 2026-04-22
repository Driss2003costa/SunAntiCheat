package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.experiments.Experiment;
import sunanticheat.dashboard.experiments.ExperimentStore;

import java.io.IOException;
import java.util.*;

public final class ExperimentHandler {

    private final ExperimentStore store;

    public ExperimentHandler(ExperimentStore store) { this.store = store; }

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        List<Map<String, Object>> out = new ArrayList<>();
        for (Experiment e : store.all()) out.add(toMap(e));
        HttpHelper.json(ex, 200, Map.of("experiments", out));
    }

    @SuppressWarnings("unchecked")
    public void create(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        List<Experiment.Variant> variants = new ArrayList<>();
        List<Map<String, Object>> raw = (List<Map<String, Object>>) body.get("variants");
        if (raw != null) for (Map<String, Object> m : raw) {
            variants.add(new Experiment.Variant(
                    (String) m.get("key"),
                    (String) m.getOrDefault("label", m.get("key")),
                    ((Number) m.getOrDefault("weight", 1)).intValue(),
                    (Map<String, Object>) m.getOrDefault("config", new LinkedHashMap<>())
            ));
        }
        if (variants.isEmpty()) {
            variants.add(new Experiment.Variant("control", "Control", 50, new LinkedHashMap<>()));
            variants.add(new Experiment.Variant("variant", "Variant", 50, new LinkedHashMap<>()));
        }

        Experiment e = store.add((String) body.get("name"),
                (String) body.getOrDefault("description", ""),
                variants);
        HttpHelper.json(ex, 200, toMap(e));
    }

    @SuppressWarnings("unchecked")
    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        Experiment e = store.update(id, body);
        if (e == null) { HttpHelper.error(ex, 404, "experiment introuvable"); return; }
        HttpHelper.json(ex, 200, toMap(e));
    }

    public void delete(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        boolean ok = store.delete(id);
        HttpHelper.json(ex, ok ? 200 : 404, Map.of("ok", ok));
    }

    @SuppressWarnings("unchecked")
    public void track(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        String playerUuid = (String) body.get("playerUuid");
        String metric = (String) body.get("metric");
        double value = ((Number) body.getOrDefault("value", 1)).doubleValue();
        if (playerUuid == null || metric == null) { HttpHelper.error(ex, 400, "playerUuid/metric manquants"); return; }
        store.trackMetric(id, playerUuid, metric, value);
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    private static Map<String, Object> toMap(Experiment e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.getId());
        m.put("name", e.getName());
        m.put("description", e.getDescription());
        m.put("enabled", e.isEnabled());
        m.put("startedAt", e.getStartedAt());
        m.put("endedAt", e.getEndedAt());
        m.put("createdAt", e.getCreatedAt());

        List<Map<String, Object>> vs = new ArrayList<>();
        for (Experiment.Variant v : e.getVariants()) {
            Map<String, Object> vm = new LinkedHashMap<>();
            vm.put("key", v.key);
            vm.put("label", v.label);
            vm.put("weight", v.weight);
            vm.put("config", v.config);
            vm.put("assignedCount", v.assignedCount);
            vm.put("metrics", v.metrics);
            vs.add(vm);
        }
        m.put("variants", vs);
        m.put("totalAssignments", e.getAssignments().size());
        return m;
    }
}
