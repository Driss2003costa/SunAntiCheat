package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.panic.PanicMode;

import java.io.IOException;
import java.util.Map;

public final class PanicHandler {
    private final PanicMode panic;
    public PanicHandler(PanicMode panic) { this.panic = panic; }

    public void status(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        HttpHelper.json(ex, 200, panic.snapshot());
    }

    @SuppressWarnings("unchecked")
    public void activate(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.PANIC)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        String reason = body != null ? (String) body.get("reason") : null;
        HttpHelper.json(ex, 200, panic.activate(u.username(), reason));
    }

    public void deactivate(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.PANIC)) return;
        HttpHelper.json(ex, 200, panic.deactivate(u.username()));
    }
}
