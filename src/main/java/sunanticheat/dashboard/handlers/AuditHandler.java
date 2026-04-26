package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.audit.AuditEntry;
import sunanticheat.dashboard.audit.AuditStore;

import java.io.IOException;
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

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entries", entries);
        out.put("total", store.totalCount());
        out.put("offset", offset);
        out.put("limit", limit);
        out.put("hasMore", entries.size() == limit);
        HttpHelper.json(ex, 200, out);
    }

    /** GET /api/audit/actions — liste des actions distinctes (pour le filtre frontend). */
    public void actions(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        HttpHelper.json(ex, 200, store.distinctActions());
    }
}
