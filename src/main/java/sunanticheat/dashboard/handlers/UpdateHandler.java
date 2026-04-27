package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.updater.UpdateManager;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GET  /api/update/status  — état de l'auto-update
 * POST /api/update/check   — déclenche une vérification immédiate (ADMIN)
 */
public final class UpdateHandler {

    private final UpdateManager updateManager;

    public UpdateHandler(UpdateManager updateManager) {
        this.updateManager = updateManager;
    }

    public void status(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users)
            throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("currentVersion",     updateManager.getCurrentVersion());
        out.put("latestVersion",      updateManager.getLatestVersion());
        out.put("updateAvailable",    updateManager.isUpdateAvailable());
        out.put("downloadedPending",  updateManager.isDownloadedPending());
        out.put("autoUpdateEnabled",
                updateManager.getCurrentVersion() != null); // toujours true si UpdateManager actif
        HttpHelper.json(ex, 200, out);
    }

    public void check(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users)
            throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.ADMIN) == null) return;
        updateManager.triggerCheck();
        HttpHelper.json(ex, 202, Map.of("message", "Vérification lancée en arrière-plan."));
    }
}
