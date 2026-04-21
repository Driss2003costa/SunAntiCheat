package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.shop.ShopItem;
import sunanticheat.dashboard.shop.ShopSection;
import sunanticheat.dashboard.shop.ShopYamlManager;

import java.io.IOException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Endpoints CRUD pour les shops EconomyShopGUI.
 *
 * <ul>
 *   <li>GET    /api/shop/sections                          — liste des sections</li>
 *   <li>POST   /api/shop/sections                          — crée une section vide</li>
 *   <li>GET    /api/shop/sections/{id}                     — détail + items</li>
 *   <li>POST   /api/shop/sections/{id}/items               — upsert item (slot dans le body)</li>
 *   <li>DELETE /api/shop/sections/{id}/items/{slot}        — supprime item</li>
 *   <li>POST   /api/shop/sections/{id}/move                — déplace un slot (fromSlot/toSlot)</li>
 *   <li>POST   /api/shop/reload                            — /esgui reload</li>
 * </ul>
 */
public final class ShopHandler {

    private final JavaPlugin plugin;
    private final ShopYamlManager manager;

    public ShopHandler(JavaPlugin plugin, ShopYamlManager manager) {
        this.plugin = plugin;
        this.manager = manager;
    }

    /* ───────────────────────── Lecture ───────────────────────── */

    public void listSections(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        if (!manager.isReady()) {
            HttpHelper.json(ex, 200, Map.of(
                    "ready", false,
                    "reason", "EconomyShopGUI introuvable (plugins/EconomyShopGUI/shops/ absent)",
                    "sections", Collections.emptyList()));
            return;
        }
        List<Map<String, Object>> out = manager.listSections().stream()
                .map(ShopHandler::serializeSectionLight).toList();
        HttpHelper.json(ex, 200, Map.of("ready", true, "sections", out));
    }

    public void getSection(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        ShopSection s = manager.getSection(id);
        if (s == null) { HttpHelper.error(ex, 404, "Section introuvable : " + id); return; }
        HttpHelper.json(ex, 200, serializeSectionFull(s));
    }

    /* ───────────────────────── Écriture ───────────────────────── */

