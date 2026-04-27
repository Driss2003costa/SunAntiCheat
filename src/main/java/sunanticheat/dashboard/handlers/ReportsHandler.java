package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.report.ReportEntry;
import sunanticheat.report.ReportStorage;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET /api/reports?limit=50&offset=0&resolved=  — liste paginée des signalements
 * GET /api/reports/{id}                          — détail d'un signalement
 * PUT /api/reports/{id}/resolve                  — marquer résolu
 */
public final class ReportsHandler {

    private final ReportStorage storage;

    public ReportsHandler(ReportStorage storage) {
        this.storage = storage;
    }

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int limit  = Math.max(1, Math.min(200, HttpHelper.queryInt(ex, "limit", 50)));
        int offset = Math.max(0, HttpHelper.queryInt(ex, "offset", 0));
        String resolvedParam = HttpHelper.queryParam(ex, "resolved");

        List<ReportEntry> all = storage.getAll();

        // Filtre optionnel resolved=true/false
        if ("true".equalsIgnoreCase(resolvedParam)) {
            all = all.stream().filter(ReportEntry::isResolved).toList();
        } else if ("false".equalsIgnoreCase(resolvedParam)) {
            all = all.stream().filter(r -> !r.isResolved()).toList();
        }

        int total = all.size();
        List<ReportEntry> page = all.stream().skip(offset).limit(limit).toList();

        List<Map<String, Object>> entries = new ArrayList<>();
        for (ReportEntry r : page) entries.add(toMap(r));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total);
        out.put("limit", limit);
        out.put("offset", offset);
        out.put("entries", entries);
        HttpHelper.json(ex, 200, out);
    }

    public void get(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                    String id) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        ReportEntry r = storage.getAll().stream()
                .filter(e -> id.equals(e.getId()))
                .findFirst().orElse(null);
        if (r == null) { HttpHelper.error(ex, 404, "Report introuvable"); return; }
        HttpHelper.json(ex, 200, toMap(r));
    }

    public void resolve(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                        String id) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        boolean exists = storage.getAll().stream().anyMatch(e -> id.equals(e.getId()));
        if (!exists) { HttpHelper.error(ex, 404, "Report introuvable"); return; }
        storage.markResolved(id);
        HttpHelper.json(ex, 200, Map.of("success", true, "id", id));
    }

    private static Map<String, Object> toMap(ReportEntry r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("reporterName", r.getReporterName());
        m.put("reporterUuid", r.getReporterUuid() != null ? r.getReporterUuid().toString() : null);
        m.put("reportedName", r.getReportedName());
        m.put("reportedUuid", r.getReportedUuid() != null ? r.getReportedUuid().toString() : null);
        m.put("reason", r.getReason());
        m.put("timestamp", r.getTimestamp());
        m.put("resolved", r.isResolved());
        return m;
    }
}
