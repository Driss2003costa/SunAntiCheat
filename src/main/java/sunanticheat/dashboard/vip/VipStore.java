package sunanticheat.dashboard.vip;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.logging.Logger;

/**
 * Persistance JSON pour le système VIP (plans, subscriptions, transactions,
 * checkouts en attente). Toutes les méthodes de lecture/écriture sont synchronized.
 */
public final class VipStore {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().serializeNulls().create();
    private static final int MAX_TRANSACTIONS = 5000;
    private static final long DAY_MS = 86_400_000L;

    private final File plansFile;
    private final File subsFile;
    private final File txFile;
    private final File pendingFile;
    private final Logger logger;

    private final List<VipPlan> plans = new ArrayList<>();
    private final List<VipSubscription> subscriptions = new ArrayList<>();
    private final List<VipTransaction> transactions = new ArrayList<>();
    private final Map<String, PendingCheckoutInfo> pending = new LinkedHashMap<>();

    public VipStore(File dataFolder, Logger logger) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        dir.mkdirs();
        this.plansFile = new File(dir, "vip_plans.json");
        this.subsFile = new File(dir, "vip_subscriptions.json");
        this.txFile = new File(dir, "vip_transactions.json");
        this.pendingFile = new File(dir, "vip_pending_checkouts.json");
        load();
    }

    /** Informations d'un checkout en attente (le temps du webhook). */
    public static class PendingCheckoutInfo {
        public String playerName;
        public String planId;
        public String gateway;
        public long createdAt;
    }

    // ── Plans ────────────────────────────────────────────────────────────────
    public synchronized List<VipPlan> listPlans() {
        List<VipPlan> out = new ArrayList<>(plans);
        out.sort(Comparator.comparingInt((VipPlan p) -> p.order).thenComparing(p -> p.displayName == null ? "" : p.displayName));
        return out;
    }

    public synchronized List<VipPlan> listEnabledPlans() {
        List<VipPlan> out = new ArrayList<>();
        for (VipPlan p : plans) if (p != null && p.enabled) out.add(p);
        out.sort(Comparator.comparingInt((VipPlan p) -> p.order).thenComparing(p -> p.displayName == null ? "" : p.displayName));
        return out;
    }

    public synchronized VipPlan getPlan(String id) {
        if (id == null) return null;
        for (VipPlan p : plans) if (id.equals(p.id)) return p;
        return null;
    }

    public synchronized VipPlan createPlan(VipPlan p) {
        if (p == null) return null;
        if (p.id == null || p.id.isBlank()) p.id = UUID.randomUUID().toString();
        if (p.createdAt == 0L) p.createdAt = System.currentTimeMillis();
        if (p.perks == null) p.perks = new ArrayList<>();
        if (p.commandsOnActivate == null) p.commandsOnActivate = new ArrayList<>();
        if (p.commandsOnExpire == null) p.commandsOnExpire = new ArrayList<>();
        plans.add(p);
        save();
        return p;
    }

    public synchronized VipPlan updatePlan(String id, VipPlan updated) {
        if (id == null || updated == null) return null;
        for (int i = 0; i < plans.size(); i++) {
            if (id.equals(plans.get(i).id)) {
                updated.id = id;
                if (updated.createdAt == 0L) updated.createdAt = plans.get(i).createdAt;
                if (updated.perks == null) updated.perks = new ArrayList<>();
                if (updated.commandsOnActivate == null) updated.commandsOnActivate = new ArrayList<>();
                if (updated.commandsOnExpire == null) updated.commandsOnExpire = new ArrayList<>();
                plans.set(i, updated);
                save();
                return updated;
            }
        }
        return null;
    }

    public synchronized void deletePlan(String id) {
        if (id == null) return;
        plans.removeIf(p -> id.equals(p.id));
        save();
    }

    // ── Subscriptions ────────────────────────────────────────────────────────
    public synchronized List<VipSubscription> listSubscriptions(String status, String playerName, int limit) {
        List<VipSubscription> out = new ArrayList<>();
        for (VipSubscription s : subscriptions) {
            if (s == null) continue;
            if (status != null && !status.equalsIgnoreCase(s.status)) continue;
            if (playerName != null && !playerName.isBlank()
                    && (s.playerName == null || !s.playerName.equalsIgnoreCase(playerName))) continue;
            out.add(s);
        }
        out.sort((a, b) -> Long.compare(b.createdAt, a.createdAt));
        if (limit > 0 && out.size() > limit) return new ArrayList<>(out.subList(0, limit));
        return out;
    }

    public synchronized VipSubscription getSubscription(String id) {
        if (id == null) return null;
        for (VipSubscription s : subscriptions) if (id.equals(s.id)) return s;
        return null;
    }

    public synchronized List<VipSubscription> getActiveSubscriptionsForPlayer(String playerName) {
        List<VipSubscription> out = new ArrayList<>();
        if (playerName == null) return out;
        long now = System.currentTimeMillis();
        for (VipSubscription s : subscriptions) {
            if (s == null) continue;
            if (!"ACTIVE".equalsIgnoreCase(s.status)) continue;
            if (s.playerName == null || !s.playerName.equalsIgnoreCase(playerName)) continue;
            if (s.expiresAt > 0 && s.expiresAt < now) continue;
            out.add(s);
        }
        return out;
    }

    public synchronized VipSubscription createSubscription(VipSubscription s) {
        if (s == null) return null;
        if (s.id == null || s.id.isBlank()) s.id = UUID.randomUUID().toString();
        if (s.createdAt == 0L) s.createdAt = System.currentTimeMillis();
        subscriptions.add(s);
        save();
        return s;
    }

    public synchronized void updateSubscription(String id, VipSubscription updated) {
        if (id == null || updated == null) return;
        for (int i = 0; i < subscriptions.size(); i++) {
            if (id.equals(subscriptions.get(i).id)) {
                updated.id = id;
                subscriptions.set(i, updated);
                save();
                return;
            }
        }
    }

    public synchronized List<VipSubscription> findExpiringSoon(int daysAhead) {
        List<VipSubscription> out = new ArrayList<>();
        long now = System.currentTimeMillis();
        long limit = now + daysAhead * DAY_MS;
        for (VipSubscription s : subscriptions) {
            if (s == null) continue;
            if (!"ACTIVE".equalsIgnoreCase(s.status)) continue;
            if (s.expiresAt > now && s.expiresAt <= limit) out.add(s);
        }
        return out;
    }

    public synchronized List<VipSubscription> findExpired() {
        List<VipSubscription> out = new ArrayList<>();
        long now = System.currentTimeMillis();
        for (VipSubscription s : subscriptions) {
            if (s == null) continue;
            if (!"ACTIVE".equalsIgnoreCase(s.status)) continue;
            if (s.expiresAt > 0 && s.expiresAt <= now) out.add(s);
        }
        return out;
    }

    // ── Transactions ─────────────────────────────────────────────────────────
    public synchronized void recordTransaction(VipTransaction t) {
        if (t == null) return;
        if (t.id == null || t.id.isBlank()) t.id = UUID.randomUUID().toString();
        if (t.timestamp == 0L) t.timestamp = System.currentTimeMillis();
        transactions.add(t);
        while (transactions.size() > MAX_TRANSACTIONS) transactions.remove(0);
        save();
    }

    public synchronized List<VipTransaction> listTransactions(String subscriptionId, int days, int limit) {
        List<VipTransaction> out = new ArrayList<>();
        long since = days > 0 ? System.currentTimeMillis() - days * DAY_MS : 0L;
        for (VipTransaction t : transactions) {
            if (t == null) continue;
            if (subscriptionId != null && !subscriptionId.equals(t.subscriptionId)) continue;
            if (since > 0 && t.timestamp < since) continue;
            out.add(t);
        }
        out.sort((a, b) -> Long.compare(b.timestamp, a.timestamp));
        if (limit > 0 && out.size() > limit) return new ArrayList<>(out.subList(0, limit));
        return out;
    }

    // ── Pending checkouts ────────────────────────────────────────────────────
    public synchronized void registerPendingCheckout(String sessionId, String playerName, String planId, String gateway) {
        if (sessionId == null) return;
        PendingCheckoutInfo p = new PendingCheckoutInfo();
        p.playerName = playerName;
        p.planId = planId;
        p.gateway = gateway;
        p.createdAt = System.currentTimeMillis();
        pending.put(sessionId, p);
        // Purge des entrées >24h
        long cutoff = System.currentTimeMillis() - DAY_MS;
        pending.values().removeIf(v -> v.createdAt < cutoff);
        save();
    }

    public synchronized PendingCheckoutInfo consumePendingCheckout(String sessionId) {
        if (sessionId == null) return null;
        PendingCheckoutInfo p = pending.remove(sessionId);
        if (p != null) save();
        return p;
    }

    // ── Stats ────────────────────────────────────────────────────────────────
    public synchronized Map<String, Object> stats(int days) {
        long now = System.currentTimeMillis();
        long since = now - (days > 0 ? days : 30) * DAY_MS;

        double totalRevenue = 0.0;
        int totalSales = 0;
        Map<String, double[]> byPlan = new HashMap<>(); // [count, revenue]

        for (VipTransaction t : transactions) {
            if (t == null) continue;
            if (!"PURCHASE".equalsIgnoreCase(t.type)) continue;
            if (!"COMPLETED".equalsIgnoreCase(t.status)) continue;
            if (t.timestamp < since) continue;
            totalRevenue += t.amount;
            totalSales++;
        }

        // Top plans (via subscriptions dans la fenêtre)
        for (VipSubscription s : subscriptions) {
            if (s == null) continue;
            if (s.createdAt < since) continue;
            String pn = s.planName == null ? "(inconnu)" : s.planName;
            double[] agg = byPlan.computeIfAbsent(pn, k -> new double[]{0, 0});
            agg[0] += 1;
            agg[1] += s.amountPaid;
        }

        int active = 0, expired = 0;
        long expiredRecent = 0;
        for (VipSubscription s : subscriptions) {
            if (s == null) continue;
            if ("ACTIVE".equalsIgnoreCase(s.status)) active++;
            else if ("EXPIRED".equalsIgnoreCase(s.status)) {
                expired++;
                if (s.expiresAt >= since) expiredRecent++;
            }
        }

        double churn = 0.0;
        int denom = active + expired;
        if (denom > 0) churn = (expiredRecent * 100.0) / denom;

        // MRR estimé : revenu des 30 derniers jours
        long since30 = now - 30L * DAY_MS;
        double mrr = 0.0;
        for (VipTransaction t : transactions) {
            if (t == null) continue;
            if (!"PURCHASE".equalsIgnoreCase(t.type)) continue;
            if (!"COMPLETED".equalsIgnoreCase(t.status)) continue;
            if (t.timestamp < since30) continue;
            mrr += t.amount;
        }

        // Daily revenue
        SimpleDateFormat dayFmt = new SimpleDateFormat("yyyy-MM-dd");
        Map<String, Double> daily = new LinkedHashMap<>();
        int d = Math.max(1, days);
        for (int i = d - 1; i >= 0; i--) {
            String key = dayFmt.format(new Date(now - i * DAY_MS));
            daily.put(key, 0.0);
        }
        for (VipTransaction t : transactions) {
            if (t == null) continue;
            if (!"PURCHASE".equalsIgnoreCase(t.type)) continue;
            if (!"COMPLETED".equalsIgnoreCase(t.status)) continue;
            if (t.timestamp < since) continue;
            String key = dayFmt.format(new Date(t.timestamp));
            if (daily.containsKey(key)) daily.put(key, daily.get(key) + t.amount);
        }

        List<Map<String, Object>> topPlans = new ArrayList<>();
        byPlan.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue()[1], a.getValue()[1]))
                .limit(10)
                .forEach(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("planName", e.getKey());
                    m.put("count", (int) e.getValue()[0]);
                    m.put("revenue", e.getValue()[1]);
                    topPlans.add(m);
                });

        List<Map<String, Object>> dailyList = new ArrayList<>();
        for (Map.Entry<String, Double> e : daily.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", e.getKey());
            m.put("value", e.getValue());
            dailyList.add(m);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalRevenue", totalRevenue);
        out.put("totalSales", totalSales);
        out.put("activeSubscriptions", active);
        out.put("expiredSubscriptions", expired);
        out.put("mrrEstimated", mrr);
        out.put("churnRate", churn);
        out.put("topPlans", topPlans);
        out.put("dailyRevenue", dailyList);
        return out;
    }

    // ── Persistence ──────────────────────────────────────────────────────────
    public synchronized void save() {
        try {
            Files.writeString(plansFile.toPath(), GSON.toJson(plans), StandardCharsets.UTF_8);
            Files.writeString(subsFile.toPath(), GSON.toJson(subscriptions), StandardCharsets.UTF_8);
            Files.writeString(txFile.toPath(), GSON.toJson(transactions), StandardCharsets.UTF_8);
            Files.writeString(pendingFile.toPath(), GSON.toJson(pending), StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.warning("[Dashboard/VIP] save fail: " + e.getMessage());
        }
    }

    private void load() {
        try {
            if (plansFile.exists()) {
                List<VipPlan> loaded = GSON.fromJson(Files.readString(plansFile.toPath(), StandardCharsets.UTF_8),
                        new TypeToken<List<VipPlan>>(){}.getType());
                if (loaded != null) plans.addAll(loaded);
            }
            if (subsFile.exists()) {
                List<VipSubscription> loaded = GSON.fromJson(Files.readString(subsFile.toPath(), StandardCharsets.UTF_8),
                        new TypeToken<List<VipSubscription>>(){}.getType());
                if (loaded != null) subscriptions.addAll(loaded);
            }
            if (txFile.exists()) {
                List<VipTransaction> loaded = GSON.fromJson(Files.readString(txFile.toPath(), StandardCharsets.UTF_8),
                        new TypeToken<List<VipTransaction>>(){}.getType());
                if (loaded != null) transactions.addAll(loaded);
            }
            if (pendingFile.exists()) {
                Map<String, PendingCheckoutInfo> loaded = GSON.fromJson(
                        Files.readString(pendingFile.toPath(), StandardCharsets.UTF_8),
                        new TypeToken<Map<String, PendingCheckoutInfo>>(){}.getType());
                if (loaded != null) pending.putAll(loaded);
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/VIP] load fail: " + e.getMessage());
        }
    }

    /** Utilitaire : retrouve une subscription par gatewayTxId (pour les refunds). */
    public synchronized VipSubscription findByGatewayTxId(String gatewayTxId) {
        if (gatewayTxId == null) return null;
        for (VipSubscription s : subscriptions) {
            if (s != null && Objects.equals(s.gatewayTxId, gatewayTxId)) return s;
        }
        return null;
    }
}
