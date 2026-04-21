package sunanticheat.dashboard.vip;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import org.bukkit.plugin.java.JavaPlugin;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Intégration PayPal : OAuth2, création/capture d'ordre, vérification webhooks.
 * Lit la configuration à chaque appel.
 */
public final class PayPalService {

    private static final Gson GSON = new Gson();

    private final JavaPlugin plugin;
    private final Logger logger;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private String accessToken;
    private long accessTokenExpiresAt;

    public PayPalService(JavaPlugin plugin, Logger logger) {
        this.plugin = plugin;
        this.logger = logger;
    }

    private String getClientId() { return plugin.getConfig().getString("vip.paypal.client-id", ""); }
    private String getClientSecret() { return plugin.getConfig().getString("vip.paypal.client-secret", ""); }
    private String getWebhookId() { return plugin.getConfig().getString("vip.paypal.webhook-id", ""); }
    private String getMode() {
        String m = plugin.getConfig().getString("vip.paypal.mode", "sandbox");
        return "live".equalsIgnoreCase(m) ? "live" : "sandbox";
    }

    private String getApiBase() {
        return "live".equals(getMode())
                ? "https://api-m.paypal.com"
                : "https://api-m.sandbox.paypal.com";
    }

    public boolean isConfigured() {
        String id = getClientId();
        String secret = getClientSecret();
        return id != null && !id.isBlank() && secret != null && !secret.isBlank();
    }

    /** Retourne le mode configuré ("sandbox" ou "live"). */
    public String getModePublic() { return getMode(); }

    private synchronized String getAccessToken() throws Exception {
        long now = System.currentTimeMillis();
        if (accessToken != null && now < accessTokenExpiresAt - 60_000L) return accessToken;

        String clientId = getClientId();
        String clientSecret = getClientSecret();
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new IllegalStateException("PayPal non configuré");
        }

        String auth = Base64.getEncoder().encodeToString(
                (clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(getApiBase() + "/v1/oauth2/token"))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Basic " + auth)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("grant_type=client_credentials", StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new RuntimeException("PayPal OAuth HTTP " + res.statusCode() + " : " + res.body());
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = GSON.fromJson(res.body(), Map.class);
        if (parsed == null) throw new RuntimeException("PayPal OAuth réponse vide");
        accessToken = (String) parsed.get("access_token");
        Number expiresIn = (Number) parsed.get("expires_in");
        long lifetimeMs = (expiresIn != null ? expiresIn.longValue() : 3600L) * 1000L;
        accessTokenExpiresAt = now + lifetimeMs;
        return accessToken;
    }

    /**
     * Crée un ordre PayPal. Retourne { orderId, approvalUrl }.
     */
    public Map<String, Object> createOrder(VipPlan plan, String playerName,
                                           String returnUrl, String cancelUrl) throws Exception {
        if (plan == null) throw new IllegalArgumentException("plan null");
        String token = getAccessToken();

        String value = String.format(java.util.Locale.ROOT, "%.2f", plan.priceEur);

        Map<String, Object> amount = new LinkedHashMap<>();
        amount.put("currency_code", "EUR");
        amount.put("value", value);

        Map<String, Object> unit = new LinkedHashMap<>();
        unit.put("reference_id", plan.id == null ? "" : plan.id);
        unit.put("description", plan.displayName == null ? plan.name : plan.displayName);
        unit.put("custom_id", (playerName == null ? "" : playerName) + "|" + (plan.id == null ? "" : plan.id));
        unit.put("amount", amount);

        Map<String, Object> appContext = new LinkedHashMap<>();
        appContext.put("return_url", returnUrl);
        appContext.put("cancel_url", cancelUrl);
        appContext.put("user_action", "PAY_NOW");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("intent", "CAPTURE");
        body.put("purchase_units", List.of(unit));
        body.put("application_context", appContext);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(getApiBase() + "/v2/checkout/orders"))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new RuntimeException("PayPal createOrder HTTP " + res.statusCode() + " : " + res.body());
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = GSON.fromJson(res.body(), Map.class);
        if (parsed == null) throw new RuntimeException("PayPal createOrder réponse vide");

