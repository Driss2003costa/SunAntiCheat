package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.vip.PayPalService;
import sunanticheat.dashboard.vip.StripeService;
import sunanticheat.dashboard.vip.VipActivationService;
import sunanticheat.dashboard.vip.VipPlan;
import sunanticheat.dashboard.vip.VipStore;
import sunanticheat.dashboard.vip.VipSubscription;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;
import java.util.regex.Pattern;

/**
 * Endpoints PUBLICS (pas d'auth) pour la page /buy et les webhooks Stripe/PayPal.
 * Rate-limité à 1 requête/seconde par IP.
 */
public final class VipPublicHandler {

    private static final Pattern PLAYER_NAME = Pattern.compile("^[a-zA-Z0-9_]{3,16}$");
    private static final long RATE_LIMIT_MS = 1_000L;

    private final JavaPlugin plugin;
    private final VipStore store;
    private final VipActivationService activation;
    private final StripeService stripe;
    private final PayPalService paypal;
    private final Logger logger;

    private final Map<String, Long> ipLastRequest = new ConcurrentHashMap<>();

    public VipPublicHandler(JavaPlugin plugin, VipStore store, VipActivationService activation,
                            StripeService stripe, PayPalService paypal, Logger logger) {
        this.plugin = plugin;
        this.store = store;
        this.activation = activation;
        this.stripe = stripe;
        this.paypal = paypal;
        this.logger = logger;
    }

    private boolean rateLimit(HttpExchange ex) throws IOException {
        String ip = clientIp(ex);
        long now = System.currentTimeMillis();
        Long last = ipLastRequest.get(ip);
        if (last != null && now - last < RATE_LIMIT_MS) {
            HttpHelper.error(ex, 429, "Trop de requêtes, réessayez dans un instant");
            return false;
        }
        ipLastRequest.put(ip, now);
        // Purge occasionnelle
        if (ipLastRequest.size() > 5000) {
            long cutoff = now - 60_000L;
            ipLastRequest.entrySet().removeIf(e -> e.getValue() < cutoff);
        }
        return true;
    }

    private static String clientIp(HttpExchange ex) {
        String xff = ex.getRequestHeaders().getFirst("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        return ex.getRemoteAddress() == null ? "unknown" : ex.getRemoteAddress().getAddress().getHostAddress();
    }

    /** GET /api/public/vip/plans — liste sanitisée pour affichage public. */
    public void listPublicPlans(HttpExchange ex) throws IOException {
        if (!rateLimit(ex)) return;
        List<VipPlan> plans = store.listEnabledPlans();
        List<Map<String, Object>> out = new ArrayList<>();
        for (VipPlan p : plans) {
            if (p == null) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.id);
            m.put("displayName", p.displayName);
            m.put("description", p.description);
            m.put("icon", p.icon);
            m.put("color", p.color);
            m.put("priceEur", p.priceEur);
            m.put("durationDays", p.durationDays);
            m.put("perks", p.perks == null ? List.of() : p.perks);
            m.put("order", p.order);
            out.add(m);
        }
        HttpHelper.json(ex, 200, out);
    }

    /** POST /api/public/vip/checkout — crée une session Stripe ou un ordre PayPal. */
    @SuppressWarnings("unchecked")
    public void createCheckout(HttpExchange ex) throws IOException {
        if (!rateLimit(ex)) return;
        Map<String, Object> body;
        try {
            body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        } catch (Exception e) {
            HttpHelper.error(ex, 400, "Body invalide"); return;
        }
        if (body == null) { HttpHelper.error(ex, 400, "Body requis"); return; }
        String planId = (String) body.get("planId");
        String playerName = (String) body.get("playerName");
        String gateway = (String) body.get("gateway");
        if (planId == null || planId.isBlank()) { HttpHelper.error(ex, 400, "planId requis"); return; }
        if (playerName == null || !PLAYER_NAME.matcher(playerName).matches()) {
            HttpHelper.error(ex, 400, "playerName invalide"); return;
        }
        if (gateway == null || (!gateway.equalsIgnoreCase("STRIPE") && !gateway.equalsIgnoreCase("PAYPAL"))) {
            HttpHelper.error(ex, 400, "gateway invalide (STRIPE ou PAYPAL)"); return;
        }
        VipPlan plan = store.getPlan(planId);
        if (plan == null || !plan.enabled) { HttpHelper.error(ex, 404, "Plan introuvable ou désactivé"); return; }

        String successUrl = plugin.getConfig().getString("vip.success-url",
                "http://localhost:8765/buy?success=true");
        String cancelUrl = plugin.getConfig().getString("vip.cancel-url",
                "http://localhost:8765/buy?cancelled=true");

        try {
            if (gateway.equalsIgnoreCase("STRIPE")) {
                Map<String, Object> result = stripe.createCheckoutSession(plan, playerName, successUrl, cancelUrl);
                String sessionId = (String) result.get("sessionId");
                String url = (String) result.get("checkoutUrl");
                if (sessionId != null) {
                    store.registerPendingCheckout(sessionId, playerName, planId, "STRIPE");
                }
                HttpHelper.json(ex, 200, Map.of("redirectUrl", url == null ? "" : url));
            } else {
                Map<String, Object> result = paypal.createOrder(plan, playerName, successUrl, cancelUrl);
                String orderId = (String) result.get("orderId");
                String url = (String) result.get("approvalUrl");
                if (orderId != null) {
                    store.registerPendingCheckout(orderId, playerName, planId, "PAYPAL");
                }
                HttpHelper.json(ex, 200, Map.of("redirectUrl", url == null ? "" : url));
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/VIP] checkout fail: " + e.getMessage());
            HttpHelper.error(ex, 500, "Le paiement n'a pas pu être initié");
        }
    }

