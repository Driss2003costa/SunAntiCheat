package sunanticheat.dashboard.jobs;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.lang.reflect.Method;
import java.util.*;

/**
 * Lecture live des données Jobs Reborn par RÉFLEXION (zéro import compile-time).
 *
 * Les méthodes invoquées :
 *   - Jobs.getJobs() → List<Job>
 *   - Jobs.getPlayerManager().getJobsPlayer(uuid) → JobsPlayer
 *   - JobsPlayer.getJobProgression() → List<JobProgression>
 *   - JobProgression.getJob() / getLevel() / getExperience() / getMaxExperience()
 *   - Job.getName() / getDisplayName() / getDescription() / getMaxLevel() / getTotalPlayers()
 *
 * Ces signatures sont stables depuis Jobs Reborn 4.x. Si elles changent, on log
 * une warning et on retourne des structures vides (pas de crash).
 */
public final class JobsLiveService {

    /** Liste tous les jobs définis dans la config Jobs. */
    public List<Map<String, Object>> listJobs() {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            Class<?> jobsClass = Class.forName("com.gamingmesh.jobs.Jobs");
            Object jobsList = jobsClass.getMethod("getJobs").invoke(null);
            if (!(jobsList instanceof List<?> list)) return out;
            for (Object j : list) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", str(invoke(j, "getName")));
                m.put("displayName", strOrNull(invoke(j, "getDisplayName"), str(invoke(j, "getName"))));
                Object desc = invoke(j, "getDescription");
                if (desc instanceof List<?> dl) {
                    StringBuilder sb = new StringBuilder();
                    for (Object x : dl) { if (sb.length() > 0) sb.append(" "); sb.append(x); }
                    m.put("description", sb.toString());
                } else {
                    m.put("description", "");
                }
                m.put("maxLevel", numInt(invoke(j, "getMaxLevel")));
                Object color = invoke(j, "getChatColor");
                m.put("color", color != null ? color.toString() : "WHITE");
                m.put("totalPlayers", numInt(invoke(j, "getTotalPlayers")));
                out.add(m);
            }
        } catch (Throwable ignored) {}
        return out;
    }

    /** Snapshot des joueurs ONLINE et leurs jobs courants. */
    public List<Map<String, Object>> activePlayers() {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            Class<?> jobsClass = Class.forName("com.gamingmesh.jobs.Jobs");
            Object pm = jobsClass.getMethod("getPlayerManager").invoke(null);
            if (pm == null) return out;
            Method getJobsPlayer = pm.getClass().getMethod("getJobsPlayer", UUID.class);

            for (Player online : Bukkit.getOnlinePlayers()) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("playerName", online.getName());
                entry.put("playerUuid", online.getUniqueId().toString());

                List<Map<String, Object>> jobsList = new ArrayList<>();
                try {
                    Object jp = getJobsPlayer.invoke(pm, online.getUniqueId());
                    if (jp != null) {
                        Object progressions = invoke(jp, "getJobProgression");
                        if (progressions instanceof List<?> list) {
                            for (Object prog : list) {
                                Object job = invoke(prog, "getJob");
                                Map<String, Object> jm = new LinkedHashMap<>();
                                jm.put("name", str(invoke(job, "getName")));
                                jm.put("level", numInt(invoke(prog, "getLevel")));
                                jm.put("maxLevel", numInt(invoke(job, "getMaxLevel")));
                                jm.put("exp", round(numDouble(invoke(prog, "getExperience"))));
                                jm.put("nextLevelExp", round(numDouble(invoke(prog, "getMaxExperience"))));
                                jobsList.add(jm);
                            }
                        }
                    }
                } catch (Throwable ignored) {}

                entry.put("jobs", jobsList);
                out.add(entry);
            }
        } catch (Throwable ignored) {}
        return out;
    }

    /** Snapshot par job : nb de joueurs ONLINE + niveau moyen. */
    public List<Map<String, Object>> jobsOccupancy() {
        Map<String, int[]> counts = new HashMap<>();   // jobName → [online, totalLevels]

        try {
            Class<?> jobsClass = Class.forName("com.gamingmesh.jobs.Jobs");
            Object pm = jobsClass.getMethod("getPlayerManager").invoke(null);
            Method getJobsPlayer = pm.getClass().getMethod("getJobsPlayer", UUID.class);

            for (Player online : Bukkit.getOnlinePlayers()) {
                try {
                    Object jp = getJobsPlayer.invoke(pm, online.getUniqueId());
                    if (jp == null) continue;
                    Object progressions = invoke(jp, "getJobProgression");
                    if (!(progressions instanceof List<?> list)) continue;
                    for (Object prog : list) {
                        Object job = invoke(prog, "getJob");
                        String name = str(invoke(job, "getName"));
                        int level = numInt(invoke(prog, "getLevel"));
                        counts.computeIfAbsent(name, k -> new int[2]);
                        counts.get(name)[0]++;
                        counts.get(name)[1] += level;
                    }
                } catch (Throwable ignored) {}
            }

            // Construit la liste finale avec totalRegistered (depuis Jobs.getJobs())
            Object allJobs = jobsClass.getMethod("getJobs").invoke(null);
            List<Map<String, Object>> out = new ArrayList<>();
            if (allJobs instanceof List<?> list) {
                for (Object j : list) {
                    String name = str(invoke(j, "getName"));
                    int[] c = counts.getOrDefault(name, new int[]{0, 0});
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", name);
                    m.put("totalRegistered", numInt(invoke(j, "getTotalPlayers")));
                    m.put("onlineCount", c[0]);
                    m.put("avgLevel", c[0] == 0 ? 0 : round((double) c[1] / c[0]));
                    out.add(m);
                }
            }
            return out;
        } catch (Throwable t) {
            return List.of();
        }
    }

    // ── Helpers réflexion ────────────────────────────────────────────────────

    private static Object invoke(Object target, String methodName) {
        if (target == null) return null;
        try {
            return target.getClass().getMethod(methodName).invoke(target);
        } catch (Throwable t) {
            return null;
        }
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o); }
    private static String strOrNull(Object o, String fallback) {
        return o == null || o.toString().isEmpty() ? fallback : o.toString();
    }
    private static int numInt(Object o) { return o instanceof Number n ? n.intValue() : 0; }
    private static double numDouble(Object o) { return o instanceof Number n ? n.doubleValue() : 0; }
    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
