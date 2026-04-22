package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.events.CalendarEvent;
import sunanticheat.dashboard.events.EventCalendarStore;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class EventCalendarHandler {

    private final EventCalendarStore store;

    public EventCalendarHandler(EventCalendarStore store) { this.store = store; }

    public void list(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        List<Map<String, Object>> out = new ArrayList<>();
        for (CalendarEvent e : store.all()) out.add(toMap(e));
        out.sort(Comparator.comparingLong(m -> ((Number) m.get("startAt")).longValue()));
        HttpHelper.json(ex, 200, Map.of("events", out));
    }

    @SuppressWarnings("unchecked")
    public void create(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }

        String title = (String) body.get("title");
        String description = (String) body.getOrDefault("description", "");
        long startAt = ((Number) body.getOrDefault("startAt", System.currentTimeMillis())).longValue();
        int durationMinutes = ((Number) body.getOrDefault("durationMinutes", 60)).intValue();
        String color = (String) body.getOrDefault("color", "#F59E0B");
        String icon = (String) body.getOrDefault("icon", "🎉");
        List<String> messages = (List<String>) body.get("broadcastMessages");
        List<Number> offsetsRaw = (List<Number>) body.get("broadcastOffsetsMinutes");
        List<Integer> offsets = null;
        if (offsetsRaw != null) {
            offsets = new ArrayList<>();
            for (Number n : offsetsRaw) offsets.add(n.intValue());
        }
        String startCommand = (String) body.get("startCommand");
        String endCommand = (String) body.get("endCommand");

        CalendarEvent e = store.add(title, description, startAt, durationMinutes, color, icon,
                messages, offsets, startCommand, endCommand);
        HttpHelper.json(ex, 200, toMap(e));
    }

    @SuppressWarnings("unchecked")
    public void update(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "body manquant"); return; }
        CalendarEvent e = store.update(id, body);
        if (e == null) { HttpHelper.error(ex, 404, "event introuvable"); return; }
        HttpHelper.json(ex, 200, toMap(e));
    }

    public void delete(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users, String id) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        boolean ok = store.delete(id);
        HttpHelper.json(ex, ok ? 200 : 404, Map.of("ok", ok));
    }

    public void exportIcs(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        byte[] data = store.toIcs().getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "text/calendar; charset=utf-8");
        ex.getResponseHeaders().add("Content-Disposition", "attachment; filename=\"sunguard-events.ics\"");
        ex.sendResponseHeaders(200, data.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(data); }
    }

    private static Map<String, Object> toMap(CalendarEvent e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.getId());
        m.put("title", e.getTitle());
        m.put("description", e.getDescription());
        m.put("startAt", e.getStartAt());
        m.put("durationMinutes", e.getDurationMinutes());
        m.put("color", e.getColor());
        m.put("icon", e.getIcon());
        m.put("broadcastMessages", e.getBroadcastMessages());
        m.put("broadcastOffsetsMinutes", e.getBroadcastOffsetsMinutes());
        m.put("startCommand", e.getStartCommand());
        m.put("endCommand", e.getEndCommand());
        m.put("createdAt", e.getCreatedAt());
        m.put("started", e.isStarted());
        m.put("ended", e.isEnded());
        return m;
    }
}
