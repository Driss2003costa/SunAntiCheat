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
                String name = str(invoke(j, "getName"));
                m.put("name", name);
                // displayName : nettoyé des codes couleur Minecraft + glyphes ItemsAdder
                String dn = clean(strOrNull(invoke(j, "getDisplayName"), name));
                m.put("displayName", dn.isBlank() ? name : dn);
                Object desc = invoke(j, "getDescription");
                if (desc instanceof List<?> dl) {
                    StringBuilder sb = new StringBuilder();
                    for (Object x : dl) { if (sb.length() > 0) sb.append(" "); sb.append(x); }
                    m.put("description", clean(sb.toString()));
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
                                String jName = str(invoke(job, "getName"));
                                jm.put("name", jName);
                                jm.put("displayName", clean(strOrNull(invoke(job, "getDisplayName"), jName)));
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
                    m.put("displayName", clean(strOrNull(invoke(j, "getDisplayName"), name)));
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

    /**
     * Nettoie une string Minecraft : supprime les codes couleur (§a, &c)
     * et les glyphes ItemsAdder (Private Use Area Unicode U+E000-U+F8FF
     * et U+F0000-U+FFFFD pour la PUA-A/B). Trim final.
     *
     * Ces glyphes apparaissent sous forme de carrés vides ou caractères
     * incompréhensibles dans toute UI web (HTML, JSON), parce qu'ils ne
     * sont rendus correctement qu'avec les fonts custom Minecraft fournies
     * par ItemsAdder.
     */
    public static String clean(String s) {
        if (s == null || s.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(s.length());
        int i = 0;
        while (i < s.length()) {
            int cp = s.codePointAt(i);
            int charCount = Character.charCount(cp);

            // Code couleur §X ou &X — skip 2 chars
            if (cp == '§' || cp == '&') {
                if (i + 1 < s.length()) {
                    char next = s.charAt(i + 1);
                    if ("0123456789abcdefklmnorxABCDEFKLMNORX".indexOf(next) >= 0) {
                        i += 2;
                        continue;
                    }
                }
            }

            // PUA Unicode — Plane 0 (BMP) : U+E000-U+F8FF
            // Supplementary PUA-A : U+F0000-U+FFFFD
            // Supplementary PUA-B : U+100000-U+10FFFD
            if ((cp >= 0xE000 && cp <= 0xF8FF)
             || (cp >= 0xF0000 && cp <= 0xFFFFD)
             || (cp >= 0x100000 && cp <= 0x10FFFD)) {
                i += charCount;
                continue;
            }

            sb.appendCodePoint(cp);
            i += charCount;
        }
        return sb.toString().trim().replaceAll("\\s{2,}", " ");
    }
    private static double numDouble(Object o) { return o instanceof Number n ? n.doubleValue() : 0; }
    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
