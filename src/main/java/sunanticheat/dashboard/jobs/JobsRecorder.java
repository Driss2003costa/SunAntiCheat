package sunanticheat.dashboard.jobs;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.event.Event;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.plugin.EventExecutor;
import org.bukkit.plugin.Plugin;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.logging.Logger;

/**
 * Listener Bukkit qui capture les events Jobs Reborn par RÉFLEXION.
 *
 * On n'importe AUCUNE classe `com.gamingmesh.jobs.*` directement, ce qui permet
 * au plugin de compiler sans Jobs Reborn dans le classpath. À l'exécution, si
 * Jobs est présent, on enregistre dynamiquement les hooks pour ses events.
 *
 * Si Jobs Reborn n'est pas chargé, register() est un no-op silencieux.
 */
public final class JobsRecorder implements Listener {

    private final JobsStore store;
    private final Plugin plugin;
    private final Logger logger;
    private final JobsFarmDetector farmDetector;
    private final Consumer<Map<String, Object>> liveCallback;

    public JobsRecorder(JobsStore store, Plugin plugin,
                        JobsFarmDetector farmDetector,
                        Consumer<Map<String, Object>> liveCallback) {
        this.store = store;
        this.plugin = plugin;
        this.logger = plugin.getLogger();
        this.farmDetector = farmDetector;
        this.liveCallback = liveCallback;
    }

    /**
     * Enregistre les hooks d'événements Jobs si la classe est trouvable.
     * Retourne true si au moins un event a été hooké.
     */
    public boolean register() {
        boolean any = false;
        any |= hook("com.gamingmesh.jobs.api.JobsPaymentEvent", this::handlePayment);
        any |= hook("com.gamingmesh.jobs.api.JobsJoinEvent", e -> handleEvent(e, "JOIN", 1));
        any |= hook("com.gamingmesh.jobs.api.JobsLeaveEvent", e -> handleEvent(e, "LEAVE", 0));
        any |= hook("com.gamingmesh.jobs.api.JobsLevelUpEvent", this::handleLevelUp);
        return any;
    }

    @SuppressWarnings("unchecked")
    private boolean hook(String fqcn, EventConsumer consumer) {
        try {
            Class<?> eventClass = Class.forName(fqcn);
            if (!Event.class.isAssignableFrom(eventClass)) return false;
            Bukkit.getPluginManager().registerEvent(
                    (Class<? extends Event>) eventClass, this, EventPriority.MONITOR,
                    (EventExecutor) (listener, event) -> {
                        try { consumer.accept(event); } catch (Throwable ignored) {}
                    },
                    plugin, true);
            return true;
        } catch (ClassNotFoundException e) {
            return false;
        } catch (Throwable t) {
            logger.warning("[Jobs] Échec hook " + fqcn + " : " + t.getMessage());
            return false;
        }
    }

    @FunctionalInterface
    private interface EventConsumer { void accept(Event e) throws Throwable; }

    // ── Handlers (par réflexion) ─────────────────────────────────────────────

