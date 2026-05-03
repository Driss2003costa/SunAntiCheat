package sunanticheat.jobs;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.Plugin;

import java.io.*;
import java.util.*;
import java.util.logging.Logger;

public final class CustomJobConfig {

    private final Plugin plugin;
    private final Logger logger;
    private final Map<String, CustomJob> jobs = new LinkedHashMap<>();

    public CustomJobConfig(Plugin plugin, Logger logger) {
        this.plugin = plugin;
        this.logger = logger;
        reload();
    }

    public void reload() {
        jobs.clear();
        File file = new File(plugin.getDataFolder(), "jobs.yml");
        if (!file.exists()) {
            try (InputStream in = plugin.getResource("jobs.yml")) {
                if (in != null) {
                    plugin.getDataFolder().mkdirs();
                    try (OutputStream out = new FileOutputStream(file)) {
                        in.transferTo(out);
                    }
                }
            } catch (IOException e) {
                logger.warning("[Jobs] Impossible de créer jobs.yml : " + e.getMessage());
                return;
            }
        }

        YamlConfiguration cfg = YamlConfiguration.loadConfiguration(file);
        ConfigurationSection jobsSection = cfg.getConfigurationSection("jobs");
        if (jobsSection == null) {
            logger.warning("[Jobs] Section 'jobs' introuvable dans jobs.yml");
            return;
        }

        for (String id : jobsSection.getKeys(false)) {
            try {
                ConfigurationSection js = jobsSection.getConfigurationSection(id);
                if (js == null) continue;

                String name        = js.getString("name", id);
                String description = js.getString("description", "");
                String icon        = js.getString("icon", "DIRT");
                int maxLevel       = js.getInt("max-level", 10);
                int baseXp         = js.getInt("base-xp-per-level", 500);
                double mult        = js.getDouble("level-multiplier", 1.2);
                int cooldown       = js.getInt("anti-farm-cooldown", 60);

                Map<String, Map<String, JobAction>> actions = new LinkedHashMap<>();
                ConfigurationSection actSection = js.getConfigurationSection("actions");
                if (actSection != null) {
                    for (String actionType : actSection.getKeys(false)) {
                        ConfigurationSection targets = actSection.getConfigurationSection(actionType);
                        if (targets == null) continue;
                        Map<String, JobAction> map = new LinkedHashMap<>();
                        for (String target : targets.getKeys(false)) {
                            ConfigurationSection rewardSec = targets.getConfigurationSection(target);
                            if (rewardSec == null) continue;
                            double xp    = rewardSec.getDouble("xp", 0);
                            double money = rewardSec.getDouble("money", 0);
                            map.put(target.toUpperCase(), new JobAction(xp, money));
                        }
                        actions.put(actionType.toLowerCase(), map);
                    }
                }

                jobs.put(id, new CustomJob(id, name, description, icon, maxLevel, baseXp, mult, cooldown, actions));
                logger.info("[Jobs] Métier chargé : " + name + " (" + id + ")");
            } catch (Exception e) {
                logger.warning("[Jobs] Erreur chargement métier '" + id + "': " + e.getMessage());
            }
        }

        logger.info("[Jobs] " + jobs.size() + " métier(s) chargé(s).");
    }

    public Map<String, CustomJob> getJobs() { return Collections.unmodifiableMap(jobs); }

    public CustomJob getJob(String id) { return jobs.get(id); }
}
