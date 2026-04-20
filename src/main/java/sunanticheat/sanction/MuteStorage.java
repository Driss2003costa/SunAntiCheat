package sunanticheat.sanction;

import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Persistance des mutes : UUID → timestamp de fin (0 = permanent).
 */
public class MuteStorage {

    private final File file;
    private final Map<UUID, Long> muteUntil = new HashMap<>();

    public MuteStorage(JavaPlugin plugin) {
        this.file = new File(plugin.getDataFolder(), "mutes.yml");
        load();
    }

    public void load() {
        muteUntil.clear();
        if (!file.exists()) return;
        YamlConfiguration cfg = YamlConfiguration.loadConfiguration(file);
        for (String key : cfg.getKeys(false)) {
            try {
                UUID uuid = UUID.fromString(key);
                long until = cfg.getLong(key + ".until", 0L);
                muteUntil.put(uuid, until);
            } catch (IllegalArgumentException ignored) {
            }
        }
    }

    public void save() {
        YamlConfiguration cfg = new YamlConfiguration();
        for (Map.Entry<UUID, Long> e : muteUntil.entrySet()) {
            String k = e.getKey().toString();
            cfg.set(k + ".until", e.getValue());
        }
        try {
            cfg.save(file);
        } catch (IOException ignored) {
        }
    }

    public boolean isMuted(UUID uuid) {
        Long until = muteUntil.get(uuid);
        if (until == null) return false;
        if (until == 0) return true; // permanent
        return System.currentTimeMillis() < until;
    }

    public void mute(UUID uuid, long untilMillis) {
        muteUntil.put(uuid, untilMillis);
        save();
    }

    public void unmute(UUID uuid) {
        muteUntil.remove(uuid);
        save();
    }
}
