package sunanticheat.dashboard.ws;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.Logger;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Configuration;
import org.apache.logging.log4j.core.layout.PatternLayout;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.logging.Handler;
import java.util.logging.LogRecord;

/**
 * Appender Log4j2 qui capture toute la sortie console du serveur
 * et la diffuse aux clients WebSocket abonnés au channel "console".
 *
 * Architecture anti-récursion :
 *
 *   1. **Filtre par logger name** : on ignore les events provenant de
 *      la lib WebSocket / notre propre broadcaster, sinon ils
 *      triggeraient une boucle log → broadcast → log → ...
 *
 *   2. **Queue asynchrone** : append() ne fait QUE poser la ligne dans
 *      une LinkedBlockingQueue (capacité 10k, drop si plein). Un thread
 *      dédié (broadcast-thread) drain la queue et appelle listener.
 *      Comme ça, même si broadcast() génère un log, il est capturé
 *      sur le broadcast-thread (pas en récursion), filtré par le step 1,
 *      et la boucle est cassée.
 *
 *   3. **Anti-recursion ThreadLocal** : ceinture + bretelles, pour le cas
 *      où un autre chemin (JUL handler, Paper, etc.) trigger une re-entrée.
 */
public final class ConsoleLogCapture extends AbstractAppender {

    private static final String APPENDER_NAME = "SunDashboardCapture";
    private static final int QUEUE_CAPACITY = 10_000;

    /** Ne JAMAIS capturer les events provenant de ces loggers (boucle infinie). */
    private static final String[] BLOCKED_LOGGER_PREFIXES = {
            "org.java_websocket",
            "sunanticheat.deps.websocket",     // (relocation shadowJar)
            "sunanticheat.dashboard.ws",
            "io.netty",
            "org.eclipse.jetty",
    };

    private static final ThreadLocal<Boolean> IN_APPEND = ThreadLocal.withInitial(() -> Boolean.FALSE);

    private final Consumer<String> listener;
    private final AtomicLong captured = new AtomicLong();
    private final AtomicLong dropped = new AtomicLong();
    private final LinkedBlockingQueue<String> queue = new LinkedBlockingQueue<>(QUEUE_CAPACITY);

    private Thread broadcastThread;
    private Handler julHandler;
    private volatile boolean stopping = false;

    private ConsoleLogCapture(Consumer<String> listener) {
        super(APPENDER_NAME, null,
                PatternLayout.newBuilder().withPattern("[%d{HH:mm:ss}] [%t/%level]: %msg%n").build(),
                true, null);
        this.listener = listener;
    }

    @Override
    public void append(LogEvent event) {
        if (stopping || IN_APPEND.get()) return;

        // ── Filtre par logger name : kill la récursion à la source ────────────
        String loggerName = event.getLoggerName();
        if (loggerName != null) {
            for (String prefix : BLOCKED_LOGGER_PREFIXES) {
                if (loggerName.startsWith(prefix)) return;
            }
        }

        IN_APPEND.set(Boolean.TRUE);
        try {
            String line = new String(getLayout().toByteArray(event)).stripTrailing();
            if (line.isEmpty()) return;
            captured.incrementAndGet();
            // Pose dans la queue, drop si plein (jamais bloquant — sinon main thread freeze)
            if (!queue.offer(line)) dropped.incrementAndGet();
        } catch (Throwable ignored) {
            // On NE relogue JAMAIS depuis ici
        } finally {
            IN_APPEND.set(Boolean.FALSE);
        }
    }

    // ── Cycle de vie ────────────────────────────────────────────────────────

