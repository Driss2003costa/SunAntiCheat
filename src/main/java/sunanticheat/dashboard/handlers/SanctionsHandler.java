package sunanticheat.dashboard.handlers;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.sanctions.KickScreenFormatter;
import sunanticheat.dashboard.sanctions.SanctionEntry;
import sunanticheat.dashboard.sanctions.SanctionService;
import sunanticheat.dashboard.sanctions.SanctionTemplate;
import sunanticheat.dashboard.sanctions.SanctionType;
import sunanticheat.dashboard.sanctions.Severity;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.*;

/**
 * Endpoints REST pour la gestion des sanctions (kick / ban / mute / warn) :
 *
 *  GET    /api/sanctions              → liste (filtres : target, type, issuedBy, activeOnly, limit, offset)
 *  POST   /api/sanctions              → émet une nouvelle sanction
 *  POST   /api/sanctions/{id}/revoke  → lève une sanction
 *  GET    /api/sanctions/templates    → liste des templates prédéfinis
 *  POST   /api/sanctions/templates    → remplace les templates (ADMIN only)
 *  GET    /api/sanctions/stats        → statistiques agrégées
 *  POST   /api/sanctions/preview      → génère le disconnect screen (preview UI)
 */
public final class SanctionsHandler {

    private final SanctionService service;

    public SanctionsHandler(SanctionService service) {
        this.service = service;
    }

    // ── List ────────────────────────────────────────────────────────────────

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;

        String target   = HttpHelper.queryParam(ex, "target");
        String type     = HttpHelper.queryParam(ex, "type");
        String issuedBy = HttpHelper.queryParam(ex, "issuedBy");
        Boolean activeOnly = HttpHelper.queryParam(ex, "activeOnly") != null
                ? "true".equalsIgnoreCase(HttpHelper.queryParam(ex, "activeOnly")) : null;
        int limit  = Math.max(1, Math.min(500, HttpHelper.queryInt(ex, "limit", 100)));
        int offset = Math.max(0, HttpHelper.queryInt(ex, "offset", 0));

