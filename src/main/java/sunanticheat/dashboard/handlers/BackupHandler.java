package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.backup.BackupManager;

import java.io.IOException;
import java.util.Map;

public final class BackupHandler {

    private final BackupManager manager;

    public BackupHandler(BackupManager manager) { this.manager = manager; }

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        HttpHelper.json(ex, 200, manager.listByWorld());
    }

    @SuppressWarnings("unchecked")
    public void create(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        String world = body != null ? (String) body.get("world") : null;
        if (world == null) { HttpHelper.error(ex, 400, "world manquant"); return; }
        try {
            Map<String, Object> res = manager.createBackup(world).get(10, java.util.concurrent.TimeUnit.MINUTES);
            HttpHelper.json(ex, 201, res);
        } catch (Exception e) {
            HttpHelper.error(ex, 500, "Backup échoué: " + e.getMessage());
        }
    }

    public void delete(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        String world = HttpHelper.queryParam(ex, "world");
        String filename = HttpHelper.queryParam(ex, "filename");
        if (world == null || filename == null) { HttpHelper.error(ex, 400, "world+filename requis"); return; }
        boolean ok = manager.deleteBackup(world, filename);
        if (!ok) { HttpHelper.error(ex, 404, "Backup introuvable"); return; }
        HttpHelper.noContent(ex);
    }
}
