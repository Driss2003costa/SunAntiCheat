package sunanticheat;

import net.milkbowl.vault.economy.Economy;
import org.bukkit.Bukkit;
import org.bukkit.plugin.RegisteredServiceProvider;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.client.ClientInfoListeners;
import sunanticheat.client.ClientInfoTracker;
import sunanticheat.freecam.FreecamBlockBreakListener;
import sunanticheat.freecam.FreecamGui;
import sunanticheat.freecam.FreecamInteractListener;
import sunanticheat.freecam.FreecamTracker;
import sunanticheat.firstjoin.FirstJoinListener;
import sunanticheat.killaura.KillAuraListener;
import sunanticheat.killaura.KillAuraTracker;
import sunanticheat.menu.DebugGui;
import sunanticheat.menu.ClientInfoGui;
import sunanticheat.menu.MainMenuGui;
import sunanticheat.menu.MenuClickListener;
import sunanticheat.menu.PlayerDataDetailGui;
import sunanticheat.menu.PlayerDataListGui;
import sunanticheat.menu.PlayerInventoryGui;
import sunanticheat.menu.PlayerListGui;
import sunanticheat.playtime.PlaytimeListeners;
import sunanticheat.playtime.PlaytimeStorage;
import sunanticheat.playtime.PlaytimeTracker;
import sunanticheat.playtime.PlaytimeCommand;
import sunanticheat.alerts.StaffAlertService;
import sunanticheat.blocklog.BlockLogGui;
import sunanticheat.blocklog.BlockLogListeners;
import sunanticheat.blocklog.BlockLogStore;
import sunanticheat.connection.ConnectionListeners;
import sunanticheat.connection.ConnectionLogStorage;
import sunanticheat.connection.GeoIpCache;
import sunanticheat.inventory.InventoryAnomalyListener;
import sunanticheat.pickup.ItemPickupHistoryGui;
import sunanticheat.pickup.ItemPickupListeners;
import sunanticheat.pickup.ItemPickupStorage;
import sunanticheat.discord.DiscordWebhook;
import sunanticheat.report.ReportCommand;
import sunanticheat.report.ReportListGui;
import sunanticheat.report.ReportStorage;
import sunanticheat.sanction.*;
import sunanticheat.security.RiskyCommandListener;
import sunanticheat.xray.BlockBreakListener;
import sunanticheat.xray.XRayCommand;
import sunanticheat.xray.XRayGui;
import sunanticheat.xray.XRayLogManager;
import sunanticheat.xray.XRayTracker;
import sunanticheat.dashboard.DashboardModule;
import sunanticheat.weaponmechanics.MultiverseInventoriesSpawnWmJoinListener;
import sunanticheat.weaponmechanics.MultiverseInventoriesSpawnWeaponFileScanner;
import sunanticheat.weaponmechanics.SpawnWorldWeaponStripListener;
import sunanticheat.weaponmechanics.WeaponMechanicsMainWorldGuard;
import sunanticheat.weaponmechanics.WorldContainerWeaponMechanicsScanner;

public class SunAntiCheat extends JavaPlugin {

    private XRayTracker xRayTracker;
    private WeaponMechanicsMainWorldGuard weaponMechanicsMainWorldGuard;
    private MultiverseInventoriesSpawnWeaponFileScanner multiverseInventoriesSpawnWeaponFileScanner;
    private WorldContainerWeaponMechanicsScanner worldContainerWeaponMechanicsScanner;
    private sunanticheat.xray.XRayLogManager xRayLogManager;
    private PlaytimeTracker playtimeTracker;
    private BlockLogStore blockLogStore;
    private Economy economy;
    private DiscordWebhook discordWebhook;
    private DashboardModule dashboardModule;
    private SanctionHistoryStorage sanctionHistoryStorageRef;
    private ReportStorage reportStorageRef;
    private SanctionService sanctionService;
    private sunanticheat.alerts.StaffAlertService staffAlertServiceRef;
    private KillAuraTracker killAuraTrackerRef;
    private sunanticheat.connection.ConnectionLogStorage connectionLogStorageRef;
    private GeoIpCache geoIpCache;
    private sunanticheat.jobs.CustomJobModule customJobModule;

