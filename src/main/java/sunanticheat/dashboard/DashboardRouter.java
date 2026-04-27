package sunanticheat.dashboard;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import sunanticheat.dashboard.handlers.*;

import java.io.IOException;
import java.util.Map;

/**
 * Routeur central de l'API REST.
 * Monte sur /api/ dans le HttpServer.
 */
public final class DashboardRouter implements HttpHandler {

    private final JwtUtil jwt;
    private final Map<String, DashboardUser> users;

    private final AuthHandler authHandler;
    private final ServerHandler serverHandler;
    private final SecurityHandler securityHandler;
    private final EconomyHandler economyHandler;
    private final AnalyticsHandler analyticsHandler;
    private final ScheduledTaskHandler taskHandler;
    private final PluginManagerHandler pluginHandler;
    private final ConfigEditorHandler configHandler;
    private final RebootHandler rebootHandler;
    private final BackupHandler backupHandler;
    private final PanicHandler panicHandler;
    private final HoneypotHandler honeypotHandler;
    private final ToxicChatHandler toxicChatHandler;
    private final EventCalendarHandler eventCalendarHandler;
    private final QuestHandler questHandler;
    private final ExperimentHandler experimentHandler;
    private final AiHandler aiHandler;
    private final UserHandler userHandler;
    private final CrateHandler crateHandler;
    private final DailyRewardHandler dailyRewardHandler;
    private final AnnouncementHandler announcementHandler;
    private final LuckPermsHandler luckPermsHandler;
    private final ShopHandler shopHandler;
    private final VipHandler vipHandler;
    private final VipPublicHandler vipPublicHandler;
    private final PermissionsHandler permsHandler;
    private final MobileHandler mobileHandler;
    private final AuditHandler auditHandler;
    private final PlayerProfileHandler profileHandler;
    private final JobsHandler jobsHandler;

