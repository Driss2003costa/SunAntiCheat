package sunanticheat.dashboard;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public final class HttpHelper {

    public static final Gson GSON = new GsonBuilder().serializeNulls().create();

    /** Store des permissions (injecté par DashboardModule au boot). */
    private static volatile sunanticheat.dashboard.auth.PermissionStore permStore;

    public static void setPermissionStore(sunanticheat.dashboard.auth.PermissionStore store) { permStore = store; }
    public static sunanticheat.dashboard.auth.PermissionStore permissions() { return permStore; }

    private HttpHelper() {}

    public static void json(HttpExchange ex, int status, Object data) throws IOException {
        byte[] body = GSON.toJson(data).getBytes(StandardCharsets.UTF_8);
        cors(ex);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(status, body.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(body); }
    }

    public static void error(HttpExchange ex, int status, String message) throws IOException {
        json(ex, status, Map.of("error", message));
    }

    public static void noContent(HttpExchange ex) throws IOException {
        cors(ex);
        ex.sendResponseHeaders(204, -1);
    }

    public static String body(HttpExchange ex) throws IOException {
        return new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    public static String queryParam(HttpExchange ex, String name) {
        String query = ex.getRequestURI().getQuery();
        if (query == null) return null;
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2 && kv[0].equals(name)) {
                return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    public static int queryInt(HttpExchange ex, String name, int defaultValue) {
        String v = queryParam(ex, name);
        if (v == null) return defaultValue;
        try { return Integer.parseInt(v); } catch (NumberFormatException e) { return defaultValue; }
    }

    /** Valide le JWT et retourne l'utilisateur, ou envoie 401 et retourne null. */
    public static DashboardUser authenticate(HttpExchange ex, JwtUtil jwt,
                                             Map<String, DashboardUser> users) throws IOException {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            error(ex, 401, "Non authentifié");
            return null;
        }
        try {
            var claims = jwt.validate(header.substring(7));
            DashboardUser user = users.get(claims.getSubject().toLowerCase());
            if (user == null) { error(ex, 401, "Utilisateur inconnu"); return null; }
            return user;
        } catch (Exception e) {
            error(ex, 401, "Token invalide ou expiré");
            return null;
        }
    }

    /** Vérifie que l'utilisateur est ADMIN, sinon envoie 403 et retourne false. */
    public static boolean requireAdmin(HttpExchange ex, DashboardUser user) throws IOException {
        if (!user.isAdmin()) { error(ex, 403, "Accès réservé aux administrateurs"); return false; }
        return true;
    }

    /**
     * Vérifie que l'utilisateur est au minimum MOD (MOD ou ADMIN).
     * Envoie 403 si seulement VIEWER. Retourne false sur échec.
     */
    public static boolean requireMod(HttpExchange ex, DashboardUser user) throws IOException {
        if (!user.role().atLeast(DashboardRole.MOD)) {
            error(ex, 403, "Accès réservé aux modérateurs ou administrateurs");
            return false;
        }
        return true;
    }

    /**
     * Vérifie que l'utilisateur a une permission spécifique via le PermissionStore.
     * Si le store n'est pas initialisé, fallback sur requireAdmin.
     * Envoie 403 avec un message clair si refusé.
     */
    public static boolean requirePermission(HttpExchange ex, DashboardUser user,
                                             sunanticheat.dashboard.auth.Permission perm) throws IOException {
        if (permStore == null) {
            // Safety fallback : si le store n'est pas initialisé, ADMIN only
            return requireAdmin(ex, user);
        }
        // Utilise le rôle custom s'il est défini, sinon l'enum
        String roleId = user.roleIdForPermissionCheck();
        if (!permStore.has(roleId, perm)) {
            error(ex, 403, "Permission refusée : " + perm.label + " (rôle " + roleId + ")");
            return false;
        }
        return true;
    }

    /**
     * Authentifie ET vérifie le rôle minimum requis.
     * Envoie 401 si non authentifié, 403 si rôle insuffisant.
     * Retourne null dans les deux cas d'échec (la réponse a déjà été envoyée).
     */
    public static DashboardUser requireAtLeast(HttpExchange ex, JwtUtil jwt,
                                               Map<String, DashboardUser> users,
                                               DashboardRole required) throws IOException {
        DashboardUser user = authenticate(ex, jwt, users);
        if (user == null) return null; // 401 déjà envoyé
        if (!user.role().atLeast(required)) {
            error(ex, 403, "Rôle insuffisant — requis : " + required
                    + ", votre rôle : " + user.role());
            return null;
        }
        return user;
    }

    private static void cors(HttpExchange ex) {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type,Authorization");
    }
}
