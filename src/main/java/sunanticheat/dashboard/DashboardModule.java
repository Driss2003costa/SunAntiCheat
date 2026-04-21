package sunanticheat.dashboard;

import com.sun.net.httpserver.HttpServer;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.SunAntiCheat;
import sunanticheat.dashboard.alerts.AlertStore;
import sunanticheat.dashboard.analytics.AnalyticsRecorder;
import sunanticheat.dashboard.analytics.SnapshotStore;
import sunanticheat.dashboard.economy.EconomyRecorder;
import sunanticheat.dashboard.economy.TransactionStore;
import sunanticheat.dashboard.backup.BackupManager;
import sunanticheat.dashboard.announcements.AnnouncementService;
import sunanticheat.dashboard.announcements.AnnouncementStore;
import sunanticheat.dashboard.announcements.SunAnnCommand;
import sunanticheat.dashboard.chat.ToxicChatListener;
import sunanticheat.dashboard.chat.ToxicChatStore;
import sunanticheat.dashboard.crates.CrateListener;
import sunanticheat.dashboard.crates.CrateStore;
import sunanticheat.dashboard.dailyreward.DailyRewardListener;
import sunanticheat.dashboard.dailyreward.DailyRewardStore;
import sunanticheat.dashboard.events.EventCalendarStore;
import sunanticheat.dashboard.experiments.ExperimentStore;
import sunanticheat.dashboard.handlers.*;
import sunanticheat.dashboard.honeypot.HoneypotListener;
import sunanticheat.dashboard.honeypot.HoneypotStore;
import sunanticheat.dashboard.shop.ShopEconomyListener;
import sunanticheat.dashboard.shop.ShopStore;
import sunanticheat.dashboard.shop.ShopSyncService;
import sunanticheat.dashboard.panic.PanicMode;
import sunanticheat.dashboard.quests.QuestListener;
import sunanticheat.dashboard.quests.QuestStore;
import sunanticheat.dashboard.auth.UserStore;
import sunanticheat.dashboard.reboot.RebootScheduler;
import sunanticheat.dashboard.tasks.ScheduledTaskStore;
import sunanticheat.dashboard.ws.ConsoleLogCapture;
import sunanticheat.dashboard.ws.DashboardWsServer;
import sunanticheat.report.ReportStorage;
import sunanticheat.sanction.SanctionHistoryStorage;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.URL;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.logging.Logger;

/**
 * Orchestrateur du dashboard web. Démarre :
 * - Un HttpServer (REST API + fichiers React statiques) sur http-port
 * - Un DashboardWsServer (WebSocket) sur ws-port
 */
public final class DashboardModule {

    private final SunAntiCheat plugin;
    private HttpServer httpServer;
    private DashboardWsServer wsServer;
    private ConsoleLogCapture consoleCapture;

    private TransactionStore transactionStore;
    private SnapshotStore snapshotStore;
    private AlertStore alertStore;
    private AnalyticsRecorder analyticsRecorder;
    private ScheduledTaskStore taskStore;
    private RebootScheduler rebootScheduler;
    private EventCalendarStore eventCalendarStore;
    private QuestStore questStore;
    private ExperimentStore experimentStore;
    private ToxicChatStore toxicChatStore;
    private HoneypotStore honeypotStore;
    private PanicMode panicMode;
    private UserStore userStore;
    private CrateStore crateStore;
    private DailyRewardStore dailyRewardStore;
    private AnnouncementStore announcementStore;
    private AnnouncementService announcementService;
    private ShopStore shopStore;
    private ShopSyncService shopSyncService;

    public DashboardModule(SunAntiCheat plugin) {
        this.plugin = plugin;
    }

