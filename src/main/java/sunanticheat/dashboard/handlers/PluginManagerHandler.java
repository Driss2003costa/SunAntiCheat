package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.PluginManager;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;

import java.io.File;
import java.io.IOException;
import java.util.*;

public final class PluginManagerHandler {

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        PluginManager pm = Bukkit.getPluginManager();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Plugin p : pm.getPlugins()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", p.getName());
            m.put("version", p.getDescription().getVersion());
            m.put("authors", p.getDescription().getAuthors());
            m.put("description", p.getDescription().getDescription());
            m.put("website", p.getDescription().getWebsite());
            m.put("apiVersion", p.getDescription().getAPIVersion());
            m.put("enabled", p.isEnabled());
            m.put("depend", p.getDescription().getDepend());
            m.put("softDepend", p.getDescription().getSoftDepend());
            File df = p.getDataFolder();
            m.put("dataFolder", df != null ? df.getName() : null);
            m.put("commands", new ArrayList<>(p.getDescription().getCommands().keySet()));
            out.add(m);
        }
        out.sort(Comparator.comparing(a -> String.valueOf(a.get("name")).toLowerCase()));
        HttpHelper.json(ex, 200, out);
    }

    public void toggle(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String name) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.PLUGIN_MANAGE)) return;
        Plugin p = Bukkit.getPluginManager().getPlugin(name);
        if (p == null) { HttpHelper.error(ex, 404, "Plugin introuvable"); return; }
        if ("SunAntiCheat".equalsIgnoreCase(name)) { HttpHelper.error(ex, 400, "Impossible de désactiver SunAntiCheat depuis lui-même"); return; }
        try {
            if (p.isEnabled()) Bukkit.getPluginManager().disablePlugin(p);
            else               Bukkit.getPluginManager().enablePlugin(p);
            HttpHelper.json(ex, 200, Map.of("name", p.getName(), "enabled", p.isEnabled()));
        } catch (Exception e) {
            HttpHelper.error(ex, 500, "Erreur: " + e.getMessage());
        }
    }

    public void reload(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String name) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.PLUGIN_MANAGE)) return;
        Plugin p = Bukkit.getPluginManager().getPlugin(name);
        if (p == null) { HttpHelper.error(ex, 404, "Plugin introuvable"); return; }
        if ("SunAntiCheat".equalsIgnoreCase(name)) { HttpHelper.error(ex, 400, "Impossible de se recharger soi-même"); return; }
        try {
            // Reload = disable/enable + reloadConfig()
            p.reloadConfig();
            Bukkit.getPluginManager().disablePlugin(p);
            Bukkit.getPluginManager().enablePlugin(p);
            HttpHelper.json(ex, 200, Map.of("name", p.getName(), "enabled", p.isEnabled()));
        } catch (Exception e) {
            HttpHelper.error(ex, 500, "Erreur reload: " + e.getMessage());
        }
    }

    public void reloadConfig(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String name) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.PLUGIN_MANAGE)) return;
        Plugin p = Bukkit.getPluginManager().getPlugin(name);
        if (p == null) { HttpHelper.error(ex, 404, "Plugin introuvable"); return; }
        try {
            p.reloadConfig();
            HttpHelper.json(ex, 200, Map.of("ok", true));
        } catch (Exception e) {
            HttpHelper.error(ex, 500, "Erreur reloadConfig: " + e.getMessage());
        }
    }
}
