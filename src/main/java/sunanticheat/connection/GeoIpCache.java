package sunanticheat.connection;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Cache GeoIP — résout les IP en pays/ville/ISP via ip-api.com (gratuit, sans clé).
 * Les résultats sont mis en cache en mémoire pour éviter les appels répétés.
 */
public final class GeoIpCache {

    public record GeoIpResult(
            String countryCode,
            String country,
            String city,
            String isp,
            boolean proxy) {}

    private static final String API_BASE = "http://ip-api.com/json/";
    private static final String FIELDS   = "?fields=status,country,countryCode,city,isp,proxy,hosting";

    private final Logger log;
    private final HttpClient client;
    private final Map<String, GeoIpResult> cache = new ConcurrentHashMap<>();

    public GeoIpCache(Logger log) {
        this.log = log;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    /** Résultat mis en cache, ou {@code null} si non encore résolu. */
    public GeoIpResult get(String ip) {
        return cache.get(normalise(ip));
    }

    /**
     * Lookup asynchrone. Met à jour le cache à la fin.
     * Pour les adresses privées/loopback, retourne immédiatement un résultat local.
     */
    public CompletableFuture<GeoIpResult> lookupAsync(String ip) {
        String key = normalise(ip);

        if (isPrivate(key)) {
            GeoIpResult r = new GeoIpResult("--", "Local/Private", "", "", false);
            cache.put(key, r);
            return CompletableFuture.completedFuture(r);
        }

        GeoIpResult cached = cache.get(key);
        if (cached != null) {
            return CompletableFuture.completedFuture(cached);
        }

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(API_BASE + key + FIELDS))
                .timeout(Duration.ofSeconds(8))
                .GET()
                .build();

        return client.sendAsync(req, HttpResponse.BodyHandlers.ofString())
                .thenApply(resp -> {
                    if (resp.statusCode() == 200) {
                        GeoIpResult r = parse(resp.body());
                        if (r != null) {
                            cache.put(key, r);
                            return r;
                        }
                    } else {
                        log.warning("[GeoIP] HTTP " + resp.statusCode() + " pour " + key);
                    }
                    return null;
                })
                .exceptionally(ex -> {
                    log.warning("[GeoIP] Erreur lookup " + key + " : " + ex.getMessage());
                    return null;
                });
    }

    /** Parse la réponse JSON de ip-api.com sans dépendance externe. */
    private GeoIpResult parse(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            if (!json.contains("\"success\"")) return null;
            String countryCode = extract(json, "countryCode");
            if (countryCode == null || countryCode.isEmpty()) return null;
            String country = extract(json, "country");
            String city    = extract(json, "city");
            String isp     = extract(json, "isp");
            boolean proxy  = json.contains("\"proxy\":true") || json.contains("\"hosting\":true");
            return new GeoIpResult(countryCode, nvl(country), nvl(city), nvl(isp), proxy);
        } catch (Throwable t) {
            log.warning("[GeoIP] Parse error : " + t.getMessage());
            return null;
        }
    }

    private static String extract(String json, String key) {
        String token = "\"" + key + "\":\"";
        int s = json.indexOf(token);
        if (s < 0) return null;
        s += token.length();
        int e = json.indexOf('"', s);
        return e < 0 ? null : json.substring(s, e);
    }

    private static String normalise(String ip) {
        return ip == null ? "?" : ip.trim();
    }

    private static String nvl(String s) {
        return s != null ? s : "";
    }

    private static boolean isPrivate(String ip) {
        if (ip == null || ip.isBlank() || ip.equals("?")) return true;
        return ip.equals("::1")
                || ip.equals("0:0:0:0:0:0:0:1")
                || ip.startsWith("127.")
                || ip.startsWith("10.")
                || ip.startsWith("192.168.")
                || ip.startsWith("172.16.")
                || ip.startsWith("172.17.")
                || ip.startsWith("172.18.")
                || ip.startsWith("172.19.")
                || ip.startsWith("172.2")
                || ip.startsWith("172.30.")
                || ip.startsWith("172.31.");
    }
}
