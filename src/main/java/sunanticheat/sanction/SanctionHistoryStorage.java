package sunanticheat.sanction;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Stockage YAML des entrées d'historique de sanctions (pour affichage fiche joueur / traçabilité).
 */
public class SanctionHistoryStorage {

    private static final int MAX_ENTRIES_TOTAL = 10000;
    private static final int MAX_PER_PLAYER = 200;

    private final File file;
    private final List<SanctionHistoryEntry> entries = new CopyOnWriteArrayList<>();
    private java.util.function.Consumer<SanctionHistoryEntry> onSanctionLogged;

    public SanctionHistoryStorage(JavaPlugin plugin) {
        this.file = new File(plugin.getDataFolder(), "sanction-history.yml");
        load();
    }

    public void setOnSanctionLogged(java.util.function.Consumer<SanctionHistoryEntry> onSanctionLogged) {
        this.onSanctionLogged = onSanctionLogged;
    }

    public void add(SanctionHistoryEntry entry) {
        if (entry == null) return;
        entries.add(0, entry);
        while (entries.size() > MAX_ENTRIES_TOTAL) {
            entries.remove(entries.size() - 1);
        }
        save();
        if (onSanctionLogged != null) onSanctionLogged.accept(entry);
    }

    /** Toutes les entrées, plus récentes en premier. */
    public List<SanctionHistoryEntry> getAll() {
        return new ArrayList<>(entries);
    }

    /** Dernières sanctions pour un joueur cible (plus récentes en premier). */
    public List<SanctionHistoryEntry> getByTarget(UUID targetUuid, int limit) {
        if (targetUuid == null) return Collections.emptyList();
        int max = Math.min(limit, MAX_PER_PLAYER);
        return entries.stream()
                .filter(e -> targetUuid.equals(e.getTargetUuid()))
                .limit(max)
                .toList();
    }

    public void save() {
        YamlConfiguration cfg = new YamlConfiguration();
        List<Map<String, Object>> list = new ArrayList<>();
        for (SanctionHistoryEntry e : entries) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("type", e.getType());
            m.put("targetUuid", e.getTargetUuid() != null ? e.getTargetUuid().toString() : "");
            m.put("targetName", e.getTargetName());
            m.put("staffUuid", e.getStaffUuid() != null ? e.getStaffUuid().toString() : "");
            m.put("staffName", e.getStaffName());
            m.put("reason", e.getReason());
            m.put("durationMillis", e.getDurationMillis());
            m.put("timestamp", e.getTimestamp());
            list.add(m);
        }
        cfg.set("entries", list);
        try {
            cfg.save(file);
        } catch (IOException ignored) {
        }
    }

    @SuppressWarnings("unchecked")
    public void load() {
        entries.clear();
        if (!file.exists()) return;
        YamlConfiguration cfg = YamlConfiguration.loadConfiguration(file);
        List<?> list = cfg.getList("entries");
        if (list == null) return;
        for (Object o : list) {
            if (!(o instanceof Map)) continue;
            Map<String, Object> m = (Map<String, Object>) o;
            String type = String.valueOf(m.get("type"));
            UUID targetUuid = parseUuid(String.valueOf(m.get("targetUuid")));
            String targetName = String.valueOf(m.get("targetName"));
            UUID staffUuid = parseUuid(String.valueOf(m.get("staffUuid")));
            String staffName = String.valueOf(m.get("staffName"));
            String reason = String.valueOf(m.get("reason"));
            long durationMillis = ((Number) m.getOrDefault("durationMillis", 0L)).longValue();
            long timestamp = ((Number) m.getOrDefault("timestamp", 0L)).longValue();
            entries.add(new SanctionHistoryEntry(type, targetUuid, targetName, staffUuid, staffName, reason, durationMillis, timestamp));
        }
    }

    private static UUID parseUuid(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return UUID.fromString(s);
        } catch (Exception e) {
            return null;
        }
    }
}
