package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.jobs.JobsLiveService;
import sunanticheat.dashboard.jobs.JobsStore;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Endpoints /api/jobs/* — lecture pour authentifié, pas d'écriture (read-only).
 *
 * Si Jobs Reborn n'est pas installé, `live` est null et on renvoie des
 * structures vides + un flag `installed: false`.
 */
public final class JobsHandler {

    private final JobsStore store;
    private final JobsLiveService live;  // null si Jobs Reborn absent

    public JobsHandler(JobsStore store, JobsLiveService live) {
        this.store = store;
        this.live = live;
    }

    public boolean isInstalled() { return live != null; }

    /** GET /api/jobs/overview — résumé pour la page principale. */
    public void overview(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        int days = Math.max(1, Math.min(90, HttpHelper.queryInt(ex, "days", 7)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("installed", live != null);
        out.put("jobs", live != null ? live.listJobs() : List.of());
        out.put("occupancy", live != null ? live.jobsOccupancy() : List.of());
        out.put("totalsByJob", store.totalsByJob(days));
        out.put("topPlayers", store.topPlayers(days, 20));
        out.put("moneyOverTime", store.moneyOverTime(days));
        out.put("days", days);
        HttpHelper.json(ex, 200, out);
    }

    /** GET /api/jobs/active — joueurs ONLINE avec leurs jobs et niveaux. */
    public void active(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("installed", live != null);
        out.put("players", live != null ? live.activePlayers() : List.of());
        HttpHelper.json(ex, 200, out);
    }

    /** GET /api/jobs/history?limit=&offset= — historique JOIN/LEAVE/LEVEL_UP. */
    public void history(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        int limit = Math.max(1, Math.min(500, HttpHelper.queryInt(ex, "limit", 100)));
        int offset = Math.max(0, HttpHelper.queryInt(ex, "offset", 0));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entries", store.history(limit, offset));
        out.put("limit", limit);
        out.put("offset", offset);
        HttpHelper.json(ex, 200, out);
    }

    /** GET /api/jobs/player/{name} — détails d'un joueur (gains par job). */
    public void player(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                       String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        int days = Math.max(1, Math.min(90, HttpHelper.queryInt(ex, "days", 30)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("playerName", playerName);
        out.put("days", days);
        out.put("earnings", store.playerEarnings(playerName, days));
        HttpHelper.json(ex, 200, out);
    }

    /** POST /api/jobs/deduplicate — supprime les doublons (ADMIN). */
    public void deduplicate(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!u.isAdmin()) { HttpHelper.json(ex, 403, Map.of("error", "Admin requis")); return; }
        int deletedEvents   = store.deduplicateEvents();
        int deletedPayments = store.deduplicatePayments();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deletedEvents", deletedEvents);
        out.put("deletedPayments", deletedPayments);
        out.put("total", deletedEvents + deletedPayments);
        HttpHelper.json(ex, 200, out);
    }
}
