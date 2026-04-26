package sunanticheat.dashboard.audit;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;

import java.util.HashMap;
import java.util.Map;

/**
 * Helper statique pour logger une action audit depuis n'importe quel handler.
 *
 * Usage simple :
 *   Audit.log(user, ex, "PLAYER_BANNED", "Steve", "Banni 7j pour X-Ray");
 *
 * Avec metadata :
 *   Audit.log(user, ex, "PERMISSION_CHANGED", "MOD", "Permissions MOD modifiées",
 *             Map.of("added", List.of("PLUGIN_MANAGE"), "removed", List.of()));
 *
 * Le store est injecté au boot par DashboardModule via setStore().
 */
public final class Audit {

    private static volatile AuditStore store;

    private Audit() {}

    public static void setStore(AuditStore s) { store = s; }
    public static AuditStore store() { return store; }

    /** Log avec contexte HttpExchange (extrait l'IP). */
    public static void log(DashboardUser user, HttpExchange ex,
                           String action, String target, String details) {
        log(user, ex, action, target, details, null);
    }

    public static void log(DashboardUser user, HttpExchange ex,
                           String action, String target, String details,
                           Map<String, Object> meta) {
        if (store == null) return;
        String ip = "unknown";
        try {
            if (ex != null && ex.getRemoteAddress() != null
                    && ex.getRemoteAddress().getAddress() != null) {
                ip = ex.getRemoteAddress().getAddress().getHostAddress();
            }
            // Tente X-Forwarded-For si reverse proxy
            if (ex != null) {
                String xff = ex.getRequestHeaders().getFirst("X-Forwarded-For");
                if (xff != null && !xff.isBlank()) {
                    int comma = xff.indexOf(',');
                    ip = (comma > 0 ? xff.substring(0, comma) : xff).trim();
                }
            }
        } catch (Throwable ignored) {}

        AuditEntry e = new AuditEntry(
                user != null ? user.username() : "anonymous",
                user != null ? user.role().name() : "?",
                action,
                target,
                details,
                ip,
                meta != null ? meta : new HashMap<>()
        );
        store.append(e);
    }

    /** Log système (pas d'user, pas d'IP). */
    public static void system(String action, String target, String details) {
        if (store == null) return;
        AuditEntry e = new AuditEntry("system", "SYSTEM", action, target, details, "system", null);
        store.append(e);
    }
}