    public DashboardRouter(JwtUtil jwt,
                           Map<String, DashboardUser> users,
                           AuthHandler authHandler,
                           ServerHandler serverHandler,
                           SecurityHandler securityHandler,
                           EconomyHandler economyHandler,
                           AnalyticsHandler analyticsHandler,
                           ScheduledTaskHandler taskHandler,
                           PluginManagerHandler pluginHandler,
                           ConfigEditorHandler configHandler,
                           RebootHandler rebootHandler,
                           BackupHandler backupHandler,
                           PanicHandler panicHandler,
                           HoneypotHandler honeypotHandler,
                           ToxicChatHandler toxicChatHandler,
                           EventCalendarHandler eventCalendarHandler,
                           QuestHandler questHandler,
                           ExperimentHandler experimentHandler,
                           AiHandler aiHandler,
                           UserHandler userHandler,
                           CrateHandler crateHandler,
                           DailyRewardHandler dailyRewardHandler,
                           AnnouncementHandler announcementHandler,
                           LuckPermsHandler luckPermsHandler,
                           ShopHandler shopHandler,
                           VipHandler vipHandler,
                           VipPublicHandler vipPublicHandler,
                           PermissionsHandler permsHandler,
                           MobileHandler mobileHandler,
                           AuditHandler auditHandler,
                           PlayerProfileHandler profileHandler,
                           JobsHandler jobsHandler) {
        this.jwt = jwt;
        this.users = users;
        this.authHandler = authHandler;
        this.serverHandler = serverHandler;
        this.securityHandler = securityHandler;
        this.economyHandler = economyHandler;
        this.analyticsHandler = analyticsHandler;
        this.taskHandler = taskHandler;
        this.pluginHandler = pluginHandler;
        this.configHandler = configHandler;
        this.rebootHandler = rebootHandler;
        this.backupHandler = backupHandler;
        this.panicHandler = panicHandler;
        this.honeypotHandler = honeypotHandler;
        this.toxicChatHandler = toxicChatHandler;
        this.eventCalendarHandler = eventCalendarHandler;
        this.questHandler = questHandler;
        this.experimentHandler = experimentHandler;
        this.aiHandler = aiHandler;
        this.userHandler = userHandler;
        this.crateHandler = crateHandler;
        this.dailyRewardHandler = dailyRewardHandler;
        this.announcementHandler = announcementHandler;
        this.luckPermsHandler = luckPermsHandler;
        this.shopHandler = shopHandler;
        this.vipHandler = vipHandler;
        this.vipPublicHandler = vipPublicHandler;
        this.permsHandler = permsHandler;
        this.mobileHandler = mobileHandler;
        this.auditHandler = auditHandler;
        this.profileHandler = profileHandler;
        this.jobsHandler = jobsHandler;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if ("OPTIONS".equals(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type,Authorization");
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();

        try {
            // ── Routes 100% publiques (webhooks Stripe/PayPal, page de vente publique) ──
            // PAS d'auth, PAS de pare-feu VIEWER. Ces handlers gèrent eux-mêmes
            // la sécurité (signature webhook, rate-limit IP).
            if (path.startsWith("/api/public/")) {
                dispatch(exchange, path, method);
                return;
            }

            // ── Pare-feu VIEWER ────────────────────────────────────────────────
            // Les VIEWER ne peuvent pas effectuer d'actions d'écriture,
            // sauf les routes explicitement autorisées ci-dessous.
            if (!isViewerAllowedWrite(path, method)) {
                DashboardUser u = HttpHelper.authenticate(exchange, jwt, users);
                if (u == null) return; // 401 déjà envoyé
                if (u.role() == DashboardRole.VIEWER) {
                    HttpHelper.error(exchange, 403,
                        "Les comptes VIEWER sont en lecture seule. Contactez un administrateur.");
                    return;
                }
            }
            dispatch(exchange, path, method);
        } catch (Throwable t) {
            HttpHelper.error(exchange, 500, "Erreur interne: " + t.getMessage());
        }
    }

    private void dispatch(HttpExchange ex, String path, String method) throws IOException {

        // ── Auth ──────────────────────────────────────────────────────────────
        if (eq(path, "/api/auth/login") && POST(method))  { authHandler.login(ex); return; }
        if (eq(path, "/api/auth/me")    && GET(method))   { authHandler.me(ex, jwt, users); return; }
        if (eq(path, "/api/auth/totp/setup")   && POST(method)) { authHandler.totpSetup(ex, jwt, users); return; }
        if (eq(path, "/api/auth/totp/verify")  && POST(method)) { authHandler.totpVerify(ex, jwt, users); return; }
        if (eq(path, "/api/auth/totp/disable") && POST(method)) { authHandler.totpDisable(ex, jwt, users); return; }

        // ── Audit log ─────────────────────────────────────────────────────────
        if (eq(path, "/api/audit")          && GET(method))    { auditHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/audit/actions")  && GET(method))    { auditHandler.actions(ex, jwt, users); return; }

        // ── Jobs (Jobs Reborn) ────────────────────────────────────────────────
        if (eq(path, "/api/jobs/overview")  && GET(method))    { jobsHandler.overview(ex, jwt, users); return; }
        if (eq(path, "/api/jobs/active")    && GET(method))    { jobsHandler.active(ex, jwt, users); return; }
        if (eq(path, "/api/jobs/history")   && GET(method))    { jobsHandler.history(ex, jwt, users); return; }
        if (path.startsWith("/api/jobs/player/") && GET(method)) {
            jobsHandler.player(ex, jwt, users, path.substring("/api/jobs/player/".length())); return;
        }

        // ── Player profile (agrégation) ──────────────────────────────────────
        if (path.startsWith("/api/players/") && path.endsWith("/profile") && GET(method)) {
            profileHandler.profile(ex, jwt, users, id(path, "/api/players/", "/profile")); return;
        }
        if (path.startsWith("/api/players/") && path.endsWith("/notes") && POST(method)) {
            profileHandler.addNote(ex, jwt, users, id(path, "/api/players/", "/notes")); return;
        }
        if (path.matches("/api/players/[^/]+/notes/[^/]+") && DELETE(method)) {
            String rest = path.substring("/api/players/".length());
            int s = rest.indexOf("/notes/");
            profileHandler.deleteNote(ex, jwt, users,
                    rest.substring(0, s), rest.substring(s + "/notes/".length())); return;
        }

        // ── Server ────────────────────────────────────────────────────────────
        if (eq(path, "/api/server/status")  && GET(method))  { serverHandler.status(ex, jwt, users); return; }
        if (eq(path, "/api/server/players") && GET(method))  { serverHandler.players(ex, jwt, users); return; }
        if (eq(path, "/api/server/worlds")  && GET(method))  { serverHandler.worlds(ex, jwt, users); return; }
        if (eq(path, "/api/server/command") && POST(method)) { serverHandler.command(ex, jwt, users); return; }
        if (eq(path, "/api/server/kick")    && POST(method)) { serverHandler.kick(ex, jwt, users); return; }
        if (eq(path, "/api/server/ban")     && POST(method)) { serverHandler.ban(ex, jwt, users); return; }
        if (path.startsWith("/api/server/worlds/") && path.endsWith("/pvp") && POST(method)) {
            String wName = path.substring("/api/server/worlds/".length(), path.length() - "/pvp".length());
            serverHandler.togglePvp(ex, jwt, users, wName); return;
        }

        // ── Security ──────────────────────────────────────────────────────────
        if (eq(path, "/api/security/config")           && GET(method))   { securityHandler.getConfig(ex, jwt, users); return; }
        if (eq(path, "/api/security/config")           && PATCH(method)) { securityHandler.patchConfig(ex, jwt, users); return; }
        if (eq(path, "/api/security/alerts")           && GET(method))   { securityHandler.getAlerts(ex, jwt, users); return; }
        if (eq(path, "/api/security/sanctions")        && GET(method))   { securityHandler.getSanctions(ex, jwt, users); return; }
        if (eq(path, "/api/security/sanctions")        && POST(method))  { securityHandler.createSanction(ex, jwt, users); return; }
        if (eq(path, "/api/security/reports")          && GET(method))   { securityHandler.getReports(ex, jwt, users); return; }
        if (eq(path, "/api/security/chestscan/status") && GET(method))   { securityHandler.chestscanStatus(ex, jwt, users); return; }
        if (eq(path, "/api/security/chestscan/start")  && POST(method))  { securityHandler.chestscanStart(ex, jwt, users); return; }
        if (path.startsWith("/api/security/sanctions/") && DELETE(method)) { securityHandler.revokeSanction(ex, jwt, users, id(path, "/api/security/sanctions/")); return; }
        if (path.startsWith("/api/security/reports/")  && POST(method))   { securityHandler.resolveReport(ex, jwt, users, id(path, "/api/security/reports/")); return; }

        // ── Economy ───────────────────────────────────────────────────────────
        if (eq(path, "/api/economy/summary")              && GET(method)) { economyHandler.summary(ex, jwt, users); return; }
        if (eq(path, "/api/economy/top-rich")             && GET(method)) { economyHandler.topRich(ex, jwt, users); return; }
        if (eq(path, "/api/economy/money-over-time")      && GET(method)) { economyHandler.moneyOverTime(ex, jwt, users); return; }
        if (eq(path, "/api/economy/transactions")         && GET(method)) { economyHandler.transactions(ex, jwt, users); return; }
        if (eq(path, "/api/economy/transactions/stats")   && GET(method)) { economyHandler.transactionStats(ex, jwt, users); return; }
        if (eq(path, "/api/economy/transactions/export")  && GET(method)) { economyHandler.exportCsv(ex, jwt, users); return; }

        // ── Analytics ─────────────────────────────────────────────────────────
        if (eq(path, "/api/analytics/connections")      && GET(method)) { analyticsHandler.connections(ex, jwt, users); return; }
        if (eq(path, "/api/analytics/session-duration") && GET(method)) { analyticsHandler.sessionDuration(ex, jwt, users); return; }
        if (eq(path, "/api/analytics/new-players")      && GET(method)) { analyticsHandler.newPlayers(ex, jwt, users); return; }
        if (eq(path, "/api/analytics/tps")              && GET(method)) { analyticsHandler.tps(ex, jwt, users); return; }
        if (eq(path, "/api/analytics/ram")              && GET(method)) { analyticsHandler.ram(ex, jwt, users); return; }
        if (eq(path, "/api/analytics/alerts")           && GET(method)) { analyticsHandler.alertsChart(ex, jwt, users); return; }

        // ── Scheduled Tasks ───────────────────────────────────────────────────
        if (eq(path, "/api/tasks") && GET(method))  { taskHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/tasks") && POST(method)) { taskHandler.create(ex, jwt, users); return; }
        if (path.startsWith("/api/tasks/") && path.endsWith("/run") && POST(method)) {
            String rest = path.substring("/api/tasks/".length());
            String id = rest.substring(0, rest.length() - "/run".length());
            taskHandler.run(ex, jwt, users, id); return;
        }
        if (path.startsWith("/api/tasks/") && PATCH(method))  { taskHandler.update(ex, jwt, users, id(path, "/api/tasks/")); return; }
        if (path.startsWith("/api/tasks/") && DELETE(method)) { taskHandler.delete(ex, jwt, users, id(path, "/api/tasks/")); return; }

        // ── Plugin Manager ────────────────────────────────────────────────────
        if (eq(path, "/api/plugins") && GET(method)) { pluginHandler.list(ex, jwt, users); return; }
        if (path.startsWith("/api/plugins/") && path.endsWith("/toggle") && POST(method)) {
            String name = path.substring("/api/plugins/".length(), path.length() - "/toggle".length());
            pluginHandler.toggle(ex, jwt, users, name); return;
        }
        if (path.startsWith("/api/plugins/") && path.endsWith("/reload") && POST(method)) {
            String name = path.substring("/api/plugins/".length(), path.length() - "/reload".length());
            pluginHandler.reload(ex, jwt, users, name); return;
        }
        if (path.startsWith("/api/plugins/") && path.endsWith("/reloadConfig") && POST(method)) {
            String name = path.substring("/api/plugins/".length(), path.length() - "/reloadConfig".length());
            pluginHandler.reloadConfig(ex, jwt, users, name); return;
        }

        // ── Config Editor ─────────────────────────────────────────────────────
        if (eq(path, "/api/configs/tree")     && GET(method))  { configHandler.tree(ex, jwt, users); return; }
        if (eq(path, "/api/configs/read")     && GET(method))  { configHandler.read(ex, jwt, users); return; }
        if (eq(path, "/api/configs/write")    && POST(method)) { configHandler.write(ex, jwt, users); return; }
        if (eq(path, "/api/configs/validate") && POST(method)) { configHandler.validate(ex, jwt, users); return; }
        if (eq(path, "/api/configs/history")  && GET(method))  { configHandler.history(ex, jwt, users); return; }
        if (eq(path, "/api/configs/version")  && GET(method))  { configHandler.version(ex, jwt, users); return; }

        // ── Reboot ────────────────────────────────────────────────────────────
        if (eq(path, "/api/reboot/status")   && GET(method))  { rebootHandler.status(ex, jwt, users); return; }
        if (eq(path, "/api/reboot/schedule") && POST(method)) { rebootHandler.schedule(ex, jwt, users); return; }
        if (eq(path, "/api/reboot/cancel")   && POST(method)) { rebootHandler.cancel(ex, jwt, users); return; }
        if (eq(path, "/api/reboot/now")      && POST(method)) { rebootHandler.now(ex, jwt, users); return; }

        // ── Backups ───────────────────────────────────────────────────────────
        if (eq(path, "/api/backups") && GET(method))    { backupHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/backups") && POST(method))   { backupHandler.create(ex, jwt, users); return; }
        if (eq(path, "/api/backups") && DELETE(method)) { backupHandler.delete(ex, jwt, users); return; }

        // ── Panic Mode ────────────────────────────────────────────────────────
        if (eq(path, "/api/panic/status")     && GET(method))  { panicHandler.status(ex, jwt, users); return; }
        if (eq(path, "/api/panic/activate")   && POST(method)) { panicHandler.activate(ex, jwt, users); return; }
        if (eq(path, "/api/panic/deactivate") && POST(method)) { panicHandler.deactivate(ex, jwt, users); return; }

        // ── Honeypot ──────────────────────────────────────────────────────────
        if (eq(path, "/api/honeypot/traps")   && GET(method))  { honeypotHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/honeypot/traps")   && POST(method)) { honeypotHandler.create(ex, jwt, users); return; }
        if (eq(path, "/api/honeypot/alerts")  && GET(method))  { honeypotHandler.alerts(ex, jwt, users); return; }
        if (path.startsWith("/api/honeypot/traps/") && DELETE(method)) { honeypotHandler.delete(ex, jwt, users, id(path, "/api/honeypot/traps/")); return; }

        // ── Toxic Chat ────────────────────────────────────────────────────────
        if (eq(path, "/api/chat/stats")    && GET(method))  { toxicChatHandler.stats(ex, jwt, users); return; }
        if (eq(path, "/api/chat/wordlist") && GET(method))  { toxicChatHandler.wordlist(ex, jwt, users); return; }
        if (eq(path, "/api/chat/wordlist") && POST(method)) { toxicChatHandler.updateWordlist(ex, jwt, users); return; }
        if (eq(path, "/api/chat/reset")    && POST(method)) { toxicChatHandler.reset(ex, jwt, users); return; }

        // ── Event Calendar ────────────────────────────────────────────────────
        if (eq(path, "/api/events")          && GET(method))  { eventCalendarHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/events")          && POST(method)) { eventCalendarHandler.create(ex, jwt, users); return; }
        if (eq(path, "/api/events/export")   && GET(method))  { eventCalendarHandler.exportIcs(ex, jwt, users); return; }
        if (path.startsWith("/api/events/")  && PATCH(method))  { eventCalendarHandler.update(ex, jwt, users, id(path, "/api/events/")); return; }
        if (path.startsWith("/api/events/")  && DELETE(method)) { eventCalendarHandler.delete(ex, jwt, users, id(path, "/api/events/")); return; }

        // ── Quests ────────────────────────────────────────────────────────────
        if (eq(path, "/api/quests")         && GET(method))  { questHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/quests")         && POST(method)) { questHandler.create(ex, jwt, users); return; }
        if (path.startsWith("/api/quests/player/") && GET(method)) { questHandler.playerProgress(ex, jwt, users, id(path, "/api/quests/player/")); return; }
        if (path.startsWith("/api/quests/") && PATCH(method))  { questHandler.update(ex, jwt, users, id(path, "/api/quests/")); return; }
        if (path.startsWith("/api/quests/") && DELETE(method)) { questHandler.delete(ex, jwt, users, id(path, "/api/quests/")); return; }

        // ── Experiments (A/B Testing) ─────────────────────────────────────────
        if (eq(path, "/api/experiments") && GET(method))  { experimentHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/experiments") && POST(method)) { experimentHandler.create(ex, jwt, users); return; }
        if (path.startsWith("/api/experiments/") && path.endsWith("/track") && POST(method)) {
            String rest = path.substring("/api/experiments/".length());
            String id = rest.substring(0, rest.length() - "/track".length());
            experimentHandler.track(ex, jwt, users, id); return;
        }
        if (path.startsWith("/api/experiments/") && PATCH(method))  { experimentHandler.update(ex, jwt, users, id(path, "/api/experiments/")); return; }
        if (path.startsWith("/api/experiments/") && DELETE(method)) { experimentHandler.delete(ex, jwt, users, id(path, "/api/experiments/")); return; }

        // ── AI Assistant ──────────────────────────────────────────────────────
        if (eq(path, "/api/ai/status") && GET(method))  { aiHandler.status(ex, jwt, users); return; }
        if (eq(path, "/api/ai/chat")   && POST(method)) { aiHandler.chat(ex, jwt, users); return; }
        if (eq(path, "/api/ai/config") && POST(method)) { aiHandler.setConfig(ex, jwt, users); return; }
        if (eq(path, "/api/ai/diagnose") && POST(method)) { aiHandler.diagnose(ex, jwt, users); return; }
        if (eq(path, "/api/ai/apply-patch") && POST(method)) { aiHandler.applyPatch(ex, jwt, users); return; }
        if (eq(path, "/api/ai/usage")    && GET(method))  { aiHandler.usage(ex, jwt, users); return; }

        // ── Crates / Lootboxes ────────────────────────────────────────────────
        // ORDRE CRITIQUE : routes spécifiques AVANT /api/crates/{id}
        if (eq(path, "/api/crates")                 && GET(method))    { crateHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/crates")                 && POST(method))   { crateHandler.create(ex, jwt, users); return; }
        if (eq(path, "/api/crates/opens")           && GET(method))    { crateHandler.allOpens(ex, jwt, users); return; }
        if (eq(path, "/api/crates/placed")          && GET(method))    { crateHandler.listPlaced(ex, jwt, users); return; }
        if (path.startsWith("/api/crates/keys/")    && GET(method))    { crateHandler.playerKeys(ex, jwt, users, id(path, "/api/crates/keys/")); return; }
        if (path.startsWith("/api/crates/") && path.endsWith("/opens") && GET(method))     { crateHandler.opens(ex, jwt, users, id(path, "/api/crates/", "/opens")); return; }
        if (path.startsWith("/api/crates/") && path.endsWith("/stats") && GET(method))     { crateHandler.stats(ex, jwt, users, id(path, "/api/crates/", "/stats")); return; }
        if (path.startsWith("/api/crates/") && path.endsWith("/key/give") && POST(method)) { crateHandler.giveKey(ex, jwt, users, id(path, "/api/crates/", "/key/give")); return; }
        if (path.startsWith("/api/crates/")         && GET(method))    { crateHandler.get(ex, jwt, users, id(path, "/api/crates/")); return; }
        if (path.startsWith("/api/crates/")         && (PUT(method) || PATCH(method))) { crateHandler.update(ex, jwt, users, id(path, "/api/crates/")); return; }
        if (path.startsWith("/api/crates/")         && DELETE(method)) { crateHandler.delete(ex, jwt, users, id(path, "/api/crates/")); return; }

        // ── Daily Rewards ─────────────────────────────────────────────────────
        if (eq(path, "/api/daily/config")           && GET(method))    { dailyRewardHandler.getConfig(ex, jwt, users); return; }
        if (eq(path, "/api/daily/config")           && (PUT(method) || POST(method))) { dailyRewardHandler.saveConfig(ex, jwt, users); return; }
        if (eq(path, "/api/daily/claims")           && GET(method))    { dailyRewardHandler.listClaims(ex, jwt, users); return; }
        if (eq(path, "/api/daily/stats")            && GET(method))    { dailyRewardHandler.stats(ex, jwt, users); return; }
        if (path.startsWith("/api/daily/streak/")   && GET(method))    { dailyRewardHandler.playerStreak(ex, jwt, users, id(path, "/api/daily/streak/")); return; }
        if (path.startsWith("/api/daily/reset/")    && POST(method))   { dailyRewardHandler.resetStreak(ex, jwt, users, id(path, "/api/daily/reset/")); return; }

        // ── Announcements ─────────────────────────────────────────────────────
        if (eq(path, "/api/announcements")          && GET(method))    { announcementHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/announcements")          && POST(method))   { announcementHandler.create(ex, jwt, users); return; }
        if (eq(path, "/api/announcements/stats")    && GET(method))    { announcementHandler.stats(ex, jwt, users); return; }
        if (path.startsWith("/api/announcements/") && path.endsWith("/test-send") && POST(method)) {
            announcementHandler.testSend(ex, jwt, users, id(path, "/api/announcements/", "/test-send")); return;
        }
        if (path.startsWith("/api/announcements/")  && GET(method))    { announcementHandler.get(ex, jwt, users, id(path, "/api/announcements/")); return; }
        if (path.startsWith("/api/announcements/")  && (PUT(method) || PATCH(method))) { announcementHandler.update(ex, jwt, users, id(path, "/api/announcements/")); return; }
        if (path.startsWith("/api/announcements/")  && DELETE(method)) { announcementHandler.delete(ex, jwt, users, id(path, "/api/announcements/")); return; }

        // ── LuckPerms ─────────────────────────────────────────────────────────
        if (eq(path, "/api/luckperms/status")       && GET(method))    { luckPermsHandler.status(ex, jwt, users); return; }
        if (eq(path, "/api/luckperms/groups")       && GET(method))    { luckPermsHandler.listGroups(ex, jwt, users); return; }
        if (eq(path, "/api/luckperms/online")       && GET(method))    { luckPermsHandler.onlinePlayersWithGroups(ex, jwt, users); return; }
        if (path.matches("/api/luckperms/group/[^/]+/permissions/.*") && DELETE(method)) {
            String after = path.substring("/api/luckperms/group/".length());
            int sep = after.indexOf("/permissions/");
            luckPermsHandler.removeGroupPermission(ex, jwt, users,
                    after.substring(0, sep), after.substring(sep + "/permissions/".length())); return;
        }
        if (path.startsWith("/api/luckperms/group/") && path.endsWith("/permissions") && POST(method)) {
            luckPermsHandler.addGroupPermission(ex, jwt, users, id(path, "/api/luckperms/group/", "/permissions")); return;
        }
        if (path.startsWith("/api/luckperms/group/") && path.endsWith("/permissions") && GET(method)) {
            luckPermsHandler.groupPermissions(ex, jwt, users, id(path, "/api/luckperms/group/", "/permissions")); return;
        }
        if (path.startsWith("/api/luckperms/player/") && path.endsWith("/primary") && PUT(method)) {
            luckPermsHandler.setPrimary(ex, jwt, users, id(path, "/api/luckperms/player/", "/primary")); return;
        }
        if (path.matches("/api/luckperms/player/[^/]+/group/[^/]+") && DELETE(method)) {
            // Extract playerName and group from path
            String rest = path.substring("/api/luckperms/player/".length());
            int slashGroup = rest.indexOf("/group/");
            String playerName = rest.substring(0, slashGroup);
            String groupName = rest.substring(slashGroup + "/group/".length());
            luckPermsHandler.removeGroup(ex, jwt, users, playerName, groupName); return;
        }
        if (path.startsWith("/api/luckperms/player/") && path.endsWith("/group") && POST(method)) {
            luckPermsHandler.addGroup(ex, jwt, users, id(path, "/api/luckperms/player/", "/group")); return;
        }
        if (path.startsWith("/api/luckperms/player/") && GET(method))    {
            luckPermsHandler.playerInfo(ex, jwt, users, id(path, "/api/luckperms/player/")); return;
        }

        // ── Shops / EconomyShopGUI sync ──────────────────────────────────────
        // ORDRE CRITIQUE : routes spécifiques AVANT /api/shops/{id}
        if (eq(path, "/api/shops")                  && GET(method))    { shopHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/shops")                  && POST(method))   { shopHandler.create(ex, jwt, users); return; }
        if (eq(path, "/api/shops/stats")            && GET(method))    { shopHandler.globalStats(ex, jwt, users); return; }
        if (eq(path, "/api/shops/esg-status")       && GET(method))    { shopHandler.esgStatus(ex, jwt, users); return; }
        if (eq(path, "/api/shops/sync")             && POST(method))   { shopHandler.sync(ex, jwt, users); return; }
        if (eq(path, "/api/shops/rollback")         && POST(method))   { shopHandler.rollback(ex, jwt, users); return; }
        if (eq(path, "/api/shops/import-esg")       && POST(method))   { shopHandler.importFromESG(ex, jwt, users); return; }
        if (path.matches("/api/shops/[^/]+/items/[^/]+") && PUT(method)) {
            String rest = path.substring("/api/shops/".length());
            int s = rest.indexOf("/items/");
            shopHandler.updateItem(ex, jwt, users, rest.substring(0, s), rest.substring(s + "/items/".length())); return;
        }
        if (path.matches("/api/shops/[^/]+/items/[^/]+") && DELETE(method)) {
            String rest = path.substring("/api/shops/".length());
            int s = rest.indexOf("/items/");
            shopHandler.removeItem(ex, jwt, users, rest.substring(0, s), rest.substring(s + "/items/".length())); return;
        }
        if (path.startsWith("/api/shops/") && path.endsWith("/items") && POST(method))  { shopHandler.addItem(ex, jwt, users, id(path, "/api/shops/", "/items")); return; }
        if (path.startsWith("/api/shops/") && path.endsWith("/transactions") && GET(method)) { shopHandler.transactions(ex, jwt, users, id(path, "/api/shops/", "/transactions")); return; }
        if (path.startsWith("/api/shops/") && path.endsWith("/stats") && GET(method))   { shopHandler.stats(ex, jwt, users, id(path, "/api/shops/", "/stats")); return; }
        if (path.startsWith("/api/shops/") && GET(method))    { shopHandler.get(ex, jwt, users, id(path, "/api/shops/")); return; }
        if (path.startsWith("/api/shops/") && (PUT(method) || PATCH(method))) { shopHandler.update(ex, jwt, users, id(path, "/api/shops/")); return; }
        if (path.startsWith("/api/shops/") && DELETE(method)) { shopHandler.delete(ex, jwt, users, id(path, "/api/shops/")); return; }

        // ── VIP / Subscriptions (ADMIN/MOD) ──────────────────────────────────
        if (eq(path, "/api/vip/plans")              && GET(method))    { vipHandler.listPlans(ex, jwt, users); return; }
        if (eq(path, "/api/vip/plans")              && POST(method))   { vipHandler.createPlan(ex, jwt, users); return; }
        if (path.startsWith("/api/vip/plans/")      && (PUT(method) || PATCH(method))) { vipHandler.updatePlan(ex, jwt, users, id(path, "/api/vip/plans/")); return; }
        if (path.startsWith("/api/vip/plans/")      && DELETE(method)) { vipHandler.deletePlan(ex, jwt, users, id(path, "/api/vip/plans/")); return; }
        if (eq(path, "/api/vip/subscriptions")      && GET(method))    { vipHandler.listSubscriptions(ex, jwt, users); return; }
        if (path.startsWith("/api/vip/subscriptions/") && path.endsWith("/extend") && POST(method)) { vipHandler.extend(ex, jwt, users, id(path, "/api/vip/subscriptions/", "/extend")); return; }
        if (path.startsWith("/api/vip/subscriptions/") && path.endsWith("/revoke") && POST(method)) { vipHandler.revoke(ex, jwt, users, id(path, "/api/vip/subscriptions/", "/revoke")); return; }
        if (path.startsWith("/api/vip/subscriptions/") && GET(method)) { vipHandler.getSubscription(ex, jwt, users, id(path, "/api/vip/subscriptions/")); return; }
        if (eq(path, "/api/vip/gift")               && POST(method))   { vipHandler.gift(ex, jwt, users); return; }
        if (eq(path, "/api/vip/transactions")       && GET(method))    { vipHandler.listTransactions(ex, jwt, users); return; }
        if (eq(path, "/api/vip/stats")              && GET(method))    { vipHandler.stats(ex, jwt, users); return; }
        if (eq(path, "/api/vip/gateways/status")    && GET(method))    { vipHandler.gatewaysStatus(ex, jwt, users); return; }

        // ── VIP routes PUBLIQUES (sans auth — webhooks + page d'achat) ───────
        if (eq(path, "/api/public/vip/plans")           && GET(method))   { vipPublicHandler.listPublicPlans(ex); return; }
        if (eq(path, "/api/public/vip/checkout")        && POST(method))  { vipPublicHandler.createCheckout(ex); return; }
        if (eq(path, "/api/public/vip/webhook/stripe")  && POST(method))  { vipPublicHandler.stripeWebhook(ex); return; }
        if (eq(path, "/api/public/vip/webhook/paypal")  && POST(method))  { vipPublicHandler.paypalWebhook(ex); return; }

        // ── Mobile (push notifications) ──────────────────────────────────────
        if (eq(path, "/api/mobile/push/register") && POST(method)) { mobileHandler.registerPush(ex, jwt, users); return; }
        if (eq(path, "/api/mobile/push/test")     && POST(method)) { mobileHandler.testPush(ex, jwt, users); return; }
        if (eq(path, "/api/mobile/devices")       && GET(method))  { mobileHandler.listDevices(ex, jwt, users); return; }

        // ── Permissions matrix ────────────────────────────────────────────────
        if (eq(path, "/api/permissions")            && GET(method))    { permsHandler.get(ex, jwt, users); return; }
        if (eq(path, "/api/permissions")            && (PUT(method) || POST(method))) { permsHandler.update(ex, jwt, users); return; }
        if (eq(path, "/api/permissions/reset")      && POST(method))   { permsHandler.reset(ex, jwt, users); return; }

        // ── Users / Accounts ──────────────────────────────────────────────────
        if (eq(path, "/api/users")                  && GET(method))    { userHandler.list(ex, jwt, users); return; }
        if (eq(path, "/api/users")                  && POST(method))   { userHandler.create(ex, jwt, users); return; }
        if (eq(path, "/api/users/me/password")       && POST(method))  { userHandler.changeOwnPassword(ex, jwt, users); return; }
        if (path.startsWith("/api/users/") && path.endsWith("/role")   && PATCH(method))  { userHandler.changeRole(ex, jwt, users, id(path, "/api/users/", "/role")); return; }
        if (path.startsWith("/api/users/") && path.endsWith("/password") && POST(method)) { userHandler.resetPassword(ex, jwt, users, id(path, "/api/users/", "/password")); return; }
        if (path.startsWith("/api/users/")           && DELETE(method)) { userHandler.delete(ex, jwt, users, id(path, "/api/users/")); return; }

        HttpHelper.error(ex, 404, "Route introuvable: " + method + " " + path);
    }

    /**
     * Retourne true si la requête n'a PAS besoin du pare-feu VIEWER
     * (soit c'est un GET, soit c'est une route POST que le VIEWER peut utiliser).
     */
    private static boolean isViewerAllowedWrite(String path, String method) {
        // Toutes les lectures sont autorisées
        if ("GET".equals(method) || "OPTIONS".equals(method)) return true;
        // Routes POST autorisées pour VIEWER
        if ("POST".equals(method)) {
            if ("/api/auth/login".equals(path))       return true; // public
            if ("/api/users/me/password".equals(path)) return true; // changer son propre mdp
            if ("/api/ai/chat".equals(path))           return true; // assistant IA (lecture)
        }
        return false;
    }

    private static boolean eq(String path, String route) { return route.equals(path); }
    private static boolean GET(String m)    { return "GET".equals(m); }
    private static boolean POST(String m)   { return "POST".equals(m); }
    private static boolean PUT(String m)    { return "PUT".equals(m); }
    private static boolean PATCH(String m)  { return "PATCH".equals(m); }
    private static boolean DELETE(String m) { return "DELETE".equals(m); }

    private static String id(String path, String prefix) {
        String rest = path.substring(prefix.length());
        int slash = rest.indexOf('/');
        return slash >= 0 ? rest.substring(0, slash) : rest;
    }

    /** Extrait la partie entre prefix et suffix (ex: /api/users/{username}/role). */
    private static String id(String path, String prefix, String suffix) {
        String without = path.substring(prefix.length());
        int end = without.lastIndexOf(suffix);
        return end >= 0 ? without.substring(0, end) : without;
    }
}