    public sunanticheat.alerts.StaffAlertService getStaffAlertService() { return staffAlertServiceRef; }
    /** Scan MV-Inv spawn (armes WM) — ex. commande {@code /sunguard mvinvscan}. */
    public MultiverseInventoriesSpawnWeaponFileScanner getMultiverseInventoriesSpawnWeaponFileScanner() {
        return multiverseInventoriesSpawnWeaponFileScanner;
    }

    /** Scan manuel des conteneurs chargés par monde (/sunguard chestscan). */
    public WorldContainerWeaponMechanicsScanner getWorldContainerWeaponMechanicsScanner() {
        return worldContainerWeaponMechanicsScanner;
    }

    public DiscordWebhook getDiscordWebhook() {
        return discordWebhook;
    }

    public BlockLogStore getBlockLogStore() {
        return blockLogStore;
    }

    public Economy getEconomy() {
        return economy;
    }

    public DashboardModule getDashboardModule() {
        return dashboardModule;
    }

    public SanctionService getSanctionService() { return sanctionService; }
    public KillAuraTracker getKillAuraTracker()   { return killAuraTrackerRef; }
    public sunanticheat.connection.ConnectionLogStorage getConnectionLogStorage() { return connectionLogStorageRef; }
    public GeoIpCache getGeoIpCache() { return geoIpCache; }
    public ReportStorage getReportStorage()        { return reportStorageRef; }
    public PlaytimeTracker getPlaytimeTracker()    { return playtimeTracker; }
    public sunanticheat.jobs.CustomJobModule getCustomJobModule() { return customJobModule; }

