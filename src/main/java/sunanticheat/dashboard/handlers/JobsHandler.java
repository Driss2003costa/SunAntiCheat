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

    /** GET /api/jobs/history?limit=&offset=&player=&job= — historique JOIN/LEAVE/LEVEL_UP. */
    public void history(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        int limit  = Math.max(1, Math.min(500, HttpHelper.queryInt(ex, "limit", 100)));
        int offset = Math.max(0, HttpHelper.queryInt(ex, "offset", 0));
        String player = HttpHelper.queryParam(ex, "player");
        String job    = HttpHelper.queryParam(ex, "job");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entries", store.history(limit, offset, player, job));
        out.put("limit", limit);
        out.put("offset", offset);
        HttpHelper.json(ex, 200, out);
    }

    /** GET /api/jobs/payments?limit=&offset=&player=&job= — historique des paiements. */
    public void payments(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        int limit  = Math.max(1, Math.min(500, HttpHelper.queryInt(ex, "limit", 100)));
        int offset = Math.max(0, HttpHelper.queryInt(ex, "offset", 0));
        String player = HttpHelper.queryParam(ex, "player");
        String job    = HttpHelper.queryParam(ex, "job");
        HttpHelper.json(ex, 200, store.paymentsHistory(limit, offset, player, job));
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

    /**
     * POST /api/jobs/history/clear — vide l'historique des events.
     * Body : { mode: "all" | "duplicates" | "payments" }
     * Permission : ADMIN.
     */
    public void clearHistory(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        String mode = "duplicates";
        try {
            com.google.gson.JsonObject body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), com.google.gson.JsonObject.class);
            if (body != null && body.has("mode")) mode = body.get("mode").getAsString();
        } catch (Exception ignored) {}

        int deleted;
        switch (mode) {
            case "all":        deleted = store.clearAllEvents();   break;
            case "payments":   deleted = store.clearAllPayments(); break;
            case "duplicates":
            default:           deleted = store.dedupEvents();      break;
        }
        HttpHelper.json(ex, 200, Map.of("success", true, "mode", mode, "deleted", deleted));
    }
}
