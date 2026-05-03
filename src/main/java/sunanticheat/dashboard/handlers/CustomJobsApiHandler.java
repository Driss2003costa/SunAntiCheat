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

    private CustomJobModule jobModule() {
        if (plugin instanceof SunAntiCheat sac) return sac.getCustomJobModule();
        return null;
    }
}
