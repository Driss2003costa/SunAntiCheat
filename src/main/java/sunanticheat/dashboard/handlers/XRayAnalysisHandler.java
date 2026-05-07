package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.audit.Audit;
import sunanticheat.xray.analysis.MiningSample;
import sunanticheat.xray.analysis.RegionProfile;
import sunanticheat.xray.analysis.XRayAnalysisStore;
import sunanticheat.xray.analysis.XRayPlayerProfile;
import sunanticheat.xray.analysis.XRaySuspicionScorer;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Endpoints d'analyse X-Ray détaillée :
 *
 *   GET    /api/xray/overview              — KPIs globaux + top suspects
 *   GET    /api/xray/players               — liste des joueurs (avec score)
 *   GET    /api/xray/player/{name}         — analyse complète d'un joueur
 *   GET    /api/xray/regions               — profils de région configurés
 *   POST   /api/xray/player/{name}/reset   — efface les données du joueur
 *   POST   /api/xray/player/{name}/clear   — marque "vu/blanchi" par le staff
 */
public final class XRayAnalysisHandler {

    private final XRayAnalysisStore store;
    private final org.bukkit.plugin.java.JavaPlugin plugin;

    public XRayAnalysisHandler(XRayAnalysisStore store, org.bukkit.plugin.java.JavaPlugin plugin) {
        this.store = store;
        this.plugin = plugin;
    }

    public void overview(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int minBlocks = plugin.getConfig().getInt("xray.min-blocks-for-index", 150);

        long totalBlocks = 0, totalDiamond = 0, totalAncient = 0;
        int veryHigh = 0, high = 0, medium = 0, low = 0, neg = 0, insufficient = 0;
        List<Map<String, Object>> top = new ArrayList<>();
        for (XRayPlayerProfile p : store.all().values()) {
            totalBlocks += p.total();
            totalDiamond += p.diamond();
            totalAncient += p.ancientDebris();
            var dom = store.dominantRegion(p);
            var s = XRaySuspicionScorer.compute(p, dom.profile(), minBlocks);
            switch (s.level()) {
                case "VERY_HIGH" -> veryHigh++;
                case "HIGH" -> high++;
                case "MEDIUM" -> medium++;
                case "LOW" -> low++;
                case "NEGLIGIBLE" -> neg++;
                default -> insufficient++;
            }
            top.add(summary(p, dom, s));
        }
        top.sort(Comparator.<Map<String, Object>, Integer>
                comparing(m -> (Integer) m.get("score")).reversed());
        if (top.size() > 8) top = top.subList(0, 8);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalPlayers", store.all().size());
        out.put("totalBlocks", totalBlocks);
        out.put("totalDiamond", totalDiamond);
        out.put("totalAncientDebris", totalAncient);
        out.put("levels", Map.of(
                "VERY_HIGH", veryHigh,
                "HIGH", high,
                "MEDIUM", medium,
                "LOW", low,
                "NEGLIGIBLE", neg,
                "INSUFFICIENT", insufficient));
        out.put("topSuspects", top);
        out.put("regions", store.regionResolver().all().stream().map(store.regionResolver()::exportProfile).toList());
        HttpHelper.json(ex, 200, out);
    }

    public void players(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int minBlocks = plugin.getConfig().getInt("xray.min-blocks-for-index", 150);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (XRayPlayerProfile p : store.all().values()) {
            if (p.total() == 0) continue;
            var dom = store.dominantRegion(p);
            var s = XRaySuspicionScorer.compute(p, dom.profile(), minBlocks);
            rows.add(summary(p, dom, s));
        }
        rows.sort(Comparator.<Map<String, Object>, Integer>
                comparing(m -> (Integer) m.get("score")).reversed());
        HttpHelper.json(ex, 200, rows);
    }

    public void player(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String name) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        OfflinePlayer op = Bukkit.getOfflinePlayer(name);
        if (op == null || op.getUniqueId() == null) {
            HttpHelper.error(ex, 404, "Joueur introuvable : " + name);
            return;
        }
        XRayPlayerProfile profile = store.get(op.getUniqueId());
        if (profile == null) {
            HttpHelper.json(ex, 200, Map.of(
                    "playerName", name,
                    "uuid", op.getUniqueId().toString(),
                    "totalBlocks", 0,
                    "score", 0,
                    "level", "INSUFFICIENT"));
            return;
        }
        int minBlocks = plugin.getConfig().getInt("xray.min-blocks-for-index", 150);
        var dom = store.dominantRegion(profile);
        var score = XRaySuspicionScorer.compute(profile, dom.profile(), minBlocks);