    /** POST /api/public/vip/webhook/stripe — endpoint webhook Stripe. */
    @SuppressWarnings("unchecked")
    public void stripeWebhook(HttpExchange ex) throws IOException {
        // SAUVEGARDE du payload AVANT parse pour la vérif de signature
        String payload = HttpHelper.body(ex);
        String signature = ex.getRequestHeaders().getFirst("Stripe-Signature");
        try {
            if (!stripe.verifyWebhookSignature(payload, signature)) {
                HttpHelper.error(ex, 400, "Signature Stripe invalide");
                return;
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/VIP] stripe verify fail: " + e.getMessage());
            HttpHelper.error(ex, 400, "Vérification signature impossible"); return;
        }

        StripeService.StripeWebhookEvent event = stripe.parseEvent(payload);
        if (event == null || event.type == null) {
            HttpHelper.json(ex, 200, Map.of("received", true));
            return;
        }

        try {
            if ("checkout.session.completed".equals(event.type) && event.object != null) {
                Map<String, Object> session = event.object;
                String sessionId = (String) session.get("id");
                Object metaObj = session.get("metadata");
                Map<String, Object> metadata = metaObj instanceof Map ? (Map<String, Object>) metaObj : Map.of();
                String playerName = (String) metadata.get("playerName");
                String planId = (String) metadata.get("planId");
                Object payStatus = session.get("payment_status");
                if (payStatus != null && !"paid".equalsIgnoreCase(String.valueOf(payStatus))) {
                    // On n'active que si réellement payé
                    HttpHelper.json(ex, 200, Map.of("received", true, "skipped", "not paid")); return;
                }
                // Fallback via pending-checkouts si metadata manquent
                if ((playerName == null || planId == null) && sessionId != null) {
                    VipStore.PendingCheckoutInfo p = store.consumePendingCheckout(sessionId);
                    if (p != null) {
                        if (playerName == null) playerName = p.playerName;
                        if (planId == null) planId = p.planId;
                    }
                } else if (sessionId != null) {
                    store.consumePendingCheckout(sessionId);
                }
                // Idempotence : si on a déjà traité cette session, skip
                if (sessionId != null && store.findByGatewayTxId(sessionId) != null) {
                    HttpHelper.json(ex, 200, Map.of("received", true, "skipped", "duplicate")); return;
                }
                double amount = 0.0;
                Object at = session.get("amount_total");
                if (at instanceof Number) amount = ((Number) at).longValue() / 100.0;
                String currency = session.get("currency") == null ? "EUR"
                        : String.valueOf(session.get("currency")).toUpperCase();

                if (playerName != null && planId != null) {
                    activation.activateSubscription(playerName, planId, "STRIPE", sessionId, amount, currency);
                } else {
                    logger.warning("[Dashboard/VIP] stripe : playerName/planId manquants, session=" + sessionId);
                }
            } else if ("charge.refunded".equals(event.type) && event.object != null) {
                Map<String, Object> charge = event.object;
                String paymentIntent = (String) charge.get("payment_intent");
                VipSubscription sub = null;
                if (paymentIntent != null) sub = store.findByGatewayTxId(paymentIntent);
                if (sub == null) {
                    String chargeId = (String) charge.get("id");
                    if (chargeId != null) sub = store.findByGatewayTxId(chargeId);
                }
                if (sub != null) activation.revokeSubscription(sub, "Refund Stripe");
            }
        } catch (Throwable t) {
            logger.warning("[Dashboard/VIP] stripe webhook handling fail: " + t.getMessage());
        }

        HttpHelper.json(ex, 200, Map.of("received", true));
    }

