package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import sunanticheat.client.ClientInfo;
import sunanticheat.client.ClientInfoTracker;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET /api/clientinfo/online         — snapshot de tous les joueurs connectés
 * GET /api/clientinfo/player/{name}  — infos d'un joueur connecté spécifique
 */
public final class ClientInfoHandler {

    private final ClientInfoTracker tracker;

    public ClientInfoHandler(ClientInfoTracker tracker) {
        this.tracker = tracker;
    }

    public void online(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        List<Map<String, Object>> out = new ArrayList<>();
        for (Player p : Bukkit.getOnlinePlayers()) {
            out.add(toMap(p.getName(), p.getUniqueId().toString(), tracker.getInfo(p.getUniqueId())));
        }
        HttpHelper.json(ex, 200, out);
    }

    public void player(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                       String name) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        Player p = Bukkit.getPlayerExact(name);
        if (p == null) {
            HttpHelper.json(ex, 200, Map.of("playerName", name, "online", false,
                    "clientBrand", "?", "premium", (Object) null,
                    "mods", List.of(), "resourcePacks", List.of()));
            return;
        }
        Map<String, Object> m = toMap(p.getName(), p.getUniqueId().toString(), tracker.getInfo(p.getUniqueId()));
        m.put("online", true);
        HttpHelper.json(ex, 200, m);
    }

    private static Map<String, Object> toMap(String name, String uuid, ClientInfo info) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("playerName", name);
        m.put("playerUuid", uuid);
        if (info == null) {
            m.put("clientBrand", "?");
            m.put("premium", null);
            m.put("mods", List.of());
            m.put("resourcePacks", List.of());
        } else {
            m.put("clientBrand", info.getClientBrand() != null ? info.getClientBrand() : "vanilla");
            m.put("premium", info.getPremium());
            m.put("mods", info.getMods());
            m.put("resourcePacks", info.getResourcePacks());
        }
        return m;
    }
}
