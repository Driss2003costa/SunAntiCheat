package sunanticheat.dashboard.economy;

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

public final class TransactionStore {

    private static final Gson GSON = new GsonBuilder().create();
    private static final long RETENTION_MS = 90L * 86400 * 1000;
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("EEE dd/MM", Locale.FRENCH);

    private final File file;
    private final Logger logger;
    private final List<TransactionEntry> entries = new CopyOnWriteArrayList<>();

    public TransactionStore(File dataFolder, Logger logger) {
        this.file = new File(dataFolder, "economy/transactions.json");
        this.logger = logger;
        load();
    }

    public void add(TransactionEntry entry) {
        entries.add(0, entry);
        saveAsync();
    }

    public List<TransactionEntry> since(long epochMs) {
        return entries.stream().filter(e -> e.timestamp() >= epochMs).collect(Collectors.toList());
    }

    public List<TransactionEntry> filter(long since, String type, String player) {
        return entries.stream()
                .filter(e -> e.timestamp() >= since)
                .filter(e -> type == null || type.isEmpty() || type.equalsIgnoreCase(e.type()))
                .filter(e -> player == null || player.isEmpty() || player.equalsIgnoreCase(e.playerName()))
                .collect(Collectors.toList());
    }

    /** Argent total échangé (BUY volume) par jour sur N jours — pour le graphique linéaire. */
    public Map<String, Object> moneyOverTime(int days) {
        List<String> labels = new ArrayList<>();
        List<Double> data = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long start = day.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
            long end   = start + 86400_000L;
            double vol = entries.stream()
                    .filter(e -> e.timestamp() >= start && e.timestamp() < end && "BUY".equals(e.type()))
                    .mapToDouble(TransactionEntry::totalPrice).sum();
            labels.add(day.format(DAY_FMT));
            data.add(round(vol));
        }
        return Map.of("labels", labels, "data", data);
    }

    // ── Persistance ──────────────────────────────────────────────────────────

    private void load() {
        if (!file.exists()) return;
        try (FileReader r = new FileReader(file)) {
            Type type = new TypeToken<List<TransactionEntry>>() {}.getType();
            List<TransactionEntry> loaded = GSON.fromJson(r, type);
            if (loaded != null) {
                long cutoff = System.currentTimeMillis() - RETENTION_MS;
                entries.addAll(loaded.stream().filter(e -> e.timestamp() >= cutoff).toList());
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/Economy] Erreur chargement transactions: " + e.getMessage());
        }
    }

    private void saveAsync() {
        new Thread(this::save, "dashboard-economy-save").start();
    }

    public synchronized void save() {
        try {
            file.getParentFile().mkdirs();
            long cutoff = System.currentTimeMillis() - RETENTION_MS;
            List<TransactionEntry> toSave = entries.stream().filter(e -> e.timestamp() >= cutoff).toList();
            try (FileWriter w = new FileWriter(file)) {
                GSON.toJson(toSave, w);
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/Economy] Erreur sauvegarde: " + e.getMessage());
        }
    }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
