package sunanticheat.dashboard.handlers;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.audit.Audit;
import sunanticheat.dashboard.auth.OpCheck;
import sunanticheat.dashboard.auth.RateLimiter;
import sunanticheat.dashboard.auth.StoredUser;
import sunanticheat.dashboard.auth.TotpUtil;
import sunanticheat.dashboard.auth.UserStore;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

public final class AuthHandler {

    private final Map<String, DashboardUser> users;
    private final JwtUtil jwt;
    private final UserStore userStore;

    /** Rate limiter login : 5 tentatives par IP par fenêtre de 15 minutes. */
    private static final RateLimiter LOGIN_LIMIT = new RateLimiter(5, 15 * 60 * 1000L);

    public AuthHandler(Map<String, DashboardUser> users, JwtUtil jwt, UserStore userStore) {
        this.users = users;
        this.jwt = jwt;
        this.userStore = userStore;
    }

    /** POST /api/auth/login — supporte 2FA TOTP optionnel + rate limiting. */
    public void login(HttpExchange ex) throws IOException {
        String ip = clientIp(ex);

        // Rate limit (avant tout traitement)
        if (!LOGIN_LIMIT.tryAcquire(ip)) {
            long retrySec = LOGIN_LIMIT.retryAfterMs(ip) / 1000;
            ex.getResponseHeaders().add("Retry-After", String.valueOf(retrySec));
            HttpHelper.error(ex, 429,
                    "Trop de tentatives. Réessayez dans " + (retrySec / 60 + 1) + " min.");
            Audit.system("LOGIN_RATE_LIMITED", ip, "5 tentatives dépassées sur cette IP");
            return;
        }

        String body = HttpHelper.body(ex);
        JsonObject req;
        try { req = HttpHelper.GSON.fromJson(body, JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }

        String username = req.has("username") ? req.get("username").getAsString().trim() : "";
        String password = req.has("password") ? req.get("password").getAsString() : "";
        String totpCode = req.has("totp")     ? req.get("totp").getAsString().trim() : "";

        // Authentification password
        DashboardUser user = userStore.authenticate(username, password);
        if (user == null) {
            HttpHelper.error(ex, 401, "Identifiants incorrects");
            Audit.system("LOGIN_FAILED", username, "Mauvais mot de passe (IP " + ip + ")");
            return;
        }

        // Restriction OP serveur : seul un joueur OP sur le serveur Minecraft
        // peut accéder au panel admin, même avec des identifiants valides.
        if (!OpCheck.isOp(user.username())) {
            HttpHelper.error(ex, 403,
                    "Accès refusé : vous devez être OP sur le serveur Minecraft pour accéder au panel admin.");
            Audit.system("LOGIN_DENIED_NOT_OP", user.username(),
                    "Identifiants valides mais utilisateur non-OP (IP " + ip + ")");
            return;
        }

        // Vérification 2FA si activé pour ce compte
        StoredUser stored = userStore.getStoredUser(username);
        if (stored != null && stored.totpEnabled) {
            if (totpCode.isEmpty()) {
                // Première étape OK — demande le code TOTP au client
                Map<String, Object> resp = new LinkedHashMap<>();
                resp.put("requiresTotp", true);
                resp.put("username", user.username());
                HttpHelper.json(ex, 200, resp);
                return;
            }
            if (!TotpUtil.verify(stored.totpSecret, totpCode)) {
                HttpHelper.error(ex, 401, "Code 2FA invalide");
                Audit.system("LOGIN_FAILED_2FA", username,
                        "Code TOTP incorrect (IP " + ip + ")");
                return;
            }
        }

        // Login réussi → reset le rate limiter pour cette IP
        LOGIN_LIMIT.reset(ip);

        // Synchronise la map live
        users.put(user.username().toLowerCase(), user);

        String token = jwt.generate(user.username(), user.role());
        Audit.log(user, ex, "LOGIN_SUCCESS", user.username(),
                "Connexion réussie" + (stored != null && stored.totpEnabled ? " (2FA)" : ""));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("token", token);
        resp.put("username", user.username());
        resp.put("role", user.role().name());
        resp.put("totpEnabled", stored != null && stored.totpEnabled);
        HttpHelper.json(ex, 200, resp);
    }

    /** GET /api/auth/me */
    public void me(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        StoredUser stored = userStore.getStoredUser(user.username());
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("username", user.username());
        resp.put("role", user.role().name());
        resp.put("totpEnabled", stored != null && stored.totpEnabled);
        HttpHelper.json(ex, 200, resp);
    }

    /**
     * POST /api/auth/totp/setup — démarre la configuration 2FA pour l'user connecté.
     * Génère un secret + URI otpauth pour QR. NE l'active PAS encore.
     */
    public void totpSetup(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;

        StoredUser stored = userStore.getStoredUser(user.username());
        if (stored != null && stored.totpEnabled) {
            HttpHelper.error(ex, 409, "2FA déjà activé pour ce compte");
            return;
        }

        String secret = TotpUtil.generateSecret();
        String err = userStore.setupTotp(user.username(), secret);
        if (err != null) { HttpHelper.error(ex, 500, err); return; }

        String uri = TotpUtil.buildOtpAuthUri("SunGuard", user.username(), secret);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("secret", secret);
        resp.put("otpauthUri", uri);
        resp.put("issuer", "SunGuard");
        resp.put("account", user.username());
        HttpHelper.json(ex, 200, resp);
    }

    /**
     * POST /api/auth/totp/verify — vérifie un code TOTP et active le 2FA.
     * Body : { code: "123456" }
     */
    public void totpVerify(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;

        JsonObject body;
        try { body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
        if (body == null || !body.has("code")) {
            HttpHelper.error(ex, 400, "code requis"); return;
        }
        String code = body.get("code").getAsString();

        StoredUser stored = userStore.getStoredUser(user.username());
        if (stored == null || stored.totpSecret == null) {
            HttpHelper.error(ex, 400, "Lance /totp/setup d'abord"); return;
        }
        if (!TotpUtil.verify(stored.totpSecret, code)) {
            HttpHelper.error(ex, 401, "Code TOTP invalide"); return;
        }

        userStore.enableTotp(user.username());
        Audit.log(user, ex, "TOTP_ENABLED", user.username(),
                "2FA activé pour ce compte");
        HttpHelper.json(ex, 200, Map.of("ok", true, "totpEnabled", true));
    }

    /** POST /api/auth/totp/disable — désactive le 2FA (nécessite le mot de passe). */
    public void totpDisable(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;

        JsonObject body;
        try { body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
        if (body == null || !body.has("password")) {
            HttpHelper.error(ex, 400, "password requis"); return;
        }
        String password = body.get("password").getAsString();

        // Re-vérifie le mdp pour cette opération sensible
        if (userStore.authenticate(user.username(), password) == null) {
            HttpHelper.error(ex, 401, "Mot de passe incorrect");
            Audit.log(user, ex, "TOTP_DISABLE_FAILED", user.username(),
                    "Tentative de désactivation 2FA avec mauvais mdp");
            return;
        }

        userStore.disableTotp(user.username());
        Audit.log(user, ex, "TOTP_DISABLED", user.username(), "2FA désactivé pour ce compte");
        HttpHelper.json(ex, 200, Map.of("ok", true, "totpEnabled", false));
    }

    /** Extrait l'IP cliente avec fallback X-Forwarded-For. */
    private static String clientIp(HttpExchange ex) {
        try {
            String xff = ex.getRequestHeaders().getFirst("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                int comma = xff.indexOf(',');
                return (comma > 0 ? xff.substring(0, comma) : xff).trim();
            }
            if (ex.getRemoteAddress() == null) return "unknown";
            if (ex.getRemoteAddress().getAddress() == null) return "unknown";
            return ex.getRemoteAddress().getAddress().getHostAddress();
        } catch (Throwable t) {
            return "unknown";
        }
    }
}
