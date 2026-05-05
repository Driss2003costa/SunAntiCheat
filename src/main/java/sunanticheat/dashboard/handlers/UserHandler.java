package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.auth.UserStore;

import java.io.IOException;
import java.util.List;
import java.util.Map;

public final class UserHandler {

    private final UserStore store;

    public UserHandler(UserStore store) { this.store = store; }

    /** GET /api/users — liste tous les comptes (ADMIN seulement) */
    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.USERS_MANAGE)) return;
        HttpHelper.json(ex, 200, Map.of("users", store.listPublic()));
    }

    /** POST /api/users — créer un compte (ADMIN seulement) */
    @SuppressWarnings("unchecked")
    public void create(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.USERS_MANAGE)) return;

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        String username = (String) body.get("username");
        String password = (String) body.get("password");
        String role     = (String) body.getOrDefault("role", "MOD");

        if (username == null || username.isBlank()) { HttpHelper.error(ex, 400, "username requis"); return; }

        String err = store.create(username.trim(), password, role);
        if (err != null) { HttpHelper.error(ex, 400, err); return; }

        // Refresh la map live pour que les tokens soient valides immédiatement
        refreshUsersMap(users);
        HttpHelper.json(ex, 200, Map.of("ok", true, "username", username.trim()));
    }

    /** PATCH /api/users/{username}/role — changer le rôle (ADMIN seulement) */
    @SuppressWarnings("unchecked")
    public void changeRole(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String target) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.USERS_MANAGE)) return;

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        String role = body != null ? (String) body.get("role") : null;
        if (role == null) { HttpHelper.error(ex, 400, "role requis"); return; }

        String err = store.changeRole(target, role);
        if (err != null) { HttpHelper.error(ex, 400, err); return; }

        refreshUsersMap(users);
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    /**
     * PATCH /api/users/{username}/custom-role — assigner ou retirer un rôle custom.
     * Body : { customRoleId: "helper_2024" } ou { customRoleId: null } pour retirer.
     */
    @SuppressWarnings("unchecked")
    public void changeCustomRole(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String target) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.USERS_MANAGE)) return;

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        String customRoleId = body != null && body.get("customRoleId") != null
                ? String.valueOf(body.get("customRoleId")) : null;
        if (customRoleId != null && customRoleId.equals("null")) customRoleId = null;

        String err = store.setCustomRole(target, customRoleId);
        if (err != null) { HttpHelper.error(ex, 400, err); return; }

        refreshUsersMap(users);
        HttpHelper.json(ex, 200, Map.of("ok", true, "customRoleId", customRoleId == null ? "" : customRoleId));
    }

    /** POST /api/users/{username}/password — reset mot de passe (ADMIN) */
    @SuppressWarnings("unchecked")
    public void resetPassword(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String target) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.USERS_MANAGE)) return;

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        String newPw = body != null ? (String) body.get("newPassword") : null;
        if (newPw == null || newPw.length() < 6) { HttpHelper.error(ex, 400, "newPassword doit faire ≥ 6 caractères"); return; }

        String err = store.changePassword(target, null, newPw, true);
        if (err != null) { HttpHelper.error(ex, 400, err); return; }
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    /** POST /api/users/me/password — changer son propre mot de passe (tout utilisateur connecté) */
    @SuppressWarnings("unchecked")
    public void changeOwnPassword(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        String current = (String) body.get("currentPassword");
        String newPw   = (String) body.get("newPassword");

        if (current == null || newPw == null) { HttpHelper.error(ex, 400, "currentPassword + newPassword requis"); return; }

        String err = store.changePassword(u.username(), current, newPw, false);
        if (err != null) { HttpHelper.error(ex, 400, err); return; }
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    /** PATCH /api/users/{username}/rename — renommer un compte (ADMIN seulement) */
    @SuppressWarnings("unchecked")
    public void rename(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String target) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.USERS_MANAGE)) return;

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        String newUsername = body != null ? (String) body.get("newUsername") : null;
        if (newUsername == null || newUsername.isBlank()) { HttpHelper.error(ex, 400, "newUsername requis"); return; }

        if (target.equalsIgnoreCase(u.username())) { HttpHelper.error(ex, 400, "Vous ne pouvez pas renommer votre propre compte."); return; }

        String err = store.rename(target, newUsername.trim());
        if (err != null) { HttpHelper.error(ex, 400, err); return; }

        refreshUsersMap(users);
        HttpHelper.json(ex, 200, Map.of("ok", true, "newUsername", newUsername.trim()));
    }

    /** DELETE /api/users/{username} — supprimer un compte (ADMIN seulement) */
    public void delete(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String target) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.USERS_MANAGE)) return;

        String err = store.delete(target, u.username());
        if (err != null) { HttpHelper.error(ex, 400, err); return; }

        refreshUsersMap(users);
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    /** Synchronise la map live depuis le store (sans redémarrage). */
    private void refreshUsersMap(Map<String, DashboardUser> liveMap) {
        liveMap.clear();
        liveMap.putAll(store.asMap());
    }
}