        Player online = op.isOnline() ? op.getPlayer() : null;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("uuid", profile.uuid().toString());
        out.put("playerName", profile.playerName());
        out.put("online", online != null);
        if (online != null) {
            var loc = online.getLocation();
            out.put("position", Map.of(
                    "world", loc.getWorld() != null ? loc.getWorld().getName() : "?",
                    "x", loc.getBlockX(), "y", loc.getBlockY(), "z", loc.getBlockZ()));
            out.put("gamemode", online.getGameMode().name());
        }
        out.put("createdAt", profile.createdAt());
        out.put("lastEventAt", profile.lastEventAt());
        out.put("reviewed", profile.reviewed());
        out.put("reviewedAt", profile.reviewedAt());
        out.put("reviewedBy", profile.reviewedBy());
        out.put("totalBlocks", profile.total());
        out.put("totalCommon", profile.totalCommon() + profile.netherrack());
        out.put("totalValuable", profile.valuable());
        out.put("score", score.total());
        out.put("level", score.level());
        out.put("oreCounts", profile.oreCountsView());
        out.put("dominantRegion", Map.of(
                "id", dom.regionId(),
                "displayName", dom.profile().displayName,
                "emoji", dom.profile().emoji,
                "share", round(dom.share() * 100, 2),
                "expectedValuablePercent", dom.profile().expectedValuablePercent,
                "expectedDiamondPer1k", dom.profile().expectedDiamondPer1k,
                "tolerance", dom.profile().tolerance));

        // Components du score (chaque sous-axe avec sa contribution)
        List<Map<String, Object>> comps = new ArrayList<>();
        for (var entry : score.components().entrySet()) {
            var c = entry.getValue();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", entry.getKey());
            m.put("label", c.label());
            m.put("value", round(c.value(), 2));
            m.put("maxScore", c.maxScore());
            m.put("score", round(c.score(), 1));
            m.put("detail", c.detail());
            comps.add(m);
        }
        out.put("scoreComponents", comps);

