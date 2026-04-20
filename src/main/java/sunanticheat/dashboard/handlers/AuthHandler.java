package sunanticheat.dashboard.handlers;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.UserStore;

import java.io.IOException;
import java.util.Map;

public final class AuthHandler {

    private final Map<String, DashboardUser> users;
    private final JwtUtil jwt;
    private final UserStore userStore;

    public AuthHandler(Map<String, DashboardUser> users, JwtUtil jwt, UserStore userStore) {
        this.users = users;
        this.jwt = jwt;
        this.userStore = userStore;
    }

    /** POST /api/auth/login */
    public void login(HttpExchange ex) throws IOException {
        String body = HttpHelper.body(ex);
        JsonObject req;
        try { req = HttpHelper.GSON.fromJson(body, JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }

        String username = req.has("username") ? req.get("username").getAsString().trim() : "";
        String password = req.has("password") ? req.get("password").getAsString() : "";

        // Délégation au UserStore (met à jour lastLoginAt automatiquement)
        DashboardUser user = userStore.authenticate(username, password);
        if (user == null) {
            HttpHelper.error(ex, 401, "Identifiants incorrects");
            return;
        }

        // Synchronise la map live (au cas où le compte aurait été modifié)
        users.put(user.username().toLowerCase(), user);

        String token = jwt.generate(user.username(), user.role());
        HttpHelper.json(ex, 200, Map.of(
                "token",    token,
                "username", user.username(),
                "role",     user.role().name()
        ));
    }

    /** GET /api/auth/me */
    public void me(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        HttpHelper.json(ex, 200, Map.of(
                "username", user.username(),
                "role",     user.role().name()
        ));
    }
}
