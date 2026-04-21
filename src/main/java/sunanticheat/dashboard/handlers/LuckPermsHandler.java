package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.luckperms.LuckPermsBridge;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Handler HTTP pour l'intégration LuckPerms : statut, liste des groupes,
 * lecture et modification des ranks d'un joueur.
 */
public final class LuckPermsHandler {

    private final JavaPlugin plugin;

    public LuckPermsHandler(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    /** GET /api/luckperms/status — auth requise. */
    public void status(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("available", LuckPermsBridge.isAvailable());
        out.put("version", LuckPermsBridge.getVersion());
        HttpHelper.json(ex, 200, out);
    }

    /** GET /api/luckperms/groups — MOD+. */
    public void listGroups(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        HttpHelper.json(ex, 200, LuckPermsBridge.listGroups());
    }

    /** GET /api/luckperms/player/{playerName} — MOD+. */
    public void playerInfo(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                           String playerName) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        if (playerName == null || playerName.isEmpty()) {
            HttpHelper.error(ex, 400, "playerName requis");
            return;
        }
        OfflinePlayer off = Bukkit.getOfflinePlayer(playerName);
        UUID uuid = off.getUniqueId();
        Map<String, Object> info = new LinkedHashMap<>(LuckPermsBridge.getPlayerInfo(uuid.toString()));
        Player online = Bukkit.getPlayerExact(playerName);
        info.put("online", online != null);
        HttpHelper.json(ex, 200, info);
    }

    /** POST /api/luckperms/player/{playerName}/group — ADMIN. Body: { group }. */
    @SuppressWarnings("unchecked")
    public void addGroup(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                         String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null || body.get("group") == null) {
            HttpHelper.error(ex, 400, "body { group } requis");
            return;
        }
        String group = (String) body.get("group");
        OfflinePlayer off = Bukkit.getOfflinePlayer(playerName);
        UUID uuid = off.getUniqueId();
        try {
            boolean ok = LuckPermsBridge.addGroup(uuid.toString(), group).get(5, TimeUnit.SECONDS);
            if (ok) {
                plugin.getLogger().info("[LP] " + u.username() + " a ajouté " + group + " à " + playerName);
                HttpHelper.json(ex, 200, Map.of("success", true));
            } else {
                HttpHelper.error(ex, 500, "Échec de l'ajout du groupe");
            }
        } catch (Exception e) {
            HttpHelper.error(ex, 500, "Erreur : " + e.getMessage());
        }
    }

    /** DELETE /api/luckperms/player/{playerName}/group/{group} — ADMIN. */
    public void removeGroup(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                            String playerName, String group) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        if (playerName == null || group == null) {
            HttpHelper.error(ex, 400, "playerName/group requis");
            return;
        }
        OfflinePlayer off = Bukkit.getOfflinePlayer(playerName);
        UUID uuid = off.getUniqueId();
        try {
            boolean ok = LuckPermsBridge.removeGroup(uuid.toString(), group).get(5, TimeUnit.SECONDS);
            if (ok) {
                plugin.getLogger().info("[LP] " + u.username() + " a retiré " + group + " de " + playerName);
                HttpHelper.json(ex, 200, Map.of("success", true));
            } else {
                HttpHelper.error(ex, 500, "Échec du retrait du groupe");
            }
        } catch (Exception e) {
            HttpHelper.error(ex, 500, "Erreur : " + e.getMessage());
        }
    }

    /** PUT /api/luckperms/player/{playerName}/primary — ADMIN. Body: { group }. */
    @SuppressWarnings("unchecked")
    public void setPrimary(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                           String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null || body.get("group") == null) {
            HttpHelper.error(ex, 400, "body { group } requis");
            return;
        }
        String group = (String) body.get("group");
        OfflinePlayer off = Bukkit.getOfflinePlayer(playerName);
        UUID uuid = off.getUniqueId();
        try {
            boolean ok = LuckPermsBridge.setPrimaryGroup(uuid.toString(), group).get(5, TimeUnit.SECONDS);
            if (ok) {
                plugin.getLogger().info("[LP] " + u.username() + " a défini le groupe principal " + group + " pour " + playerName);
                HttpHelper.json(ex, 200, Map.of("success", true));
            } else {
                HttpHelper.error(ex, 500, "Échec de la définition du groupe principal");
            }
        } catch (Exception e) {
            HttpHelper.error(ex, 500, "Erreur : " + e.getMessage());
        }
    }

    /** GET /api/luckperms/online — MOD+. Joueurs connectés avec leurs groupes. */
    public void onlinePlayersWithGroups(HttpExchange ex, JwtUtil jwt,
                                        Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        List<Map<String, Object>> out = new ArrayList<>();
        for (Player p : Bukkit.getOnlinePlayers()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", p.getName());
            m.put("uuid", p.getUniqueId().toString());
            Map<String, Object> info = LuckPermsBridge.getPlayerInfo(p.getUniqueId().toString());
            m.put("primaryGroup", info.get("primaryGroup"));
            Object groups = info.get("groups");
            m.put("groups", groups == null ? List.of() : groups);
            out.add(m);
        }
        HttpHelper.json(ex, 200, out);
    }
}
