package sunanticheat.dashboard.shop;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.logging.Logger;

/**
 * Persistance des shops + des transactions shop dans plugin/dashboard/.
 * Thread-safe : toutes les méthodes modifiantes sont synchronized.
 */
public final class ShopStore {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().serializeNulls().create();
    private static final int MAX_TRANSACTIONS = 2000;
    private static final DateTimeFormatter ISO_DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.ROOT);

    private final File shopsFile;
    private final File transactionsFile;
    private final Logger logger;

    private final List<Shop> shops = new ArrayList<>();
    private final List<ShopTransaction> transactions = new ArrayList<>();

    public ShopStore(File dataFolder, Logger logger) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        if (!dir.exists()) dir.mkdirs();
        this.shopsFile = new File(dir, "shops.json");
        this.transactionsFile = new File(dir, "shop_transactions.json");
        load();
    }

    // ── Lecture ──────────────────────────────────────────────────────────────

    public synchronized List<Shop> listShops() {
        return new ArrayList<>(shops);
    }

    public synchronized Shop getShop(String id) {
        if (id == null) return null;
        for (Shop s : shops) if (id.equals(s.id)) return s;
        return null;
    }

    public synchronized Shop getShopByName(String name) {
        if (name == null) return null;
        for (Shop s : shops) if (name.equalsIgnoreCase(s.name)) return s;
        return null;
    }

    // ── Écriture shops ───────────────────────────────────────────────────────

    public synchronized Shop createShop(Shop s) {
        if (s == null) return null;
        if (s.id == null || s.id.isBlank()) s.id = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();
        s.createdAt = now;
        s.modifiedAt = now;
        if (s.items == null) s.items = new ArrayList<>();
        for (ShopItem it : s.items) {
            if (it != null && (it.id == null || it.id.isBlank())) it.id = UUID.randomUUID().toString();
        }
        shops.add(s);
        save();
        return s;
    }

    public synchronized Shop updateShop(String id, Shop incoming) {
        if (id == null || incoming == null) return null;
        Shop existing = getShop(id);
        if (existing == null) return null;

        // Conserve id/createdAt/totalTransactions/totalRevenue
        incoming.id = existing.id;
        incoming.createdAt = existing.createdAt;
        incoming.totalTransactions = existing.totalTransactions;
        incoming.totalRevenue = existing.totalRevenue;
        incoming.modifiedAt = System.currentTimeMillis();
        if (incoming.items == null) incoming.items = new ArrayList<>();
        for (ShopItem it : incoming.items) {
            if (it != null && (it.id == null || it.id.isBlank())) it.id = UUID.randomUUID().toString();
        }

        int idx = shops.indexOf(existing);
        shops.set(idx, incoming);
        save();
        return incoming;
    }

    public synchronized void deleteShop(String id) {
        if (id == null) return;
        shops.removeIf(s -> id.equals(s.id));
        save();
    }

    // ── Écriture items ───────────────────────────────────────────────────────

    public synchronized void addItem(String shopId, ShopItem item) {
        Shop s = getShop(shopId);
        if (s == null || item == null) return;
        if (item.id == null || item.id.isBlank()) item.id = UUID.randomUUID().toString();
        if (s.items == null) s.items = new ArrayList<>();
        s.items.add(item);
        s.modifiedAt = System.currentTimeMillis();
        save();
    }

    public synchronized void updateItem(String shopId, String itemId, ShopItem item) {
        Shop s = getShop(shopId);
        if (s == null || itemId == null || item == null || s.items == null) return;
        for (int i = 0; i < s.items.size(); i++) {
            ShopItem existing = s.items.get(i);
            if (existing != null && itemId.equals(existing.id)) {
                item.id = itemId;
                s.items.set(i, item);
                s.modifiedAt = System.currentTimeMillis();
                save();
                return;
            }
        }
    }

    public synchronized void removeItem(String shopId, String itemId) {
        Shop s = getShop(shopId);
        if (s == null || itemId == null || s.items == null) return;
        boolean removed = s.items.removeIf(it -> it != null && itemId.equals(it.id));
        if (removed) {
            s.modifiedAt = System.currentTimeMillis();
            save();
        }
    }

    public synchronized ShopItem getItemAt(String shopId, int slot) {
        Shop s = getShop(shopId);
        if (s == null || s.items == null) return null;
        for (ShopItem it : s.items) if (it != null && it.slot == slot) return it;
        return null;
    }

    // ── Transactions ─────────────────────────────────────────────────────────

    public synchronized void recordTransaction(ShopTransaction t) {
        if (t == null) return;
        if (t.id == null || t.id.isBlank()) t.id = UUID.randomUUID().toString();
        if (t.timestamp <= 0) t.timestamp = System.currentTimeMillis();
        transactions.add(0, t);
        while (transactions.size() > MAX_TRANSACTIONS) {
            transactions.remove(transactions.size() - 1);
        }
        // Met à jour les compteurs du shop (si on le retrouve)
        Shop s = t.shopId != null ? getShop(t.shopId) : getShopByName(t.shopName);
        if (s != null) {
            s.totalTransactions++;
            if ("BUY".equalsIgnoreCase(t.type)) s.totalRevenue += t.totalPrice;
        }
        save();
    }

    public synchronized List<ShopTransaction> listTransactions(String shopId, String playerName, int days, int limit) {
        long cutoff = days > 0 ? System.currentTimeMillis() - (long) days * 86_400_000L : 0L;
        List<ShopTransaction> out = new ArrayList<>();
        for (ShopTransaction t : transactions) {
            if (t == null) continue;
            if (t.timestamp < cutoff) continue;
            if (shopId != null && !shopId.isBlank() && !shopId.equals(t.shopId)) continue;
            if (playerName != null && !playerName.isBlank()
                    && !playerName.equalsIgnoreCase(t.playerName)) continue;
            out.add(t);
            if (limit > 0 && out.size() >= limit) break;
        }
        return out;
    }

    // ── Stats ────────────────────────────────────────────────────────────────

    public synchronized Map<String, Object> statsForShop(String shopId, int days) {
        return computeStats(shopId, days);
    }

    public synchronized Map<String, Object> globalStats(int days) {
        return computeStats(null, days);
    }

    private Map<String, Object> computeStats(String shopId, int days) {
        long cutoff = days > 0 ? System.currentTimeMillis() - (long) days * 86_400_000L : 0L;
        long totalTx = 0;
        double totalRevenue = 0.0;
        int buy = 0, sell = 0;
        HashSet<String> uniquePlayers = new HashSet<>();

        // Agrégation par item
        Map<String, long[]> countByItem = new HashMap<>();        // itemId -> [count]
        Map<String, double[]> revenueByItem = new HashMap<>();    // itemId -> [revenue]
        Map<String, String> nameByItem = new HashMap<>();

        // Revenu par jour (clé "yyyy-MM-dd")
        Map<String, Double> dailyRevenueMap = new LinkedHashMap<>();

        for (ShopTransaction t : transactions) {
            if (t == null) continue;
            if (t.timestamp < cutoff) continue;
            if (shopId != null && !shopId.isBlank() && !shopId.equals(t.shopId)) continue;

            totalTx++;
            if ("BUY".equalsIgnoreCase(t.type)) {
                buy++;
                totalRevenue += t.totalPrice;
            } else if ("SELL".equalsIgnoreCase(t.type)) {
                sell++;
            }
            if (t.playerUuid != null) uniquePlayers.add(t.playerUuid);
            else if (t.playerName != null) uniquePlayers.add(t.playerName);

            String itemKey = t.itemId != null ? t.itemId
                    : (t.itemDisplayName != null ? t.itemDisplayName : "unknown");
            countByItem.computeIfAbsent(itemKey, k -> new long[]{0})[0] += Math.max(1, t.amount);
            if ("BUY".equalsIgnoreCase(t.type)) {
                revenueByItem.computeIfAbsent(itemKey, k -> new double[]{0.0})[0] += t.totalPrice;
            } else {
                revenueByItem.computeIfAbsent(itemKey, k -> new double[]{0.0});
            }
            nameByItem.putIfAbsent(itemKey, t.itemDisplayName != null ? t.itemDisplayName : t.itemMaterial);

            String day = LocalDate.ofInstant(
                    java.time.Instant.ofEpochMilli(t.timestamp), ZoneId.systemDefault()).format(ISO_DAY);
            if ("BUY".equalsIgnoreCase(t.type)) {
                dailyRevenueMap.merge(day, t.totalPrice, Double::sum);
            } else {
                dailyRevenueMap.putIfAbsent(day, 0.0);
            }
        }

        // Top items (par count)
        List<Map<String, Object>> topItems = new ArrayList<>();
        List<String> itemKeys = new ArrayList<>(countByItem.keySet());
        itemKeys.sort(Comparator.comparingLong((String k) -> -countByItem.get(k)[0]));
        int take = Math.min(10, itemKeys.size());
        for (int i = 0; i < take; i++) {
            String k = itemKeys.get(i);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("itemId", k);
            row.put("name", nameByItem.getOrDefault(k, k));
            row.put("count", countByItem.get(k)[0]);
            row.put("revenue", round(revenueByItem.getOrDefault(k, new double[]{0.0})[0]));
            topItems.add(row);
        }

        // Série journalière complète sur `days` jours (valeurs 0 pour les jours vides)
        List<Map<String, Object>> dailyRevenue = new ArrayList<>();
        int seriesDays = days > 0 ? days : 7;
        LocalDate today = LocalDate.now();
        for (int i = seriesDays - 1; i >= 0; i--) {
            String key = today.minusDays(i).format(ISO_DAY);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", key);
            row.put("value", round(dailyRevenueMap.getOrDefault(key, 0.0)));
            dailyRevenue.add(row);
        }

        Map<String, Object> buyVsSell = new LinkedHashMap<>();
        buyVsSell.put("buy", buy);
        buyVsSell.put("sell", sell);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalTransactions", totalTx);
        out.put("totalRevenue", round(totalRevenue));
        out.put("uniqueCustomers", uniquePlayers.size());
        out.put("topItems", topItems);
        out.put("buyVsSell", buyVsSell);
        out.put("dailyRevenue", dailyRevenue);
        return out;
    }

    // ── Persistance ──────────────────────────────────────────────────────────

    public synchronized void save() {
        try {
            Files.writeString(shopsFile.toPath(), GSON.toJson(shops), StandardCharsets.UTF_8);
        } catch (Exception e) {
            logger.warning("[Dashboard/Shop] save shops fail: " + e.getMessage());
        }
        try {
            Files.writeString(transactionsFile.toPath(), GSON.toJson(transactions), StandardCharsets.UTF_8);
        } catch (Exception e) {
            logger.warning("[Dashboard/Shop] save transactions fail: " + e.getMessage());
        }
    }

    private void load() {
        try {
            if (shopsFile.exists()) {
                String raw = Files.readString(shopsFile.toPath(), StandardCharsets.UTF_8);
                Type t = new TypeToken<List<Shop>>() {}.getType();
                List<Shop> loaded = GSON.fromJson(raw, t);
                if (loaded != null) {
                    loaded.removeIf(Objects::isNull);
                    shops.addAll(loaded);
                }
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/Shop] load shops fail: " + e.getMessage());
        }
        try {
            if (transactionsFile.exists()) {
                String raw = Files.readString(transactionsFile.toPath(), StandardCharsets.UTF_8);
                Type t = new TypeToken<List<ShopTransaction>>() {}.getType();
                List<ShopTransaction> loaded = GSON.fromJson(raw, t);
                if (loaded != null) {
                    loaded.removeIf(Objects::isNull);
                    transactions.addAll(loaded);
                    while (transactions.size() > MAX_TRANSACTIONS) {
                        transactions.remove(transactions.size() - 1);
                    }
                }
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/Shop] load transactions fail: " + e.getMessage());
        }
    }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
