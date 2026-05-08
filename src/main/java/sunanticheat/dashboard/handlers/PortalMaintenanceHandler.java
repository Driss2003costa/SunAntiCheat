package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.audit.Audit;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.portal.PortalMaintenanceMode;

import java.io.IOException;
import java.util.Map;

/**
 * Endpoints pour le mode maintenance GLOBAL du portail :
 *   GET    /api/portal/maintenance      — admin : état complet
 *   PATCH  /api/portal/maintenance      — admin : activer/désactiver, message + endsAt
 *   GET    /api/public/maintenance      — public : état (pour le portail joueur)
 */
public final class PortalMaintenanceHandler {

    private final PortalMaintenanceMode mode;

    public PortalMaintenanceHandler(PortalMaintenanceMode mode) {
        this.mode = mode;
    }

    public void status(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        HttpHelper.json(ex, 200, mode.exportAdmin());
    }

    @SuppressWarnings("unchecked")
    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        boolean enabled = body.get("enabled") instanceof Boolean
                ? (Boolean) body.get("enabled")
                : Boolean.parseBoolean(String.valueOf(body.getOrDefault("enabled", "false")));
        String message = body.get("message") != null ? body.get("message").toString() : "";
        long endsAt = 0;
        if (body.get("endsAt") instanceof Number n) endsAt = n.longValue();
        else if (body.get("endsAt") != null) {
            try { endsAt = Long.parseLong(body.get("endsAt").toString()); } catch (Exception ignored) {}
        }

        if (enabled) {
            mode.enable(message, endsAt, u.username());
            Audit.log(u, ex, "PORTAL_MAINTENANCE_ON", "global",
                    "Maintenance globale activée" + (endsAt > 0 ? " (ETA " + endsAt + ")" : ""),
                    Map.of("message", message, "endsAt", endsAt));
        } else {
            mode.disable(u.username());
            Audit.log(u, ex, "PORTAL_MAINTENANCE_OFF", "global", "Maintenance globale désactivée");
        }
        HttpHelper.json(ex, 200, Map.of("ok", true, "state", mode.exportAdmin()));
    }

    public void publicStatus(HttpExchange ex) throws IOException {
        HttpHelper.json(ex, 200, mode.exportPublic());
    }
}
