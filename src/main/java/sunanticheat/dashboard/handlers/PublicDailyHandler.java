package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.dailyreward.DailyRewardConfig;
import sunanticheat.dashboard.dailyreward.DailyRewardDay;
import sunanticheat.dashboard.dailyreward.DailyRewardItem;
import sunanticheat.dashboard.dailyreward.DailyRewardListener;
import sunanticheat.dashboard.dailyreward.DailyRewardStore;
import sunanticheat.dashboard.portal.PlayerJwtUtil;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

public final class PublicDailyHandler {

    private final DailyRewardStore store;
    private final PlayerJwtUtil playerJwt;
    private final JavaPlugin plugin;
    private final DailyRewardListener listener;

    public PublicDailyHandler(DailyRewardStore store, PlayerJwtUtil playerJwt,
                               JavaPlugin plugin, DailyRewardListener listener) {
        this.store     = store;
        this.playerJwt = playerJwt;
        this.plugin    = plugin;
        this.listener  = listener;
    }

    /** GET /api/public/player/me/daily/status */
    public void status(HttpExchange ex) throws IOException {
        String[] auth = extractAuth(ex);
        if (auth == null) return;
        String uuid = auth[0];

        DailyRewardConfig cfg = store.getConfig();
        boolean canClaim = store.canClaim(uuid);
        int nextDay = store.getStreak(uuid);
        DailyRewardStore.PlayerState st = store.getPlayerState(uuid);

        long cooldownMs = 0L;
        if (!canClaim && st != null) {
            long next = st.lastClaimAt + TimeUnit.HOURS.toMillis(20);
            cooldownMs = Math.max(0L, next - System.currentTimeMillis());
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("canClaim", canClaim);
        resp.put("streak", st == null ? 0 : st.currentStreak);
        resp.put("nextDay", nextDay);
        resp.put("cooldownMs", cooldownMs);

        // Simplified config for the frontend
        if (cfg != null) {
            Map<String, Object> cfgMap = new LinkedHashMap<>();
            cfgMap.put("enabled", cfg.enabled);
            cfgMap.put("cycleDays", cfg.cycleDays);
            cfgMap.put("resetOnMiss", cfg.resetOnMiss);
            List<Map<String, Object>> days = new ArrayList<>();
            if (cfg.days != null) {
                for (DailyRewardDay d : cfg.days) {
                    if (d == null) continue;
                    Map<String, Object> dm = new LinkedHashMap<>();
                    dm.put("day", d.day);
                    dm.put("displayName", d.displayName);
                    dm.put("icon", d.icon);
                    dm.put("color", d.color);
                    dm.put("bonusCoins", d.bonusCoins);
                    dm.put("itemsLabel", buildItemsLabel(d));
                    days.add(dm);
                }
            }
            cfgMap.put("days", days);
            resp.put("config", cfgMap);
        }

        HttpHelper.json(ex, 200, resp);
    }

    /** POST /api/public/player/me/daily/claim */
    public void claim(HttpExchange ex) throws IOException {
        String[] auth = extractAuth(ex);
        if (auth == null) return;
        String uuid = auth[0];
        String username = auth[1];

        DailyRewardConfig cfg = store.getConfig();
        if (cfg == null || !cfg.enabled) {
            HttpHelper.error(ex, 403, "Le système de récompense quotidienne est désactivé."); return;
        }
        if (!store.canClaim(uuid)) {
            DailyRewardStore.PlayerState st = store.getPlayerState(uuid);
            long cooldownMs = 0L;
            if (st != null) {
                long next = st.lastClaimAt + TimeUnit.HOURS.toMillis(20);
                cooldownMs = Math.max(0L, next - System.currentTimeMillis());
            }
            long h = cooldownMs / 3600000L;
            long m = (cooldownMs % 3600000L) / 60000L;
            HttpHelper.error(ex, 429, "Déjà réclamé. Revenez dans " + h + "h" + m + "m."); return;
        }

        DailyRewardDay reward = store.claim(uuid, username);
        if (reward == null) {
            HttpHelper.error(ex, 400, "Aucune récompense configurée pour ce jour."); return;
        }

        // Deliver now if online, else queue for next join
        boolean deliveredNow = false;
        try {
            Player online = Bukkit.getPlayer(UUID.fromString(uuid));
            if (online != null && online.isOnline()) {
                final Player fp = online;
                final DailyRewardDay fr = reward;
                plugin.getServer().getScheduler().runTask(plugin, () -> listener.deliverReward(fp, fr));
                deliveredNow = true;
            }
        } catch (Throwable ignored) {}

        if (!deliveredNow) {
            store.addPendingWebClaim(uuid, reward);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", true);
        resp.put("day", reward.day);
        resp.put("displayName", reward.displayName);
        resp.put("icon", reward.icon);
        resp.put("color", reward.color);
        resp.put("bonusCoins", reward.bonusCoins);
        resp.put("itemsLabel", buildItemsLabel(reward));
        resp.put("deliveredNow", deliveredNow);
        resp.put("message", deliveredNow
                ? "Récompense livrée en jeu !"
                : "Récompense réservée ! Elle vous sera remise à votre prochaine connexion.");
        HttpHelper.json(ex, 200, resp);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String[] extractAuth(HttpExchange ex) throws IOException {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            HttpHelper.error(ex, 401, "Non authentifié"); return null;
        }
        try {
            var claims = playerJwt.validate(header.substring(7));
            String uuid     = claims.getSubject();
            String username = claims.get("username", String.class);
            return new String[]{uuid, username};
        } catch (Exception e) {
            HttpHelper.error(ex, 401, "Token invalide ou expiré"); return null;
        }
    }

    private static String buildItemsLabel(DailyRewardDay d) {
        if (d == null || d.items == null || d.items.isEmpty()) return "";
        List<String> parts = new ArrayList<>();
        for (DailyRewardItem it : d.items) {
            if (it == null) continue;
            String name = it.displayName != null ? it.displayName : it.material;
            parts.add(name + " ×" + Math.max(1, it.amount));
        }
        return String.join(", ", parts);
    }
}