    public void start(SanctionHistoryStorage sanctionHistory,
                      ReportStorage reportStorage,
                      Economy economy) throws Exception {

        var cfg = plugin.getConfig();
        if (!cfg.getBoolean("dashboard.enabled", false)) {
            plugin.getLogger().info("[Dashboard] Désactivé (dashboard.enabled: false dans config.yml)");
            return;
        }

        int httpPort = cfg.getInt("dashboard.http-port", 8765);
        int wsPort   = cfg.getInt("dashboard.ws-port",   8766);
        String jwtSecret = cfg.getString("dashboard.jwt-secret", "changez-moi-secret-aleatoire-32chars!");

        // ── Utilisateurs ──────────────────────────────────────────────────────
        userStore = new UserStore(plugin.getDataFolder(), plugin.getLogger(), cfg);
        Map<String, DashboardUser> users = new java.util.concurrent.ConcurrentHashMap<>(userStore.asMap());
        JwtUtil jwtUtil = new JwtUtil(jwtSecret);

        // ── Stores ────────────────────────────────────────────────────────────
        alertStore        = new AlertStore();
        transactionStore  = new TransactionStore(plugin.getDataFolder(), plugin.getLogger());
        snapshotStore     = new SnapshotStore(plugin.getDataFolder(), plugin.getLogger());
        taskStore         = new ScheduledTaskStore(plugin.getDataFolder(), plugin.getLogger());
        taskStore.start(plugin);
        rebootScheduler   = new RebootScheduler(plugin, plugin.getDataFolder(), plugin.getLogger());
        rebootScheduler.start();
        BackupManager backupManager = new BackupManager(plugin, plugin.getLogger());

        eventCalendarStore = new EventCalendarStore(plugin, plugin.getDataFolder(), plugin.getLogger());
        eventCalendarStore.start();
        questStore        = new QuestStore(plugin, plugin.getDataFolder(), plugin.getLogger());
        experimentStore   = new ExperimentStore(plugin.getDataFolder(), plugin.getLogger());
        toxicChatStore    = new ToxicChatStore(plugin.getDataFolder(), plugin.getLogger());
        honeypotStore     = new HoneypotStore(plugin.getDataFolder(), plugin.getLogger());
        panicMode         = new PanicMode(plugin, plugin.getLogger());
        crateStore        = new CrateStore(plugin.getDataFolder(), plugin.getLogger());
        dailyRewardStore  = new DailyRewardStore(plugin.getDataFolder(), plugin.getLogger());
        announcementStore = new AnnouncementStore(plugin.getDataFolder(), plugin.getLogger());
        announcementService = new AnnouncementService(plugin, announcementStore, plugin.getLogger());
        announcementService.start();
        shopStore = new ShopStore(plugin.getDataFolder(), plugin.getLogger());
        shopSyncService = new ShopSyncService(plugin, shopStore, plugin.getLogger());

        // ── Recorders ─────────────────────────────────────────────────────────
        analyticsRecorder = new AnalyticsRecorder(plugin, snapshotStore, alertStore);
        analyticsRecorder.start();
        Bukkit.getPluginManager().registerEvents(analyticsRecorder, plugin);

        if (Bukkit.getPluginManager().getPlugin("EconomyShopGUI") != null
                || Bukkit.getPluginManager().getPlugin("EconomyShopGUI-Premium") != null) {
            EconomyRecorder economyRecorder = new EconomyRecorder(transactionStore, plugin.getLogger());
            Bukkit.getPluginManager().registerEvents(economyRecorder, plugin);
            plugin.getLogger().info("[Dashboard] EconomyShopGUI+ détecté — tracking des transactions activé.");
        } else {
            plugin.getLogger().warning("[Dashboard] EconomyShopGUI(+) non trouvé — tracking shop désactivé.");
        }

        // ── Handlers ─────────────────────────────────────────────────────────
        List<String> allowedCmds = cfg.getStringList("dashboard.allowed-commands");
        AuthHandler     authHandler     = new AuthHandler(users, jwtUtil, userStore);
        UserHandler     userHandler     = new UserHandler(userStore);
        ServerHandler   serverHandler   = new ServerHandler(plugin, allowedCmds);
        SecurityHandler securityHandler = new SecurityHandler(plugin, sanctionHistory, reportStorage, alertStore);
        EconomyHandler  economyHandler  = new EconomyHandler(plugin, economy, transactionStore);
        AnalyticsHandler analyticsHandler = new AnalyticsHandler(snapshotStore);
        ScheduledTaskHandler taskHandler = new ScheduledTaskHandler(plugin, taskStore);
        PluginManagerHandler pluginHandler = new PluginManagerHandler();
        File pluginsDir = plugin.getDataFolder().getParentFile();
        ConfigEditorHandler configHandler = new ConfigEditorHandler(pluginsDir, plugin.getDataFolder());
        RebootHandler rebootHandler = new RebootHandler(rebootScheduler);
        BackupHandler backupHandler = new BackupHandler(backupManager);
        PanicHandler panicHandler = new PanicHandler(panicMode);
        HoneypotHandler honeypotHandler = new HoneypotHandler(honeypotStore);
        ToxicChatHandler toxicChatHandler = new ToxicChatHandler(toxicChatStore);
        EventCalendarHandler eventCalendarHandler = new EventCalendarHandler(eventCalendarStore);
        QuestHandler questHandler = new QuestHandler(questStore);
        ExperimentHandler experimentHandler = new ExperimentHandler(experimentStore);
        AiHandler aiHandler = new AiHandler(plugin);

        // Crates & Daily Rewards
        CrateListener crateListener = new CrateListener(plugin, crateStore);
        CrateHandler crateHandler = new CrateHandler(plugin, crateStore, crateListener);
        DailyRewardListener dailyRewardListener = new DailyRewardListener(plugin, dailyRewardStore, economy);
        DailyRewardHandler dailyRewardHandler = new DailyRewardHandler(dailyRewardStore);

        // Announcements & LuckPerms
        AnnouncementHandler announcementHandler = new AnnouncementHandler(plugin, announcementStore, announcementService);
        LuckPermsHandler luckPermsHandler = new LuckPermsHandler(plugin);
        SunAnnCommand sunAnnCommand = new SunAnnCommand(plugin, announcementStore);
        if (plugin.getCommand("sunann") != null) {
            plugin.getCommand("sunann").setExecutor(sunAnnCommand);
        }

        if (Bukkit.getPluginManager().getPlugin("LuckPerms") != null) {
            plugin.getLogger().info("[Dashboard] LuckPerms détecté — gestion des rangs activée.");
        } else {
            plugin.getLogger().info("[Dashboard] LuckPerms absent — gestion des rangs désactivée.");
        }

        // Shop Manager (EconomyShopGUI sync)
        ShopHandler shopHandler = new ShopHandler(plugin, shopStore, shopSyncService);
        if (Bukkit.getPluginManager().getPlugin("EconomyShopGUI") != null
                || Bukkit.getPluginManager().getPlugin("EconomyShopGUI-Premium") != null) {
            Bukkit.getPluginManager().registerEvents(new ShopEconomyListener(shopStore, plugin.getLogger()), plugin);
            plugin.getLogger().info("[Dashboard] EconomyShopGUI détecté — sync shops et tracking transactions activés.");
        } else {
            plugin.getLogger().info("[Dashboard] EconomyShopGUI absent — sync shops désactivé.");
        }

        // Listeners
        Bukkit.getPluginManager().registerEvents(new HoneypotListener(honeypotStore, this::pushAlertRaw), plugin);
        Bukkit.getPluginManager().registerEvents(new ToxicChatListener(plugin, toxicChatStore, this::pushAlertRaw), plugin);
        Bukkit.getPluginManager().registerEvents(new QuestListener(questStore), plugin);
        Bukkit.getPluginManager().registerEvents(crateListener, plugin);
        Bukkit.getPluginManager().registerEvents(dailyRewardListener, plugin);

        // Commandes /crate et /daily
        if (plugin.getCommand("crate") != null) {
            plugin.getCommand("crate").setExecutor(crateListener);
        } else {
            plugin.getLogger().warning("[Dashboard] Commande /crate non enregistrée dans plugin.yml");
        }
        if (plugin.getCommand("daily") != null) {
            plugin.getCommand("daily").setExecutor(dailyRewardListener);
        } else {
            plugin.getLogger().warning("[Dashboard] Commande /daily non enregistrée dans plugin.yml");
        }

        if (Bukkit.getPluginManager().getPlugin("ItemsAdder") != null) {
            plugin.getLogger().info("[Dashboard] ItemsAdder détecté — support items/blocs custom activé.");
        } else {
            plugin.getLogger().info("[Dashboard] ItemsAdder absent — fallback Material + CustomModelData.");
        }

        // ── WebSocket ─────────────────────────────────────────────────────────
        wsServer = new DashboardWsServer(wsPort, jwtUtil, users, plugin.getLogger(),
                cmd -> Bukkit.getScheduler().runTask(plugin, () -> {
                    plugin.getLogger().info("[Dashboard/WS] Commande: " + cmd);
                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd);
                }));
        wsServer.start();