    @Override
    public void onEnable() {
        saveDefaultConfig();
        ensureFirstJoinDefaults();
        xRayTracker = new XRayTracker();
        xRayLogManager = new XRayLogManager(this, xRayTracker);
        xRayLogManager.onEnable();
        int saveMinutes = getConfig().getInt("xray-log.save-interval-minutes", 5);
        long saveTicks = Math.max(20, 20L * 60 * saveMinutes);
        getServer().getScheduler().runTaskTimer(this, () -> xRayLogManager.saveToday(), saveTicks, saveTicks);
        reloadDiscordWebhookFromConfig();
        sunanticheat.alerts.ViolationLogService violationLogService = new sunanticheat.alerts.ViolationLogService(this);
        StaffAlertService staffAlertService = new StaffAlertService(this, violationLogService);
        this.staffAlertServiceRef = staffAlertService;
        weaponMechanicsMainWorldGuard = new WeaponMechanicsMainWorldGuard(this, violationLogService);
        weaponMechanicsMainWorldGuard.start();
        multiverseInventoriesSpawnWeaponFileScanner = new MultiverseInventoriesSpawnWeaponFileScanner(this);
        multiverseInventoriesSpawnWeaponFileScanner.start();
        worldContainerWeaponMechanicsScanner = new WorldContainerWeaponMechanicsScanner(this);
        getServer().getPluginManager().registerEvents(
                new MultiverseInventoriesSpawnWmJoinListener(this, multiverseInventoriesSpawnWeaponFileScanner), this);
        getServer().getPluginManager().registerEvents(new SpawnWorldWeaponStripListener(this), this);
        getServer().getPluginManager().registerEvents(new BlockBreakListener(xRayTracker, this, staffAlertService), this);
        FreecamTracker freecamTracker = new FreecamTracker();
        boolean cancelFreecam = getConfig().getBoolean("freecam.cancel-suspicious-actions", false);
        getServer().getPluginManager().registerEvents(new FreecamBlockBreakListener(freecamTracker, cancelFreecam, this, staffAlertService), this);
        getServer().getPluginManager().registerEvents(new FreecamInteractListener(freecamTracker, cancelFreecam, this, staffAlertService), this);
        KillAuraTracker killAuraTracker = new KillAuraTracker();
        this.killAuraTrackerRef = killAuraTracker;
        getServer().getPluginManager().registerEvents(new KillAuraListener(this, killAuraTracker, staffAlertService), this);
        XRayGui xRayGui = new XRayGui(this, xRayTracker);
        FreecamGui freecamGui = new FreecamGui(freecamTracker);
        ClientInfoTracker clientInfoTracker = new ClientInfoTracker();
        PlaytimeStorage playtimeStorage = new PlaytimeStorage(this);
        playtimeTracker = new PlaytimeTracker(playtimeStorage);
        ClientInfoGui clientInfoGui = new ClientInfoGui(clientInfoTracker);
        clientInfoGui.setPlaytimeTracker(playtimeTracker);
        PlayerListGui playerListGui = new PlayerListGui();
        PlayerInventoryGui playerInventoryGui = new PlayerInventoryGui();
        MainMenuGui mainMenuGui = new MainMenuGui(xRayGui, playerListGui, freecamGui, clientInfoGui);

        MuteStorage muteStorage = new MuteStorage(this);
        this.sanctionService = new SanctionService(muteStorage);
        SanctionHistoryStorage sanctionHistoryStorage = new SanctionHistoryStorage(this);
        this.sanctionHistoryStorageRef = sanctionHistoryStorage;
        SanctionMenuGui sanctionMenuGui = new SanctionMenuGui(sanctionService);
        SanctionDurationGui sanctionDurationGui = new SanctionDurationGui(sanctionService, sanctionMenuGui);
        sanctionDurationGui.setHistoryStorage(sanctionHistoryStorage);
        SanctionPlayerListGui sanctionPlayerListGui = new SanctionPlayerListGui(sanctionMenuGui);
        sanctionMenuGui.setDurationGui(sanctionDurationGui);
        sanctionMenuGui.setPlayerListGui(sanctionPlayerListGui);
        mainMenuGui.setSanctionPlayerListGui(sanctionPlayerListGui);
        SanctionHistoryGui sanctionHistoryGui = new SanctionHistoryGui(sanctionHistoryStorage);
        mainMenuGui.setSanctionHistoryGui(sanctionHistoryGui);
        ReportStorage reportStorage = new ReportStorage(this);
        this.reportStorageRef = reportStorage;
        ReportListGui reportListGui = new ReportListGui(reportStorage);
        mainMenuGui.setReportListGui(reportListGui);
        DebugGui debugGui = new DebugGui(this, this.discordWebhook, staffAlertService);
        mainMenuGui.setPlugin(this);
        mainMenuGui.setDebugGui(debugGui);
        ConnectionLogStorage connectionLogStorage = new ConnectionLogStorage(this);
        this.connectionLogStorageRef = connectionLogStorage;
        geoIpCache = new GeoIpCache(getLogger());
        getServer().getPluginManager().registerEvents(new ConnectionListeners(connectionLogStorage, geoIpCache), this);
        getServer().getPluginManager().registerEvents(new InventoryAnomalyListener(this, staffAlertService), this);
        getServer().getPluginManager().registerEvents(new FirstJoinListener(this), this);
        getServer().getPluginManager().registerEvents(new RiskyCommandListener(this), this);

        ItemPickupStorage itemPickupStorage = new ItemPickupStorage();
        ItemPickupHistoryGui itemPickupHistoryGui = new ItemPickupHistoryGui(itemPickupStorage);
        mainMenuGui.setItemPickupHistoryGui(itemPickupHistoryGui);
        getServer().getPluginManager().registerEvents(new ItemPickupListeners(itemPickupStorage), this);

        if (getServer().getPluginManager().getPlugin("Vault") != null) {
            try {
                RegisteredServiceProvider<Economy> rsp = getServer().getServicesManager().getRegistration(Economy.class);
                economy = rsp != null ? rsp.getProvider() : null;
                if (economy != null) getLogger().info("Vault : économie liée (argent affiché dans la fiche joueur).");
            } catch (Throwable t) {
                economy = null;
            }
        }

        PlayerDataDetailGui playerDataDetailGui = new PlayerDataDetailGui(clientInfoTracker, playtimeTracker, sanctionService, xRayTracker, freecamTracker, connectionLogStorage, economy);
        PlayerDataListGui playerDataListGui = new PlayerDataListGui(playerDataDetailGui);
        mainMenuGui.setPlayerDataListGui(playerDataListGui);

        getServer().getPluginManager().registerEvents(new SanctionListeners(sanctionService), this);
        getServer().getPluginManager().registerEvents(new SanctionMenuClickListener(sanctionMenuGui, sanctionHistoryStorage), this);
        getServer().getPluginManager().registerEvents(new PlaytimeListeners(playtimeTracker), this);

        sunanticheat.blocklog.BlockLogInspectionMode blockLogInspectionMode = new sunanticheat.blocklog.BlockLogInspectionMode();
        boolean blockLogEnabled = getConfig().getBoolean("blocklog.enabled", true);
        if (blockLogEnabled) {
            int maxEntries = getConfig().getInt("blocklog.max-entries-per-block", 100);
            int maxBlocks = getConfig().getInt("blocklog.max-blocks", 50000);
            blockLogStore = new BlockLogStore(this, maxEntries, maxBlocks);
            BlockLogGui blockLogGui = new BlockLogGui(blockLogStore);
            getServer().getPluginManager().registerEvents(new BlockLogListeners(blockLogStore, blockLogGui, blockLogInspectionMode, this,
                    getConfig().getBoolean("blocklog.log-break", true),
                    getConfig().getBoolean("blocklog.log-place", true),
                    getConfig().getBoolean("blocklog.log-interact", true)), this);
            int blockLogSaveMin = getConfig().getInt("blocklog.save-interval-minutes", 5);
            long blockLogSaveTicks = Math.max(60, 20L * 60 * blockLogSaveMin);
            getServer().getScheduler().runTaskTimer(this, blockLogStore::save, blockLogSaveTicks, blockLogSaveTicks);
            getServer().getScheduler().runTaskLater(this, blockLogStore::save, 200L);
        }

        ClientInfoListeners clientInfoListeners = new ClientInfoListeners(clientInfoTracker);
        getServer().getPluginManager().registerEvents(clientInfoListeners, this);
        getServer().getMessenger().registerIncomingPluginChannel(this, ClientInfoListeners.CHANNEL_CLIENT, clientInfoListeners);
        getServer().getPluginManager().registerEvents(new MenuClickListener(mainMenuGui, playerInventoryGui), this);
        var xrayCommand = getCommand("xray");
        if (xrayCommand != null) {
            XRayCommand xRayCmd = new XRayCommand(xRayGui, xRayTracker);
            xrayCommand.setExecutor(xRayCmd);
            xrayCommand.setTabCompleter(xRayCmd);
        }
        var sunguardCommand = getCommand("sunguard");
        if (sunguardCommand != null) {
            SunAntiCheatCommand sacCmd = new SunAntiCheatCommand(this, mainMenuGui, blockLogInspectionMode, blockLogStore);
            sunguardCommand.setExecutor(sacCmd);
            sunguardCommand.setTabCompleter(sacCmd);
        }
        var playtimeCommand = getCommand("sunplaytime");
        if (playtimeCommand != null) {
            PlaytimeCommand ptCmd = new PlaytimeCommand(playtimeTracker);
            playtimeCommand.setExecutor(ptCmd);
            playtimeCommand.setTabCompleter(ptCmd);
        }
        var reportCommand = getCommand("report");
        if (reportCommand != null) {
            ReportCommand rptCmd = new ReportCommand(this, reportStorage, entry -> {});
            reportCommand.setExecutor(rptCmd);
            reportCommand.setTabCompleter(rptCmd);
        }
        // ── Dashboard Web Admin ───────────────────────────────────────────────
        dashboardModule = new DashboardModule(this);
        try {
            dashboardModule.start(sanctionHistoryStorageRef, reportStorageRef, economy);
        } catch (Exception e) {
            getLogger().severe("[Dashboard] Échec du démarrage : " + e.getMessage());
            e.printStackTrace();
        }

        // ── Custom Jobs ────────────────────────────────────────────────────────
        try {
            customJobModule = new sunanticheat.jobs.CustomJobModule(this, dashboardModule.getDatabase(), economy);
            getLogger().info("Système de métiers custom initialisé.");
        } catch (Exception e) {
            getLogger().warning("[Jobs] Erreur initialisation : " + e.getMessage());
        }

        if (Bukkit.getPluginManager().isPluginEnabled("PlaceholderAPI")) {
            Bukkit.getScheduler().runTaskLater(this, () -> {
                if (new sunanticheat.playtime.SunAntiCheatPlaceholders(this, playtimeTracker, xRayTracker, freecamTracker, clientInfoTracker, killAuraTrackerRef, reportStorageRef, connectionLogStorageRef).register()) {
                    getLogger().info("PlaceholderAPI : expansion SunAntiCheat enregistrée.");
                } else {
                    getLogger().warning("PlaceholderAPI : échec enregistrement expansion SunAntiCheat.");
                }
            }, 2L);
        }
        getLogger().info("SunAntiCheat activé ! (/sunguard, /sunguard reload, /xray, /sunplaytime)");
    }

