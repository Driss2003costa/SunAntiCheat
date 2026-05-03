package sunanticheat.jobs;

import net.milkbowl.vault.economy.Economy;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.db.Database;

public final class CustomJobModule {

    private final CustomJobConfig config;
    private final CustomJobStore store;
    private final CustomJobService service;
    private final CustomJobGui gui;
    private final CustomJobCommand command;
    private final CustomJobListener listener;

    public CustomJobModule(JavaPlugin plugin, Database db, Economy economy) {
        this.config   = new CustomJobConfig(plugin, plugin.getLogger());
        this.store    = new CustomJobStore(db, plugin.getLogger());
        this.service  = new CustomJobService(config, store, economy, plugin.getLogger());
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

    public CustomJobService getService() { return service; }
    public CustomJobStore   getStore()   { return store; }
    public CustomJobConfig  getConfig()  { return config; }

    public void shutdown() { service.cleanup(); }
}
