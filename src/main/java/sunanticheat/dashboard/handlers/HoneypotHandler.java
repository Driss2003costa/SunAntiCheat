package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.honeypot.HoneypotStore;
import sunanticheat.dashboard.honeypot.HoneypotTrap;

import java.io.IOException;
import java.util.*;

public final class HoneypotHandler {
    private final HoneypotStore store;
    public HoneypotHandler(HoneypotStore store) { this.store = store; }

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        List<Map<String, Object>> out = new ArrayList<>();
        for (HoneypotTrap t : store.all()) out.add(map(t));
        out.sort((a, b) -> Long.compare((long) b.get("createdAt"), (long) a.get("createdAt")));
        HttpHelper.json(ex, 200, out);
    }

    public void alerts(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int limit = HttpHelper.queryInt(ex, "limit", 100);
        List<Map<String, Object>> a = store.recentAlerts(limit);
        Collections.reverse(a);
        HttpHelper.json(ex, 200, a);
    }

    @SuppressWarnings("unchecked")
    public void create(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        String label = (String) body.get("label");
        String world = (String) body.get("world");
        String material = (String) body.getOrDefault("material", "DIAMOND_BLOCK");
        Number nx = (Number) body.get("x"), ny = (Number) body.get("y"), nz = (Number) body.get("z");
        Boolean place = (Boolean) body.getOrDefault("place", true);
        if (world == null || nx == null || ny == null || nz == null) { HttpHelper.error(ex, 400, "world/x/y/z requis"); return; }
        int x = nx.intValue(), y = ny.intValue(), z = nz.intValue();

        HoneypotTrap trap = store.add(label, world, x, y, z, material);

        if (place) {
            World w = Bukkit.getWorld(world);
            if (w != null) {
                Material mat;
                try { mat = Material.valueOf(material); } catch (Exception e) { mat = Material.DIAMOND_BLOCK; }
                final Material finalMat = mat;
                Bukkit.getScheduler().runTask(Bukkit.getPluginManager().getPlugin("SunAntiCheat"), () -> {
                    Block b = w.getBlockAt(x, y, z);
                    b.setType(finalMat);
                });
            }
        }

        HttpHelper.json(ex, 201, map(trap));
    }

    public void delete(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        boolean ok = store.delete(id);
        if (!ok) { HttpHelper.error(ex, 404, "Piège introuvable"); return; }
        HttpHelper.noContent(ex);
    }

    private static Map<String, Object> map(HoneypotTrap t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("label", t.getLabel());
        m.put("world", t.getWorld());
        m.put("x", t.getX()); m.put("y", t.getY()); m.put("z", t.getZ());
        m.put("material", t.getMaterial());
        m.put("createdAt", t.getCreatedAt());
        m.put("lastTriggered", t.getLastTriggered());
        m.put("triggerCount", t.getTriggerCount());
        return m;
    }
}
