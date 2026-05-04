package sunanticheat.jobs;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.Plugin;

import java.io.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

public final class CustomJobConfig {

    private final Plugin plugin;
    private final Logger logger;
    private final Map<String, CustomJob> jobs = new LinkedHashMap<>();

    /** Per-job runtime enable state — persisted in jobs-state.yml. Missing = enabled. */
    private final Map<String, Boolean> enabledOverrides = new ConcurrentHashMap<>();
    /** Slots per LuckPerms primary group. Always contains a "default" entry. */
    private final Map<String, Integer> slotsPerRank = new ConcurrentHashMap<>();

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
        loadState();
    }

    /** jobs-state.yml — runtime mutable state (enabled + slot caps). */
    private File stateFile() {
        return new File(plugin.getDataFolder(), "jobs-state.yml");
    }

    private void loadState() {
        enabledOverrides.clear();
        slotsPerRank.clear();
        slotsPerRank.put("default", 2);

        File f = stateFile();
        if (!f.exists()) { saveState(); return; }
        YamlConfiguration y = YamlConfiguration.loadConfiguration(f);

        ConfigurationSection en = y.getConfigurationSection("enabled");
        if (en != null) {
            for (String k : en.getKeys(false)) enabledOverrides.put(k, en.getBoolean(k));
        }
        ConfigurationSection sl = y.getConfigurationSection("slots-per-rank");
        if (sl != null) {
            slotsPerRank.clear();
            for (String k : sl.getKeys(false)) {
                slotsPerRank.put(k.toLowerCase(Locale.ROOT), Math.max(0, sl.getInt(k, 0)));
            }
            slotsPerRank.putIfAbsent("default", 2);
        }
    }

    public synchronized void saveState() {
        YamlConfiguration y = new YamlConfiguration();
        for (Map.Entry<String, Boolean> e : enabledOverrides.entrySet()) {
            y.set("enabled." + e.getKey(), e.getValue());
        }
        for (Map.Entry<String, Integer> e : slotsPerRank.entrySet()) {
            y.set("slots-per-rank." + e.getKey(), e.getValue());
        }
        try {
            plugin.getDataFolder().mkdirs();
            y.save(stateFile());
        } catch (IOException e) {
            logger.warning("[Jobs] Impossible d'écrire jobs-state.yml : " + e.getMessage());
        }
    }

    public boolean isJobEnabled(String jobId) {
        Boolean v = enabledOverrides.get(jobId);
        return v == null || v;
    }

    public void setJobEnabled(String jobId, boolean enabled) {
        enabledOverrides.put(jobId, enabled);
        saveState();
    }

    public int slotsForRank(String rank) {
        if (rank == null) return slotsPerRank.getOrDefault("default", 2);
        Integer v = slotsPerRank.get(rank.toLowerCase(Locale.ROOT));
        if (v != null) return v;
        return slotsPerRank.getOrDefault("default", 2);
    }

    public Map<String, Integer> slotsPerRank() {
        return Collections.unmodifiableMap(slotsPerRank);
    }

    public void setSlotsForRank(String rank, int slots) {
        if (rank == null || rank.isBlank()) return;
        slotsPerRank.put(rank.toLowerCase(Locale.ROOT), Math.max(0, slots));
        saveState();
    }

    public void removeRank(String rank) {
        if (rank == null || "default".equalsIgnoreCase(rank)) return;
        slotsPerRank.remove(rank.toLowerCase(Locale.ROOT));
        saveState();
    }

    public Map<String, CustomJob> getJobs() { return Collections.unmodifiableMap(jobs); }

    public CustomJob getJob(String id) { return jobs.get(id); }
}
