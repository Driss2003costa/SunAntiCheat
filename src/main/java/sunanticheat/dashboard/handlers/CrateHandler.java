package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.crates.Crate;
import sunanticheat.dashboard.crates.CrateItem;
import sunanticheat.dashboard.crates.CrateListener;
import sunanticheat.dashboard.crates.CrateOpen;
import sunanticheat.dashboard.crates.CrateStore;
import sunanticheat.dashboard.crates.PlacedCrate;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Endpoints HTTP de gestion des crates.
 */
public final class CrateHandler {

    private final JavaPlugin plugin;
    private final CrateStore store;
    private final CrateListener listener;

    public CrateHandler(JavaPlugin plugin, CrateStore store, CrateListener listener) {
        this.plugin = plugin;
        this.store = store;
        this.listener = listener;
    }

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        HttpHelper.json(ex, 200, store.listCrates());
    }

    public void get(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        Crate c = store.getCrate(id);
        if (c == null) { HttpHelper.error(ex, 404, "Crate introuvable"); return; }
        HttpHelper.json(ex, 200, c);
    }

    public void create(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Crate c;
        try { c = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Crate.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        if (c == null) { HttpHelper.error(ex, 400, "Body vide"); return; }
        c.id = null;
        HttpHelper.json(ex, 201, store.createCrate(c));
    }

    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        if (store.getCrate(id) == null) { HttpHelper.error(ex, 404, "Crate introuvable"); return; }
        Crate c;
        try { c = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Crate.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        if (c == null) { HttpHelper.error(ex, 400, "Body vide"); return; }
        store.updateCrate(id, c);
        HttpHelper.json(ex, 200, store.getCrate(id));
    }

    public void delete(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        if (store.getCrate(id) == null) { HttpHelper.error(ex, 404, "Crate introuvable"); return; }
        store.deleteCrate(id);
        HttpHelper.noContent(ex);
    }

    public void opens(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String crateId) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int limit = HttpHelper.queryInt(ex, "limit", 50);
        HttpHelper.json(ex, 200, store.listOpens(crateId, limit));
    }

    public void allOpens(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int limit = HttpHelper.queryInt(ex, "limit", 100);
        HttpHelper.json(ex, 200, store.listOpens(null, limit));
    }

    @SuppressWarnings("unchecked")
    public void giveKey(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String crateId) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Crate crate = store.getCrate(crateId);
        if (crate == null) { HttpHelper.error(ex, 404, "Crate introuvable"); return; }
        Map<String, Object> body;
        try { body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        if (body == null) { HttpHelper.error(ex, 400, "Body vide"); return; }
        String playerName = (String) body.get("playerName");
        Number nc = (Number) body.get("count");
        int count = nc == null ? 1 : Math.max(1, nc.intValue());
        if (playerName == null || playerName.isEmpty()) { HttpHelper.error(ex, 400, "playerName requis"); return; }

        OfflinePlayer off = Bukkit.getOfflinePlayer(playerName);
        UUID uuid = off.getUniqueId();

        if (crate.usesPhysicalKey) {
            final int amount = count;
            Bukkit.getScheduler().runTask(plugin, () -> {
                Player online = off.getPlayer();
                if (online == null) return;
                ItemStack key = listener.buildKeyItem(crate);
                if (key == null) return;
                key.setAmount(amount);
                for (ItemStack leftover : online.getInventory().addItem(key).values()) {
                    online.getWorld().dropItemNaturally(online.getLocation(), leftover);
                }
            });
        } else {
            store.giveKey(crate.id, uuid.toString(), count);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", true);
        resp.put("crateId", crate.id);
        resp.put("playerName", playerName);
        resp.put("uuid", uuid.toString());
        resp.put("count", count);
        resp.put("physical", crate.usesPhysicalKey);
        HttpHelper.json(ex, 200, resp);
    }

    public void playerKeys(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String playerName) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        if (playerName == null || playerName.isEmpty()) { HttpHelper.error(ex, 400, "playerName requis"); return; }
        OfflinePlayer off = Bukkit.getOfflinePlayer(playerName);
        UUID uuid = off.getUniqueId();
        Map<String, Integer> keys = store.getAllKeysForPlayer(uuid.toString());
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("playerName", playerName);
        resp.put("uuid", uuid.toString());
        resp.put("keys", keys);
        HttpHelper.json(ex, 200, resp);
    }

    public void listPlaced(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        List<PlacedCrate> placed = store.listPlacedCrates(null);
        List<Map<String, Object>> out = new ArrayList<>();
        for (PlacedCrate p : placed) {
            Crate c = store.getCrate(p.crateId);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("crateId", p.crateId);
            m.put("crateName", c == null ? null : c.name);
            m.put("crateDisplayName", c == null ? null : c.displayName);
            m.put("world", p.world);
            m.put("x", p.x); m.put("y", p.y); m.put("z", p.z);
            out.add(m);
        }
        HttpHelper.json(ex, 200, out);
    }

    public void stats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String crateId) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        Crate c = store.getCrate(crateId);
        if (c == null) { HttpHelper.error(ex, 404, "Crate introuvable"); return; }

        int totalWeight = 0;
        for (CrateItem it : c.items) if (it != null) totalWeight += Math.max(0, it.weight);

        Map<String, Integer> actualCounts = new HashMap<>();
        List<CrateOpen> opens = store.listOpens(crateId, 10000);
        for (CrateOpen o : opens) {
            if (o.itemId == null) continue;
            actualCounts.merge(o.itemId, 1, Integer::sum);
        }
        int totalOpens = opens.size();

        List<Map<String, Object>> items = new ArrayList<>();
        for (CrateItem it : c.items) {
            if (it == null) continue;
            double theoretical = totalWeight > 0 ? (100.0 * Math.max(0, it.weight) / totalWeight) : 0.0;
            int count = actualCounts.getOrDefault(it.id, 0);
            double actual = totalOpens > 0 ? (100.0 * count / totalOpens) : 0.0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", it.id);
            m.put("displayName", it.displayName);
            m.put("rarity", it.rarity == null ? null : it.rarity.name());
            m.put("weight", it.weight);
            m.put("theoreticalDropRate", theoretical);
            m.put("actualDropRate", actual);
            m.put("actualCount", count);
            items.add(m);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("crateId", crateId);
        resp.put("crateName", c.name);
        resp.put("totalOpens", c.totalOpens);
        resp.put("recentOpens", totalOpens);
        resp.put("items", items);
        HttpHelper.json(ex, 200, resp);
    }
}
