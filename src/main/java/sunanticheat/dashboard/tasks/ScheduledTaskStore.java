package sunanticheat.dashboard.tasks;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Persistance JSON + scheduler Bukkit (tick toutes les minutes).
 * Fichier : plugins/SunAntiCheat/dashboard/tasks.json
 */
public final class ScheduledTaskStore {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().serializeNulls().create();
    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    private final File file;
    private final Logger logger;
    private final Map<String, ScheduledTask> tasks = new ConcurrentHashMap<>();
    private BukkitTask tickTask;

    public ScheduledTaskStore(File dataFolder, Logger logger) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        dir.mkdirs();
        this.file = new File(dir, "tasks.json");
        load();
    }

    public Collection<ScheduledTask> getAll() {
        return new ArrayList<>(tasks.values());
    }

    public ScheduledTask get(String id) {
        return tasks.get(id);
    }

    public ScheduledTask add(String name, String command, List<String> times,
                             boolean enabled, String color, String icon) {
        String id = UUID.randomUUID().toString();
        ScheduledTask t = new ScheduledTask(id, name, command, sanitizeTimes(times),
                enabled, color, icon, 0L, System.currentTimeMillis());
        tasks.put(id, t);
        save();
        return t;
    }

    public ScheduledTask update(String id, String name, String command, List<String> times,
                                Boolean enabled, String color, String icon) {
        ScheduledTask t = tasks.get(id);
        if (t == null) return null;
        if (name != null) t.setName(name);
        if (command != null) t.setCommand(command);
        if (times != null) t.setTimes(sanitizeTimes(times));
        if (enabled != null) t.setEnabled(enabled);
        if (color != null) t.setColor(color);
        if (icon != null) t.setIcon(icon);
        save();
        return t;
    }

    public boolean delete(String id) {
        boolean removed = tasks.remove(id) != null;
        if (removed) save();
        return removed;
    }

    /** Exécute une tâche immédiatement (via Bukkit scheduler sur main thread). */
    public boolean runNow(JavaPlugin plugin, String id) {
        ScheduledTask t = tasks.get(id);
        if (t == null) return false;
        dispatch(plugin, t);
        return true;
    }

    // ── Scheduler ─────────────────────────────────────────────────────────────

    public void start(JavaPlugin plugin) {
        // Tick toutes les 60 secondes (1200 ticks) — léger délai initial pour laisser le serveur démarrer
        tickTask = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin,
                () -> tick(plugin), 200L, 1200L);
    }

    public void stop() {
        if (tickTask != null) { tickTask.cancel(); tickTask = null; }
        save();
    }

    private void tick(JavaPlugin plugin) {
        String now = LocalDateTime.now().format(HHMM);
        long nowMs = System.currentTimeMillis();
        for (ScheduledTask t : tasks.values()) {
            if (!t.isEnabled()) continue;
            if (!t.getTimes().contains(now)) continue;
            // Déduplication : pas deux fois dans la même minute
            if (nowMs - t.getLastRun() < 55_000) continue;
            dispatch(plugin, t);
        }
    }

    private void dispatch(JavaPlugin plugin, ScheduledTask t) {
        t.setLastRun(System.currentTimeMillis());
        save();
        Bukkit.getScheduler().runTask(plugin, () -> {
            String cmd = t.getCommand();
            if (cmd == null || cmd.isBlank()) return;
            logger.info("[Dashboard/Tasks] ▶ " + t.getName() + " : " + cmd);
            try {
                Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd.startsWith("/") ? cmd.substring(1) : cmd);
            } catch (Exception e) {
                logger.warning("[Dashboard/Tasks] Erreur exécution '" + t.getName() + "': " + e.getMessage());
            }
        });
    }

    // ── Persistance ───────────────────────────────────────────────────────────

    public synchronized void save() {
        try {
            List<ScheduledTask> list = new ArrayList<>(tasks.values());
            String json = GSON.toJson(list);
            Files.writeString(file.toPath(), json, StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.warning("[Dashboard/Tasks] Erreur sauvegarde : " + e.getMessage());
        }
    }

    private void load() {
        if (!file.exists()) return;
        try {
            String json = Files.readString(file.toPath(), StandardCharsets.UTF_8);
            if (json.isBlank()) return;
            List<ScheduledTask> list = GSON.fromJson(json, new TypeToken<List<ScheduledTask>>(){}.getType());
            if (list == null) return;
            for (ScheduledTask t : list) {
                if (t != null && t.getId() != null) tasks.put(t.getId(), t);
            }
            logger.info("[Dashboard/Tasks] " + tasks.size() + " tâche(s) planifiée(s) chargée(s).");
        } catch (Exception e) {
            logger.warning("[Dashboard/Tasks] Erreur chargement : " + e.getMessage());
        }
    }

    private static List<String> sanitizeTimes(List<String> times) {
        List<String> out = new ArrayList<>();
        if (times == null) return out;
        for (String s : times) {
            if (s == null) continue;
            String trimmed = s.trim();
            if (trimmed.matches("^([01]\\d|2[0-3]):[0-5]\\d$")) {
                if (!out.contains(trimmed)) out.add(trimmed);
            }
        }
        Collections.sort(out);
        return out;
    }
}
