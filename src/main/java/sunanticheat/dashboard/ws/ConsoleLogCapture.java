package sunanticheat.dashboard.ws;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Configuration;
import org.apache.logging.log4j.core.layout.PatternLayout;

import java.util.function.Consumer;

/**
 * Appender Log4j2 qui capture toute la sortie console du serveur
 * et la diffuse aux clients WebSocket abonnés au channel "console".
 */
public final class ConsoleLogCapture extends AbstractAppender {

    private static final String APPENDER_NAME = "SunDashboardCapture";
    private final Consumer<String> listener;

    private ConsoleLogCapture(Consumer<String> listener) {
        super(APPENDER_NAME, null,
                PatternLayout.newBuilder().withPattern("[%d{HH:mm:ss}] [%t/%level]: %msg%n").build(),
                true, null);
        this.listener = listener;
    }

    @Override
    public void append(LogEvent event) {
        try {
            String line = new String(getLayout().toByteArray(event)).stripTrailing();
            if (!line.isEmpty()) listener.accept(line);
        } catch (Exception ignored) {}
    }

    // ── Cycle de vie ────────────────────────────────────────────────────────

    public static ConsoleLogCapture install(Consumer<String> listener) {
        ConsoleLogCapture appender = new ConsoleLogCapture(listener);
        appender.start();
        LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
        Configuration cfg = ctx.getConfiguration();
        cfg.addAppender(appender);
        ctx.getRootLogger().addAppender(appender);
        ctx.updateLoggers();
        return appender;
    }

    public void uninstall() {
        stop();
        LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
        ctx.getRootLogger().removeAppender(this);
        ctx.updateLoggers();
    }
}
