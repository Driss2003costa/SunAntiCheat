package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.audit.AuditEntry;
import sunanticheat.dashboard.audit.AuditStore;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Endpoints /api/audit/* — consultation de l'audit log.
 *
 * Lecture réservée aux ADMIN (audit log peut contenir des infos sensibles).
 */
public final class AuditHandler {

    private final AuditStore store;

    public AuditHandler(AuditStore store) {
        this.store = store;
    }

    /** GET /api/audit?user=&action=&target=&since=&limit=100&offset=0 — ADMIN. */
    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        String userFilter   = HttpHelper.queryParam(ex, "user");
        String actionFilter = HttpHelper.queryParam(ex, "action");
        String targetFilter = HttpHelper.queryParam(ex, "target");
        long sinceTs        = HttpHelper.queryInt(ex, "since", 0);
        int limit           = Math.min(500, Math.max(1, HttpHelper.queryInt(ex, "limit", 100)));
        int offset          = Math.max(0, HttpHelper.queryInt(ex, "offset", 0));

        List<AuditEntry> entries = store.list(userFilter, actionFilter, targetFilter, sinceTs, limit, offset);

        int total = store.filteredCount(userFilter, actionFilter, targetFilter, sinceTs);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entries", entries);
        out.put("total", total);
        out.put("offset", offset);
        out.put("limit", limit);
        out.put("hasMore", offset + entries.size() < total);
        HttpHelper.json(ex, 200, out);
    }

    /** GET /api/audit/actions — liste des actions distinctes (pour le filtre frontend). */
    public void actions(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        HttpHelper.json(ex, 200, store.distinctActions());
    }

    /**
     * GET /api/audit/export?format=csv&user=&action=&target=&since= — ADMIN.
     * Exporte jusqu'à 10 000 entrées en CSV ou JSON brut.
     */
    public void export(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        String format       = HttpHelper.queryParam(ex, "format");
        String userFilter   = HttpHelper.queryParam(ex, "user");
        String actionFilter = HttpHelper.queryParam(ex, "action");
        String targetFilter = HttpHelper.queryParam(ex, "target");
        long sinceTs        = HttpHelper.queryInt(ex, "since", 0);

        List<AuditEntry> entries = store.list(userFilter, actionFilter, targetFilter, sinceTs, 10_000, 0);

        if ("csv".equalsIgnoreCase(format)) {
            StringBuilder sb = new StringBuilder();
            sb.append("id,timestamp,user,role,action,target,details,ip\n");
            for (AuditEntry e : entries) {
                sb.append(csv(e.id)).append(',');
                sb.append(e.timestamp).append(',');
                sb.append(csv(e.user)).append(',');
                sb.append(csv(e.role)).append(',');
                sb.append(csv(e.action)).append(',');
                sb.append(csv(e.target)).append(',');
                sb.append(csv(e.details)).append(',');
                sb.append(csv(e.ip)).append('\n');
            }
            byte[] bytes = sb.toString().getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().set("Content-Type", "text/csv; charset=utf-8");
            ex.getResponseHeaders().set("Content-Disposition", "attachment; filename=\"audit-export.csv\"");
            ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            ex.sendResponseHeaders(200, bytes.length);
            try (var out = ex.getResponseBody()) { out.write(bytes); }
        } else {
            HttpHelper.json(ex, 200, entries);
        }
    }

    private static String csv(String v) {
        if (v == null) return "";
        if (v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r"))
            return "\"" + v.replace("\"", "\"\"") + "\"";
        return v;
    }
}
