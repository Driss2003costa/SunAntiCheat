package sunanticheat.alerts;

import org.bukkit.plugin.java.JavaPlugin;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Enregistre les violations (alertes) dans un fichier log pour audit.
 * Format : timestamp | type | joueur | détail
 */
public class ViolationLogService {

    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.systemDefault());

    private final JavaPlugin plugin;

    public ViolationLogService(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public void log(String checkType, String playerName, String detail) {
        if (!plugin.getConfig().getBoolean("violation-log.enabled", true) || checkType == null || playerName == null) return;
        String fileName = plugin.getConfig().getString("violation-log.file", "violations.log");
        String line = FORMAT.format(Instant.now()) + " | " + checkType + " | " + sanitize(playerName) + " | " + sanitize(detail != null ? detail : "") + "\n";
        Path path = plugin.getDataFolder().toPath().resolve(fileName);
        try {
            Files.createDirectories(path.getParent());
            try (BufferedWriter w = Files.newBufferedWriter(path, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND)) {
                w.write(line);
            }
        } catch (IOException e) {
            plugin.getLogger().warning("Violation log write error: " + e.getMessage());
        }
    }

    private static String sanitize(String s) {
        if (s == null) return "";
        return s.replace("|", ",").replace("\n", " ").replace("\r", "");
    }
}
