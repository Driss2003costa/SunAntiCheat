package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.shop.Shop;
import sunanticheat.dashboard.shop.ShopItem;
import sunanticheat.dashboard.shop.ShopStore;
import sunanticheat.dashboard.shop.ShopSyncService;
import sunanticheat.dashboard.shop.ShopSyncService.SyncResult;
import sunanticheat.dashboard.shop.ShopTransaction;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;

/**
 * Endpoints /api/shops/* — CRUD des shops, items, stats, sync ESG.
 */
public final class ShopHandler {

    private final JavaPlugin plugin;
    private final ShopStore store;
    private final ShopSyncService sync;

    public ShopHandler(JavaPlugin plugin, ShopStore store, ShopSyncService sync) {
        this.plugin = plugin;
        this.store = store;
        this.sync = sync;
    }

    // ── Liste / get ──────────────────────────────────────────────────────────

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        try {
            if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
            List<Map<String, Object>> out = new ArrayList<>();
            for (Shop s : store.listShops()) {
                if (s == null) continue;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", s.id);
                row.put("name", s.name);
                row.put("displayName", s.displayName);
                row.put("description", s.description);
                row.put("category", s.category);
                row.put("order", s.order);
                row.put("rows", s.rows);
                row.put("itemCount", s.items != null ? s.items.size() : 0);
                row.put("enabled", s.enabled);
                row.put("totalTransactions", s.totalTransactions);
                row.put("totalRevenue", s.totalRevenue);
                row.put("modifiedAt", s.modifiedAt);
                row.put("iconMaterial", s.iconMaterial);
                out.add(row);
            }
            HttpHelper.json(ex, 200, out);
        } catch (Exception e) { fail(ex, e); }
    }

    public void get(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        try {
            if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
            Shop s = store.getShop(id);
            if (s == null) { HttpHelper.error(ex, 404, "Shop introuvable"); return; }
            HttpHelper.json(ex, 200, s);
        } catch (Exception e) { fail(ex, e); }
    }

    // ── CRUD shop ────────────────────────────────────────────────────────────

    public void create(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        try {
            DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
            if (u == null) return;
            if (!HttpHelper.requireAdmin(ex, u)) return;
            Shop incoming;
            try { incoming = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Shop.class); }
            catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
            if (incoming == null || incoming.name == null || incoming.name.isBlank()) {
                HttpHelper.error(ex, 400, "name requis"); return;
            }
            incoming.id = null; // forcer la génération
            Shop saved = store.createShop(incoming);
            SyncResult r = safeSync();
            HttpHelper.json(ex, 201, resp("shop", saved, r));
        } catch (Exception e) { fail(ex, e); }
    }

    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        try {
            DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
            if (u == null) return;
            if (!HttpHelper.requireAdmin(ex, u)) return;
            Shop incoming;
            try { incoming = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Shop.class); }
            catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
            if (incoming == null) { HttpHelper.error(ex, 400, "Body requis"); return; }
            Shop saved = store.updateShop(id, incoming);
            if (saved == null) { HttpHelper.error(ex, 404, "Shop introuvable"); return; }
            SyncResult r = safeSync();
            HttpHelper.json(ex, 200, resp("shop", saved, r));
        } catch (Exception e) { fail(ex, e); }
    }

    public void delete(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        try {
            DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
            if (u == null) return;
            if (!HttpHelper.requireAdmin(ex, u)) return;
            store.deleteShop(id);
            SyncResult r = safeSync();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("deleted", id);
            body.put("sync", r);
            HttpHelper.json(ex, 200, body);
        } catch (Exception e) { fail(ex, e); }
    }

    // ── CRUD items ───────────────────────────────────────────────────────────

    public void addItem(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String shopId) throws IOException {
        try {
            DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
            if (u == null) return;
            if (!HttpHelper.requireAdmin(ex, u)) return;
            if (store.getShop(shopId) == null) { HttpHelper.error(ex, 404, "Shop introuvable"); return; }
            ShopItem item;
            try { item = HttpHelper.GSON.fromJson(HttpHelper.body(ex), ShopItem.class); }
            catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
            if (item == null) { HttpHelper.error(ex, 400, "Body requis"); return; }
            item.id = null; // force UUID
            store.addItem(shopId, item);
            SyncResult r = safeSync();
            HttpHelper.json(ex, 201, resp("item", item, r));
        } catch (Exception e) { fail(ex, e); }
    }

    public void updateItem(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                           String shopId, String itemId) throws IOException {
        try {
            if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
            if (store.getShop(shopId) == null) { HttpHelper.error(ex, 404, "Shop introuvable"); return; }
            ShopItem item;
            try { item = HttpHelper.GSON.fromJson(HttpHelper.body(ex), ShopItem.class); }
            catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
            if (item == null) { HttpHelper.error(ex, 400, "Body requis"); return; }
            store.updateItem(shopId, itemId, item);
            SyncResult r = safeSync();
            HttpHelper.json(ex, 200, resp("item", item, r));
        } catch (Exception e) { fail(ex, e); }
    }

    public void removeItem(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                           String shopId, String itemId) throws IOException {
        try {
            DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
            if (u == null) return;
            if (!HttpHelper.requireAdmin(ex, u)) return;
            store.removeItem(shopId, itemId);
            SyncResult r = safeSync();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("deleted", itemId);
            body.put("sync", r);
            HttpHelper.json(ex, 200, body);
        } catch (Exception e) { fail(ex, e); }
    }

    // ── Sync / import / status ──────────────────────────────────────────────

    public void sync(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        try {
            DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
            if (u == null) return;
            if (!HttpHelper.requireAdmin(ex, u)) return;
            SyncResult r = sync.syncToESG();
            HttpHelper.json(ex, r.success() ? 200 : 500, r);
        } catch (Exception e) { fail(ex, e); }
    }

    public void importFromESG(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        try {
            DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
            if (u == null) return;
            if (!HttpHelper.requireAdmin(ex, u)) return;
            List<Map<String, Object>> preview = sync.importFromESG();
            HttpHelper.json(ex, 200, preview);
        } catch (Exception e) { fail(ex, e); }
    }

    public void esgStatus(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        try {
            if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
            HttpHelper.json(ex, 200, sync.esgStatus());
        } catch (Exception e) { fail(ex, e); }
    }

    // ── Transactions / stats ────────────────────────────────────────────────

    public void transactions(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String shopId) throws IOException {
        try {
            if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
            int days = HttpHelper.queryInt(ex, "days", 7);
            int limit = HttpHelper.queryInt(ex, "limit", 100);
            String player = HttpHelper.queryParam(ex, "player");
            List<ShopTransaction> list = store.listTransactions(shopId, player, days, limit);
            HttpHelper.json(ex, 200, list);
        } catch (Exception e) { fail(ex, e); }
    }

    public void stats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String shopId) throws IOException {
        try {
            if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
            if (store.getShop(shopId) == null) { HttpHelper.error(ex, 404, "Shop introuvable"); return; }
            int days = HttpHelper.queryInt(ex, "days", 7);
            HttpHelper.json(ex, 200, store.statsForShop(shopId, days));
        } catch (Exception e) { fail(ex, e); }
    }

    public void globalStats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        try {
            if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
            int days = HttpHelper.queryInt(ex, "days", 7);
            HttpHelper.json(ex, 200, store.globalStats(days));
        } catch (Exception e) { fail(ex, e); }
    }

    // ── Helpers internes ────────────────────────────────────────────────────

    private SyncResult safeSync() {
        try { return sync.syncToESG(); }
        catch (Throwable t) {
            plugin.getLogger().warning("[Dashboard/Shop] safeSync: " + t.getMessage());
            return new SyncResult(false, "Exception sync: " + t.getMessage(), null);
        }
    }

    private static Map<String, Object> resp(String key, Object value, SyncResult r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put(key, value);
        out.put("sync", r);
        return out;
    }

    private void fail(HttpExchange ex, Exception e) throws IOException {
        plugin.getLogger().log(Level.WARNING, "[Dashboard/Shop] endpoint error", e);
        HttpHelper.error(ex, 500, "Erreur interne : " + e.getMessage());
    }
}