        // ── Console capture ───────────────────────────────────────────────────
        consoleCapture = ConsoleLogCapture.install(wsServer::broadcastConsole);

        // ── HTTP Server ───────────────────────────────────────────────────────
        DashboardRouter router = new DashboardRouter(jwtUtil, users,
                authHandler, serverHandler, securityHandler, economyHandler, analyticsHandler,
                taskHandler, pluginHandler, configHandler, rebootHandler, backupHandler,
                panicHandler, honeypotHandler, toxicChatHandler, eventCalendarHandler,
                questHandler, experimentHandler, aiHandler, userHandler,
                crateHandler, dailyRewardHandler, announcementHandler, luckPermsHandler,
                shopHandler);

        File dashboardDir = new File(plugin.getDataFolder(), "dashboard");
        dashboardDir.mkdirs();
        extractDashboardFiles(dashboardDir, plugin.getLogger());

        httpServer = HttpServer.create(new InetSocketAddress(httpPort), 100);
        httpServer.createContext("/api/", router);
        httpServer.createContext("/", new StaticFileHandler(dashboardDir));
        httpServer.setExecutor(Executors.newFixedThreadPool(8, r -> {
            Thread t = new Thread(r, "dashboard-http");
            t.setDaemon(true);
            return t;
        }));
        httpServer.start();