        List<SanctionEntry> entries = service.store().list(target, type, issuedBy, activeOnly, limit, offset);
        int total = service.store().count(target, type, issuedBy, activeOnly);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entries", entries);
        out.put("total", total);
        out.put("limit", limit);
        out.put("offset", offset);
        out.put("hasMore", offset + entries.size() < total);
        HttpHelper.json(ex, 200, out);
    }

    // ── Issue ───────────────────────────────────────────────────────────────

    public void issue(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.MODERATE_PLAYERS)) return;

        JsonObject body;
        try { body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        String typeStr  = jstr(body, "type", "BAN");
        String sevStr   = jstr(body, "severity", "MEDIUM");
        String category = jstr(body, "category", "OTHER");
        String target   = jstr(body, "target", null);
        String reason   = jstr(body, "reason", "Aucune raison");
        String evidence = jstr(body, "evidenceUrl", null);
        String notes    = jstr(body, "notes", null);
        String tplId    = jstr(body, "templateId", null);
        long durationMs = body.has("durationMs") && !body.get("durationMs").isJsonNull()
                ? body.get("durationMs").getAsLong() : 0L;
        boolean silent = body.has("silent") && body.get("silent").getAsBoolean();

        if (target == null || target.isBlank()) {
            HttpHelper.error(ex, 400, "Champ 'target' requis (nom du joueur)"); return;
        }

        SanctionType type;
        try { type = SanctionType.valueOf(typeStr.toUpperCase()); }
        catch (Exception e) { HttpHelper.error(ex, 400, "type invalide"); return; }

        Severity sev;
        try { sev = Severity.valueOf(sevStr.toUpperCase()); }
        catch (Exception e) { sev = Severity.MEDIUM; }

        // Récupère UUID + IP via Bukkit
        String uuid = null;
        String ip = null;
        Player online = Bukkit.getPlayerExact(target);
        if (online != null) {
            uuid = online.getUniqueId().toString();
            target = online.getName(); // garde le casing exact
            try {
                InetSocketAddress addr = online.getAddress();
                if (addr != null && addr.getAddress() != null) ip = addr.getAddress().getHostAddress();
            } catch (Throwable ignored) {}
        } else {
            OfflinePlayer off = Bukkit.getOfflinePlayer(target);
            if (off != null && off.getUniqueId() != null) {
                uuid = off.getUniqueId().toString();
                if (off.getName() != null) target = off.getName();
            }
        }

        SanctionEntry entry = service.issue(type, sev, category, uuid, target, ip,
                u.username(), durationMs, reason, evidence, notes, silent, tplId);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        out.put("sanction", entry);
        HttpHelper.json(ex, 200, out);
    }

    // ── Revoke ──────────────────────────────────────────────────────────────

    public void revoke(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.MODERATE_PLAYERS)) return;

        JsonObject body = null;
        try { body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); } catch (Exception ignored) {}
        String reason = body != null && body.has("reason") ? body.get("reason").getAsString() : "";

        boolean ok = service.revoke(id, u.username(), reason);
        if (!ok) { HttpHelper.error(ex, 404, "Sanction inexistante ou déjà levée"); return; }
        HttpHelper.json(ex, 200, Map.of("success", true));
    }

    // ── Templates ───────────────────────────────────────────────────────────

    public void listTemplates(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        HttpHelper.json(ex, 200, service.store().listTemplates());
    }

    public void saveTemplates(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        try {
            String body = HttpHelper.body(ex);
            java.lang.reflect.Type listType = new com.google.gson.reflect.TypeToken<List<SanctionTemplate>>(){}.getType();
            List<SanctionTemplate> list = HttpHelper.GSON.fromJson(body, listType);
            if (list == null) { HttpHelper.error(ex, 400, "Liste invalide"); return; }
            service.store().saveTemplates(list);
            HttpHelper.json(ex, 200, Map.of("success", true, "count", list.size()));
        } catch (Exception e) {
            HttpHelper.error(ex, 400, "JSON invalide");
        }
    }

    // ── Stats ───────────────────────────────────────────────────────────────

    public void stats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        int days = Math.max(1, Math.min(90, HttpHelper.queryInt(ex, "days", 30)));
        Map<String, Object> stats = service.store().stats(days);
        stats.put("days", days);
        HttpHelper.json(ex, 200, stats);
    }

    // ── Preview ─────────────────────────────────────────────────────────────

    /** Génère le disconnect screen pour un payload donné, sans rien sauver. */
    public void preview(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;

        JsonObject body;
        try { body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), JsonObject.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        SanctionType type;
        try { type = SanctionType.valueOf(jstr(body, "type", "BAN").toUpperCase()); }
        catch (Exception e) { type = SanctionType.BAN; }
        Severity sev;
        try { sev = Severity.valueOf(jstr(body, "severity", "MEDIUM").toUpperCase()); }
        catch (Exception e) { sev = Severity.MEDIUM; }

        SanctionEntry e = SanctionEntry.create(type, sev, jstr(body, "category", "OTHER"),
                null, jstr(body, "target", "PlayerName"), null, u.username(),
                body.has("durationMs") && !body.get("durationMs").isJsonNull() ? body.get("durationMs").getAsLong() : 0L,
                jstr(body, "reason", "..."), null, null, false, null);

        String screen;
        if (type == SanctionType.MUTE)         screen = service.formatter().formatMutedMessage(e);
        else if (type == SanctionType.KICK)    screen = service.formatter().formatKick(e);
        else                                    screen = service.formatter().formatBan(e);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("screen", screen);
        out.put("durationFormatted", e.isPermanent() ? "PERMANENT" : KickScreenFormatter.formatDuration(e.expiresAt - e.issuedAt));
        HttpHelper.json(ex, 200, out);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static String jstr(JsonObject o, String key, String def) {
        if (!o.has(key) || o.get(key).isJsonNull()) return def;
        try { return o.get(key).getAsString(); } catch (Exception e) { return def; }
    }
}