        // Y histogram
        out.put("byY", profile.byYSnapshot().entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> {
                    long[] a = e.getValue();
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("y", e.getKey());
                    m.put("diamond", a[0]); m.put("iron", a[1]);
                    m.put("gold", a[2]);    m.put("ancientDebris", a[3]);
                    m.put("emerald", a[4]); m.put("common", a[5]);
                    return m;
                }).toList());

        // Per-world
        out.put("byWorld", profile.byWorldSnapshot().entrySet().stream().map(e -> {
            long[] a = e.getValue();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("world", e.getKey());
            m.put("diamond", a[0]); m.put("iron", a[1]); m.put("gold", a[2]);
            m.put("ancientDebris", a[3]); m.put("common", a[4]);
            return m;
        }).toList());

        // Per-region
        out.put("byRegion", profile.byRegionSnapshot().entrySet().stream().map(e -> {
            long[] a = e.getValue();
            RegionProfile rp = store.regionResolver().all().stream()
                    .filter(p -> p.id.equals(e.getKey())).findFirst().orElse(store.regionResolver().defaultProfile());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("regionId", e.getKey());
            m.put("displayName", rp.displayName);
            m.put("emoji", rp.emoji);
            m.put("diamond", a[0]); m.put("iron", a[1]); m.put("gold", a[2]);
            m.put("ancientDebris", a[3]); m.put("common", a[4]);
            return m;
        }).toList());

        // Hourly (24 derniers buckets)
        long now = System.currentTimeMillis();
        long currentHour = now / 3_600_000L;
        var hourly = profile.hourlySnapshot();
        List<Map<String, Object>> hourlyOut = new ArrayList<>();
        for (int i = 23; i >= 0; i--) {
            long bucket = currentHour - i;
            long[] a = hourly.getOrDefault(bucket, new long[5]);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("hour", bucket * 3_600_000L);
            m.put("diamond", a[0]); m.put("iron", a[1]); m.put("gold", a[2]);
            m.put("ancientDebris", a[3]); m.put("common", a[4]);
            hourlyOut.add(m);
        }
        out.put("hourly", hourlyOut);

        // Daily (14 derniers buckets)
        long currentDay = now / 86_400_000L;
        var daily = profile.dailySnapshot();
        List<Map<String, Object>> dailyOut = new ArrayList<>();
        for (int i = XRayPlayerProfile.DAILY_BUCKETS - 1; i >= 0; i--) {
            long bucket = currentDay - i;
            long[] a = daily.getOrDefault(bucket, new long[5]);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("day", bucket * 86_400_000L);
            m.put("diamond", a[0]); m.put("iron", a[1]); m.put("gold", a[2]);
            m.put("ancientDebris", a[3]); m.put("common", a[4]);
            dailyOut.add(m);
        }
        out.put("daily", dailyOut);

        // Veines récentes
        List<MiningSample> recent = profile.recentSamplesList();
        List<Map<String, Object>> recentOut = new ArrayList<>();
        for (int i = recent.size() - 1; i >= 0; i--) {
            MiningSample s = recent.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("timestamp", s.timestamp());
            m.put("oreType", s.oreType().name());
            m.put("world", s.world());
            m.put("region", s.region());
            m.put("x", s.x()); m.put("y", s.y()); m.put("z", s.z());
            recentOut.add(m);
        }
        out.put("recentVeins", recentOut);

        HttpHelper.json(ex, 200, out);
    }

    public void regions(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        List<Map<String, Object>> out = new ArrayList<>();
        for (RegionProfile p : store.regionResolver().all()) {
            out.add(store.regionResolver().exportProfile(p));
        }
        HttpHelper.json(ex, 200, Map.of("regions", out));
    }

    public void resetPlayer(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String name) throws IOException {
        DashboardUser u = HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.ADMIN);
        if (u == null) return;
        OfflinePlayer op = Bukkit.getOfflinePlayer(name);
        if (op == null || op.getUniqueId() == null) {
            HttpHelper.error(ex, 404, "Joueur introuvable : " + name);
            return;
        }
        boolean removed = store.reset(op.getUniqueId());
        Audit.log(u, ex, "XRAY_RESET", name, removed ? "Données X-Ray réinitialisées" : "Aucune donnée à effacer");
        HttpHelper.json(ex, 200, Map.of("ok", removed, "playerName", name));
    }

    public void clearReview(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String name) throws IOException {
        DashboardUser u = HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD);
        if (u == null) return;
        OfflinePlayer op = Bukkit.getOfflinePlayer(name);
        if (op == null || op.getUniqueId() == null) {
            HttpHelper.error(ex, 404, "Joueur introuvable : " + name);
            return;
        }
        XRayPlayerProfile profile = store.get(op.getUniqueId());
        if (profile == null) { HttpHelper.error(ex, 404, "Pas de données X-Ray pour : " + name); return; }
        profile.markReviewed(u.username());
        Audit.log(u, ex, "XRAY_REVIEW", name, "Joueur marqué comme blanchi");
        HttpHelper.json(ex, 200, Map.of("ok", true, "playerName", name, "reviewedBy", u.username()));
    }

    private Map<String, Object> summary(XRayPlayerProfile p, XRaySuspicionScorer.DominantRegion dom, XRaySuspicionScorer.Score s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("uuid", p.uuid().toString());
        m.put("playerName", p.playerName() != null ? p.playerName() : "?");
        m.put("totalBlocks", p.total());
        m.put("diamond", p.diamond());
        m.put("iron", p.iron());
        m.put("gold", p.gold());
        m.put("ancientDebris", p.ancientDebris());
        m.put("emerald", p.emerald());
        m.put("valuablePercent", round(p.total() == 0 ? 0 : 100.0 * p.valuable() / p.total(), 2));
        m.put("diamondPer1k", round(p.totalCommon() + p.netherrack() == 0 ? 0 :
                1000.0 * p.diamond() / (p.totalCommon() + p.netherrack()), 2));
        m.put("score", s.total());
        m.put("level", s.level());
        m.put("regionId", dom.regionId());
        m.put("regionName", dom.profile().displayName);
        m.put("regionEmoji", dom.profile().emoji);
        m.put("lastEventAt", p.lastEventAt());
        m.put("reviewed", p.reviewed());
        OfflinePlayer op = Bukkit.getOfflinePlayer(p.uuid());
        m.put("online", op.isOnline());
        return m;
    }

    private static double round(double v, int decimals) {
        double f = Math.pow(10, decimals);
        return Math.round(v * f) / f;
    }
}
