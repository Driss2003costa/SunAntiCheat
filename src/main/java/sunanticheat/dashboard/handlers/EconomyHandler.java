package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.economy.TransactionEntry;
import sunanticheat.dashboard.economy.TransactionStore;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

public final class EconomyHandler {

    private final JavaPlugin plugin;
    private final Economy economy;
    private final TransactionStore transactions;

    // Cache balances (recalcul coûteux sur grand nombre de joueurs)
    private volatile double cachedTotal = -1;
    private volatile long cacheTime = 0;
    private static final long CACHE_TTL = 5 * 60 * 1000L;

    public EconomyHandler(JavaPlugin plugin, Economy economy, TransactionStore transactions) {
        this.plugin = plugin;
        this.economy = economy;
        this.transactions = transactions;
    }

    /** GET /api/economy/summary */
    public void summary(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;

        long today = todayEpoch();
        List<TransactionEntry> todayTx = transactions.since(today);
        double volumeToday = todayTx.stream().mapToDouble(TransactionEntry::totalPrice).sum();
        int countToday = todayTx.size();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalMoney", getOrComputeTotal());
        result.put("transactionsToday", countToday);
        result.put("volumeToday", round(volumeToday));
        result.put("economyAvailable", economy != null);

        if (economy != null) {
            Optional<OfflinePlayer> richest = richestPlayer();
            richest.ifPresent(p -> {
                result.put("topPlayer", Map.of("name", p.getName() != null ? p.getName() : "?", "balance", round(economy.getBalance(p))));
            });
        }

        HttpHelper.json(ex, 200, result);
    }

