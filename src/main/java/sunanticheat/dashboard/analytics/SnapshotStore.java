package sunanticheat.dashboard.analytics;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.lang.reflect.Type;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.logging.Logger;
import java.util.stream.Collectors;

public final class SnapshotStore {

    private static final Gson GSON = new GsonBuilder().create();
    private static final long RETENTION_MS = 30L * 86400 * 1000;
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("EEE dd/MM", Locale.FRENCH);

    private final File snapshotsFile;
    private final File sessionsFile;
    private final File firstJoinsFile;
    private final File alertsFile;
    private final Logger logger;

    private final List<AnalyticsSnapshot> snapshots = new CopyOnWriteArrayList<>();
    private final List<SessionEntry>      sessions  = new CopyOnWriteArrayList<>();
    private final List<FirstJoinEntry>    firstJoins= new CopyOnWriteArrayList<>();
    // alerts: timestamp, type
    private final List<long[]>            alertTs   = new CopyOnWriteArrayList<>(); // [timestamp, type_ordinal]
    private final List<String>            alertTypes= new CopyOnWriteArrayList<>();

    public SnapshotStore(File dataFolder, Logger logger) {
        File dir = new File(dataFolder, "analytics");
        dir.mkdirs();
        this.snapshotsFile = new File(dir, "snapshots.json");
        this.sessionsFile  = new File(dir, "sessions.json");
        this.firstJoinsFile= new File(dir, "firstjoins.json");
        this.alertsFile    = new File(dir, "alerts.json");
        this.logger = logger;
        load();
    }

    // ── Écriture ─────────────────────────────────────────────────────────────

    public void addSnapshot(AnalyticsSnapshot s) {
        snapshots.add(s);
        purgeOld(snapshots, RETENTION_MS);
    }

    public void recordSession(String player, long durationMs) {
        sessions.add(new SessionEntry(System.currentTimeMillis(), durationMs, player));
        purgeOld(sessions, RETENTION_MS);
    }

    public void recordFirstJoin(String player, String uuid) {
        firstJoins.add(new FirstJoinEntry(System.currentTimeMillis(), player, uuid));
        purgeOld(firstJoins, RETENTION_MS);
    }

    public void recordAlert(String type) {
        alertTs.add(new long[]{System.currentTimeMillis()});
        alertTypes.add(type);
        // Purge
        long cutoff = System.currentTimeMillis() - RETENTION_MS;
        int size = alertTs.size();
        int remove = 0;
        for (long[] ts : alertTs) { if (ts[0] < cutoff) remove++; else break; }
        for (int i = 0; i < remove; i++) { if (!alertTs.isEmpty()) alertTs.remove(0); if (!alertTypes.isEmpty()) alertTypes.remove(0); }
    }

    // ── Lecture (API REST) ────────────────────────────────────────────────────

    public Map<String, Object> connectionsPerDay(int days) {
        return dailyCount(sessions.stream().map(SessionEntry::timestamp).collect(Collectors.toList()), days, "Connexions");
    }

    public Map<String, Object> firstJoinsPerDay(int days) {
        return dailyCount(firstJoins.stream().map(FirstJoinEntry::timestamp).collect(Collectors.toList()), days, "Nouveaux joueurs");
    }

