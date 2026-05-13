package sunanticheat.dashboard.handlers;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.audit.Audit;
import sunanticheat.dashboard.portal.PlayerAccountStore;
import sunanticheat.dashboard.portal.PortalActivityStore;
import sunanticheat.dashboard.portal.PortalSection;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Endpoints admin pour gérer les comptes portail :
 *  - Lister/chercher des comptes avec leur état (ban, restrictions, échecs login)
 *  - Bannir / lever un ban (permanent ou temporaire)
 *  - Modifier les restrictions par section
 *  - Forcer la réinitialisation du mot de passe au prochain login
 *  - Lister les sections disponibles (catalogue) pour l'UI
 */
public final class AdminPortalAccountsHandler {

    private final PlayerAccountStore accountStore;
    private final PortalActivityStore activityStore;

    public AdminPortalAccountsHandler(PlayerAccountStore accountStore, PortalActivityStore activityStore) {
        this.accountStore = accountStore;
        this.activityStore = activityStore;
    }

    /** GET /api/admin/portal/sections — catalogue des sections (pour peupler l'UI). */
    public void sections(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireMod(ex, u)) return;

        List<Map<String, Object>> list = new ArrayList<>();
        for (PortalSection s : PortalSection.values()) {
            list.add(Map.of("key", s.key, "bit", s.bit, "name", s.name()));
        }
        HttpHelper.json(ex, 200, Map.of("sections", list));
    }

    /** GET /api/admin/portal/accounts?search=&limit=&offset= — liste paginée. */
    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireMod(ex, u)) return;

        String search = HttpHelper.queryParam(ex, "search");
        int limit  = Math.min(200, Math.max(1, HttpHelper.queryInt(ex, "limit", 50)));
        int offset = Math.max(0, HttpHelper.queryInt(ex, "offset", 0));

        List<Map<String, Object>> rows = accountStore.listAccounts(search, limit, offset);
        for (Map<String, Object> r : rows) decorate(r);
        int total = accountStore.countAccounts(search);

        HttpHelper.json(ex, 200, Map.of(
            "accounts", rows,
            "total",    total,
            "limit",    limit,
            "offset",   offset
        ));
    }

    /** GET /api/admin/portal/accounts/{uuid} — détail d'un compte + dernières activités. */
    public void detail(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String uuid)
            throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireMod(ex, u)) return;

        Map<String, Object> acc = accountStore.getByUuid(uuid);
        if (acc == null) { HttpHelper.error(ex, 404, "Compte introuvable"); return; }
        decorate(acc);

        Map<String, Object> resp = new LinkedHashMap<>(acc);
        if (activityStore != null) {
            resp.put("recent_logins", activityStore.listLogins(uuid, false, 20, 0));
        }
        HttpHelper.json(ex, 200, resp);
    }

    /** POST /api/admin/portal/accounts/{uuid}/ban — body: {duration_ms?: long, reason?: string} */
    public void ban(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String uuid)
            throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        Map<String, Object> acc = accountStore.getByUuid(uuid);
        if (acc == null) { HttpHelper.error(ex, 404, "Compte introuvable"); return; }

        JsonObject body = parseJson(ex);
        Long until = null; // null impossible (sinon = unban) → ici on impose au moins un ban perma
        String reason = body != null && body.has("reason") && !body.get("reason").isJsonNull()
                ? body.get("reason").getAsString() : null;
        if (body != null && body.has("duration_ms") && !body.get("duration_ms").isJsonNull()) {
            long d = body.get("duration_ms").getAsLong();
            until = d <= 0 ? 0L : System.currentTimeMillis() + d;
        } else {
            until = 0L; // permanent
        }

        accountStore.setBan(uuid, until, reason);
        Audit.log(u, ex, "PORTAL_ACCOUNT_BANNED", (String) acc.get("username"),
                "Ban portail" + (until == 0 ? " (permanent)" : " jusqu'à " + until)
                + (reason != null ? " — " + reason : ""));
        HttpHelper.json(ex, 200, Map.of("ok", true, "banned_until", until, "reason", reason));
    }

    /** POST /api/admin/portal/accounts/{uuid}/unban */
    public void unban(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String uuid)
            throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        Map<String, Object> acc = accountStore.getByUuid(uuid);
        if (acc == null) { HttpHelper.error(ex, 404, "Compte introuvable"); return; }

        accountStore.setBan(uuid, null, null);
        Audit.log(u, ex, "PORTAL_ACCOUNT_UNBANNED", (String) acc.get("username"), "Ban portail levé");
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    /** POST /api/admin/portal/accounts/{uuid}/restrictions — body: {sections: [keys]} (remplace le mask) */
    public void restrictions(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String uuid)
            throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        Map<String, Object> acc = accountStore.getByUuid(uuid);
        if (acc == null) { HttpHelper.error(ex, 404, "Compte introuvable"); return; }

        JsonObject body = parseJson(ex);
        List<String> keys = new ArrayList<>();
        if (body != null && body.has("sections") && body.get("sections").isJsonArray()) {
            body.get("sections").getAsJsonArray().forEach(el -> {
                if (!el.isJsonNull()) keys.add(el.getAsString());
            });
        }
        int mask = PortalSection.maskFromKeys(keys);
        accountStore.setRestrictions(uuid, mask);
        Audit.log(u, ex, "PORTAL_ACCOUNT_RESTRICTIONS", (String) acc.get("username"),
                "Sections bloquées : " + (keys.isEmpty() ? "(aucune)" : String.join(",", keys)));
        HttpHelper.json(ex, 200, Map.of("ok", true, "restrictions", PortalSection.keysFromMask(mask)));
    }

    /** POST /api/admin/portal/accounts/{uuid}/force-reset — body: {value: bool} */
    public void forceReset(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String uuid)
            throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        Map<String, Object> acc = accountStore.getByUuid(uuid);
        if (acc == null) { HttpHelper.error(ex, 404, "Compte introuvable"); return; }

        JsonObject body = parseJson(ex);
        boolean value = body == null || !body.has("value") || body.get("value").isJsonNull()
                ? true : body.get("value").getAsBoolean();
        accountStore.setMustResetPassword(uuid, value);
        Audit.log(u, ex, "PORTAL_FORCE_RESET", (String) acc.get("username"),
                value ? "Reset mot de passe forcé activé" : "Reset mot de passe forcé désactivé");
        HttpHelper.json(ex, 200, Map.of("ok", true, "must_reset_password", value));
    }

    /** POST /api/admin/portal/accounts/{uuid}/reset-failed — remet à zéro le compteur d'échecs login. */
    public void resetFailed(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String uuid)
            throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireMod(ex, u)) return;

        Map<String, Object> acc = accountStore.getByUuid(uuid);
        if (acc == null) { HttpHelper.error(ex, 404, "Compte introuvable"); return; }

        accountStore.resetFailedLogin(uuid);
        Audit.log(u, ex, "PORTAL_RESET_FAILED_COUNTER", (String) acc.get("username"),
                "Compteur d'échecs login remis à 0");
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** Enrichit une ligne brute avec les clés de sections bloquées (humain). */
    private static void decorate(Map<String, Object> row) {
        int mask = ((Number) row.get("section_restrictions")).intValue();
        row.put("restrictions", PortalSection.keysFromMask(mask));
        Object bu = row.get("banned_until");
        boolean banned = bu != null && (((Number) bu).longValue() == 0 || ((Number) bu).longValue() > System.currentTimeMillis());
        row.put("is_banned", banned);
    }

    private static JsonObject parseJson(HttpExchange ex) throws IOException {
        String raw = HttpHelper.body(ex);
        if (raw == null || raw.isBlank()) return null;
        try { return HttpHelper.GSON.fromJson(raw, JsonObject.class); }
        catch (Exception e) { return null; }
    }
}
