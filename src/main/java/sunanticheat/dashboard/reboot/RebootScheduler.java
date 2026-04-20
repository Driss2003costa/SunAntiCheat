package sunanticheat.dashboard.reboot;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.logging.Logger;

/**
 * Planification de reboot.
 * Modes : ONCE (at = epoch ms) | DAILY (hhmm) | WEEKLY (hhmm + days[])
 * Broadcasts : 10min, 5min, 1min, 30s, 10s, 5s, 3s, 2s, 1s avant reboot.
 */
public final class RebootScheduler {

    public enum Mode { ONCE, DAILY, WEEKLY, DISABLED }

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");
    private static final int[] COUNTDOWN_SECONDS = { 600, 300, 120, 60, 30, 15, 10, 5, 3, 2, 1 };

    private final File file;
    private final Logger logger;
    private final JavaPlugin plugin;

    private Mode mode = Mode.DISABLED;
    private long onceAt = 0L;
    private String hhmm = "04:00";
    private List<Integer> weeklyDays = new ArrayList<>(); // 1=Monday ... 7=Sunday
    private final List<Long> history = new ArrayList<>();

    private BukkitTask tickTask;
    private long nextBroadcastMs = 0L;
    private final Set<Integer> broadcastedMarks = new HashSet<>();
    private long armedForMs = 0L;

    public RebootScheduler(JavaPlugin plugin, File dataFolder, Logger logger) {
        this.plugin = plugin;
        this.logger = logger;
        this.file = new File(dataFolder, "dashboard/reboot.json");
        this.file.getParentFile().mkdirs();
        load();
    }

    public void start() {
        tickTask = Bukkit.getScheduler().runTaskTimer(plugin, this::tick, 100L, 20L); // tous les secondes
    }

    public void stop() {
        if (tickTask != null) tickTask.cancel();
        save();
    }

    // ── API publique ──────────────────────────────────────────────────────────

