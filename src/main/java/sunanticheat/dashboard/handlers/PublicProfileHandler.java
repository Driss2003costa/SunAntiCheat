package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import sunanticheat.SunAntiCheat;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.portal.PlayerAccountStore;
import sunanticheat.dashboard.sanctions.SanctionEntry;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class PublicProfileHandler {

    private final PlayerAccountStore accountStore;
    private final Plugin plugin;

    public PublicProfileHandler(PlayerAccountStore accountStore, Plugin plugin) {
        this.accountStore = accountStore;
        this.plugin       = plugin;
    }

    /** GET /api/public/profile/:username */
    public void profile(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        // extract last path segment as username
        String username = path.substring(path.lastIndexOf('/') + 1);

        if (username.isBlank() || !username.matches("[a-zA-Z0-9_]{3,16}")) {
            HttpHelper.error(ex, 400, "Pseudo invalide"); return;
        }

        Map<String, Object> account = accountStore.getByUsername(username);
        if (account == null) {
            HttpHelper.json(ex, 404, Map.of("error", "not_found",
                    "message", "Aucun portail joueur pour ce pseudo.")); return;
        }

        String uuid = (String) account.get("uuid");
        String exactName = (String) account.get("username");

        boolean online = Bukkit.getOnlinePlayers().stream()
                .anyMatch(p -> p.getUniqueId().toString().equals(uuid));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("uuid",      uuid);
        result.put("username",  exactName);
        result.put("role",      account.get("role"));
        result.put("online",    online);
        result.put("created_at", account.get("created_at"));

        // Playtime
        try {
            if (plugin instanceof SunAntiCheat sac && sac.getPlaytimeTracker() != null) {
                long seconds = sac.getPlaytimeTracker().getTotalPlaytimeSeconds(UUID.fromString(uuid));
                result.put("playtime_seconds",   seconds);
                result.put("playtime_formatted", sunanticheat.playtime.PlaytimeTracker.formatPlaytime(seconds));
            }
        } catch (Throwable ignored) {}

        // Active bans/mutes only (public — no internal sanctions details)
        try {
            if (plugin instanceof SunAntiCheat sac
                    && sac.getDashboardModule() != null
                    && sac.getDashboardModule().getSanctionStore() != null) {

                List<SanctionEntry> sanctions = sac.getDashboardModule().getSanctionStore()
                        .list(null, null, null, Boolean.TRUE, 100, 0)
                        .stream()
                        .filter(s -> uuid.equals(s.targetUuid))
                        .filter(s -> "BAN".equals(s.type) || "MUTE".equals(s.type))
                        .toList();

                result.put("active_sanctions", sanctions.stream().map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("type",      s.type);
                    m.put("reason",    s.reason);
                    m.put("expires_at", s.expiresAt);
                    return m;
                }).toList());
            }
        } catch (Throwable ignored) {}

        HttpHelper.json(ex, 200, result);
    }
}
