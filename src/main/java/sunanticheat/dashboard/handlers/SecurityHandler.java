package sunanticheat.dashboard.handlers;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.SunAntiCheat;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.alerts.AlertStore;
import sunanticheat.report.ReportEntry;
import sunanticheat.report.ReportStorage;
import sunanticheat.sanction.SanctionHistoryEntry;
import sunanticheat.sanction.SanctionHistoryStorage;
import sunanticheat.sanction.SanctionService;

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
        if (!HttpHelper.requirePermission(ex, user, Permission.MODERATE_PLAYERS)) return;

        JsonObject req;
        try { req = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }

        String target  = req.has("player")  ? req.get("player").getAsString() : "";
        String type    = req.has("type")    ? req.get("type").getAsString()   : "";
        String reason  = req.has("reason")  ? req.get("reason").getAsString() : "Raison non précisée";
        String message = req.has("message") ? req.get("message").getAsString() : reason;
        long durationMs = req.has("durationMs") ? req.get("durationMs").getAsLong() : 0L;
        double amount  = req.has("amount")  ? req.get("amount").getAsDouble() : 5.0;
        int ticks      = req.has("ticks")   ? req.get("ticks").getAsInt()     : 100;

        if (target.isEmpty() || type.isEmpty()) {
            HttpHelper.error(ex, 400, "Champs player et type requis"); return;
        }

        SanctionService svc = plugin instanceof SunAntiCheat sac ? sac.getSanctionService() : null;
        String typeUpper = type.toUpperCase(Locale.ROOT);

        // Types ne nécessitant pas le joueur en ligne
        if ("UNBAN".equals(typeUpper)) {
            if (svc != null) {
                var done = new CompletableFuture<Void>();
                Bukkit.getScheduler().runTask(plugin, () -> { svc.unban(target); done.complete(null); });
                done.join();
            } else {
                var done = new CompletableFuture<Void>();
                Bukkit.getScheduler().runTask(plugin, () -> {
                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "pardon " + target);
                    done.complete(null);
                });
                done.join();
            }
            plugin.getLogger().info("[Dashboard] Sanction UNBAN sur " + target + " par " + user.username());
            HttpHelper.json(ex, 200, Map.of("success", true, "type", typeUpper, "player", target)); return;
        }

        // Types nécessitant un joueur en ligne (ou ban hors ligne par commande)
        var result = new CompletableFuture<Map<String, Object>>();
        final long endMillis = durationMs > 0 ? System.currentTimeMillis() + durationMs : 0L;
        Bukkit.getScheduler().runTask(plugin, () -> {
            try {
                Player p = Bukkit.getPlayerExact(target);
                plugin.getLogger().info("[Dashboard] Sanction " + typeUpper + " sur " + target + " par " + user.username());
                switch (typeUpper) {
                    case "BAN" -> {
                        if (svc != null && p != null) svc.banPermanent(p, reason, user.username());
                        else Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "ban " + target + " " + reason);
                    }
                    case "BAN_TEMP" -> {
                        if (svc != null && p != null) svc.banTemporary(p, reason, endMillis, user.username());
                        else Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "ban-ip " + target + " " + reason);
                    }
                    case "KICK" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.kick(p, reason);
                        else p.kickPlayer(reason);
                    }
                    case "MUTE" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.mutePermanent(p);
                    }
                    case "MUTE_TEMP" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.muteTemporary(p, endMillis);
                    }
                    case "UNMUTE" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.unmute(p);
                    }
                    case "FREEZE" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.freeze(p);
                    }
                    case "UNFREEZE" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.unfreeze(p);
                    }
                    case "WARN" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.warn(p, message);
                    }
                    case "SPECTATOR" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.setSpectator(p);
                    }
                    case "SURVIVAL" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.setSurvival(p);
                    }
                    case "STRIP" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.stripInventory(p);
                    }
                    case "CLEAR" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.clearInventory(p);
                    }
                    case "TELEPORT_SPAWN" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.teleportSpawn(p);
                    }
                    case "HEAL" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.heal(p);
                    }
                    case "FEED" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.feed(p);
                    }
                    case "DAMAGE" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.damage(p, amount);
                    }
                    case "BURN" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.burn(p, ticks);
                    }
                    case "LIGHTNING" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.lightningEffect(p);
                    }
                    case "MESSAGE" -> {
                        if (p == null) { result.complete(Map.of("success", false, "error", "Joueur non connecté")); return; }
                        if (svc != null) svc.sendCustomMessage(p, message);
                    }
                    default -> { result.complete(Map.of("success", false, "error", "Type de sanction inconnu: " + type)); return; }
                }
                result.complete(Map.of("success", true, "type", typeUpper, "player", target));
            } catch (Exception ex2) {
                result.complete(Map.of("success", false, "error", ex2.getMessage() != null ? ex2.getMessage() : "erreur interne"));
            }
        });

        Map<String, Object> res = result.join();
        boolean ok = Boolean.TRUE.equals(res.get("success"));
        HttpHelper.json(ex, ok ? 200 : 400, res);
    }

    /** DELETE /api/security/sanctions/:id — MOD+ révoque une sanction (unban par nom de joueur encodé en id). */
    public void revokeSanction(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser user = HttpHelper.authenticate(ex, jwt, users);
        if (user == null) return;
        if (!HttpHelper.requirePermission(ex, user, Permission.MODERATE_PLAYERS)) return;
        if (id == null || id.isBlank()) { HttpHelper.error(ex, 400, "id requis"); return; }

        SanctionService svc = plugin instanceof SunAntiCheat sac ? sac.getSanctionService() : null;
        // id = synthetic UUID. We look up the entry to get the player name.
        SanctionHistoryEntry entry = sanctionHistory.getAll().stream()
                .filter(e -> {
                    String synId = java.util.UUID.nameUUIDFromBytes(
                            (e.getTargetUuid() + ":" + e.getTimestamp()).getBytes()).toString();
                    return synId.equals(id);
                }).findFirst().orElse(null);
        if (entry == null) { HttpHelper.error(ex, 404, "Sanction introuvable"); return; }

        String playerName = entry.getTargetName();
        var done = new CompletableFuture<Void>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (svc != null) svc.unban(playerName);
            else Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "pardon " + playerName);
            done.complete(null);
        });
        done.join();
        plugin.getLogger().info("[Dashboard] Révocation sanction sur " + playerName + " par " + user.username());
        HttpHelper.json(ex, 200, Map.of("success", true, "player", playerName));
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
        if (!HttpHelper.requirePermission(ex, user, Permission.MODERATE_PLAYERS)) return;
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
        if (!HttpHelper.requirePermission(ex, user, Permission.CHESTSCAN_RUN)) return;

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
        if (!HttpHelper.requirePermission(ex, user, Permission.SECURITY_CONFIG)) return;

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

}
