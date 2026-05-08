package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.audit.Audit;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.portal.PortalSectionsStore;
import sunanticheat.dashboard.portal.PortalSectionsStore.FeatureStatus;

import java.io.IOException;
import java.util.*;

/**
 * Endpoints sections portail :
 *  - admin (JWT) : lister, toggle on/off, changer le statut (4 états + message)
 *  - public      : lecture des statuts (ouvert sans auth) — utilisé par le portail joueur
 */
public final class PortalSectionsHandler {

    private final PortalSectionsStore store;

    public PortalSectionsHandler(PortalSectionsStore store) {
        this.store = store;
    }

    /** GET /api/portal/sections — admin. */
    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        Map<String, PortalSectionsStore.FeatureState> states = store.getAll();
        List<Map<String, Object>> out = new ArrayList<>();
        for (PortalSectionsStore.SectionDef def : PortalSectionsStore.ALL_SECTIONS) {
            PortalSectionsStore.FeatureState s = states.get(def.key);
            out.add(serialize(def, s));
        }
        HttpHelper.json(ex, 200, Map.of("sections", out));
    }

    /** PATCH /api/portal/sections — admin : bulk toggle enabled. */
    @SuppressWarnings("unchecked")
    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        Map<String, Object> raw = body.containsKey("sections")
                ? (Map<String, Object>) body.get("sections")
                : body;
        Map<String, Boolean> patch = new LinkedHashMap<>();
        for (var e : raw.entrySet()) {
            if (e.getValue() instanceof Boolean b) patch.put(e.getKey(), b);
            else if (e.getValue() instanceof Number n) patch.put(e.getKey(), n.intValue() != 0);
        }
        store.setAllEnabled(patch, u.username());
        Audit.log(u, ex, "PORTAL_SECTIONS_TOGGLE", "*",
                "Toggle de " + patch.size() + " section(s)", Map.of("patch", patch));
        HttpHelper.json(ex, 200, Map.of("ok", true, "sections", store.getEnabledMap()));
    }

    /**
     * PATCH /api/portal/sections/{key}/status — admin : passe une section à OPERATIONAL/DEGRADED/MAINTENANCE/DISABLED.
     * Body: { "status": "MAINTENANCE", "message": "ETA 1h" }
     */
    @SuppressWarnings("unchecked")
    public void updateStatus(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String key) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;

        boolean known = PortalSectionsStore.ALL_SECTIONS.stream().anyMatch(d -> d.key.equals(key));
        if (!known) { HttpHelper.error(ex, 404, "Section inconnue : " + key); return; }

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        String statusStr = body.get("status") != null ? body.get("status").toString() : "OPERATIONAL";
        String message   = body.get("message") != null ? body.get("message").toString() : "";

        FeatureStatus newStatus;
        try { newStatus = FeatureStatus.valueOf(statusStr); }
        catch (Exception e) { HttpHelper.error(ex, 400, "status invalide (OPERATIONAL/DEGRADED/MAINTENANCE/DISABLED)"); return; }

        store.setStatus(key, newStatus, message, u.username());
        Audit.log(u, ex, "PORTAL_SECTION_STATUS", key,
                "Statut → " + newStatus + (message.isBlank() ? "" : " (" + message + ")"),
                Map.of("status", newStatus.name(), "message", message));
        var def = PortalSectionsStore.ALL_SECTIONS.stream().filter(d -> d.key.equals(key)).findFirst().orElseThrow();
        HttpHelper.json(ex, 200, Map.of("ok", true, "section", serialize(def, store.stateOf(key))));
    }

    /** GET /api/public/sections — portail joueur : lecture publique des statuts (sans auth admin). */
    public void publicList(HttpExchange ex) throws IOException {
        Map<String, PortalSectionsStore.FeatureState> states = store.getAll();

        // Format compat ancienne version : { sections: { shop: true, leaderboard: false, ... } }
        Map<String, Boolean> enabledMap = store.getEnabledMap();

        // Format riche : { details: [ { key, status, message, ... }, ... ] }
        List<Map<String, Object>> details = new ArrayList<>();
        for (PortalSectionsStore.SectionDef def : PortalSectionsStore.ALL_SECTIONS) {
            details.add(serialize(def, states.get(def.key)));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sections", enabledMap);
        out.put("details", details);
        HttpHelper.json(ex, 200, out);
    }

    private Map<String, Object> serialize(PortalSectionsStore.SectionDef def, PortalSectionsStore.FeatureState s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key",         def.key);
        m.put("label",       def.label);
        m.put("description", def.description);
        m.put("icon",        def.icon);
        m.put("enabled",     s.enabled && s.status != FeatureStatus.DISABLED);
        m.put("status",      s.status.name());
        m.put("message",     s.message);
        m.put("updatedAt",   s.updatedAt);
        m.put("updatedBy",   s.updatedBy);
        return m;
    }
}
