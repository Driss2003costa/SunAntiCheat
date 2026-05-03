package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.connection.GeoIpCache;
import sunanticheat.connection.GeoIpCache.GeoIpResult;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * GET /api/geoip/lookup?ip=x.x.x.x — résout une adresse IP en informations géographiques.
 * Utilise le cache local ; effectue un appel ip-api.com si nécessaire.
 */
public final class GeoIpHandler {

    private final GeoIpCache cache;

    public GeoIpHandler(GeoIpCache cache) {
        this.cache = cache;
    }

    public void lookup(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;

        String ip = HttpHelper.queryParam(ex, "ip");
        if (ip == null || ip.isBlank()) {
            HttpHelper.error(ex, 400, "Paramètre 'ip' requis");
            return;
        }

        GeoIpResult cached = cache.get(ip);
        if (cached != null) {
            HttpHelper.json(ex, 200, toMap(ip, cached));
            return;
        }

        try {
            GeoIpResult result = cache.lookupAsync(ip).get(8, TimeUnit.SECONDS);
            if (result != null) {
                HttpHelper.json(ex, 200, toMap(ip, result));
            } else {
                HttpHelper.error(ex, 502, "Lookup GeoIP échoué pour " + ip);
            }
        } catch (java.util.concurrent.TimeoutException e) {
            HttpHelper.error(ex, 504, "GeoIP timeout");
        } catch (Exception e) {
            HttpHelper.error(ex, 500, "Erreur GeoIP : " + e.getMessage());
        }
    }

    private static Map<String, Object> toMap(String ip, GeoIpResult r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ip", ip);
        m.put("countryCode", r.countryCode());
        m.put("country", r.country());
        m.put("city", r.city());
        m.put("isp", r.isp());
        m.put("proxy", r.proxy());
        return m;
    }
}
