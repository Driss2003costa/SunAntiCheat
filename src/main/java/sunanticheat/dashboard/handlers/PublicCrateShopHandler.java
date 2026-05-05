package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import net.milkbowl.vault.economy.Economy;
import net.milkbowl.vault.economy.EconomyResponse;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.crates.Crate;
import sunanticheat.dashboard.crates.CrateListener;
import sunanticheat.dashboard.crates.CratePendingClaimStore;
import sunanticheat.dashboard.crates.CrateStore;
import sunanticheat.dashboard.portal.PlayerAccountStore;
import sunanticheat.dashboard.portal.PlayerJwtUtil;
import sunanticheat.dashboard.shop.ShopStore;
import sunanticheat.dashboard.shop.ShopTransaction;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Routes publiques du shop de crates.
 *
 * GET  /api/public/crates/shop                          — liste les crates achetables (sans auth)
 * POST /api/public/player/me/crates/buy                 — achète une clé (auth requise)
 * GET  /api/public/player/me/crates/keys                — liste les clés du joueur (auth requise)
 * POST /api/public/player/me/crates/keys/{crateId}/claim — réclame la clé en jeu (auth requise)
 *
 * Les joueurs avec le rôle ADMIN peuvent acheter gratuitement (price = 0 forcé).
 */
public final class PublicCrateShopHandler {

    private final CrateStore crateStore;
    private final CratePendingClaimStore pendingStore;
    private final CrateListener crateListener;
    private final PlayerJwtUtil playerJwt;
    private final PlayerAccountStore accountStore;
    private final ShopStore shopStore;
    private final Economy economy;
    private final JavaPlugin plugin;

    public PublicCrateShopHandler(CrateStore crateStore,
                                   CratePendingClaimStore pendingStore,
                                   CrateListener crateListener,
                                   PlayerJwtUtil playerJwt,
                                   PlayerAccountStore accountStore,
                                   ShopStore shopStore,
                                   Economy economy,
                                   JavaPlugin plugin) {
        this.crateStore   = crateStore;
        this.pendingStore = pendingStore;
        this.crateListener = crateListener;
        this.playerJwt    = playerJwt;
        this.accountStore = accountStore;
        this.shopStore    = shopStore;
        this.economy      = economy;
        this.plugin       = plugin;
    }

    // ── GET /api/public/crates/shop ───────────────────────────────────────────

