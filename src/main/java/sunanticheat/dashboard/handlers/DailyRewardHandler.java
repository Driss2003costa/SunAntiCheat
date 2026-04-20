package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.dailyreward.DailyRewardConfig;
import sunanticheat.dashboard.dailyreward.DailyRewardStore;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Endpoints HTTP pour la gestion des r\u00e9compenses quotidiennes.
 */
public final class DailyRewardHandler {

    private final DailyRewardStore store;

    public DailyRewardHandler(DailyRewardStore store) {
        this.store = store;
    }

    public void getConfig(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        DailyRewardConfig cfg = store.getConfig();
        if (cfg == null) cfg = DailyRewardConfig.createDefault();
        HttpHelper.json(ex, 200, cfg);
    }

    public void saveConfig(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        DailyRewardConfig cfg;
        try { cfg = HttpHelper.GSON.fromJson(HttpHelper.body(ex), DailyRewardConfig.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        if (cfg == null) { HttpHelper.error(ex, 400, "Body vide"); return; }
        store.saveConfig(cfg);
        HttpHelper.json(ex, 200, store.getConfig());
    }

    public void listClaims(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        String player = HttpHelper.queryParam(ex, "player");
        int days = HttpHelper.queryInt(ex, "days", 7);
        int limit = HttpHelper.queryInt(ex, "limit", 100);
        HttpHelper.json(ex, 200, store.listClaims(player, days, limit));
    }

    public void stats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 7);
        HttpHelper.json(ex, 200, store.statsOverDays(days));
    }

    public void playerStreak(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String playerName) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        if (playerName == null || playerName.isEmpty()) { HttpHelper.error(ex, 400, "playerName requis"); return; }
        OfflinePlayer off = Bukkit.getOfflinePlayer(playerName);
        UUID uuid = off.getUniqueId();
        DailyRewardStore.PlayerState st = store.getPlayerState(uuid.toString());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("playerName", playerName);
        out.put("uuid", uuid.toString());
        out.put("currentStreak", st == null ? 0 : st.currentStreak);
        out.put("nextDay", store.getStreak(uuid.toString()));
        out.put("canClaim", store.canClaim(uuid.toString()));
        out.put("lastClaimAt", st == null ? 0L : st.lastClaimAt);
        HttpHelper.json(ex, 200, out);
    }

    public void resetStreak(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        if (playerName == null || playerName.isEmpty()) { HttpHelper.error(ex, 400, "playerName requis"); return; }
        OfflinePlayer off = Bukkit.getOfflinePlayer(playerName);
        UUID uuid = off.getUniqueId();
        store.resetPlayerStreak(uuid.toString());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("playerName", playerName);
        out.put("uuid", uuid.toString());
        HttpHelper.json(ex, 200, out);
    }
}