    public static ConsoleLogCapture install(Consumer<String> listener) {
        ConsoleLogCapture appender = new ConsoleLogCapture(listener);
        appender.start();

        // ── 1. Thread broadcaster dédié ──────────────────────────────────────
        appender.broadcastThread = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted() && !appender.stopping) {
                try {
                    String line = appender.queue.take(); // bloque si vide
                    try { listener.accept(line); }
                    catch (Throwable ignored) {}        // jamais propager — sinon le thread meurt
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                } catch (Throwable ignored) {}
            }
        }, "sunguard-console-broadcast");
        appender.broadcastThread.setDaemon(true);
        appender.broadcastThread.start();

        // ── 2. Attache Log4j2 ────────────────────────────────────────────────
        try {
            Logger rootLogger = (Logger) LogManager.getRootLogger();
            rootLogger.addAppender(appender);
        } catch (Throwable t) {
            try {
                LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
                Configuration cfg = ctx.getConfiguration();
                cfg.addAppender(appender);
                ctx.getRootLogger().addAppender(appender);
                ctx.updateLoggers();
            } catch (Throwable ignored) {}
        }

        // ── 3. Handler JUL fallback (avec mêmes protections) ─────────────────
        try {
            Handler handler = new Handler() {
                @Override public void publish(LogRecord record) {
                    if (record == null || record.getMessage() == null) return;
                    if (appender.stopping || IN_APPEND.get()) return;
                    String src = record.getLoggerName();
                    if (src != null) {
                        for (String prefix : BLOCKED_LOGGER_PREFIXES) {
                            if (src.startsWith(prefix)) return;
                        }
                    }
                    IN_APPEND.set(Boolean.TRUE);
                    try {
                        String ts = new SimpleDateFormat("HH:mm:ss").format(new Date(record.getMillis()));
                        String msg = record.getMessage();
                        if (record.getParameters() != null && record.getParameters().length > 0) {
                            try { msg = java.text.MessageFormat.format(msg, record.getParameters()); }
                            catch (Throwable ignored) {}
                        }
                        String line = "[" + ts + "] [" + record.getLevel() + "]: " + msg;
                        appender.captured.incrementAndGet();
                        if (!appender.queue.offer(line)) appender.dropped.incrementAndGet();
                    } catch (Throwable ignored) {
                    } finally {
                        IN_APPEND.set(Boolean.FALSE);
                    }
                }
                @Override public void flush() {}
                @Override public void close() throws SecurityException {}
            };
            appender.julHandler = handler;

            // Active le handler JUL après 10s si Log4j ne reçoit rien
            Thread delayed = new Thread(() -> {
                try { Thread.sleep(10_000); } catch (InterruptedException e) { return; }
                if (appender.captured.get() == 0) {
                    try {
                        java.util.logging.Logger.getLogger("").addHandler(handler);
                        appender.queue.offer("[dashboard] Fallback JUL activé (Log4j n'envoyait rien)");
                    } catch (Throwable ignored) {}
                }
            }, "sunguard-log-capture-fallback");
            delayed.setDaemon(true);
            delayed.start();
        } catch (Throwable ignored) {}

        // ── 4. Hello message ─────────────────────────────────────────────────
        Thread hello = new Thread(() -> {
            try { Thread.sleep(500); } catch (InterruptedException e) { return; }
            String ts = new SimpleDateFormat("HH:mm:ss").format(new Date());
            appender.queue.offer("[" + ts + "] [INFO]: [Dashboard] Console capture active — en attente de logs serveur...");
        }, "sunguard-console-hello");
        hello.setDaemon(true);
        hello.start();

        return appender;
    }

    public long getCapturedCount() { return captured.get(); }
    public long getDroppedCount()  { return dropped.get(); }

    public void uninstall() {
        stopping = true;
        stop();
        try {
            Logger rootLogger = (Logger) LogManager.getRootLogger();
            rootLogger.removeAppender(this);
        } catch (Throwable ignored) {}
        try {
            LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
            ctx.getRootLogger().removeAppender(this);
            ctx.updateLoggers();
        } catch (Throwable ignored) {}
        if (julHandler != null) {
            try { java.util.logging.Logger.getLogger("").removeHandler(julHandler); }
            catch (Throwable ignored) {}
        }
        if (broadcastThread != null) {
            broadcastThread.interrupt();
            broadcastThread = null;
        }
        queue.clear();
    }
}