    @SuppressWarnings("unchecked")
    public void createSection(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = requireAuth(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        String id = str(body.get("id"));
        if (id == null || id.isEmpty()) { HttpHelper.error(ex, 400, "id requis"); return; }
        String name = str(body.get("name"));
        String icon = str(body.get("icon"));
        int size = intVal(body.get("size"), 54);
        try {
            ShopSection s = manager.createSection(id, name, icon, size);
            HttpHelper.json(ex, 201, serializeSectionFull(s));
        } catch (IOException e) {
            HttpHelper.error(ex, 400, e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    public void upsertItem(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String sectionId) throws IOException {
        DashboardUser u = requireAuth(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        int slot = intVal(body.get("slot"), -1);
        if (slot < 0) { HttpHelper.error(ex, 400, "slot requis (>= 0)"); return; }

        ShopItem item = new ShopItem(
                slot,
                strOr(body.get("source"), "Vanilla"),
                str(body.get("nativeId")),
                str(body.get("material")),
                str(body.get("displayName")),
                strList(body.get("lore")),
                Math.max(1, intVal(body.get("amount"), 1)),
                doubleOrNull(body.get("buyPrice")),
                doubleOrNull(body.get("sellPrice")),
                Math.max(0, intVal(body.get("limitPerPlayerDay"), 0)),
                Math.max(0, intVal(body.get("limitServerDay"), 0)),
                Math.max(0, intVal(body.get("stock"), 0)),
                str(body.get("permission")),
                strList(body.get("commands")),
                body.get("enabled") == null || Boolean.TRUE.equals(body.get("enabled")),
                null
        );

        if (item.nativeId() == null || item.nativeId().isEmpty()) {
            HttpHelper.error(ex, 400, "nativeId requis"); return;
        }
        try {
            ShopItem saved = manager.upsertItem(sectionId, item);
            HttpHelper.json(ex, 200, serializeItem(saved));
        } catch (IOException e) {
            HttpHelper.error(ex, 400, e.getMessage());
        }
    }

    public void deleteItem(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                           String sectionId, int slot) throws IOException {
        DashboardUser u = requireAuth(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        try {
            boolean removed = manager.deleteItem(sectionId, slot);
            if (!removed) { HttpHelper.error(ex, 404, "Aucun item au slot " + slot); return; }
            HttpHelper.json(ex, 200, Map.of("removed", true, "slot", slot));
        } catch (IOException e) {
            HttpHelper.error(ex, 400, e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    public void moveItem(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String sectionId) throws IOException {
        DashboardUser u = requireAuth(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        int from = intVal(body.get("fromSlot"), -1);
        int to   = intVal(body.get("toSlot"), -1);
        if (from < 0 || to < 0) { HttpHelper.error(ex, 400, "fromSlot/toSlot requis"); return; }
        try {
            manager.moveItem(sectionId, from, to);
            HttpHelper.json(ex, 200, Map.of("ok", true, "fromSlot", from, "toSlot", to));
        } catch (IOException e) {
            HttpHelper.error(ex, 400, e.getMessage());
        }
    }

    public void reload(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = requireAuth(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        boolean ok = manager.reloadEconomyShopGUI(plugin);
        if (ok) HttpHelper.json(ex, 200, Map.of("reloaded", true));
        else    HttpHelper.error(ex, 500, "Reload EconomyShopGUI échoué (voir console)");
    }

    /* ───────────────────────── Helpers ───────────────────────── */

    private static DashboardUser requireAuth(HttpExchange ex, JwtUtil jwt,
                                             Map<String, DashboardUser> users) throws IOException {
        return HttpHelper.authenticate(ex, jwt, users);
    }

    private static Map<String, Object> serializeSectionLight(ShopSection s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.id());
        m.put("filename", s.filename());
        m.put("name", s.name());
        m.put("icon", s.icon());
        m.put("size", s.size());
        m.put("itemCount", s.itemCount());
        return m;
    }

    private static Map<String, Object> serializeSectionFull(ShopSection s) {
        Map<String, Object> m = serializeSectionLight(s);
        m.put("items", s.items().stream().map(ShopHandler::serializeItem).toList());
        return m;
    }

    private static Map<String, Object> serializeItem(ShopItem i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("slot", i.slot());
        m.put("source", i.source());
        m.put("nativeId", i.nativeId());
        m.put("material", i.material());
        m.put("displayName", i.displayName());
        m.put("lore", i.lore());
        m.put("amount", i.amount());
        m.put("buyPrice", i.buyPrice());
        m.put("sellPrice", i.sellPrice());
        m.put("limitPerPlayerDay", i.limitPerPlayerDay());
        m.put("limitServerDay", i.limitServerDay());
        m.put("stock", i.stock());
        m.put("permission", i.permission());
        m.put("commands", i.commands());
        m.put("enabled", i.enabled());
        return m;
    }

    private static String str(Object o) { return o == null ? null : String.valueOf(o); }
    private static String strOr(Object o, String def) { return o == null ? def : String.valueOf(o); }

    @SuppressWarnings("unchecked")
    private static List<String> strList(Object o) {
        if (!(o instanceof List<?> l)) return List.of();
        List<String> out = new java.util.ArrayList<>(l.size());
        for (Object e : l) if (e != null) out.add(String.valueOf(e));
        return out;
    }

    private static int intVal(Object o, int def) {
        if (o instanceof Number n) return n.intValue();
        if (o instanceof String s) { try { return Integer.parseInt(s); } catch (NumberFormatException e) { return def; } }
        return def;
    }

    private static Double doubleOrNull(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.doubleValue();
        if (o instanceof String s && !s.isEmpty()) {
            try { return Double.parseDouble(s); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }
}
