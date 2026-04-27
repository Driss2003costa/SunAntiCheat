package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.configuration.file.YamlConfiguration;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.xray.BlockMiningStats;
import sunanticheat.xray.XRayLogManager;
import sunanticheat.xray.XRayTracker;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * GET /api/xray/stats?limit=50          — classement tous joueurs (session en cours)
 * GET /api/xray/stats/{name}            — stats d'un joueur
 * GET /api/xray/logs                    — dates disponibles (fichiers log)
 * GET /api/xray/logs/{date}             — log d'une date précise (YYYY-MM-DD)
 */
public final class XRayStatsHandler {

    private final XRayTracker tracker;
    private final XRayLogManager logManager;

    public XRayStatsHandler(XRayTracker tracker, XRayLogManager logManager) {
        this.tracker = tracker;
        this.logManager = logManager;
    }

    public void stats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int limit = Math.max(1, Math.min(500, HttpHelper.queryInt(ex, "limit", 50)));

        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<UUID, BlockMiningStats> e : tracker.getAllStats().entrySet()) {
            BlockMiningStats s = e.getValue();
            if (s.getTotal() == 0) continue;
            OfflinePlayer op = Bukkit.getOfflinePlayer(e.getKey());
            out.add(toMap(e.getKey().toString(), op.getName(), s));
        }
        out.sort(Comparator.<Map<String, Object>, Double>
                comparing(m -> (Double) m.get("valuablePercent")).reversed());
        if (out.size() > limit) out = out.subList(0, limit);
        HttpHelper.json(ex, 200, out);
    }

    public void playerStats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                            String name) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        OfflinePlayer op = Bukkit.getOfflinePlayer(name);
        BlockMiningStats s = tracker.getStats(op.getUniqueId());
        if (s == null) {
            HttpHelper.json(ex, 200, Map.of("playerName", name, "totalBlocks", 0));
            return;
        }
        HttpHelper.json(ex, 200, toMap(op.getUniqueId().toString(), op.getName(), s));
    }

    public void logs(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        List<String> dates = new ArrayList<>();
        File dir = logManager.getLogDirectory();
        if (dir.exists()) {
            File[] files = dir.listFiles((d, n) -> n.startsWith("xray-log-") && n.endsWith(".yml"));
            if (files != null) {
                for (File f : files) {
                    String n = f.getName();
                    dates.add(n.substring("xray-log-".length(), n.length() - ".yml".length()));
                }
                dates.sort(Comparator.reverseOrder());
            }
        }
        HttpHelper.json(ex, 200, Map.of("dates", dates));
    }

    public void logForDate(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                           String date) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        if (!date.matches("\\d{4}-\\d{2}-\\d{2}")) {
            HttpHelper.error(ex, 400, "Format date invalide (YYYY-MM-DD attendu)");
            return;
        }
        File file = new File(logManager.getLogDirectory(), "xray-log-" + date + ".yml");
        if (!file.exists()) { HttpHelper.error(ex, 404, "Log introuvable pour la date : " + date); return; }

        YamlConfiguration cfg = YamlConfiguration.loadConfiguration(file);
        List<Map<String, Object>> players = new ArrayList<>();
        var section = cfg.getConfigurationSection("players");
        if (section != null) {
            for (String key : section.getKeys(false)) {
                String path = "players." + key + ".";
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("playerUuid", key);
                m.put("playerName", cfg.getString(path + "name", "?"));
                m.put("diamond", cfg.getLong(path + "diamond", 0));
                m.put("iron", cfg.getLong(path + "iron", 0));
                m.put("gold", cfg.getLong(path + "gold", 0));
                m.put("ancientDebris", cfg.getLong(path + "ancientDebris", 0));
                m.put("netherrack", cfg.getLong(path + "netherrack", 0));
                m.put("common", cfg.getLong(path + "common", 0));
                players.add(m);
            }
        }
        players.sort(Comparator.<Map<String, Object>, Long>
                comparing(m -> (Long) m.get("diamond")).reversed());
        HttpHelper.json(ex, 200, Map.of("date", date, "players", players));
    }

    private static Map<String, Object> toMap(String uuid, String name, BlockMiningStats s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("playerUuid", uuid);
        m.put("playerName", name != null ? name : "?");
        m.put("diamond", s.getDiamondCount());
        m.put("iron", s.getIronCount());
        m.put("gold", s.getGoldCount());
        m.put("ancientDebris", s.getAncientDebrisCount());
        m.put("netherrack", s.getNetherrackCount());
        m.put("common", s.getCommonCount());
        m.put("total", s.getTotal());
        m.put("valuablePercent", round(s.getValuablePercentage()));
        m.put("diamondPerThousand", round(s.getDiamondPerThousandCommon()));
        m.put("suspicion", suspicion(s));
        return m;
    }

    private static String suspicion(BlockMiningStats s) {
        double vp = s.getValuablePercentage();
        double dpt = s.getDiamondPerThousandCommon();
        if (vp >= 65 || dpt >= 5) return "VERY_HIGH";
        if (vp >= 45 || dpt >= 3) return "HIGH";
        if (vp >= 22 || dpt >= 1.5) return "MEDIUM";
        return "LOW";
    }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
