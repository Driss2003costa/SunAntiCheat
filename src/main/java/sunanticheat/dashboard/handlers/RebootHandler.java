package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.reboot.RebootScheduler;

import java.io.IOException;
import java.util.List;
import java.util.Map;

public final class RebootHandler {

    private final RebootScheduler scheduler;

    public RebootHandler(RebootScheduler scheduler) { this.scheduler = scheduler; }

    public void status(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        HttpHelper.json(ex, 200, scheduler.snapshot());
    }

    @SuppressWarnings("unchecked")
    public void schedule(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }
        String mode = String.valueOf(body.get("mode"));
        switch (mode) {
            case "ONCE" -> {
                Number at = (Number) body.get("at");
                if (at == null) { HttpHelper.error(ex, 400, "at manquant"); return; }
                scheduler.scheduleOnce(at.longValue());
            }
            case "DAILY" -> {
                String hhmm = (String) body.get("hhmm");
                if (hhmm == null) { HttpHelper.error(ex, 400, "hhmm manquant"); return; }
                scheduler.scheduleDaily(hhmm);
            }
            case "WEEKLY" -> {
                String hhmm = (String) body.get("hhmm");
                List<Number> days = (List<Number>) body.get("days");
                if (hhmm == null || days == null) { HttpHelper.error(ex, 400, "hhmm+days requis"); return; }
                List<Integer> dayInts = new java.util.ArrayList<>();
                for (Number n : days) dayInts.add(n.intValue());
                scheduler.scheduleWeekly(hhmm, dayInts);
            }
            default -> { HttpHelper.error(ex, 400, "mode invalide (ONCE|DAILY|WEEKLY)"); return; }
        }
        HttpHelper.json(ex, 200, scheduler.snapshot());
    }

    public void cancel(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        scheduler.cancel();
        HttpHelper.json(ex, 200, scheduler.snapshot());
    }

    public void now(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;
        scheduler.rebootNow();
        HttpHelper.json(ex, 200, scheduler.snapshot());
    }
}
