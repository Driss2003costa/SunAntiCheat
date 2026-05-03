package sunanticheat.jobs;

import net.milkbowl.vault.economy.Economy;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.db.Database;
import sunanticheat.jobs.dynamics.WorldDynamicsService;
import sunanticheat.jobs.polish.ComboTracker;
import sunanticheat.jobs.polish.JobActionBarService;
import sunanticheat.jobs.polish.JobBossBarService;
import sunanticheat.jobs.polish.JobFxService;
import sunanticheat.jobs.polish.JobTitlesService;

public final class CustomJobModule {

    private final CustomJobConfig config;
    private final CustomJobStore store;
    private final CustomJobService service;
    private final CustomJobGui gui;
    private final CustomJobCommand command;
    private final CustomJobListener listener;

    private final WorldDynamicsService dynamics;
    private final JobBossBarService    bossBarService;
    private final JobActionBarService  actionBarService;
    private final JobFxService         fxService;
    private final JobTitlesService     titlesService;
    private final ComboTracker         comboTracker;

    public CustomJobModule(JavaPlugin plugin, Database db, Economy economy) {
        this.config   = new CustomJobConfig(plugin, plugin.getLogger());
        this.store    = new CustomJobStore(db, plugin.getLogger());
        this.service  = new CustomJobService(config, store, economy, plugin.getLogger());

        // Polish layer
        this.bossBarService   = new JobBossBarService(plugin);
        this.actionBarService = new JobActionBarService();
        this.fxService        = new JobFxService();
        this.titlesService    = new JobTitlesService();
        this.comboTracker     = new ComboTracker();

        // World dynamics layer
        this.dynamics = new WorldDynamicsService(plugin, db, config, plugin.getLogger());
        this.dynamics.start();

        // Wire everything into the service
        this.service.attachExtensions(dynamics, bossBarService, actionBarService,
                fxService, titlesService, comboTracker);

        this.gui      = new CustomJobGui(service);
        this.command  = new CustomJobCommand(service, gui);
        this.listener = new CustomJobListener(service);

        plugin.getServer().getPluginManager().registerEvents(listener, plugin);
        plugin.getServer().getPluginManager().registerEvents(gui, plugin);

        var cmd = plugin.getCommand("job");
        if (cmd != null) {
            cmd.setExecutor(command);
            cmd.setTabCompleter(command);
        } else {
            plugin.getLogger().warning("[Jobs] Commande '/job' non déclarée dans plugin.yml !");
        }
    }

    public CustomJobService          getService()  { return service; }
    public CustomJobStore            getStore()    { return store; }
    public CustomJobConfig           getConfig()   { return config; }
    public WorldDynamicsService      getDynamics() { return dynamics; }
    public JobBossBarService         getBossBar()  { return bossBarService; }

    public void shutdown() {
        if (bossBarService != null) bossBarService.shutdown();
        if (dynamics != null) dynamics.stop();
        service.cleanup();
    }
}