    public synchronized Map<String, Object> snapshot() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("mode", mode.name());
        m.put("onceAt", onceAt);
        m.put("hhmm", hhmm);
        m.put("weeklyDays", weeklyDays);
        m.put("nextAt", nextRunMs());
        m.put("history", new ArrayList<>(history));
        return m;
    }

    public synchronized void scheduleOnce(long atMs) {
        mode = Mode.ONCE;
        onceAt = atMs;
        broadcastedMarks.clear();
        armedForMs = 0L;
        save();
    }

    public synchronized void scheduleDaily(String hhmm) {
        this.mode = Mode.DAILY;
        this.hhmm = hhmm;
        broadcastedMarks.clear();
        armedForMs = 0L;
        save();
    }

    public synchronized void scheduleWeekly(String hhmm, List<Integer> days) {
        this.mode = Mode.WEEKLY;
        this.hhmm = hhmm;
        this.weeklyDays = days != null ? days : new ArrayList<>();
        broadcastedMarks.clear();
        armedForMs = 0L;
        save();
    }

    public synchronized void cancel() {
        mode = Mode.DISABLED;
        broadcastedMarks.clear();
        armedForMs = 0L;
        save();
    }

    public synchronized void rebootNow() {
        scheduleOnce(System.currentTimeMillis() + 5_000); // countdown 5s
    }

    // ── Tick ──────────────────────────────────────────────────────────────────

    private void tick() {
        long next = nextRunMs();
        if (next <= 0) return;
        long now = System.currentTimeMillis();
        long delta = next - now;

        if (delta <= 0) {
            execute();
            return;
        }

        // Broadcast à chaque seuil franchi
        int deltaSec = (int) (delta / 1000L);
        for (int mark : COUNTDOWN_SECONDS) {
            if (deltaSec <= mark && !broadcastedMarks.contains(mark)) {
                broadcastedMarks.add(mark);
                broadcastCountdown(mark);
                break;
            }
        }
    }

    private long nextRunMs() {
        switch (mode) {
            case ONCE -> {
                return onceAt > System.currentTimeMillis() ? onceAt : -1L;
            }
            case DAILY -> { return nextOccurrence(hhmm, null); }
            case WEEKLY -> {
                if (weeklyDays.isEmpty()) return -1L;
                return nextOccurrence(hhmm, weeklyDays);
            }
            default -> { return -1L; }
        }
    }

    private long nextOccurrence(String hm, List<Integer> allowedDays) {
        try {
            LocalTime target = LocalTime.parse(hm, HHMM);
            ZoneId zone = ZoneId.systemDefault();
            ZonedDateTime now = ZonedDateTime.now(zone);
            ZonedDateTime candidate = now.with(target).withSecond(0).withNano(0);
            if (!candidate.isAfter(now)) candidate = candidate.plusDays(1);
            if (allowedDays != null) {
                // avancer jusqu'au premier jour autorisé
                for (int i = 0; i < 8; i++) {
                    int dayIdx = candidate.getDayOfWeek().getValue(); // 1..7
                    if (allowedDays.contains(dayIdx)) break;
                    candidate = candidate.plusDays(1);
                }
            }
            return candidate.toInstant().toEpochMilli();
        } catch (Exception e) {
            return -1L;
        }
    }

    private void broadcastCountdown(int seconds) {
        String text;
        if (seconds >= 60) text = "⚠ Redémarrage du serveur dans " + (seconds / 60) + " min";
        else                text = "⚠ Redémarrage du serveur dans " + seconds + " s";
        Bukkit.getScheduler().runTask(plugin, () -> {
            Component msg = Component.text(text, NamedTextColor.YELLOW);
            Bukkit.broadcast(msg);
            logger.info("[Dashboard/Reboot] " + text);
        });
    }

    private void execute() {
        long now = System.currentTimeMillis();
        if (armedForMs == nextRunMs()) return; // déjà lancé
        armedForMs = nextRunMs();
        history.add(now);
        if (history.size() > 50) history.remove(0);
        if (mode == Mode.ONCE) { mode = Mode.DISABLED; onceAt = 0; }
        broadcastedMarks.clear();
        save();
        logger.warning("[Dashboard/Reboot] ▶ EXÉCUTION reboot planifié.");
        Bukkit.getScheduler().runTask(plugin, () -> {
            Bukkit.broadcast(Component.text("⚠ Redémarrage en cours...", NamedTextColor.RED));
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                try { Bukkit.spigot().restart(); }
                catch (Throwable t) {
                    logger.warning("[Dashboard/Reboot] restart() indisponible, shutdown: " + t.getMessage());
                    Bukkit.shutdown();
                }
            }, 20L);
        });
    }

    // ── Persistance ───────────────────────────────────────────────────────────

    private synchronized void save() {
        try {
            Map<String, Object> m = snapshot();
            Files.writeString(file.toPath(), GSON.toJson(m), StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.warning("[Dashboard/Reboot] save fail: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void load() {
        if (!file.exists()) return;
        try {
            Map<String, Object> m = GSON.fromJson(Files.readString(file.toPath(), StandardCharsets.UTF_8), Map.class);
            if (m == null) return;
            String md = (String) m.getOrDefault("mode", "DISABLED");
            mode = Mode.valueOf(md);
            Number onceN = (Number) m.get("onceAt");
            onceAt = onceN != null ? onceN.longValue() : 0L;
            hhmm = (String) m.getOrDefault("hhmm", "04:00");
            List<Number> days = (List<Number>) m.get("weeklyDays");
            if (days != null) {
                weeklyDays.clear();
                for (Number n : days) weeklyDays.add(n.intValue());
            }
            List<Number> hist = (List<Number>) m.get("history");
            if (hist != null) {
                history.clear();
                for (Number n : hist) history.add(n.longValue());
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/Reboot] load fail: " + e.getMessage());
        }
    }
}
