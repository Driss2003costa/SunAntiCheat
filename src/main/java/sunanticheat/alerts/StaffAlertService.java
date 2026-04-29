package sunanticheat.alerts;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.Permissions;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Envoie aux staff (permission sunguard.alerts) des messages cliquables : [TP] [Sanctions].
 * Cooldown par joueur pour éviter le spam. Optionnel : envoi Discord.
 */
public class StaffAlertService {

    private final JavaPlugin plugin;
    private final ViolationLogService violationLog;
    private final Map<UUID, Long> lastXRayAlert        = new ConcurrentHashMap<>();
    private final Map<UUID, Long> lastFreecamAlert     = new ConcurrentHashMap<>();
    private final Map<UUID, Long> lastKillAuraAlert    = new ConcurrentHashMap<>();
    private final Map<UUID, Long> lastInventoryAlert   = new ConcurrentHashMap<>();

    public StaffAlertService(JavaPlugin plugin, ViolationLogService violationLog) {
        this.plugin = plugin;
        this.violationLog = violationLog != null ? violationLog : new ViolationLogService(plugin);
    }

    private long cooldownXRayMs() {
        return Math.max(60_000, plugin.getConfig().getLong("alerts.xray.cooldown-minutes", 5) * 60 * 1000);
    }

    private long cooldownFreecamMs() {
        return Math.max(60_000, plugin.getConfig().getLong("alerts.freecam.cooldown-minutes", 5) * 60 * 1000);
    }

    private long cooldownKillAuraMs() {
        return Math.max(60_000, plugin.getConfig().getLong("alerts.killaura.cooldown-minutes", 5) * 60 * 1000);
    }

    /** Alerte X-Ray : joueur suspect (nom + indice). Respecte le cooldown. */
    public void alertXRay(Player target, String detail) {
        if (!plugin.getConfig().getBoolean("alerts.xray.enabled", true)) return;
        long now = System.currentTimeMillis();
        if (now - lastXRayAlert.getOrDefault(target.getUniqueId(), 0L) < cooldownXRayMs()) return;
        lastXRayAlert.put(target.getUniqueId(), now);
        String name = target.getName();
        Component msg = Component.text("[SunGuard] ")
                .color(NamedTextColor.DARK_GRAY)
                .append(Component.text("X-Ray suspect: ").color(NamedTextColor.RED))
                .append(Component.text(name).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD))
                .append(Component.text(" — " + detail).color(NamedTextColor.GRAY))
                .append(Component.text(" [TP]").color(NamedTextColor.GREEN).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/tp " + name)))
                .append(Component.text(" [Sanctions]").color(NamedTextColor.YELLOW).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/sunguard sanction " + name)));
        broadcastToStaff(msg);
        if (violationLog != null) violationLog.log("X-Ray", name, detail);
        runAlertCommand("alerts.xray.run-command", name);
    }

    /** Alerte Freecam : joueur suspect. Respecte le cooldown. */
    public void alertFreecam(Player target, String detail) {
        if (!plugin.getConfig().getBoolean("alerts.freecam.enabled", true)) return;
        long now = System.currentTimeMillis();
        if (now - lastFreecamAlert.getOrDefault(target.getUniqueId(), 0L) < cooldownFreecamMs()) return;
        lastFreecamAlert.put(target.getUniqueId(), now);
        String name = target.getName();
        Component msg = Component.text("[SunGuard] ")
                .color(NamedTextColor.DARK_GRAY)
                .append(Component.text("Freecam suspect: ").color(NamedTextColor.RED))
                .append(Component.text(name).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD))
                .append(Component.text(" — " + detail).color(NamedTextColor.GRAY))
                .append(Component.text(" [TP]").color(NamedTextColor.GREEN).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/tp " + name)))
                .append(Component.text(" [Sanctions]").color(NamedTextColor.YELLOW).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/sunguard sanction " + name)));
        broadcastToStaff(msg);
        if (violationLog != null) violationLog.log("Freecam", name, detail);
        runAlertCommand("alerts.freecam.run-command", name);
    }

    /** Alerte Kill Aura : joueur suspect (portée, angle, CPS, etc.). Respecte le cooldown. */
    public void alertKillAura(Player target, String detail) {
        if (!plugin.getConfig().getBoolean("alerts.killaura.enabled", true)) return;
        long now = System.currentTimeMillis();
        if (now - lastKillAuraAlert.getOrDefault(target.getUniqueId(), 0L) < cooldownKillAuraMs()) return;
        lastKillAuraAlert.put(target.getUniqueId(), now);
        String name = target.getName();
        Component msg = Component.text("[SunGuard] ")
                .color(NamedTextColor.DARK_GRAY)
                .append(Component.text("Kill Aura suspect: ").color(NamedTextColor.RED))
                .append(Component.text(name).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD))
                .append(Component.text(" — " + detail).color(NamedTextColor.GRAY))
                .append(Component.text(" [TP]").color(NamedTextColor.GREEN).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/tp " + name)))
                .append(Component.text(" [Sanctions]").color(NamedTextColor.YELLOW).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/sunguard sanction " + name)));
        broadcastToStaff(msg);
        if (violationLog != null) violationLog.log("Kill Aura", name, detail);
        runAlertCommand("alerts.killaura.run-command", name);
    }

    /** Alerte anomalie d'inventaire : enchantement hors limite ou combinaison illégale. */
    public void alertInventoryAnomaly(Player target, String detail) {
        if (!plugin.getConfig().getBoolean("alerts.inventory-anomaly.enabled", true)) return;
        long now = System.currentTimeMillis();
        long cooldownMs = Math.max(60_000, plugin.getConfig().getLong("alerts.inventory-anomaly.cooldown-minutes", 5) * 60_000L);
        if (now - lastInventoryAlert.getOrDefault(target.getUniqueId(), 0L) < cooldownMs) return;
        lastInventoryAlert.put(target.getUniqueId(), now);
        String name = target.getName();
        Component msg = Component.text("[SunGuard] ")
                .color(NamedTextColor.DARK_GRAY)
                .append(Component.text("Inventaire illégal: ").color(NamedTextColor.DARK_RED))
                .append(Component.text(name).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD))
                .append(Component.text(" — " + detail).color(NamedTextColor.GRAY))
                .append(Component.text(" [TP]").color(NamedTextColor.GREEN).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/tp " + name)))
                .append(Component.text(" [Sanctions]").color(NamedTextColor.YELLOW).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/sunguard sanction " + name)));
        broadcastToStaff(msg);
        if (violationLog != null) violationLog.log("InventoryAnomaly", name, detail);
        runAlertCommand("alerts.inventory-anomaly.run-command", name);
    }

    private void runAlertCommand(String configPath, String playerName) {
        String cmd = plugin.getConfig().getString(configPath, "").trim();
        if (cmd.isEmpty()) return;
        String toRun = cmd.replace("%player%", playerName).replace("%joueur%", playerName);
        Bukkit.getScheduler().runTask(plugin, () -> Bukkit.dispatchCommand(Bukkit.getConsoleSender(), toRun));
    }

    private void broadcastToStaff(Component message) {
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (p.hasPermission(Permissions.ALERTS)) {
                p.sendMessage(message);
            }
        }
    }
}