    /** Après {@link #reloadConfig()} : redémarre le garde WeaponMechanics / monde principal. */
    public void reloadWeaponMechanicsMainWorldGuard() {
        reloadDiscordWebhookFromConfig();
        if (weaponMechanicsMainWorldGuard != null) {
            weaponMechanicsMainWorldGuard.reloadSchedule();
        }
        if (multiverseInventoriesSpawnWeaponFileScanner != null) {
            multiverseInventoriesSpawnWeaponFileScanner.reload();
        }
    }

    /**
     * Recrée le webhook Discord à partir de la config courante (nécessaire après /sunguard reload).
     * Exige {@code discord.enabled: true} et une {@code discord.webhook-url} non vide.
     */
    public void reloadDiscordWebhookFromConfig() {
        String discordUrl = getConfig().getString("discord.webhook-url", "").trim();
        boolean discordOn = getConfig().getBoolean("discord.enabled", false);
        if (!discordOn || discordUrl.isEmpty()) {
            this.discordWebhook = new DiscordWebhook(this, "");
            if (!discordOn && !discordUrl.isEmpty()) {
                getLogger().warning("Discord : URL renseignée mais discord.enabled est false — aucun envoi.");
            } else if (discordOn && discordUrl.isEmpty()) {
                getLogger().warning("Discord : activé mais discord.webhook-url est vide — aucun envoi.");
            }
            return;
        }
        this.discordWebhook = new DiscordWebhook(this, discordUrl);
        getLogger().info("Discord : webhook prêt (rapports mvinvscan / chestscan).");
    }