    public void listShop(HttpExchange ex) throws IOException {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Crate c : crateStore.listCrates()) {
            if (!c.purchasable) continue;
            result.add(crateToShopDto(c));
        }
        HttpHelper.json(ex, 200, result);
    }

    // ── POST /api/public/player/me/crates/buy ─────────────────────────────────

    public void buy(HttpExchange ex) throws IOException {
        String[] auth = extractAuth(ex);
        if (auth == null) return;
        String uuid     = auth[0];
        String username = auth[1];
        String role     = auth[2];

        Map<String, Object> body = parseBody(ex);
        String crateId = getString(body, "crateId");
        int count      = getInt(body, "count", 1);
        if (crateId == null || crateId.isBlank()) {
            HttpHelper.error(ex, 400, "crateId manquant"); return;
        }
        count = Math.max(1, count);

        Crate crate = crateStore.getCrate(crateId);
        if (crate == null) { HttpHelper.error(ex, 404, "Crate introuvable"); return; }
        if (!crate.purchasable) { HttpHelper.error(ex, 400, "Cette crate n'est pas en vente"); return; }

        boolean isAdmin = "ADMIN".equalsIgnoreCase(role);
        double totalPrice = isAdmin ? 0.0 : crate.price * count;

        if (!isAdmin && totalPrice > 0) {
            if (economy == null) {
                HttpHelper.error(ex, 500, "Système économique indisponible"); return;
            }
            OfflinePlayer op;
            try { op = Bukkit.getOfflinePlayer(UUID.fromString(uuid)); }
            catch (IllegalArgumentException e) { HttpHelper.error(ex, 400, "UUID invalide"); return; }

            double balance = economy.getBalance(op);
            if (balance < totalPrice) {
                HttpHelper.error(ex, 400, "Solde insuffisant (" + balance + " / " + totalPrice + " requis)"); return;
            }
            EconomyResponse resp = economy.withdrawPlayer(op, totalPrice);
            if (!resp.transactionSuccess()) {
                HttpHelper.error(ex, 500, "Échec de la transaction: " + resp.errorMessage); return;
            }
        }

        crateStore.giveKey(crateId, uuid, count);

        if (shopStore != null && totalPrice > 0) {
            ShopTransaction tx = new ShopTransaction();
            tx.shopId           = "crate-shop";
            tx.shopName         = "Shop de crates";
            tx.itemId           = crateId;
            tx.itemDisplayName  = crate.displayName != null ? crate.displayName : crate.name;
            tx.itemMaterial     = crate.icon;
            tx.playerUuid       = uuid;
            tx.playerName       = username;
            tx.type             = "BUY";
            tx.amount           = count;
            tx.pricePer         = crate.price;
            tx.totalPrice       = totalPrice;
            tx.timestamp        = System.currentTimeMillis();
            shopStore.recordTransaction(tx);
        }

        double newBalance = 0.0;
        if (economy != null) {
            try {
                OfflinePlayer op = Bukkit.getOfflinePlayer(UUID.fromString(uuid));
                newBalance = economy.getBalance(op);
            } catch (Exception ignored) {}
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("crateId", crateId);
        result.put("count", count);
        result.put("totalPrice", totalPrice);
        result.put("free", isAdmin);
        result.put("newBalance", newBalance);
        result.put("message", count + " clé(s) ajoutée(s) à votre inventaire !");
        HttpHelper.json(ex, 200, result);
    }

    // ── GET /api/public/player/me/crates/keys ────────────────────────────────

    public void myKeys(HttpExchange ex) throws IOException {
        String[] auth = extractAuth(ex);
        if (auth == null) return;
        String uuid = auth[0];

        Map<String, Integer> keysMap = crateStore.getAllKeysForPlayer(uuid);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : keysMap.entrySet()) {
            if (entry.getValue() <= 0) continue;
            Crate crate = crateStore.getCrate(entry.getKey());
            if (crate == null) continue;

            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("crateId",     crate.id);
            dto.put("displayName", crate.displayName != null ? crate.displayName : crate.name);
            dto.put("icon",        buildIconDto(crate));
            dto.put("color",       crate.color);
            dto.put("count",       entry.getValue());
            dto.put("pendingClaim", pendingStore.hasPendingClaims(uuid)
                    && hasPendingForCrate(uuid, crate.id));
            result.add(dto);
        }
        HttpHelper.json(ex, 200, result);
    }

    // ── POST /api/public/player/me/crates/keys/{crateId}/claim ───────────────

    public void claim(HttpExchange ex, String crateId) throws IOException {
        String[] auth = extractAuth(ex);
        if (auth == null) return;
        String uuid     = auth[0];
        String username = auth[1];

        Crate crate = crateStore.getCrate(crateId);
        if (crate == null) { HttpHelper.error(ex, 404, "Crate introuvable"); return; }

        int available = crateStore.getKeys(crateId, uuid);
        if (available <= 0) {
            HttpHelper.error(ex, 400, "Vous n'avez aucune clé pour cette crate"); return;
        }

        Map<String, Object> body = parseBody(ex);
        int count = getInt(body, "count", available);
        count = Math.max(1, Math.min(count, available));

        for (int i = 0; i < count; i++) {
            crateStore.consumeKey(crateId, uuid);
        }

        boolean deliveredNow = false;
        try {
            Player online = Bukkit.getPlayer(UUID.fromString(uuid));
            if (online != null && online.isOnline()) {
                final Player fp    = online;
                final Crate  fc    = crate;
                final int    fc2   = count;
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    if (fc.usesPhysicalKey) {
                        ItemStack key = crateListener.buildKeyItem(fc);
                        if (key != null) {
                            key.setAmount(fc2);
                            for (ItemStack leftover : fp.getInventory().addItem(key).values()) {
                                fp.getWorld().dropItemNaturally(fp.getLocation(), leftover);
                            }
                        }
                    } else {
                        crateStore.giveKey(fc.id, fp.getUniqueId().toString(), fc2);
                    }
                    String name = fc.displayName != null ? fc.displayName : fc.name;
                    fp.sendMessage("§a✦ " + fc2 + " clé(s) §b" + name + "§a livrée(s) en jeu !");
                });
                deliveredNow = true;
            }
        } catch (Throwable ignored) {}

        if (!deliveredNow) {
            pendingStore.addPendingClaim(uuid, crateId, count);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok",          true);
        result.put("crateId",     crateId);
        result.put("count",       count);
        result.put("deliveredNow", deliveredNow);
        result.put("message", deliveredNow
                ? "Clé(s) livrée(s) en jeu !"
                : "Clé(s) réservée(s) ! Elle(s) vous sera/seront remise(s) à votre prochaine connexion.");
        HttpHelper.json(ex, 200, result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Extrait uuid, username, role depuis le Bearer JWT player. */
    private String[] extractAuth(HttpExchange ex) throws IOException {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            HttpHelper.error(ex, 401, "Non authentifié"); return null;
        }
        try {
            var claims  = playerJwt.validate(header.substring(7));
            String uuid = claims.getSubject();
            String username = claims.get("username", String.class);
            // Récupère le rôle depuis la base de données du portail
            String role = "PLAYER";
            if (accountStore != null && uuid != null) {
                Map<String, Object> account = accountStore.getByUuid(uuid);
                if (account != null && account.get("role") instanceof String r) {
                    role = r;
                }
            }
            return new String[]{uuid, username, role};
        } catch (Exception e) {
            HttpHelper.error(ex, 401, "Token invalide ou expiré"); return null;
        }
    }

    private Map<String, Object> crateToShopDto(Crate c) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id",          c.id);
        dto.put("name",        c.name);
        dto.put("displayName", c.displayName);
        dto.put("description", c.description);
        dto.put("icon",        buildIconDto(c));
        dto.put("color",       c.color);
        dto.put("price",       c.price);
        dto.put("priceType",   c.priceType);
        return dto;
    }

    private Map<String, Object> buildIconDto(Crate c) {
        Map<String, Object> icon = new LinkedHashMap<>();
        icon.put("material",        c.icon);
        icon.put("itemAdderId",     c.itemAdderBlockId);
        return icon;
    }

    private boolean hasPendingForCrate(String uuid, String crateId) {
        // CratePendingClaimStore ne donne pas accès par crateId sans consommer — on retourne true générique
        return true;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseBody(HttpExchange ex) {
        try {
            byte[] bytes = ex.getRequestBody().readAllBytes();
            if (bytes.length == 0) return Map.of();
            String json = new String(bytes, StandardCharsets.UTF_8);
            com.google.gson.Gson gson = new com.google.gson.Gson();
            Map<String, Object> map = gson.fromJson(json, Map.class);
            return map != null ? map : Map.of();
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String getString(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v instanceof String s ? s : null;
    }

    private int getInt(Map<String, Object> map, String key, int def) {
        Object v = map.get(key);
        if (v instanceof Number n) return n.intValue();
        return def;
    }
}
