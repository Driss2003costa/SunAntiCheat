package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.auth.PermissionStore;

import java.io.IOException;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;

/**
 * Endpoints /api/permissions/* — consultation et édition de la matrice
 * des permissions par rôle. ADMIN uniquement pour modifier.
 */
public final class PermissionsHandler {

    private final PermissionStore store;

    public PermissionsHandler(PermissionStore store) {
        this.store = store;
    }

    /** GET /api/permissions — snapshot complet (catalogue + matrice actuelle). MOD+. */
    public void get(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        // Lecture accessible à tous les rôles authentifiés (permet à MOD/VIEWER de voir leurs droits)
        HttpHelper.json(ex, 200, store.snapshot());
    }

    /**
     * PUT /api/permissions — remplace complètement la matrice d'un rôle.
     * Body : { role: "MOD" | "VIEWER", permissions: ["MODERATE_PLAYERS", ...] }
     * ADMIN ne peut pas être modifié (protection interne du store).
     */
    @SuppressWarnings("unchecked")
    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        Map<String, Object> body;
        try {
            body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        } catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
        if (body == null) { HttpHelper.error(ex, 400, "Body requis"); return; }

        String roleName = (String) body.get("role");
        List<String> permNames = (List<String>) body.get("permissions");
        if (roleName == null || permNames == null) {
            HttpHelper.error(ex, 400, "role + permissions[] requis"); return;
        }

        DashboardRole role;
        try { role = DashboardRole.valueOf(roleName.toUpperCase()); }
        catch (Exception e) { HttpHelper.error(ex, 400, "Rôle inconnu : " + roleName); return; }

        if (role == DashboardRole.ADMIN) {
            HttpHelper.error(ex, 403, "Les permissions ADMIN ne peuvent pas être modifiées (sécurité).");
            return;
        }

        EnumSet<Permission> perms = EnumSet.noneOf(Permission.class);
        for (String p : permNames) {
            try { perms.add(Permission.valueOf(p)); }
            catch (Exception e) { HttpHelper.error(ex, 400, "Permission inconnue : " + p); return; }
        }

        store.replace(role, perms);
        HttpHelper.json(ex, 200, store.snapshot());
    }

    /** POST /api/permissions/reset — restaure les défauts. ADMIN. */
    public void reset(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        store.resetToDefaults();
        HttpHelper.json(ex, 200, store.snapshot());
    }
}