    /** POST /api/public/vip/webhook/paypal — endpoint webhook PayPal. */
    @SuppressWarnings("unchecked")
    public void paypalWebhook(HttpExchange ex) throws IOException {
        String payload = HttpHelper.body(ex);
        // Collecte des headers PayPal
        Headers hdrs = ex.getRequestHeaders();
        Map<String, String> headers = new LinkedHashMap<>();
        for (String name : List.of("paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id",
                "paypal-transmission-sig", "paypal-transmission-time")) {
            String v = hdrs.getFirst(name);
            if (v != null) headers.put(name, v);
        }
        try {
            if (!paypal.verifyWebhookSignature(headers, payload)) {
                HttpHelper.error(ex, 400, "Signature PayPal invalide"); return;
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/VIP] paypal verify fail: " + e.getMessage());
            HttpHelper.error(ex, 400, "Vérification signature impossible"); return;
        }

        PayPalService.PayPalWebhookEvent event = paypal.parseEvent(payload);
        if (event == null || event.eventType == null) {
            HttpHelper.json(ex, 200, Map.of("received", true)); return;
        }

        try {
            if ("PAYMENT.CAPTURE.COMPLETED".equals(event.eventType) && event.resource != null) {
                Map<String, Object> resource = event.resource;
                String customId = (String) resource.get("custom_id");
                String txId = (String) resource.get("id");
                String playerName = null, planId = null;
                if (customId != null && customId.contains("|")) {
                    String[] parts = customId.split("\\|", 2);
                    playerName = parts[0];
                    planId = parts[1];
                }
                // Fallback pending-checkouts avec order id supplémentaire
                Object links = resource.get("supplementary_data");
                if ((playerName == null || planId == null) && links instanceof Map) {
                    Object related = ((Map<String, Object>) links).get("related_ids");
                    if (related instanceof Map) {
                        String orderId = (String) ((Map<String, Object>) related).get("order_id");
                        if (orderId != null) {
                            VipStore.PendingCheckoutInfo p = store.consumePendingCheckout(orderId);
                            if (p != null) {
                                if (playerName == null) playerName = p.playerName;
                                if (planId == null) planId = p.planId;
                            }
                        }
                    }
                }
                // Idempotence
                if (txId != null && store.findByGatewayTxId(txId) != null) {
                    HttpHelper.json(ex, 200, Map.of("received", true, "skipped", "duplicate")); return;
                }
                double value = 0.0;
                String currency = "EUR";
                Object amountObj = resource.get("amount");
                if (amountObj instanceof Map) {
                    Map<String, Object> amount = (Map<String, Object>) amountObj;
                    try { value = Double.parseDouble(String.valueOf(amount.get("value"))); }
                    catch (Exception ignored) {}
                    Object cc = amount.get("currency_code");
                    if (cc != null) currency = String.valueOf(cc).toUpperCase();
                }
                if (playerName != null && planId != null) {
                    activation.activateSubscription(playerName, planId, "PAYPAL", txId, value, currency);
                } else {
                    logger.warning("[Dashboard/VIP] paypal : playerName/planId manquants, tx=" + txId);
                }
            } else if ("PAYMENT.CAPTURE.REFUNDED".equals(event.eventType) && event.resource != null) {
                Map<String, Object> resource = event.resource;
                String txId = (String) resource.get("id");
                // PayPal refund : id = id du refund, on cherche par capture id dans links
                VipSubscription sub = null;
                if (txId != null) sub = store.findByGatewayTxId(txId);
                if (sub == null) {
                    // Essaye via links/up
                    Object links = resource.get("links");
                    if (links instanceof List) {
                        for (Object l : (List<?>) links) {
                            if (l instanceof Map) {
                                Map<?, ?> link = (Map<?, ?>) l;
                                if ("up".equals(link.get("rel"))) {
                                    String href = (String) link.get("href");
                                    if (href != null) {
                                        int idx = href.lastIndexOf('/');
                                        if (idx > 0) {
                                            String captureId = href.substring(idx + 1);
                                            sub = store.findByGatewayTxId(captureId);
                                            if (sub != null) break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (sub != null) activation.revokeSubscription(sub, "Refund PayPal");
            }
        } catch (Throwable t) {
            logger.warning("[Dashboard/VIP] paypal webhook handling fail: " + t.getMessage());
        }

        HttpHelper.json(ex, 200, Map.of("received", true));
    }
}
