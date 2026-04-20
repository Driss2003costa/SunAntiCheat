package sunanticheat.playtime;

import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Persistance du temps de jeu par joueur (UUID → secondes).
 */
public class PlaytimeStorage {

    private final File file;
    private final Map<UUID, Long> totalSeconds = new HashMap<>();

    public PlaytimeStorage(JavaPlugin plugin) {
        this.file = new File(plugin.getDataFolder(), "playtime.yml");
        load();
    }

    public void load() {
        totalSeconds.clear();
        if (!file.exists()) return;
        YamlConfiguration cfg = YamlConfiguration.loadConfiguration(file);
        for (String key : cfg.getKeys(false)) {
            try {
                UUID uuid = UUID.fromString(key);
                long seconds = cfg.getLong(key + ".seconds", 0L);
                totalSeconds.put(uuid, Math.max(0, seconds));
            } catch (IllegalArgumentException ignored) {
            }
        }
    }

    public void save() {
        YamlConfiguration cfg = new YamlConfiguration();
        for (Map.Entry<UUID, Long> e : totalSeconds.entrySet()) {
            String k = e.getKey().toString();
            cfg.set(k + ".seconds", e.getValue());
        }
        try {
            cfg.save(file);
        } catch (IOException ignored) {
        }
    }

    public long getTotalSeconds(UUID uuid) {
        return totalSeconds.getOrDefault(uuid, 0L);
    }

    public void addSeconds(UUID uuid, long seconds) {
        totalSeconds.merge(uuid, Math.max(0, seconds), Long::sum);
    }

    public void setTotalSeconds(UUID uuid, long seconds) {
        totalSeconds.put(uuid, Math.max(0, seconds));
        save();
    }

    /** Retourne une copie de toutes les données (UUID → secondes) pour le classement. */
    public Map<UUID, Long> getAll() {
        return new HashMap<>(totalSeconds);
    }
}