        plugin.getLogger().info("[Dashboard] HTTP démarré sur le port " + httpPort);
        plugin.getLogger().info("[Dashboard] WebSocket démarré sur le port " + wsPort);
        plugin.getLogger().info("[Dashboard] Fichiers React : plugins/SunAntiCheat/dashboard/");
        plugin.getLogger().info("[Dashboard] Accès : http://localhost:" + httpPort);
    }

    public void stop() {
        if (consoleCapture != null) { consoleCapture.uninstall(); consoleCapture = null; }
        if (httpServer != null) { httpServer.stop(1); httpServer = null; }
        if (wsServer != null) {
            try { wsServer.stop(1000); } catch (Exception ignored) {}
            wsServer = null;
        }
        if (snapshotStore != null) snapshotStore.save();
        if (transactionStore != null) transactionStore.save();
        if (taskStore != null) taskStore.stop();
        if (rebootScheduler != null) rebootScheduler.stop();
        if (eventCalendarStore != null) eventCalendarStore.stop();
        if (questStore != null) { questStore.saveQuests(); questStore.saveProgress(); }
        if (experimentStore != null) experimentStore.save();
        if (toxicChatStore != null) toxicChatStore.save();
        if (honeypotStore != null) honeypotStore.save();
        if (crateStore != null) crateStore.save();
        // DailyRewardStore persiste automatiquement à chaque modification
        if (announcementService != null) announcementService.stop();
        if (announcementStore != null) announcementStore.save();
        if (shopStore != null) shopStore.save();
        plugin.getLogger().info("[Dashboard] Arrêté.");
    }

    /** Consommateur d'alertes brutes (pour listeners internes). */
    public void pushAlertRaw(Map<String, Object> alert) {
        if (alert == null) return;
        pushAlert(
                String.valueOf(alert.getOrDefault("type", "UNKNOWN")),
                String.valueOf(alert.getOrDefault("player", "")),
                String.valueOf(alert.getOrDefault("world", "")),
                String.valueOf(alert.getOrDefault("detail", ""))
        );
    }

    /** Expose pour que StaffAlertService puisse pousser des alertes temps réel. */
    public void pushAlert(String type, String player, String world, String detail) {
        if (alertStore != null) alertStore.push(type, player, world, detail);
        if (snapshotStore != null) snapshotStore.recordAlert(type);
        if (wsServer != null) {
            wsServer.broadcastAlert(Map.of(
                    "timestamp", System.currentTimeMillis(),
                    "type", type, "player", player, "world", world, "detail", detail));
        }
    }

    /**
     * Extrait les fichiers du build React (dashboard-dist/) depuis le JAR
     * vers plugins/SunAntiCheat/dashboard/ — uniquement si index.html est absent.
     * Utilise JavaPlugin#getFile() via réflexion (méthode protected, stable sur tous les forks).
     */
    private void extractDashboardFiles(File dashboardDir, Logger logger) {
        File index = new File(dashboardDir, "index.html");
        if (index.exists()) return; // déjà extrait

        try {
            // getFile() est protected dans JavaPlugin — on y accède par réflexion
            java.lang.reflect.Method getFile = org.bukkit.plugin.java.JavaPlugin.class.getDeclaredMethod("getFile");
            getFile.setAccessible(true);
            File jarFile = (File) getFile.invoke(plugin);

            if (jarFile == null || !jarFile.isFile()) {
                logger.warning("[Dashboard] Impossible de localiser le JAR (getFile() null).");
                return;
            }

            String prefix = "dashboard-dist/";
            try (JarFile jar = new JarFile(jarFile)) {
                var entries = jar.entries();
                int count = 0;
                while (entries.hasMoreElements()) {
                    JarEntry entry = entries.nextElement();
                    String name = entry.getName();
                    if (!name.startsWith(prefix) || name.equals(prefix)) continue;
                    String relative = name.substring(prefix.length());
                    File dest = new File(dashboardDir, relative);
                    if (entry.isDirectory()) { dest.mkdirs(); continue; }
                    dest.getParentFile().mkdirs();
                    try (InputStream in = jar.getInputStream(entry);
                         OutputStream out = new FileOutputStream(dest)) {
                        in.transferTo(out);
                    }
                    count++;
                }
                if (count > 0)
                    logger.info("[Dashboard] " + count + " fichiers React extraits dans " + dashboardDir);
                else
                    logger.warning("[Dashboard] Aucun fichier React dans le JAR (dashboard-dist/ vide ?)");
            }
        } catch (Exception e) {
            logger.warning("[Dashboard] Erreur extraction React : " + e.getMessage());
        }
    }

}