    private void handlePayment(Event e) throws Throwable {
        // getPlayer() on JobsPaymentEvent returns a JobsPlayer, not OfflinePlayer
        Object jobsPlayer = invoke(e, "getPlayer", Object.class);
        String uuid = null, name = null;
        if (jobsPlayer instanceof OfflinePlayer op) {
            uuid = playerUuid(op);
            name = op.getName();
        } else if (jobsPlayer != null) {
            Object u = invoke(jobsPlayer, "getPlayerUUID", Object.class);
            if (u instanceof UUID uu) uuid = uu.toString();
            Object n = invoke(jobsPlayer, "getName", Object.class);
            if (n != null) name = String.valueOf(n);
        }

        Object job = invoke(e, "getJob", Object.class);
        String jobName = jobName(job);

        // API ancienne : getPayment() → Map<CurrencyType, Double>
        // API récente (5.x+) : getMoney() / getExp() directs
        double money = 0, exp = 0;
        Object paymentMap = invoke(e, "getPayment", Object.class);
        if (paymentMap instanceof java.util.Map<?, ?> map) {
            for (java.util.Map.Entry<?, ?> en : map.entrySet()) {
                String key = String.valueOf(en.getKey());
                double v = en.getValue() instanceof Number ? ((Number) en.getValue()).doubleValue() : 0;
                if ("MONEY".equalsIgnoreCase(key)) money = v;
                else if ("EXP".equalsIgnoreCase(key) || "POINTS".equalsIgnoreCase(key)) exp = v;
            }
        } else {
            Object m = invoke(e, "getMoney", Object.class);
            if (m instanceof Number n) money = n.doubleValue();
            Object ex2 = invoke(e, "getExp", Object.class);
            if (ex2 instanceof Number n) exp = n.doubleValue();
        }

        String actionType = null;
        try {
            Object actionInfo = invoke(e, "getActionInfo", Object.class);
            if (actionInfo != null) {
                Object type = invoke(actionInfo, "getType", Object.class);
                if (type != null) actionType = String.valueOf(type);
            }
        } catch (Throwable ignored) {}

        store.recordPayment(uuid, name, jobName, money, exp, actionType);

        if (farmDetector != null) farmDetector.record(uuid, name, actionType);

        if (liveCallback != null) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("type", "payment");
            payload.put("timestamp", System.currentTimeMillis());
            payload.put("playerName", name);
            payload.put("playerUuid", uuid);
            payload.put("jobName", jobName);
            payload.put("money", money);
            payload.put("exp", exp);
            payload.put("actionType", actionType);
            liveCallback.accept(payload);
        }
    }

    private void handleEvent(Event e, String evType, int level) throws Throwable {
        OfflinePlayer p = invoke(e, "getPlayer", OfflinePlayer.class);
        Object job = invoke(e, "getJob", Object.class);
        String jName = jobName(job);
        store.recordEvent(playerUuid(p), p == null ? null : p.getName(), jName, evType, level);

        if (liveCallback != null) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("type", evType);
            payload.put("timestamp", System.currentTimeMillis());
            payload.put("playerName", p == null ? null : p.getName());
            payload.put("playerUuid", playerUuid(p));
            payload.put("jobName", jName);
            payload.put("level", level);
            liveCallback.accept(payload);
        }
    }

    private void handleLevelUp(Event e) throws Throwable {
        // ev.getPlayer() returns JobsPlayer dans le LevelUpEvent — on récupère son UUID
        Object jobsPlayer = invoke(e, "getPlayer", Object.class);
        String uuid = null, name = null;
        if (jobsPlayer != null) {
            Object u = invoke(jobsPlayer, "getPlayerUUID", Object.class);
            if (u instanceof UUID uu) uuid = uu.toString();
            Object n = invoke(jobsPlayer, "getName", Object.class);
            if (n != null) name = String.valueOf(n);
        }
        Object job = invoke(e, "getJob", Object.class);
        String jName = jobName(job);
        int level = 0;
        try {
            Object lvl = invoke(e, "getNewLevel", Object.class);
            if (lvl instanceof Number num) level = num.intValue();
        } catch (Throwable ignored) {}
        store.recordEvent(uuid, name, jName, "LEVEL_UP", level);

        if (liveCallback != null) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("type", "LEVEL_UP");
            payload.put("timestamp", System.currentTimeMillis());
            payload.put("playerName", name);
            payload.put("playerUuid", uuid);
            payload.put("jobName", jName);
            payload.put("level", level);
            liveCallback.accept(payload);
        }
    }

    // ── Helpers réflexion ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private static <T> T invoke(Object target, String methodName, Class<T> returnType) throws Throwable {
        Method m = target.getClass().getMethod(methodName);
        Object res = m.invoke(target);
        return res == null ? null : (T) res;
    }

    private static String playerUuid(OfflinePlayer p) {
        return p == null || p.getUniqueId() == null ? null : p.getUniqueId().toString();
    }

    private static String jobName(Object job) {
        if (job == null) return "unknown";
        try {
            Object n = job.getClass().getMethod("getName").invoke(job);
            return n != null ? String.valueOf(n) : "unknown";
        } catch (Throwable t) {
            return "unknown";
        }
    }
}
