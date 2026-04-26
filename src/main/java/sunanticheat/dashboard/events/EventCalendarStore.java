package sunanticheat.dashboard.events;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.io.File;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

public final class EventCalendarStore {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().serializeNulls().create();
    private static final List<Integer> DEFAULT_OFFSETS = List.of(60, 15, 5, 1);

    private final Persistence storage;
    private final Logger logger;
    private final JavaPlugin plugin;
    private final Map<String, CalendarEvent> events = new ConcurrentHashMap<>();
    private final Set<String> broadcastedKeys = ConcurrentHashMap.newKeySet(); // "id:offset"
    private BukkitTask tickTask;

    public EventCalendarStore(JavaPlugin plugin, File dataFolder, Logger logger, BlobStorage blobs) {
        this.plugin = plugin;
        this.logger = logger;
        File legacy = new File(new File(dataFolder, "dashboard"), "events.json");
        this.storage = new Persistence(blobs, "events", legacy);
        load();
    }

    public void start() {
        tickTask = Bukkit.getScheduler().runTaskTimer(plugin, this::tick, 200L, 600L); // toutes les 30s
    }
    public void stop() { if (tickTask != null) tickTask.cancel(); save(); }

    public Collection<CalendarEvent> all() { return new ArrayList<>(events.values()); }
    public CalendarEvent get(String id) { return events.get(id); }

    public CalendarEvent add(String title, String description, long startAt, int durationMinutes,
                             String color, String icon, List<String> messages, List<Integer> offsets,
                             String startCommand, String endCommand) {
        String id = UUID.randomUUID().toString();
        CalendarEvent e = new CalendarEvent(id, title, description, startAt, durationMinutes,
                color, icon, messages, offsets != null ? offsets : DEFAULT_OFFSETS,
                startCommand, endCommand, System.currentTimeMillis(), false, false);
        events.put(id, e);
        save();
        return e;
    }

    public CalendarEvent update(String id, Map<String, Object> patch) {
        CalendarEvent e = events.get(id);
        if (e == null) return null;
        if (patch.containsKey("title")) e.setTitle((String) patch.get("title"));
        if (patch.containsKey("description")) e.setDescription((String) patch.get("description"));
        if (patch.containsKey("startAt")) e.setStartAt(((Number) patch.get("startAt")).longValue());
        if (patch.containsKey("durationMinutes")) e.setDurationMinutes(((Number) patch.get("durationMinutes")).intValue());
        if (patch.containsKey("color")) e.setColor((String) patch.get("color"));
        if (patch.containsKey("icon")) e.setIcon((String) patch.get("icon"));
        if (patch.containsKey("broadcastMessages")) e.setBroadcastMessages((List<String>) patch.get("broadcastMessages"));
        if (patch.containsKey("broadcastOffsetsMinutes")) {
            List<Number> o = (List<Number>) patch.get("broadcastOffsetsMinutes");
            List<Integer> ints = new ArrayList<>();
            if (o != null) for (Number n : o) ints.add(n.intValue());
            e.setBroadcastOffsetsMinutes(ints);
        }
        if (patch.containsKey("startCommand")) e.setStartCommand((String) patch.get("startCommand"));
        if (patch.containsKey("endCommand")) e.setEndCommand((String) patch.get("endCommand"));
        save();
        return e;
    }

    public boolean delete(String id) {
        boolean r = events.remove(id) != null;
        if (r) save();
        return r;
    }

    // ── Tick : broadcasts + start/end auto ────────────────────────────────────
    private void tick() {
        long now = System.currentTimeMillis();
        for (CalendarEvent e : events.values()) {
            if (e.isEnded()) continue;
            long start = e.getStartAt();
            long end = start + e.getDurationMinutes() * 60_000L;

            // Broadcast pre-start
            if (now < start) {
                long deltaMin = (start - now) / 60_000L;
                List<Integer> offsets = e.getBroadcastOffsetsMinutes();
                if (offsets != null) {
                    for (int o : offsets) {
                        String key = e.getId() + ":" + o;
                        if (deltaMin <= o && !broadcastedKeys.contains(key)) {
                            broadcastedKeys.add(key);
                            broadcast(e, "⏰ " + e.getIcon() + " " + e.getTitle() + " dans " + o + " min !");
                        }
                    }
                }
            }
            // Start
            if (!e.isStarted() && now >= start && now < end) {
                e.setStarted(true);
                broadcast(e, "▶ " + e.getIcon() + " " + e.getTitle() + " commence !");
                if (e.getStartCommand() != null && !e.getStartCommand().isBlank()) {
                    dispatch(e.getStartCommand());
                }
                save();
            }
            // End
            if (e.isStarted() && !e.isEnded() && now >= end) {
                e.setEnded(true);
                broadcast(e, "⏹ " + e.getIcon() + " " + e.getTitle() + " est terminé !");
                if (e.getEndCommand() != null && !e.getEndCommand().isBlank()) {
                    dispatch(e.getEndCommand());
                }
                save();
            }
        }
    }

    private void broadcast(CalendarEvent e, String text) {
        Bukkit.getScheduler().runTask(plugin, () ->
                Bukkit.broadcast(Component.text(text, NamedTextColor.YELLOW)));
    }
    private void dispatch(String cmd) {
        Bukkit.getScheduler().runTask(plugin, () -> Bukkit.dispatchCommand(Bukkit.getConsoleSender(),
                cmd.startsWith("/") ? cmd.substring(1) : cmd));
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    public synchronized void save() {
        try {
            storage.write(GSON.toJson(new ArrayList<>(events.values())));
        } catch (Exception ex) { logger.warning("[Dashboard/Events] save: " + ex.getMessage()); }
    }

    private void load() {
        String json = storage.read();
        if (json == null || json.isBlank()) return;
        try {
            List<CalendarEvent> list = GSON.fromJson(json, new TypeToken<List<CalendarEvent>>(){}.getType());
            if (list != null) for (CalendarEvent e : list) events.put(e.getId(), e);
        } catch (Exception ex) { logger.warning("[Dashboard/Events] load: " + ex.getMessage()); }
    }

    // ── ICS export ────────────────────────────────────────────────────────────
    public String toIcs() {
        StringBuilder sb = new StringBuilder();
        sb.append("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SunGuard//Dashboard//FR\r\n");
        for (CalendarEvent e : events.values()) {
            String dtStart = icsDate(e.getStartAt());
            String dtEnd = icsDate(e.getStartAt() + e.getDurationMinutes() * 60_000L);
            sb.append("BEGIN:VEVENT\r\n")
              .append("UID:").append(e.getId()).append("@sunguard\r\n")
              .append("DTSTAMP:").append(dtStart).append("\r\n")
              .append("DTSTART:").append(dtStart).append("\r\n")
              .append("DTEND:").append(dtEnd).append("\r\n")
              .append("SUMMARY:").append(escapeIcs(e.getIcon() + " " + e.getTitle())).append("\r\n")
              .append("DESCRIPTION:").append(escapeIcs(e.getDescription())).append("\r\n")
              .append("END:VEVENT\r\n");
        }
        sb.append("END:VCALENDAR\r\n");
        return sb.toString();
    }
    private static String icsDate(long ms) {
        return new java.text.SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'")
                .format(new Date(ms - TimeZone.getDefault().getOffset(ms)));
    }
    private static String escapeIcs(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n");
    }
}