        String orderId = (String) parsed.get("id");
        String approvalUrl = null;
        Object linksObj = parsed.get("links");
        if (linksObj instanceof List) {
            for (Object l : (List<?>) linksObj) {
                if (l instanceof Map) {
                    Map<?, ?> link = (Map<?, ?>) l;
                    if ("approve".equals(link.get("rel"))) {
                        approvalUrl = (String) link.get("href");
                        break;
                    }
                }
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("orderId", orderId);
        out.put("approvalUrl", approvalUrl);
        out.put("raw", parsed);
        return out;
    }

    /** Capture un ordre PayPal. */
    public Map<String, Object> captureOrder(String orderId) throws Exception {
        if (orderId == null || orderId.isBlank()) throw new IllegalArgumentException("orderId manquant");
        String token = getAccessToken();

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(getApiBase() + "/v2/checkout/orders/" + orderId + "/capture"))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new RuntimeException("PayPal captureOrder HTTP " + res.statusCode() + " : " + res.body());
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = GSON.fromJson(res.body(), Map.class);
        return parsed == null ? new LinkedHashMap<>() : parsed;
    }

    /**
     * Vérifie la signature d'un webhook PayPal via l'endpoint officiel.
     */
    @SuppressWarnings("unchecked")
    public boolean verifyWebhookSignature(Map<String, String> headers, String payload) throws Exception {
        if (headers == null || payload == null) return false;
        String webhookId = getWebhookId();
        if (webhookId == null || webhookId.isBlank()) {
            logger.warning("[Dashboard/VIP] PayPal webhook-id non configuré, vérif impossible");
            return false;
        }
        try {
            String token = getAccessToken();

            Map<String, Object> event;
            try {
                event = GSON.fromJson(payload, new TypeToken<Map<String, Object>>(){}.getType());
            } catch (Exception e) {
                return false;
            }
            if (event == null) return false;

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("auth_algo", headerCI(headers, "paypal-auth-algo"));
            body.put("cert_url", headerCI(headers, "paypal-cert-url"));
            body.put("transmission_id", headerCI(headers, "paypal-transmission-id"));
            body.put("transmission_sig", headerCI(headers, "paypal-transmission-sig"));
            body.put("transmission_time", headerCI(headers, "paypal-transmission-time"));
            body.put("webhook_id", webhookId);
            body.put("webhook_event", event);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(getApiBase() + "/v1/notifications/verify-webhook-signature"))
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() < 200 || res.statusCode() >= 300) {
                logger.warning("[Dashboard/VIP] PayPal verify HTTP " + res.statusCode() + " : " + res.body());
                return false;
            }
            Map<String, Object> parsed = GSON.fromJson(res.body(), Map.class);
            if (parsed == null) return false;
            String status = (String) parsed.get("verification_status");
            return "SUCCESS".equalsIgnoreCase(status);
        } catch (Exception e) {
            logger.warning("[Dashboard/VIP] PayPal verifyWebhook fail: " + e.getMessage());
            return false;
        }
    }

    private static String headerCI(Map<String, String> headers, String name) {
        if (headers == null || name == null) return null;
        for (Map.Entry<String, String> e : headers.entrySet()) {
            if (e.getKey() != null && e.getKey().equalsIgnoreCase(name)) return e.getValue();
        }
        return null;
    }

    /** Parse un payload webhook PayPal. */
    @SuppressWarnings("unchecked")
    public PayPalWebhookEvent parseEvent(String payload) {
        PayPalWebhookEvent ev = new PayPalWebhookEvent();
        if (payload == null) return ev;
        try {
            Map<String, Object> root = GSON.fromJson(payload, new TypeToken<Map<String, Object>>(){}.getType());
            if (root == null) return ev;
            ev.id = (String) root.get("id");
            ev.eventType = (String) root.get("event_type");
            Object resource = root.get("resource");
            if (resource instanceof Map) ev.resource = (Map<String, Object>) resource;
        } catch (Exception e) {
            logger.warning("[Dashboard/VIP] parseEvent PayPal fail: " + e.getMessage());
        }
        return ev;
    }

    public static class PayPalWebhookEvent {
        public String id;
        public String eventType;
        public Map<String, Object> resource;
    }
}