    /** GET /api/economy/top-rich?limit=5 */
    public void topRich(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int limit = HttpHelper.queryInt(ex, "limit", 5);

        if (economy == null) { HttpHelper.json(ex, 200, List.of()); return; }

        var future = new CompletableFuture<List<Map<String, Object>>>();
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            OfflinePlayer[] all = Bukkit.getOfflinePlayers();
            List<OfflinePlayer> sorted = Arrays.stream(all)
                    .filter(p -> p.getName() != null)
                    .sorted((a, b) -> Double.compare(economy.getBalance(b), economy.getBalance(a)))
                    .limit(limit)
                    .collect(Collectors.toList());

            List<Map<String, Object>> result = new ArrayList<>();
            for (int i = 0; i < sorted.size(); i++) {
                OfflinePlayer p = sorted.get(i);
                result.add(Map.of(
                        "rank",     i + 1,
                        "name",     p.getName(),
                        "uuid",     p.getUniqueId().toString(),
                        "balance",  round(economy.getBalance(p)),
                        "online",   p.isOnline(),
                        "lastSeen", p.getLastSeen()
                ));
            }
            future.complete(result);
        });

        HttpHelper.json(ex, 200, future.join());
    }

    /** GET /api/economy/money-over-time?days=7 */
    public void moneyOverTime(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 7);
        HttpHelper.json(ex, 200, transactions.moneyOverTime(days));
    }

    /** GET /api/economy/transactions?page=0&size=50&type=&days=7 */
    public void transactions(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int page = HttpHelper.queryInt(ex, "page", 0);
        int size = HttpHelper.queryInt(ex, "size", 50);
        int days = HttpHelper.queryInt(ex, "days", 7);
        String type = HttpHelper.queryParam(ex, "type");
        String player = HttpHelper.queryParam(ex, "player");

        long since = System.currentTimeMillis() - (long) days * 86400 * 1000;
        List<TransactionEntry> filtered = transactions.filter(since, type, player);
        int total = filtered.size();
        List<TransactionEntry> page_ = filtered.stream()
                .skip((long) page * size).limit(size).collect(Collectors.toList());

        HttpHelper.json(ex, 200, Map.of("total", total, "page", page, "transactions", page_));
    }

    /** GET /api/economy/transactions/stats?days=7 */
    public void transactionStats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 7);
        long since = System.currentTimeMillis() - (long) days * 86400 * 1000;
        List<TransactionEntry> all = transactions.since(since);

        long buys = all.stream().filter(t -> "BUY".equals(t.type())).count();
        long sells = all.stream().filter(t -> "SELL".equals(t.type())).count();
        double volBuy = all.stream().filter(t -> "BUY".equals(t.type())).mapToDouble(TransactionEntry::totalPrice).sum();
        double volSell = all.stream().filter(t -> "SELL".equals(t.type())).mapToDouble(TransactionEntry::totalPrice).sum();

        // Top buyers
        Map<String, Double> buyerSpend = new HashMap<>();
        Map<String, Integer> buyerCount = new HashMap<>();
        all.stream().filter(t -> "BUY".equals(t.type())).forEach(t -> {
            buyerSpend.merge(t.playerName(), t.totalPrice(), Double::sum);
            buyerCount.merge(t.playerName(), 1, Integer::sum);
        });
        List<Map<String, Object>> topBuyers = buyerSpend.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(5)
                .map(e -> Map.<String, Object>of("name", e.getKey(), "spent", round(e.getValue()), "count", buyerCount.get(e.getKey())))
                .collect(Collectors.toList());

        // Top items
        Map<String, Long> itemQty = new HashMap<>();
        Map<String, Double> itemRev = new HashMap<>();
        all.stream().filter(t -> "BUY".equals(t.type())).forEach(t -> {
            itemQty.merge(t.itemDisplayName(), (long) t.quantity(), Long::sum);
            itemRev.merge(t.itemDisplayName(), t.totalPrice(), Double::sum);
        });
        List<Map<String, Object>> topItems = itemQty.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> Map.<String, Object>of("item", e.getKey(), "quantity", e.getValue(), "revenue", round(itemRev.getOrDefault(e.getKey(), 0.0))))
                .collect(Collectors.toList());

        HttpHelper.json(ex, 200, Map.of(
                "totalBuy", buys, "totalSell", sells,
                "volumeBuy", round(volBuy), "volumeSell", round(volSell),
                "topBuyers", topBuyers, "topItems", topItems
        ));
    }

    /** GET /api/economy/transactions/export?days=7&type=&player= */
    public void exportCsv(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 7);
        String type = HttpHelper.queryParam(ex, "type");
        String player = HttpHelper.queryParam(ex, "player");

        long since = System.currentTimeMillis() - (long) days * 86400 * 1000;
        List<TransactionEntry> list = transactions.filter(since, type, player);

        StringBuilder csv = new StringBuilder("timestamp,joueur,type,item,quantite,prix_unitaire,total\n");
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        for (TransactionEntry t : list) {
            String ts = Instant.ofEpochMilli(t.timestamp()).atZone(ZoneId.systemDefault()).format(fmt);
            csv.append(ts).append(',')
               .append(esc(t.playerName())).append(',')
               .append(t.type()).append(',')
               .append(esc(t.itemDisplayName())).append(',')
               .append(t.quantity()).append(',')
               .append(t.pricePerUnit()).append(',')
               .append(t.totalPrice()).append('\n');
        }

        byte[] body = csv.toString().getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "text/csv; charset=utf-8");
        ex.getResponseHeaders().set("Content-Disposition", "attachment; filename=\"transactions.csv\"");
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.sendResponseHeaders(200, body.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(body); }
    }

    private double getOrComputeTotal() {
        if (economy == null) return 0;
        long now = System.currentTimeMillis();
        if (now - cacheTime < CACHE_TTL && cachedTotal >= 0) return cachedTotal;
        double total = Arrays.stream(Bukkit.getOfflinePlayers())
                .mapToDouble(economy::getBalance).sum();
        cachedTotal = total;
        cacheTime = now;
        return round(total);
    }

    private Optional<OfflinePlayer> richestPlayer() {
        return Arrays.stream(Bukkit.getOfflinePlayers())
                .filter(p -> p.getName() != null)
                .max(Comparator.comparingDouble(economy::getBalance));
    }

    private static long todayEpoch() {
        return LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
    private static String esc(String s) { return s == null ? "" : "\"" + s.replace("\"", "\"\"") + "\""; }
}
