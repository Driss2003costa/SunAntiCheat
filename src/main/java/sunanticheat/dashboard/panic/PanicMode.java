package sunanticheat.dashboard.panic;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.*;
import java.util.logging.Logger;

/**
 * Mode panique : whitelist ON, kick non-OP, broadcast d'urgence.
 * État non persisté (volontaire : au reboot, on repart normal).
 */
public final class PanicMode {

    private final JavaPlugin plugin;
    private final Logger logger;

    private boolean active = false;
    private long activatedAt = 0L;
    private String activatedBy = "";
    private String reason = "";
    private Boolean previousWhitelistState = null;

    public PanicMode(JavaPlugin plugin, Logger logger) {
        this.plugin = plugin;
        this.logger = logger;
    }

    public synchronized Map<String, Object> snapshot() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("active", active);
        m.put("activatedAt", activatedAt);
        m.put("activatedBy", activatedBy);
        m.put("reason", reason);
        m.put("whitelistActive", Bukkit.hasWhitelist());
        m.put("onlineCount", Bukkit.getOnlinePlayers().size());
        return m;
    }

    public synchronized Map<String, Object> activate(String by, String reason) {
        if (active) return snapshot();
        active = true;
        activatedAt = System.currentTimeMillis();
        activatedBy = by != null ? by : "admin";
        this.reason = reason != null ? reason : "Maintenance d'urgence";

        previousWhitelistState = Bukkit.hasWhitelist();

        Bukkit.getScheduler().runTask(plugin, () -> {
            Bukkit.setWhitelist(true);
            // Broadcast avant de kicker
            Component broadcast = Component.text("⚠ MAINTENANCE D'URGENCE — Le serveur va être fermé temporairement.", NamedTextColor.RED);
            Bukkit.broadcast(broadcast);

            // Kick des non-OP
            int kicked = 0;
            for (Player p : new ArrayList<>(Bukkit.getOnlinePlayers())) {
                if (p.isOp()) continue;
                p.kick(Component.text("⚠ Maintenance d'urgence en cours.\n\nRaison : " + this.reason + "\n\nReviens plus tard.", NamedTextColor.RED));
                kicked++;
            }
            logger.warning("[Dashboard/Panic] ⚠ ACTIVÉ par " + activatedBy + " : " + this.reason + " — " + kicked + " joueurs kickés.");
        });

        return snapshot();
    }

    public synchronized Map<String, Object> deactivate(String by) {
        if (!active) return snapshot();
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (previousWhitelistState != null) Bukkit.setWhitelist(previousWhitelistState);
            else Bukkit.setWhitelist(false);
            Bukkit.broadcast(Component.text("✓ Maintenance terminée — serveur rouvert.", NamedTextColor.GREEN));
            logger.info("[Dashboard/Panic] ✓ Désactivé par " + (by != null ? by : "admin"));
        });
        active = false;
        activatedAt = 0L;
        activatedBy = "";
        reason = "";
        previousWhitelistState = null;
        return snapshot();
    }
}