    public Map<String, Object> avgSessionPerDay(int days) {
        List<String> labels = new ArrayList<>();
        List<Double> data = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long start = dayStart(day);
            long end   = start + 86400_000L;
            OptionalDouble avg = sessions.stream()
                    .filter(s -> s.timestamp() >= start && s.timestamp() < end)
                    .mapToLong(SessionEntry::durationMs)
                    .average();
            labels.add(day.format(DAY_FMT));
            data.add(avg.isPresent() ? Math.round(avg.getAsDouble() / 60000.0 * 10) / 10.0 : 0.0);
        }
        return Map.of("labels", labels, "datasets", List.of(Map.of("label", "Durée moy. (min)", "data", data)));
    }

    public Map<String, Object> tpsPerDay(int days) {
        List<String> labels = new ArrayList<>();
        List<Double> data = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long start = dayStart(day);
            long end   = start + 86400_000L;
            OptionalDouble avg = snapshots.stream()
                    .filter(s -> s.timestamp() >= start && s.timestamp() < end)
                    .mapToDouble(AnalyticsSnapshot::tps).average();
            labels.add(day.format(DAY_FMT));
            data.add(avg.isPresent() ? Math.round(avg.getAsDouble() * 100) / 100.0 : 20.0);
        }
        return Map.of("labels", labels, "datasets", List.of(Map.of("label", "TPS moyen", "data", data)));
    }

    public Map<String, Object> ramPerDay(int days) {
        List<String> labels = new ArrayList<>();
        List<Integer> data = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long start = dayStart(day);
            long end   = start + 86400_000L;
            OptionalDouble avg = snapshots.stream()
                    .filter(s -> s.timestamp() >= start && s.timestamp() < end)
                    .mapToInt(AnalyticsSnapshot::ramUsedMb).average();
            labels.add(day.format(DAY_FMT));
            data.add(avg.isPresent() ? (int) avg.getAsDouble() : 0);
        }
        return Map.of("labels", labels, "datasets", List.of(Map.of("label", "RAM (MB)", "data", data)));
    }

    public Map<String, Object> alertsPerDay(int days) {
        List<String> labels = new ArrayList<>();
        Map<String, List<Integer>> series = new LinkedHashMap<>();
        List<String> knownTypes = List.of("XRAY", "KILLAURA", "FREECAM", "WM_CHEST");
        for (String t : knownTypes) series.put(t, new ArrayList<>());

        LocalDate today = LocalDate.now();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long start = dayStart(day);
            long end   = start + 86400_000L;
            labels.add(day.format(DAY_FMT));
            for (String t : knownTypes) {
                int count = 0;
                for (int j = 0; j < alertTs.size(); j++) {
                    long ts = alertTs.get(j)[0];
                    if (ts >= start && ts < end && t.equalsIgnoreCase(alertTypes.size() > j ? alertTypes.get(j) : "")) count++;
                }
                series.get(t).add(count);
            }
        }

        List<Map<String, Object>> datasets = new ArrayList<>();
        for (Map.Entry<String, List<Integer>> e : series.entrySet()) {
            datasets.add(Map.of("label", e.getKey(), "data", e.getValue()));
        }
        return Map.of("labels", labels, "datasets", datasets);
    }

    // ── Persistance ───────────────────────────────────────────────────────────

    public synchronized void save() {
        saveList(snapshotsFile, new ArrayList<>(snapshots));
        saveList(sessionsFile,  new ArrayList<>(sessions));
        saveList(firstJoinsFile,new ArrayList<>(firstJoins));
    }

    private void load() {
        snapshots.addAll(loadList(snapshotsFile, new TypeToken<List<AnalyticsSnapshot>>(){}.getType()));
        sessions.addAll(loadList(sessionsFile,   new TypeToken<List<SessionEntry>>(){}.getType()));
        firstJoins.addAll(loadList(firstJoinsFile, new TypeToken<List<FirstJoinEntry>>(){}.getType()));
    }

    private <T> List<T> loadList(File f, Type type) {
        if (!f.exists()) return new ArrayList<>();
        try (FileReader r = new FileReader(f)) {
            List<T> list = GSON.fromJson(r, type);
            return list != null ? list : new ArrayList<>();
        } catch (Exception e) {
            logger.warning("[Dashboard/Analytics] Erreur chargement " + f.getName() + ": " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private void saveList(File f, List<?> list) {
        try { f.getParentFile().mkdirs(); try (FileWriter w = new FileWriter(f)) { GSON.toJson(list, w); } }
        catch (Exception e) { logger.warning("[Dashboard/Analytics] Erreur sauvegarde " + f.getName() + ": " + e.getMessage()); }
    }

    private static <T> void purgeOld(List<T> list, long retentionMs) {
        long cutoff = System.currentTimeMillis() - retentionMs;
        list.removeIf(e -> {
            try {
                long ts = (long) e.getClass().getMethod("timestamp").invoke(e);
                return ts < cutoff;
            } catch (Exception ex) { return false; }
        });
    }

    private static long dayStart(LocalDate day) {
        return day.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    private static Map<String, Object> dailyCount(List<Long> timestamps, int days, String label) {
        List<String> labels = new ArrayList<>();
        List<Integer> data = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long start = dayStart(day);
            long end   = start + 86400_000L;
            int count = (int) timestamps.stream().filter(ts -> ts >= start && ts < end).count();
            labels.add(day.format(DAY_FMT));
            data.add(count);
        }
        return Map.of("labels", labels, "datasets", List.of(Map.of("label", label, "data", data)));
    }
}
