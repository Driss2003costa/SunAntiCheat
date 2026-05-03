package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.plugin.Plugin;
import sunanticheat.SunAntiCheat;
import sunanticheat.dashboard.HttpHelper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class PublicLeaderboardHandler {

    private final Plugin plugin;

    public PublicLeaderboardHandler(Plugin plugin) {
        this.plugin = plugin;
    }

    /** GET /api/public/leaderboard — no authentication required */
    public void leaderboard(HttpExchange ex) throws IOException {
        List<Map<String, Object>> playtimeRows = new ArrayList<>();
        List<Map<String, Object>> economyRows  = new ArrayList<>();

        if (plugin instanceof SunAntiCheat sac && sac.getPlaytimeTracker() != null) {
            var top = sac.getPlaytimeTracker().getTopPlaytimes(25);
            int rank = 1;
            for (Map.Entry<UUID, Long> entry : top) {
                UUID uuid = entry.getKey();
                long seconds = entry.getValue();
                OfflinePlayer op = Bukkit.getOfflinePlayer(uuid);
                String name = op.getName();
                if (name == null || name.isBlank()) continue;

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("rank",               rank);
                row.put("username",            name);
                row.put("uuid",                uuid.toString());
                row.put("playtime_seconds",    seconds);
                row.put("playtime_formatted",
                        sunanticheat.playtime.PlaytimeTracker.formatPlaytime(seconds));

                // Include economy balance if available
                try {
                    if (sac.getEconomy() != null) {
                        double bal = sac.getEconomy().getBalance(op);
                        row.put("balance", bal);
                    }
                } catch (Throwable ignored) {}

                playtimeRows.add(row);
                rank++;
                if (rank > 20) break;
            }
        }

        // Economy-only leaderboard: if Vault economy is available, collect online + offline
        // (only useful if more data is available; skip if already added via playtime)
        // We intentionally rely on the playtime list since Vault doesn't expose a "top" API.

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("playtime",   playtimeRows);
        resp.put("economy",    economyRows);
        resp.put("updatedAt",  System.currentTimeMillis());
        HttpHelper.json(ex, 200, resp);
    }
}
