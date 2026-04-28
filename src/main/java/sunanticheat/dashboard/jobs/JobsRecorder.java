package sunanticheat.dashboard.jobs;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.event.Event;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.plugin.EventExecutor;
import org.bukkit.plugin.Plugin;

import java.lang.reflect.Method;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
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

    /**
     * Cache de déduplication. Jobs Reborn fire parfois ses events 2 fois
     * (notamment lors d'un /jobs join sur un job existant qui déclenche
     * leave + join + un autre cycle interne). Plus, dans certains scenarios
     * de reload/re-register, on peut avoir un double-listening.
     *
     * Solution : on ignore tout event identique à un précédent reçu dans la
     * dernière seconde. Clé = "TYPE|uuid|jobName" (pour les events) ou
     * "PAY|uuid|jobName|amount" (pour les paiements — où le dedup est strict
     * pour éviter de perdre des paiements identiques légitimes, on inclut
     * un nano-timestamp tronqué).
     */
    private static final long DEDUP_WINDOW_MS = 5000; // 5s anti-spam JOIN/LEAVE
    private final ConcurrentHashMap<String, Long> recent = new ConcurrentHashMap<>();

    public JobsRecorder(JobsStore store, Plugin plugin) {
        this.store = store;
        this.plugin = plugin;
        this.logger = plugin.getLogger();
    }

    /** @return true si l'event est nouveau (à enregistrer). false si dup récent. */
    private boolean shouldRecord(String key) {
        long now = System.currentTimeMillis();
        Long last = recent.get(key);
        if (last != null && (now - last) < DEDUP_WINDOW_MS) return false;
        recent.put(key, now);
        // Cleanup périodique (évite la fuite mémoire si beaucoup de joueurs)
        if (recent.size() > 2000) {
            recent.entrySet().removeIf(e -> (now - e.getValue()) > 10_000);
        }
        return true;
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
                        // Vérification STRICTE du type : Jobs Reborn partage parfois
                        // la HandlerList entre ses events (JoinEvent, PaymentEvent,
                        // ExpGainEvent...) parce qu'ils héritent d'un parent commun
                        // sans override getHandlers(). Sans ce check, notre handler
                        // JOIN reçoit aussi les payments → faux events JOIN dans
                        // l'historique à chaque gain d'argent.
                        if (event.getClass() != eventClass) return;
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
        Class<?> ec = e.getClass();
        OfflinePlayer p = invoke(e, "getPlayer", OfflinePlayer.class);
        String uuid = playerUuid(p);
        String name = p == null ? null : p.getName();

        // Job
        Object job = invoke(e, "getJob", Object.class);
        String jobName = jobName(job);

        // Payment map (CurrencyType → Double)
        double money = 0, exp = 0;
        Object paymentMap = invoke(e, "getPayment", Object.class);
        if (paymentMap instanceof java.util.Map<?, ?> map) {
            for (java.util.Map.Entry<?, ?> en : map.entrySet()) {
                String key = String.valueOf(en.getKey());
                double v = en.getValue() instanceof Number ? ((Number) en.getValue()).doubleValue() : 0;
                if ("MONEY".equalsIgnoreCase(key)) money = v;
                else if ("EXP".equalsIgnoreCase(key) || "POINTS".equalsIgnoreCase(key)) exp = v;
            }
        }

        // ActionType (optional)
        String actionType = null;
        try {
            Object actionInfo = invoke(e, "getActionInfo", Object.class);
            if (actionInfo != null) {
                Object type = invoke(actionInfo, "getType", Object.class);
                if (type != null) actionType = String.valueOf(type);
            }
        } catch (Throwable ignored) {}

        store.recordPayment(uuid, name, jobName, money, exp, actionType);
    }

    private void handleEvent(Event e, String evType, int level) throws Throwable {
        OfflinePlayer p = invoke(e, "getPlayer", OfflinePlayer.class);
        Object job = invoke(e, "getJob", Object.class);
        String uuid = playerUuid(p);
        String jName = jobName(job);
        // Clé commune JOIN/LEAVE : un seul event par joueur×job dans la fenêtre de 5s
        if (!shouldRecord("CHANGE|" + uuid + "|" + jName)) return;
        store.recordEvent(uuid, p == null ? null : p.getName(), jName, evType, level);
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
        // Le nom de méthode du level varie selon les versions de Jobs Reborn :
        //   - getNewLevel() (versions récentes)
        //   - getLevel()    (anciennes)
        //   - getNewLevelString() (renvoie un String)
        int level = 0;
        for (String method : new String[]{"getNewLevel", "getLevel", "getNewLevelInt"}) {
            try {
                Object lvl = invoke(e, method, Object.class);
                if (lvl instanceof Number num) { level = num.intValue(); break; }
                if (lvl instanceof String s && !s.isBlank()) {
                    try { level = Integer.parseInt(s.trim()); break; } catch (Exception ignored) {}
                }
            } catch (Throwable ignored) {}
        }
        String jName = jobName(job);
        // Dedup : level-up identique répété → skip
        if (!shouldRecord("LEVEL_UP|" + uuid + "|" + jName + "|" + level)) return;
        store.recordEvent(uuid, name, jName, "LEVEL_UP", level);
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
