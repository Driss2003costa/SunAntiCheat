package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.shop.ModdedItem;
import sunanticheat.dashboard.shop.ModdedItemBridge;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Endpoints HTTP exposant la bibliothèque d'items (vanilla + modded) pour la page Shop.
 * <p>Routes :
 * <ul>
 *   <li>GET /api/shop/library/providers      → liste des providers + statut disponibilité</li>
 *   <li>GET /api/shop/library/modded         → items paginés et filtrables</li>
 *   <li>GET /api/shop/library/player/:uuid   → inventaire live d'un joueur connecté</li>
 *   <li>POST /api/shop/library/match         → identifie une source native depuis un ItemStack sérialisé</li>
 * </ul>
 */
public final class ShopLibraryHandler {

    private final ModdedItemBridge bridge;

    public ShopLibraryHandler(ModdedItemBridge bridge) {
        this.bridge = bridge;
    }

    /** GET /api/shop/library/providers */
    public void providers(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        HttpHelper.json(ex, 200, bridge.status());
    }

    /** GET /api/shop/library/modded?source=&search=&offset=&limit= */
    public void modded(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;

        String source = HttpHelper.queryParam(ex, "source");
        String search = HttpHelper.queryParam(ex, "search");
        int offset    = HttpHelper.queryInt(ex, "offset", 0);
        int limit     = HttpHelper.queryInt(ex, "limit", 200);

        List<ModdedItem> items = bridge.list(source, search, offset, limit);
        // Total pour pagination (même filtre, sans limites) — on le calcule une seule fois
        int total = bridge.list(source, search, 0, 0).size();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", items.stream().map(ShopLibraryHandler::serialize).toList());
        body.put("total", total);
        body.put("offset", offset);
        body.put("limit", limit);
        HttpHelper.json(ex, 200, body);
    }

    /** GET /api/shop/library/player/:uuid */
    public void playerInventory(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String uuidRaw) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;

        UUID uuid;
        try { uuid = UUID.fromString(uuidRaw); }
        catch (IllegalArgumentException e) { HttpHelper.error(ex, 400, "UUID invalide"); return; }

        Player p = Bukkit.getPlayer(uuid);
        if (p == null) { HttpHelper.error(ex, 404, "Joueur non connecté"); return; }

        List<Map<String, Object>> slots = new ArrayList<>();
        ItemStack[] contents = p.getInventory().getContents();
        for (int i = 0; i < contents.length; i++) {
            ItemStack stack = contents[i];
            slots.add(serializeSlot(i, stack));
        }
        // Armure (slots 36-39 dans certaines versions, on les expose séparément pour clarté)
        Map<String, Object> armor = new LinkedHashMap<>();
        ItemStack[] arm = p.getInventory().getArmorContents();
        String[] armorNames = {"boots", "leggings", "chestplate", "helmet"};
        for (int i = 0; i < arm.length && i < armorNames.length; i++) {
            armor.put(armorNames[i], serializeSlot(-1, arm[i]));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("player", Map.of("uuid", p.getUniqueId().toString(), "name", p.getName()));
        body.put("slots", slots);
        body.put("armor", armor);
        body.put("offhand", serializeSlot(-1, p.getInventory().getItemInOffHand()));
        HttpHelper.json(ex, 200, body);
    }

    /** POST /api/shop/library/match — body: { "base64": "..." } ou { "material": "...", "amount": n } */
    @SuppressWarnings("unchecked")
    public void match(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        ItemStack stack = null;
        Object b64 = body.get("base64");
        if (b64 instanceof String s && !s.isEmpty()) {
            try {
                byte[] raw = Base64.getDecoder().decode(s);
                stack = ItemStack.deserializeBytes(raw);
            } catch (Throwable t) {
                HttpHelper.error(ex, 400, "base64 invalide : " + t.getMessage()); return;
            }
        } else if (body.get("material") instanceof String mat) {
            int amount = 1;
            if (body.get("amount") instanceof Number n) amount = n.intValue();
            stack = bridge.build("Vanilla", mat, amount);
        }

        if (stack == null) { HttpHelper.error(ex, 400, "Impossible de reconstruire l'item"); return; }

        ModdedItemBridge.MatchResult res = bridge.match(stack);
        if (res == null) { HttpHelper.json(ex, 200, Map.of("matched", false)); return; }

        HttpHelper.json(ex, 200, Map.of(
                "matched", true,
                "source", res.source(),
                "id", res.id(),
                "material", stack.getType().name()
        ));
    }

    /* ───────────────────────── Serialization helpers ───────────────────────── */

    private static Map<String, Object> serialize(ModdedItem it) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("source", it.source());
        m.put("id", it.id());
        m.put("displayName", it.displayName());
        m.put("material", it.material());
        m.put("category", it.category());
        m.put("customModelData", it.customModelData());
        m.put("iconUrl", it.iconUrl());
        m.put("lore", it.lore());
        m.put("shopYaml", it.shopYaml());
        return m;
    }

    private static Map<String, Object> serializeSlot(int index, ItemStack stack) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("slot", index);
        if (stack == null || stack.getType().isAir()) {
            m.put("empty", true);
            return m;
        }
        m.put("empty", false);
        m.put("material", stack.getType().name());
        m.put("amount", stack.getAmount());
        try {
            if (stack.hasItemMeta() && stack.getItemMeta() != null) {
                var meta = stack.getItemMeta();
                if (meta.hasDisplayName()) m.put("displayName", meta.getDisplayName());
                if (meta.hasLore()) m.put("lore", meta.getLore());
                if (meta.hasCustomModelData()) m.put("customModelData", meta.getCustomModelData());
            }
        } catch (Throwable ignored) {}
        try {
            byte[] raw = stack.serializeAsBytes();
            m.put("base64", Base64.getEncoder().encodeToString(raw));
        } catch (Throwable ignored) {}
        return m;
    }
}
