package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.vip.PayPalService;
import sunanticheat.dashboard.vip.StripeService;
import sunanticheat.dashboard.vip.VipActivationService;
import sunanticheat.dashboard.vip.VipPlan;
import sunanticheat.dashboard.vip.VipStore;
import sunanticheat.dashboard.vip.VipSubscription;
import sunanticheat.dashboard.vip.VipTransaction;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Endpoints ADMIN/MOD pour gérer les plans, abonnements et transactions VIP.
 */
public final class VipHandler {

    private final JavaPlugin plugin;
    private final VipStore store;
    private final VipActivationService activation;
    private final StripeService stripe;
    private final PayPalService paypal;

    public VipHandler(JavaPlugin plugin, VipStore store, VipActivationService activation,
                      StripeService stripe, PayPalService paypal) {
        this.plugin = plugin;
        this.store = store;
        this.activation = activation;
        this.stripe = stripe;
        this.paypal = paypal;
    }

    // ── Plans ────────────────────────────────────────────────────────────────
    public void listPlans(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        HttpHelper.json(ex, 200, store.listPlans());
    }

    public void createPlan(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        VipPlan plan = HttpHelper.GSON.fromJson(HttpHelper.body(ex), VipPlan.class);
        if (plan == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        VipPlan created = store.createPlan(plan);
        HttpHelper.json(ex, 201, created);
    }

    public void updatePlan(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        VipPlan plan = HttpHelper.GSON.fromJson(HttpHelper.body(ex), VipPlan.class);
        if (plan == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        VipPlan updated = store.updatePlan(id, plan);
        if (updated == null) { HttpHelper.error(ex, 404, "Plan introuvable"); return; }
        HttpHelper.json(ex, 200, updated);
    }

    public void deletePlan(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        store.deletePlan(id);
        HttpHelper.noContent(ex);
    }

    // ── Subscriptions ────────────────────────────────────────────────────────
    public void listSubscriptions(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        String status = HttpHelper.queryParam(ex, "status");
        String player = HttpHelper.queryParam(ex, "player");
        int limit = HttpHelper.queryInt(ex, "limit", 100);
        HttpHelper.json(ex, 200, store.listSubscriptions(status, player, limit));
    }

    public void getSubscription(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        VipSubscription s = store.getSubscription(id);
        if (s == null) { HttpHelper.error(ex, 404, "Abonnement introuvable"); return; }
        HttpHelper.json(ex, 200, s);
    }

    @SuppressWarnings("unchecked")
    public void gift(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        String playerName = (String) body.get("playerName");
        String planId = (String) body.get("planId");
        if (playerName == null || planId == null) {
            HttpHelper.error(ex, 400, "playerName/planId requis"); return;
        }
        if (store.getPlan(planId) == null) {
            HttpHelper.error(ex, 404, "Plan introuvable"); return;
        }
        activation.giftSubscription(playerName, planId, u.username());
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    @SuppressWarnings("unchecked")
    public void extend(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        Number n = (Number) body.get("days");
        if (n == null) { HttpHelper.error(ex, 400, "days requis"); return; }
        VipSubscription sub = store.getSubscription(id);
        if (sub == null) { HttpHelper.error(ex, 404, "Abonnement introuvable"); return; }
        activation.extendSubscription(sub, n.intValue(), u.username());
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    @SuppressWarnings("unchecked")
    public void revoke(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        String reason = body == null ? "Révocation admin" : (String) body.getOrDefault("reason", "Révocation admin");
        VipSubscription sub = store.getSubscription(id);
        if (sub == null) { HttpHelper.error(ex, 404, "Abonnement introuvable"); return; }
        activation.revokeSubscription(sub, reason);
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    // ── Transactions / stats ─────────────────────────────────────────────────
    public void listTransactions(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 30);
        int limit = HttpHelper.queryInt(ex, "limit", 200);
        List<VipTransaction> list = store.listTransactions(null, days, limit);
        HttpHelper.json(ex, 200, list);
    }

    public void stats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        int days = HttpHelper.queryInt(ex, "days", 30);
        HttpHelper.json(ex, 200, store.stats(days));
    }

    public void gatewaysStatus(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;
        Map<String, Object> stripeInfo = new LinkedHashMap<>();
        stripeInfo.put("configured", stripe.isConfigured());
        stripeInfo.put("mode", stripe.getMode());
        Map<String, Object> paypalInfo = new LinkedHashMap<>();
        paypalInfo.put("configured", paypal.isConfigured());
        paypalInfo.put("mode", paypal.getModePublic());
        HttpHelper.json(ex, 200, Map.of("stripe", stripeInfo, "paypal", paypalInfo));
    }
}
