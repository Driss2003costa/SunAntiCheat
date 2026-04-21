package sunanticheat.dashboard.vip;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import org.bukkit.plugin.java.JavaPlugin;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Intégration Stripe : Checkout Session creation + vérification des webhooks.
 * Lit la configuration à chaque appel pour supporter le reload sans restart.
 */
public final class StripeService {

    private static final Gson GSON = new Gson();
    private static final long TOLERANCE_SECONDS = 300L; // 5 minutes

    private final JavaPlugin plugin;
    private final Logger logger;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public StripeService(JavaPlugin plugin, Logger logger) {
        this.plugin = plugin;
        this.logger = logger;
    }

    /** Lit la clé secrète depuis plugin.getConfig(). */
    private String getSecretKey() {
        return plugin.getConfig().getString("vip.stripe.secret-key", "");
    }

    private String getWebhookSecret() {
        return plugin.getConfig().getString("vip.stripe.webhook-secret", "");
    }

    private String getCurrency() {
        String c = plugin.getConfig().getString("vip.stripe.currency", "eur");
        return c == null || c.isBlank() ? "eur" : c.toLowerCase();
    }

    /** Indique si Stripe est configuré (clé présente). */
    public boolean isConfigured() {
        String k = getSecretKey();
        return k != null && !k.isBlank();
    }

    /** Mode : "test" | "live" | "unknown" basé sur le prefix de la clé. */
    public String getMode() {
        String k = getSecretKey();
        if (k == null || k.isBlank()) return "unknown";
        if (k.startsWith("sk_test_")) return "test";
        if (k.startsWith("sk_live_")) return "live";
        return "unknown";
    }

    /**
     * Crée une Checkout Session Stripe. Retourne un Map { sessionId, checkoutUrl }.
     */
    public Map<String, Object> createCheckoutSession(VipPlan plan, String playerName,
                                                     String successUrl, String cancelUrl) throws Exception {
        String secretKey = getSecretKey();
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalStateException("Stripe non configuré");
        }
        if (plan == null) throw new IllegalArgumentException("plan null");

        long amountCents = Math.round(plan.priceEur * 100);
        String currency = getCurrency();
        String displayName = plan.displayName == null ? plan.name : plan.displayName;
        String description = plan.description == null ? "" : plan.description;

        StringBuilder form = new StringBuilder();
        appendForm(form, "payment_method_types[]", "card");
        appendForm(form, "line_items[0][price_data][currency]", currency);
        appendForm(form, "line_items[0][price_data][product_data][name]", displayName);
        if (!description.isEmpty()) {
            appendForm(form, "line_items[0][price_data][product_data][description]", description);
        }
        appendForm(form, "line_items[0][price_data][unit_amount]", String.valueOf(amountCents));
        appendForm(form, "line_items[0][quantity]", "1");
        appendForm(form, "mode", "payment");
        // Append session_id template - Stripe remplace {CHECKOUT_SESSION_ID}
        String success = successUrl + (successUrl.contains("?") ? "&" : "?") + "session_id={CHECKOUT_SESSION_ID}";
        appendForm(form, "success_url", success);
        appendForm(form, "cancel_url", cancelUrl);
        appendForm(form, "metadata[playerName]", playerName == null ? "" : playerName);
        appendForm(form, "metadata[planId]", plan.id == null ? "" : plan.id);
        appendForm(form, "metadata[gateway]", "STRIPE");

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.stripe.com/v1/checkout/sessions"))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + secretKey)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new RuntimeException("Stripe HTTP " + res.statusCode() + " : " + res.body());
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = GSON.fromJson(res.body(), Map.class);
        if (parsed == null) throw new RuntimeException("Réponse Stripe vide");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sessionId", parsed.get("id"));
        out.put("checkoutUrl", parsed.get("url"));
        out.put("raw", parsed);
        return out;
    }

    private static void appendForm(StringBuilder sb, String key, String value) {
        if (sb.length() > 0) sb.append('&');
        sb.append(URLEncoder.encode(key, StandardCharsets.UTF_8));
        sb.append('=');
        sb.append(URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8));
    }

    /**
     * Vérifie la signature d'un webhook Stripe.
     * Format du header "Stripe-Signature" : "t=1234567890,v1=hash,v1=hash".
     */
    public boolean verifyWebhookSignature(String payload, String signatureHeader) throws Exception {
        String secret = getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            logger.warning("[Dashboard/VIP] Stripe webhook-secret non configuré, vérif impossible");
            return false;
        }
        if (payload == null || signatureHeader == null) return false;

        String timestamp = null;
        java.util.List<String> v1Signatures = new java.util.ArrayList<>();
        for (String part : signatureHeader.split(",")) {
            String[] kv = part.trim().split("=", 2);
            if (kv.length != 2) continue;
            if ("t".equals(kv[0])) timestamp = kv[1];
            else if ("v1".equals(kv[0])) v1Signatures.add(kv[1]);
        }
        if (timestamp == null || v1Signatures.isEmpty()) return false;

        // Tolérance timestamp
        try {
            long ts = Long.parseLong(timestamp);
            long now = System.currentTimeMillis() / 1000L;
            if (Math.abs(now - ts) > TOLERANCE_SECONDS) {
                logger.warning("[Dashboard/VIP] Stripe timestamp trop ancien : " + Math.abs(now - ts) + "s");
                return false;
            }
        } catch (NumberFormatException e) {
            return false;
        }

        String signedPayload = timestamp + "." + payload;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] computed = mac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8));
        String computedHex = toHex(computed);
        byte[] computedBytes = computedHex.getBytes(StandardCharsets.UTF_8);

        for (String v1 : v1Signatures) {
            byte[] v1Bytes = v1.getBytes(StandardCharsets.UTF_8);
            if (v1Bytes.length == computedBytes.length && MessageDigest.isEqual(v1Bytes, computedBytes)) {
                return true;
            }
        }
        return false;
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    /**
     * Parse un payload d'event Stripe en objet simplifié.
     * On expose directement data.object dans le champ "object".
     */
    @SuppressWarnings("unchecked")
    public StripeWebhookEvent parseEvent(String payload) {
        StripeWebhookEvent ev = new StripeWebhookEvent();
        if (payload == null) return ev;
        try {
            Map<String, Object> root = GSON.fromJson(payload, new TypeToken<Map<String, Object>>(){}.getType());
            if (root == null) return ev;
            ev.id = (String) root.get("id");
            ev.type = (String) root.get("type");
            Object data = root.get("data");
            if (data instanceof Map) {
                Object obj = ((Map<String, Object>) data).get("object");
                if (obj instanceof Map) ev.object = (Map<String, Object>) obj;
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/VIP] parseEvent Stripe fail: " + e.getMessage());
        }
        return ev;
    }

    /** Wrapper simplifié d'un event Stripe. */
    public static class StripeWebhookEvent {
        public String id;
        public String type;
        public Map<String, Object> object;
    }
}
