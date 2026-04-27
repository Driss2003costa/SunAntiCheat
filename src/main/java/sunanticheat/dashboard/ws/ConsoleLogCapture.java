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
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.logging.Handler;
import java.util.logging.LogRecord;

/**
 * Appender Log4j2 qui capture toute la sortie console du serveur
 * et la diffuse aux clients WebSocket abonnés au channel "console".
 *
 * Double attache :
 *   1. Appender Log4j2 sur le root logger (capture la majorité des logs Paper/Bukkit)
 *   2. Handler java.util.logging sur le root JUL (safety net pour les plugins
 *      qui loggent via JUL sans passer par Log4j)
 *
 * Un message initial est émis à l'installation pour valider le pipe WS end-to-end.
 */
public final class ConsoleLogCapture extends AbstractAppender {

    private static final String APPENDER_NAME = "SunDashboardCapture";

    /**
     * Garde de réentrance par thread.
     *
     * Si `listener.accept(line)` (qui broadcast vers le WebSocket) loggue indirectement
     * quoi que ce soit (ex. java.net, le serveur WS lui-même), ce log repasse par Log4j
     * et rappelle append() → boucle infinie. Log4j détecte et spam "Recursive call",
     * et le main thread peut freeze assez longtemps pour déclencher le watchdog Paper.
     *
     * On marque le thread courant comme "déjà dans append" et on skip silencieusement
     * si c'est le cas. Pareil pour le handler JUL.
     */
    private static final ThreadLocal<Boolean> IN_APPEND = ThreadLocal.withInitial(() -> Boolean.FALSE);

    private final Consumer<String> listener;
    private final AtomicLong captured = new AtomicLong();

    // Handler JUL (optionnel, sert de fallback)
    private Handler julHandler;

    private ConsoleLogCapture(Consumer<String> listener) {
        super(APPENDER_NAME, null,
                PatternLayout.newBuilder().withPattern("[%d{HH:mm:ss}] [%t/%level]: %msg%n").build(),
                true, null);
        this.listener = listener;
    }

    @Override
    public void append(LogEvent event) {
        if (IN_APPEND.get()) return;     // Réentrance → on ignore, sinon boucle infinie
        IN_APPEND.set(Boolean.TRUE);
        try {
            String line = new String(getLayout().toByteArray(event)).stripTrailing();
            if (line.isEmpty()) return;
            captured.incrementAndGet();
            listener.accept(line);
        } catch (Throwable ignored) {
            // On ne re-loggue jamais depuis ici (sinon récursion garantie)
        } finally {
            IN_APPEND.set(Boolean.FALSE);
        }
    }

    // ── Cycle de vie ────────────────────────────────────────────────────────

    public static ConsoleLogCapture install(Consumer<String> listener) {
        ConsoleLogCapture appender = new ConsoleLogCapture(listener);
        appender.start();

        // ── 1. Attache Log4j2 sur le root logger directement ──────────────────
        // Méthode la plus robuste : on récupère le vrai root Logger et on y attache.
        try {
            Logger rootLogger = (Logger) LogManager.getRootLogger();
            rootLogger.addAppender(appender);
        } catch (Throwable t) {
            // Fallback ancienne méthode via Configuration
            try {
                LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
                Configuration cfg = ctx.getConfiguration();
                cfg.addAppender(appender);
                ctx.getRootLogger().addAppender(appender);
                ctx.updateLoggers();
            } catch (Throwable ignored) {}
        }

        // ── 2. Attache aussi un handler JUL (safety net) ──────────────────────
        try {
            Handler handler = new Handler() {
                @Override public void publish(LogRecord record) {
                    if (record == null || record.getMessage() == null) return;
                    if (IN_APPEND.get()) return;   // Même garde — éviter récursion JUL
                    IN_APPEND.set(Boolean.TRUE);
                    try {
                        String ts = new SimpleDateFormat("HH:mm:ss").format(new Date(record.getMillis()));
                        String msg = record.getMessage();
                        // substitution des paramètres JUL
                        if (record.getParameters() != null && record.getParameters().length > 0) {
                            try { msg = java.text.MessageFormat.format(msg, record.getParameters()); }
                            catch (Throwable ignored) {}
                        }
                        String line = "[" + ts + "] [" + record.getLevel() + "]: " + msg;
                        appender.captured.incrementAndGet();
                        listener.accept(line);
                    } catch (Throwable ignored) {
                    } finally {
                        IN_APPEND.set(Boolean.FALSE);
                    }
                }
                @Override public void flush() {}
                @Override public void close() throws SecurityException {}
            };
            // Évite la duplication : on ne capture QUE si la log n'est pas déjà passée par Log4j.
            // En pratique JUL sur Paper est routé vers Log4j via l'adapter BukkitLogger,
            // donc on active ce handler UNIQUEMENT si l'appender Log4j ne reçoit rien.
            // Pour éviter la duplication, on le laisse désactivé par défaut et on le "réveille"
            // plus tard si captured == 0 après 10s.
            appender.julHandler = handler;

            // Active le handler JUL après 10s si rien n'a été capturé
            Thread delayed = new Thread(() -> {
                try { Thread.sleep(10_000); } catch (InterruptedException e) { return; }
                if (appender.captured.get() == 0) {
                    try {
                        java.util.logging.Logger.getLogger("").addHandler(handler);
                        listener.accept("[dashboard] Fallback JUL activé (Log4j n'envoyait rien)");
                    } catch (Throwable ignored) {}
                }
            }, "dashboard-log-capture-fallback");
            delayed.setDaemon(true);
            delayed.start();
        } catch (Throwable ignored) {}

        // ── 3. Message initial pour valider le pipe WS ─────────────────────
        // Émis en asynchrone pour laisser le WS démarrer
        Thread hello = new Thread(() -> {
            try { Thread.sleep(500); } catch (InterruptedException e) { return; }
            String ts = new SimpleDateFormat("HH:mm:ss").format(new Date());
            try {
                listener.accept("[" + ts + "] [INFO]: [Dashboard] Console capture active — en attente de logs serveur...");
            } catch (Throwable ignored) {}
        }, "dashboard-console-hello");
        hello.setDaemon(true);
        hello.start();

        return appender;
    }

    /** Nombre de lignes capturées depuis le start (utile pour diag). */
    public long getCapturedCount() {
        return captured.get();
    }

    public void uninstall() {
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
    }
}
