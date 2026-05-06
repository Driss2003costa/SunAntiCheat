package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.portal.PortalSectionsStore;

import java.io.IOException;
import java.util.*;

public final class PortalSectionsHandler {

    private final PortalSectionsStore store;

    public PortalSectionsHandler(PortalSectionsStore store) {
        this.store = store;
    }

    /** GET /api/portal/sections — admin : retourne toutes les sections avec métadonnées. */
    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        Map<String, Boolean> states = store.getAll();
        List<Map<String, Object>> out = new ArrayList<>();
        for (PortalSectionsStore.SectionDef def : PortalSectionsStore.ALL_SECTIONS) {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("key",         def.key);
            s.put("label",       def.label);
            s.put("description", def.description);
            s.put("icon",        def.icon);
            s.put("enabled",     states.getOrDefault(def.key, true));
            out.add(s);
        }
        HttpHelper.json(ex, 200, Map.of("sections", out));
    }

    /** PATCH /api/portal/sections — admin : met à jour un ou plusieurs états. */
    @SuppressWarnings("unchecked")
    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        // body peut contenir { "sections": { "leaderboard": true, "shop": false } }
        // ou directement { "leaderboard": true, "shop": false }
        Map<String, Object> raw = body.containsKey("sections")
                ? (Map<String, Object>) body.get("sections")
                : body;
        Map<String, Boolean> patch = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : raw.entrySet()) {
            if (e.getValue() instanceof Boolean) {
                patch.put(e.getKey(), (Boolean) e.getValue());
            } else if (e.getValue() instanceof Number) {
                patch.put(e.getKey(), ((Number) e.getValue()).intValue() != 0);
            }
        }
        store.setAll(patch);
        HttpHelper.json(ex, 200, Map.of("ok", true, "sections", store.getAll()));
    }

    /** GET /api/public/sections — portail joueur : retourne uniquement les états activé/désactivé. */
    public void publicList(HttpExchange ex) throws IOException {
        HttpHelper.json(ex, 200, Map.of("sections", store.getAll()));
    }
}
