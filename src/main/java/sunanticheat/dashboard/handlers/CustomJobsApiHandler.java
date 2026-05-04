package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import sunanticheat.SunAntiCheat;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.portal.PlayerJwtUtil;
import sunanticheat.jobs.CustomJob;
import sunanticheat.jobs.CustomJobModule;
import sunanticheat.jobs.CustomJobService;
import sunanticheat.jobs.dynamics.WorldDynamicsService;

import java.io.IOException;
import java.util.*;

public final class CustomJobsApiHandler {

    private final Plugin plugin;
    private final JwtUtil jwt;
    private final Map<String, DashboardUser> users;
    private final PlayerJwtUtil playerJwt;

    public CustomJobsApiHandler(Plugin plugin, JwtUtil jwt, Map<String, DashboardUser> users,
                                 PlayerJwtUtil playerJwt) {
        this.plugin    = plugin;
        this.jwt       = jwt;
        this.users     = users;
        this.playerJwt = playerJwt;
    }

    /** GET /api/custom-jobs/list */
    public void list(HttpExchange ex) throws IOException {
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }

        List<Map<String, Object>> result = new ArrayList<>();
        for (CustomJob job : module.getConfig().getJobs().values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",          job.id());
            m.put("name",        job.name());
            m.put("description", job.description());
            m.put("icon",        job.icon());
            m.put("max_level",   job.maxLevel());
            m.put("actions",     job.actions());
            m.put("enabled",     module.getConfig().isJobEnabled(job.id()));

            List<Map<String, Object>> stats = module.getStore().jobStats(job.id());
            if (!stats.isEmpty()) m.putAll(stats.get(0));

            result.add(m);
        }
        HttpHelper.json(ex, 200, result);
    }

    /** GET /api/custom-jobs/leaderboard/:jobId */
    public void leaderboard(HttpExchange ex) throws IOException {
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }

        String path  = ex.getRequestURI().getPath();
        String jobId = path.substring(path.lastIndexOf('/') + 1);

        if (module.getConfig().getJob(jobId) == null) {
            HttpHelper.json(ex, 404, Map.of("error", "job_not_found")); return;
        }

        List<Map<String, Object>> top = module.getStore().leaderboard(jobId, 25);
        HttpHelper.json(ex, 200, top);
    }

    /** GET /api/custom-jobs/history/:jobId */
    public void history(HttpExchange ex) throws IOException {
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }

        String path  = ex.getRequestURI().getPath();
        String jobId = path.substring(path.lastIndexOf('/') + 1);

        List<Map<String, Object>> hist = module.getStore().recentHistory(jobId, 50);
        HttpHelper.json(ex, 200, hist);
    }

    /** GET /api/custom-jobs/player/:uuid */
    public void playerJobs(HttpExchange ex) throws IOException {
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }

        String path = ex.getRequestURI().getPath();
        String uuid = path.substring(path.lastIndexOf('/') + 1);

        List<Map<String, Object>> pJobs = module.getStore().getPlayerJobs(uuid);
        for (Map<String, Object> pj : pJobs) {
            String jobId = (String) pj.get("job_id");
            CustomJob job = module.getConfig().getJob(jobId);
            if (job != null) {
                pj.put("job_name", job.name());
                pj.put("max_level", job.maxLevel());
                int level = ((Number) pj.get("level")).intValue();
                pj.put("xp_to_next", !job.isMaxLevel(level) ? job.xpForLevel(level + 1) : 0);
            }
        }
        HttpHelper.json(ex, 200, pJobs);
    }

    /**
     * GET /api/custom-jobs/dynamics
     * Snapshot des dynamiques de monde courantes (saison, bulletin, évènements actifs).
     */
    public void dynamics(HttpExchange ex) throws IOException {
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }
        if (module.getDynamics() == null) {
            HttpHelper.json(ex, 200, Map.of("enabled", false));
            return;
        }
        HttpHelper.json(ex, 200, module.getDynamics().snapshot());
    }

    /**
     * GET /api/custom-jobs/player/:uuid/timeline?job=miner&days=30
     * Timeline d'XP par jour pour un métier donné (graph côté portail).
     */
    public void playerTimeline(HttpExchange ex) throws IOException {
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }

        String path = ex.getRequestURI().getPath();
        String uuid = extractUuid(path, "/api/custom-jobs/player/", "/timeline");
        String jobId = HttpHelper.queryParam(ex, "job");
        int days = HttpHelper.queryInt(ex, "days", 30);
        if (jobId == null) { HttpHelper.error(ex, 400, "missing 'job' query param"); return; }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("uuid",     uuid);
        resp.put("job_id",   jobId);
        resp.put("days",     days);
        resp.put("timeline", module.getStore().playerTimeline(uuid, jobId, days));
        resp.put("targets",  module.getStore().playerTopTargets(uuid, jobId, 10));
        resp.put("xp_per_hour", module.getStore().playerXpPerHour(uuid, jobId, days));

        // Forecast : à ce rythme, jours pour atteindre niveau suivant et niveau max
        var pj = module.getStore().getPlayerJob(uuid, jobId);
        var job = module.getConfig().getJob(jobId);
        if (pj != null && job != null) {
            int level = ((Number) pj.get("level")).intValue();
            double xp = ((Number) pj.get("xp")).doubleValue();
            double xpPerHour = module.getStore().playerXpPerHour(uuid, jobId, days);

            Map<String, Object> forecast = new LinkedHashMap<>();
            forecast.put("level",        level);
            forecast.put("xp",           xp);
            forecast.put("xp_per_hour",  xpPerHour);
            if (xpPerHour > 0) {
                if (!job.isMaxLevel(level)) {
                    long needed = job.xpForLevel(level + 1);
                    double remaining = needed - xp;
                    forecast.put("hours_to_next", remaining / xpPerHour);
                }
                if (job.maxLevel() > 0 && level < job.maxLevel()) {
                    long maxXp = job.xpForLevel(job.maxLevel());
                    double remaining = maxXp - xp;
                    forecast.put("hours_to_max", remaining / xpPerHour);
                }
            }
            resp.put("forecast", forecast);
        }
        HttpHelper.json(ex, 200, resp);
    }

    /**
     * GET /api/custom-jobs/player/:uuid/heatmap?days=7
     * Activité agrégée du joueur sur la dernière fenêtre.
     */
    public void playerHeatmap(HttpExchange ex) throws IOException {
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }

        String path = ex.getRequestURI().getPath();
        String uuid = extractUuid(path, "/api/custom-jobs/player/", "/heatmap");
        int days = HttpHelper.queryInt(ex, "days", 7);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("uuid", uuid);
        resp.put("days", days);
        if (module.getDynamics() != null && module.getDynamics().heatmap() != null) {
            resp.put("by_job", module.getDynamics().heatmap().playerHeatmap(uuid, days, 25));
        } else {
            resp.put("by_job", List.of());
        }
        HttpHelper.json(ex, 200, resp);
    }

    /**
     * GET /api/custom-jobs/market
     * État du « marché » : bulletin du jour + chunks les plus exploités par job.
     */
    public void market(HttpExchange ex) throws IOException {
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }

        Map<String, Object> resp = new LinkedHashMap<>();
        if (module.getDynamics() != null) {
            resp.put("snapshot", module.getDynamics().snapshot());
            Map<String, Object> hot = new LinkedHashMap<>();
            for (CustomJob job : module.getConfig().getJobs().values()) {
                hot.put(job.id(), module.getDynamics().heatmap().topChunks(job.id(), 5));
            }
            resp.put("hot_chunks", hot);
        }
        HttpHelper.json(ex, 200, resp);
    }

    // ── Admin controls (JWT required) ─────────────────────────────────────────

    /**
     * PATCH /api/custom-jobs/admin/dynamics/toggle
     * Body : { "system": "seasons|weather|time|heatmap|events|bulletin|global", "enabled": true/false }
     */
    public void adminToggle(HttpExchange ex) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

        CustomJobModule module = jobModule();
        if (module == null || module.getDynamics() == null) {
            HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return;
        }

        try {
            var body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
            String system  = (String) body.get("system");
            Boolean enabled = (Boolean) body.get("enabled");
            if (system == null || enabled == null) {
                HttpHelper.error(ex, 400, "Missing 'system' or 'enabled'"); return;
            }
            module.getDynamics().setSubsystemEnabled(system, enabled);
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("system",   system);
            resp.put("enabled",  enabled);
            resp.put("states",   module.getDynamics().subsystemStates());
            HttpHelper.json(ex, 200, resp);
        } catch (Exception e) {
            HttpHelper.error(ex, 400, "Invalid body: " + e.getMessage());
        }
    }

    /**
     * POST /api/custom-jobs/admin/dynamics/event/trigger
     * Body : { "id": "golden_vein" }
     */
    public void adminTriggerEvent(HttpExchange ex) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

        CustomJobModule module = jobModule();
        if (module == null || module.getDynamics() == null) {
            HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return;
        }
        try {
            var body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
            String id = (String) body.get("id");
            if (id == null) { HttpHelper.error(ex, 400, "Missing 'id'"); return; }
            boolean ok = module.getDynamics().events().trigger(id);
            HttpHelper.json(ex, ok ? 200 : 404,
                    Map.of("triggered", ok, "id", id,
                           "active_events", module.getDynamics().events().active().stream()
                               .map(e -> Map.of("id", e.id(), "target_job", String.valueOf(e.targetJob()),
                                                "ends_at", e.endsAt())).toList()));
        } catch (Exception e) {
            HttpHelper.error(ex, 400, "Invalid body: " + e.getMessage());
        }
    }

    /**
     * POST /api/custom-jobs/admin/dynamics/bulletin/refresh
     * Force un nouveau tirage du bulletin du jour.
     */
    public void adminRefreshBulletin(HttpExchange ex) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

        CustomJobModule module = jobModule();
        if (module == null || module.getDynamics() == null) {
            HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return;
        }
        module.getDynamics().forceBulletinRefresh();
        var bul = module.getDynamics().bulletin();
        HttpHelper.json(ex, 200, Map.of(
                "job_id",       String.valueOf(bul.currentJobId()),
                "multiplier",   bul.currentMult(),
                "refreshed_at", bul.refreshedAt()
        ));
    }

    /**
     * DELETE /api/custom-jobs/admin/heatmap
     * Vide toutes les données heatmap (mémoire + DB).
     */
    public void adminClearHeatmap(HttpExchange ex) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

        CustomJobModule module = jobModule();
        if (module == null || module.getDynamics() == null) {
            HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return;
        }
        module.getDynamics().clearHeatmap();
        HttpHelper.json(ex, 200, Map.of("cleared", true));
    }

    /**
     * POST /api/custom-jobs/admin/dynamics/reload
     * Recharge dynamics.yml + remet tous les overrides à zéro.
     */
    public void adminReloadDynamics(HttpExchange ex) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

        CustomJobModule module = jobModule();
        if (module == null || module.getDynamics() == null) {
            HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return;
        }
        module.getDynamics().clearOverrides();
        module.getDynamics().reload();
        HttpHelper.json(ex, 200, module.getDynamics().snapshot());
    }

    // ── Portal endpoints (player JWT required) ─────────────────────────────────

    /** GET /api/custom-jobs/me/slots → {used, max, rank} */
    public void meSlots(HttpExchange ex) throws IOException {
        String uuid = portalUuid(ex);
        if (uuid == null) return;
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }
        HttpHelper.json(ex, 200, module.getService().slotsSnapshot(uuid));
    }

    /** POST /api/custom-jobs/me/join — body {jobId} */
    public void meJoin(HttpExchange ex) throws IOException {
        String uuid = portalUuid(ex);
        if (uuid == null) return;
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }
        try {
            var body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
            String jobId = (String) body.get("jobId");
            if (jobId == null) { HttpHelper.error(ex, 400, "Missing 'jobId'"); return; }

            CustomJobService svc = module.getService();
            CustomJobService.JoinResult r;

            Player online = Bukkit.getPlayer(UUID.fromString(uuid));
            if (online != null) {
                // Use the online path so the player gets the chat message + side effects.
                boolean ok = svc.join(online, jobId);
                r = ok ? CustomJobService.JoinResult.OK : svc.tryJoin(uuid, jobId);
                // (If online join failed, tryJoin re-runs and gives the precise reason.)
            } else {
                r = svc.tryJoin(uuid, jobId);
            }

            int code = switch (r) {
                case OK          -> 200;
                case ALREADY_IN  -> 409;
                case NOT_FOUND   -> 404;
                case DISABLED    -> 423;
                case NO_SLOT     -> 403;
            };
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("ok",     r == CustomJobService.JoinResult.OK);
            resp.put("reason", r.name());
            resp.putAll(svc.slotsSnapshot(uuid));
            HttpHelper.json(ex, code, resp);
        } catch (Exception e) {
            HttpHelper.error(ex, 400, "Invalid body: " + e.getMessage());
        }
    }

    /** POST /api/custom-jobs/me/leave — body {jobId} */
    public void meLeave(HttpExchange ex) throws IOException {
        String uuid = portalUuid(ex);
        if (uuid == null) return;
        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }
        try {
            var body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
            String jobId = (String) body.get("jobId");
            if (jobId == null) { HttpHelper.error(ex, 400, "Missing 'jobId'"); return; }

            CustomJobService svc = module.getService();
            boolean ok;
            Player online = Bukkit.getPlayer(UUID.fromString(uuid));
            if (online != null) ok = svc.leave(online, jobId);
            else                ok = svc.tryLeave(uuid, jobId);

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("ok", ok);
            resp.putAll(svc.slotsSnapshot(uuid));
            HttpHelper.json(ex, ok ? 200 : 404, resp);
        } catch (Exception e) {
            HttpHelper.error(ex, 400, "Invalid body: " + e.getMessage());
        }
    }

    // ── Admin: per-job enable + slots-per-rank ─────────────────────────────────

    /**
     * PATCH /api/custom-jobs/admin/job/:id/enabled
     * Body : { "enabled": true|false }
     */
    public void adminToggleJob(HttpExchange ex) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }

        String path = ex.getRequestURI().getPath();
        String tail = path.substring("/api/custom-jobs/admin/job/".length());
        String jobId = tail.endsWith("/enabled") ? tail.substring(0, tail.length() - "/enabled".length()) : tail;

        if (module.getConfig().getJob(jobId) == null) {
            HttpHelper.json(ex, 404, Map.of("error", "job_not_found")); return;
        }
        try {
            var body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
            Boolean enabled = (Boolean) body.get("enabled");
            if (enabled == null) { HttpHelper.error(ex, 400, "Missing 'enabled'"); return; }
            module.getConfig().setJobEnabled(jobId, enabled);
            HttpHelper.json(ex, 200, Map.of("id", jobId, "enabled", enabled));
        } catch (Exception e) {
            HttpHelper.error(ex, 400, "Invalid body: " + e.getMessage());
        }
    }

    /** GET /api/custom-jobs/admin/slots — { rank: count, ... } */
    public void adminGetSlots(HttpExchange ex) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }
        HttpHelper.json(ex, 200, module.getConfig().slotsPerRank());
    }

    /**
     * PUT /api/custom-jobs/admin/slots
     * Body : { "rank": "vip", "slots": 3 }   (slots = -1 supprime le rang)
     */
    public void adminPutSlots(HttpExchange ex) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

        CustomJobModule module = jobModule();
        if (module == null) { HttpHelper.json(ex, 503, Map.of("error", "module_unavailable")); return; }
        try {
            var body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
            String rank = (String) body.get("rank");
            Number slots = (Number) body.get("slots");
            if (rank == null || slots == null) { HttpHelper.error(ex, 400, "Missing 'rank' or 'slots'"); return; }
            int n = slots.intValue();
            if (n < 0) module.getConfig().removeRank(rank);
            else       module.getConfig().setSlotsForRank(rank, n);
            HttpHelper.json(ex, 200, module.getConfig().slotsPerRank());
        } catch (Exception e) {
            HttpHelper.error(ex, 400, "Invalid body: " + e.getMessage());
        }
    }

    private String portalUuid(HttpExchange ex) throws IOException {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            HttpHelper.error(ex, 401, "Non authentifié"); return null;
        }
        try {
            return playerJwt.validate(header.substring(7)).getSubject();
        } catch (Exception e) {
            HttpHelper.error(ex, 401, "Token invalide ou expiré"); return null;
        }
    }

    private static String extractUuid(String path, String prefix, String suffix) {
        int start = path.indexOf(prefix);
        if (start < 0) return "";
        start += prefix.length();
        int end = path.indexOf(suffix, start);
        if (end < 0) end = path.length();
        return path.substring(start, end);
    }

    private CustomJobModule jobModule() {
        if (plugin instanceof SunAntiCheat sac) return sac.getCustomJobModule();
        return null;
    }
}
