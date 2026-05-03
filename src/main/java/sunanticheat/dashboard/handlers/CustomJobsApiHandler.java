package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.plugin.Plugin;
import sunanticheat.SunAntiCheat;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.jobs.CustomJob;
import sunanticheat.jobs.CustomJobModule;

import java.io.IOException;
import java.util.*;

public final class CustomJobsApiHandler {

    private final Plugin plugin;

    public CustomJobsApiHandler(Plugin plugin) {
        this.plugin = plugin;
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