    private void ensureFirstJoinDefaults() {
        boolean changed = false;
        if (!getConfig().isSet("first-join.enabled")) {
            getConfig().set("first-join.enabled", true);
            changed = true;
        }
        if (!getConfig().isSet("first-join.delay-ticks")) {
            getConfig().set("first-join.delay-ticks", 20);
            changed = true;
        }
        if (!getConfig().isSet("first-join.command")) {
            getConfig().set("first-join.command", "mvtp spawn %player%");
            changed = true;
        }
        if (!getConfig().isSet("first-join.commands")) {
            getConfig().set("first-join.commands", java.util.List.of("mvtp spawn %player%"));
            changed = true;
        }
        if (changed) {
            saveConfig();
        }
    }

    @Override
    public void onDisable() {
        if (xRayLogManager != null) {
            xRayLogManager.saveToday();
        }
        if (playtimeTracker != null) {
            getServer().getOnlinePlayers().forEach(playtimeTracker::onQuit);
        }
        if (blockLogStore != null) {
            blockLogStore.save();
        }
        if (weaponMechanicsMainWorldGuard != null) {
            weaponMechanicsMainWorldGuard.stop();
        }
        if (multiverseInventoriesSpawnWeaponFileScanner != null) {
            multiverseInventoriesSpawnWeaponFileScanner.stop();
        }
        if (worldContainerWeaponMechanicsScanner != null) {
            if (worldContainerWeaponMechanicsScanner.isRunning()) {
                getLogger().warning("Un scan WM des conteneurs était en cours à l'arrêt du plugin.");
            }
            worldContainerWeaponMechanicsScanner.stop();
        }
        if (dashboardModule != null) {
            dashboardModule.stop();
        }
        if (customJobModule != null) {
            customJobModule.shutdown();
        }
        getServer().getMessenger().unregisterIncomingPluginChannel(this, ClientInfoListeners.CHANNEL_CLIENT);
        getLogger().info("SunAntiCheat désactivé.");
    }
}
