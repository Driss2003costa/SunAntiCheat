package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.mobile.MobileDevice;
import sunanticheat.dashboard.mobile.PushService;

import java.io.IOException;
import java.util.*;

/**
 * Endpoints /api/mobile/* — enregistrement push tokens, gestion devices.
 */
public final class MobileHandler {

    /** POST /api/mobile/push/register — un user authentifié enregistre son token push. */
    @SuppressWarnings("unchecked")
    public void registerPush(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;

        Map<String, Object> body;
        try { body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
        if (body == null) { HttpHelper.error(ex, 400, "Body requis"); return; }

        String token = (String) body.get("expoPushToken");
        String deviceName = (String) body.getOrDefault("deviceName", "Mobile");
        if (token == null || token.isBlank() || !token.startsWith("ExponentPushToken[")) {
            HttpHelper.error(ex, 400, "expoPushToken invalide"); return;
        }

        PushService svc = PushService.get();
        if (svc == null) { HttpHelper.error(ex, 503, "Push service non initialisé"); return; }

        svc.registerDevice(token, u.username(), deviceName);
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }

    /** GET /api/mobile/devices — liste les devices (ADMIN). */
    public void listDevices(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        PushService svc = PushService.get();
        if (svc == null) { HttpHelper.json(ex, 200, List.of()); return; }
        List<Map<String, Object>> out = new ArrayList<>();
        for (MobileDevice d : svc.listDevices()) {
            out.add(Map.of(
                    "deviceName", d.deviceName != null ? d.deviceName : "Mobile",
                    "username", d.username != null ? d.username : "",
                    "registeredAt", d.registeredAt,
                    "lastSeenAt", d.lastSeenAt,
                    "tokenShort", d.expoPushToken != null && d.expoPushToken.length() > 30
                            ? d.expoPushToken.substring(0, 30) + "..."
                            : d.expoPushToken
            ));
        }
        HttpHelper.json(ex, 200, out);
    }

    /** POST /api/mobile/push/test — envoie une notif de test à l'user connecté. */
    public void testPush(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        PushService svc = PushService.get();
        if (svc == null) { HttpHelper.error(ex, 503, "Push service non initialisé"); return; }
        svc.sendToUser(u.username(), "SunGuard test ✓",
                "Les notifications push fonctionnent correctement !", "default");
        HttpHelper.json(ex, 200, Map.of("ok", true, "sent", true));
    }
}
