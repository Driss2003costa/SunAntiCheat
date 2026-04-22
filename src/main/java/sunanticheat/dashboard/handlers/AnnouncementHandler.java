package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.announcements.Announcement;
import sunanticheat.dashboard.announcements.AnnouncementService;
import sunanticheat.dashboard.announcements.AnnouncementStore;
import sunanticheat.dashboard.announcements.AnnouncementVariant;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Handler HTTP pour le CRUD des annonces, test-send et statistiques.
 */
public final class AnnouncementHandler {

    private final JavaPlugin plugin;
    private final AnnouncementStore store;
    private final AnnouncementService service;

    public AnnouncementHandler(JavaPlugin plugin, AnnouncementStore store, AnnouncementService service) {
        this.plugin = plugin;
        this.store = store;
        this.service = service;
    }

    /** GET /api/announcements — MOD+. */
    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        HttpHelper.json(ex, 200, store.list());
    }

    /** GET /api/announcements/{id} — MOD+. */
    public void get(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        Announcement a = store.get(id);
        if (a == null) { HttpHelper.error(ex, 404, "Annonce introuvable"); return; }
        HttpHelper.json(ex, 200, a);
    }

    /** POST /api/announcements — ADMIN. */
    public void create(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Announcement a = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Announcement.class);
        if (a == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        Announcement created = store.create(a);
        HttpHelper.json(ex, 201, created);
    }

    /** PUT /api/announcements/{id} — ADMIN. */
    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Announcement patch = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Announcement.class);
        if (patch == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        Announcement updated = store.update(id, patch);
        if (updated == null) { HttpHelper.error(ex, 404, "Annonce introuvable"); return; }
        HttpHelper.json(ex, 200, updated);
    }

    /** DELETE /api/announcements/{id} — ADMIN. */
    public void delete(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        boolean ok = store.delete(id);
        if (!ok) { HttpHelper.error(ex, 404, "Annonce introuvable"); return; }
        HttpHelper.noContent(ex);
    }

    /** POST /api/announcements/{id}/test-send — ADMIN. Force l'envoi immédiat. */
    public void testSend(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Announcement a = store.get(id);
        if (a == null) { HttpHelper.error(ex, 404, "Annonce introuvable"); return; }
        service.triggerTestSend(a);
        HttpHelper.json(ex, 200, Map.of("success", true));
    }

    /** GET /api/announcements/stats — MOD+. Métriques globales. */
    public void stats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        List<Announcement> all = store.list();
        long totalSent = 0, totalClicks = 0;
        List<Map<String, Object>> perAnn = new ArrayList<>();
        for (Announcement a : all) {
            long sent = 0, clicks = 0;
            if (a.variants != null) {
                for (AnnouncementVariant v : a.variants) {
                    sent += v.sentCount;
                    clicks += v.clickCount;
                }
            }
            totalSent += sent;
            totalClicks += clicks;
            double ctr = sent > 0 ? (100.0 * clicks / sent) : 0.0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.id);
            m.put("name", a.name);
            m.put("sent", sent);
            m.put("clicks", clicks);
            m.put("ctr", ctr);
            perAnn.add(m);
        }
        perAnn.sort(Comparator.comparingDouble(
                (Map<String, Object> m) -> (double) m.get("ctr")).reversed());
        List<Map<String, Object>> top = perAnn.size() > 5 ? perAnn.subList(0, 5) : perAnn;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalAnnouncements", all.size());
        out.put("totalSent", totalSent);
        out.put("totalClicks", totalClicks);
        out.put("clickRate", totalSent > 0 ? (100.0 * totalClicks / totalSent) : 0.0);
        out.put("topAnnouncements", top);
        HttpHelper.json(ex, 200, out);
    }
}
