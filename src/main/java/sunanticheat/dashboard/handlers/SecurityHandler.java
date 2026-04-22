package sunanticheat.dashboard.handlers;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.SunAntiCheat;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.alerts.AlertStore;
import sunanticheat.report.ReportEntry;
import sunanticheat.report.ReportStorage;
import sunanticheat.sanction.SanctionHistoryEntry;
import sunanticheat.sanction.SanctionHistoryStorage;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public final class SecurityHandler {

    private final SunAntiCheat plugin;
    private final SanctionHistoryStorage sanctionHistory;
    private final ReportStorage reportStorage;
    private final AlertStore alertStore;

    public SecurityHandler(SunAntiCheat plugin,
                           SanctionHistoryStorage sanctionHistory,
                           ReportStorage reportStorage,
                           AlertStore alertStore) {
        this.plugin = plugin;
        this.sanctionHistory = sanctionHistory;
        this.reportStorage = reportStorage;
        this.alertStore = alertStore;
    }

    /** GET /api/security/alerts */
    public void getAlerts(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        int limit = HttpHelper.queryInt(ex, "limit", 50);
        HttpHelper.json(ex, 200, alertStore.getRecent(limit));
    }

    /** GET /api/security/sanctions */
    public void getSanctions(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        List<Map<String, Object>> list = new ArrayList<>();
        for (SanctionHistoryEntry e : sanctionHistory.getAll()) {
            list.add(sanctionToMap(e));
        }
        HttpHelper.json(ex, 200, list);
    }

    /** POST /api/security/sanctions — MOD+ (modération normale) */
    public void createSanction(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireMod(ex, user)) return;

        JsonObject req;
        try { req = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }

        String target  = req.has("player")  ? req.get("player").getAsString() : "";
        String type    = req.has("type")    ? req.get("type").getAsString()   : "";
        String reason  = req.has("reason")  ? req.get("reason").getAsString() : "Raison non précisée";

        if (target.isEmpty() || type.isEmpty()) {
            HttpHelper.error(ex, 400, "Champs player et type requis"); return;
        }

        String cmd = buildSanctionCommand(type, target, reason);
        if (cmd == null) { HttpHelper.error(ex, 400, "Type de sanction inconnu: " + type); return; }

        final String finalCmd = cmd;
        var done = new CompletableFuture<Void>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            plugin.getLogger().info("[Dashboard] Sanction par " + user.username() + ": " + finalCmd);
            Bukkit.dispatchCommand(Bukkit.getConsoleSender(), finalCmd);
            done.complete(null);
        });
        done.join();

        HttpHelper.json(ex, 200, Map.of("success", true, "command", finalCmd));
    }

    /** DELETE /api/security/sanctions/:id — MOD+ (révocation de sanction = modération) */
    public void revokeSanction(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireMod(ex, user)) return;
        // La révocation dépend de la structure interne de SanctionHistoryStorage
        // On expose l'info et laisse l'admin utiliser la commande /pardon
        HttpHelper.json(ex, 200, Map.of("message", "Utilisez /pardon <joueur> en console pour révoquer un ban."));
    }

    /** GET /api/security/reports */
    public void getReports(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        List<Map<String, Object>> list = new ArrayList<>();
        for (ReportEntry e : reportStorage.getAll()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",         e.getId());
            m.put("reporterName", e.getReporterName());
            m.put("targetName", e.getReportedName());
            m.put("reason",     e.getReason());
            m.put("timestamp",  e.getTimestamp());
            m.put("resolved",   e.isResolved());
            list.add(m);
        }
        HttpHelper.json(ex, 200, list);
    }

    /** POST /api/security/reports/:id/resolve — MOD+ (traitement des reports) */
    public void resolveReport(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireMod(ex, user)) return;
        reportStorage.markResolved(id);
        HttpHelper.json(ex, 200, Map.of("success", true));
    }

    /** GET /api/security/chestscan/status */
    public void chestscanStatus(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        var scanner = plugin.getWorldContainerWeaponMechanicsScanner();
        boolean running = scanner.isRunning();
        var last = scanner.getLastResult();
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("running", running);
        out.put("lastResult", last != null ? last.toMap() : null);
        HttpHelper.json(ex, 200, out);
    }

    /** POST /api/security/chestscan/start — MOD+ (outil de détection d'anticheat) */
    public void chestscanStart(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireMod(ex, user)) return;

        JsonObject req;
        try { req = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }

        List<String> worldNames = new ArrayList<>();
        if (req.has("worlds")) {
            req.get("worlds").getAsJsonArray().forEach(w -> worldNames.add(w.getAsString()));
        }
        if (worldNames.isEmpty()) { HttpHelper.error(ex, 400, "Liste de mondes vide"); return; }

        var done = new CompletableFuture<Boolean>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            List<org.bukkit.World> targets = new ArrayList<>();
            for (String n : worldNames) {
                org.bukkit.World w = Bukkit.getWorld(n);
                if (w != null) targets.add(w);
            }
            boolean started = plugin.getWorldContainerWeaponMechanicsScanner()
                    .startScan(Bukkit.getConsoleSender(), targets);
            done.complete(started);
        });

        HttpHelper.json(ex, 200, Map.of("started", done.join()));
    }

    /** GET /api/security/config */
    public void getConfig(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        var cfg = plugin.getConfig();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("killaura_enabled",      cfg.getBoolean("killaura.enabled", true));
        result.put("killaura_max_reach",    cfg.getDouble("killaura.max-reach", 3.5));
        result.put("killaura_max_cps",      cfg.getInt("killaura.max-cps", 15));
        result.put("freecam_cancel",        cfg.getBoolean("freecam.cancel-suspicious-actions", false));
        result.put("freecam_max_reach",     cfg.getDouble("freecam.max-reach", 6.0));
        result.put("xray_min_blocks",       cfg.getInt("xray.min-blocks-for-index", 150));
        result.put("blocklog_enabled",      cfg.getBoolean("blocklog.enabled", true));
        result.put("discord_enabled",       cfg.getBoolean("discord.enabled", false));
        result.put("discord_url",           cfg.getString("discord.webhook-url", ""));
        HttpHelper.json(ex, 200, result);
    }

    /** PATCH /api/security/config */
    public void patchConfig(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requireAdmin(ex, user)) return;

        JsonObject req;
        try { req = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }

        var cfg = plugin.getConfig();
        if (req.has("killaura_enabled"))   cfg.set("killaura.enabled", req.get("killaura_enabled").getAsBoolean());
        if (req.has("killaura_max_reach")) cfg.set("killaura.max-reach", req.get("killaura_max_reach").getAsDouble());
        if (req.has("killaura_max_cps"))   cfg.set("killaura.max-cps", req.get("killaura_max_cps").getAsInt());
        if (req.has("freecam_cancel"))     cfg.set("freecam.cancel-suspicious-actions", req.get("freecam_cancel").getAsBoolean());
        if (req.has("freecam_max_reach"))  cfg.set("freecam.max-reach", req.get("freecam_max_reach").getAsDouble());
        if (req.has("xray_min_blocks"))    cfg.set("xray.min-blocks-for-index", req.get("xray_min_blocks").getAsInt());
        if (req.has("discord_enabled"))    cfg.set("discord.enabled", req.get("discord_enabled").getAsBoolean());
        if (req.has("discord_url"))        cfg.set("discord.webhook-url", req.get("discord_url").getAsString());

        plugin.saveConfig();
        plugin.reloadDiscordWebhookFromConfig();
        HttpHelper.json(ex, 200, Map.of("success", true));
    }

    private static Map<String, Object> sanctionToMap(SanctionHistoryEntry e) {
        // id synthétique basé sur contenu (SanctionHistoryEntry n'a pas d'UUID propre)
        String syntheticId = java.util.UUID.nameUUIDFromBytes(
                (e.getTargetUuid() + ":" + e.getTimestamp()).getBytes()
        ).toString();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",        syntheticId);
        m.put("playerName", e.getTargetName());
        m.put("type",      e.getType());
        m.put("reason",    e.getReason());
        m.put("staffName", e.getStaffName());
        m.put("timestamp", e.getTimestamp());
        m.put("durationMs", e.getDurationMillis());
        m.put("active",    e.getDurationMillis() == 0 || System.currentTimeMillis() < e.getTimestamp() + e.getDurationMillis());
        return m;
    }

    private static String buildSanctionCommand(String type, String target, String reason) {
        return switch (type.toUpperCase(Locale.ROOT)) {
            case "BAN"  -> "ban " + target + " " + reason;
            case "KICK" -> "kick " + target + " " + reason;
            case "MUTE" -> "mute " + target + " " + reason;
            default -> null;
        };
    }
}
