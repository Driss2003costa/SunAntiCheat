package sunanticheat.report;

import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Stockage des reports (signalements). Cooldown géré côté commande.
 */
public class ReportStorage {

    private static final int MAX_ENTRIES = 5000;

    private final File file;
    private final List<ReportEntry> entries = new CopyOnWriteArrayList<>();

    public ReportStorage(JavaPlugin plugin) {
        this.file = new File(plugin.getDataFolder(), "reports.yml");
        load();
    }

    public void add(ReportEntry entry) {
        if (entry == null) return;
        entries.add(0, entry);
        while (entries.size() > MAX_ENTRIES) {
            entries.remove(entries.size() - 1);
        }
        save();
    }

    /** Tous les reports, plus récents en premier. */
    public List<ReportEntry> getAll() {
        return new ArrayList<>(entries);
    }

    /** Marque un report comme résolu par son id. */
    public void markResolved(String id) {
        if (id == null) return;
        entries.stream()
               .filter(e -> id.equals(e.getId()))
               .findFirst()
               .ifPresent(e -> { e.setResolved(true); save(); });
    }

    public void save() {
        YamlConfiguration cfg = new YamlConfiguration();
        List<Map<String, Object>> list = new ArrayList<>();
        for (ReportEntry e : entries) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId());
            m.put("reporterUuid", e.getReporterUuid() != null ? e.getReporterUuid().toString() : "");
            m.put("reporterName", e.getReporterName());
            m.put("reportedUuid", e.getReportedUuid() != null ? e.getReportedUuid().toString() : "");
            m.put("reportedName", e.getReportedName());
            m.put("reason", e.getReason());
            m.put("timestamp", e.getTimestamp());
            m.put("resolved", e.isResolved());
            list.add(m);
        }
        cfg.set("reports", list);
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
        List<?> list = cfg.getList("reports");
        if (list == null) return;
        for (Object o : list) {
            if (!(o instanceof Map)) continue;
            Map<String, Object> m = (Map<String, Object>) o;
            String id = m.containsKey("id") ? String.valueOf(m.get("id")) : null;
            UUID reporterUuid = parseUuid(String.valueOf(m.get("reporterUuid")));
            String reporterName = String.valueOf(m.get("reporterName"));
            UUID reportedUuid = parseUuid(String.valueOf(m.get("reportedUuid")));
            String reportedName = String.valueOf(m.get("reportedName"));
            String reason = String.valueOf(m.get("reason"));
            long timestamp = ((Number) m.getOrDefault("timestamp", 0L)).longValue();
            boolean resolved = Boolean.TRUE.equals(m.get("resolved"));
            entries.add(new ReportEntry(id, reporterUuid, reporterName, reportedUuid, reportedName, reason, timestamp, resolved));
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
