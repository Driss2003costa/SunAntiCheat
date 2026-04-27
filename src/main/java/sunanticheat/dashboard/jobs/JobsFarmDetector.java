package sunanticheat.dashboard.jobs;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import sunanticheat.Permissions;

import java.util.*;
import java.util.function.Consumer;

/**
 * Détecte le farm automatisé (bot Jobs) via fenêtre glissante de 60 secondes
 * par couple (playerUuid × actionType).
 *
 * Quand le seuil est dépassé :
 *  - Message cliquable [TP] [Sanctions] aux staff en jeu (Permissions.ALERTS)
 *  - Alerte dashboard poussée via le callback WS fourni à la construction
 *
 * Doit être appelé depuis le thread principal Bukkit (événements Jobs).
 * Toutes les structures sont non-concurrentes par conception.
 *
 * Config (config.yml) :
 *   jobs.farm-detection.enabled                 (défaut: true)
 *   jobs.farm-detection.max-payments-per-minute (défaut: 30)
 *   jobs.farm-detection.cooldown-minutes        (défaut: 5)
 */
public final class JobsFarmDetector {

    private final Plugin plugin;
    private final Consumer<Map<String, Object>> dashboardAlert;

    // playerUuid:actionType → timestamps (fenêtre 60s)
    private final Map<String, ArrayDeque<Long>> windows = new HashMap<>();
    // playerUuid → timestamp de la dernière alerte (anti-spam)
    private final Map<String, Long> alertCooldown = new HashMap<>();

    public JobsFarmDetector(Plugin plugin, Consumer<Map<String, Object>> dashboardAlert) {
        this.plugin = plugin;
        this.dashboardAlert = dashboardAlert;
    }

    /**
     * Enregistre un paiement et déclenche une alerte si le seuil est franchi.
     *
     * @param playerUuid  UUID du joueur (null = ignoré)
     * @param playerName  Nom affiché dans l'alerte
     * @param actionType  Type d'action Jobs (BREAK, KILL, CRAFT…) — peut être null
     */
    public void record(String playerUuid, String playerName, String actionType) {
        if (!enabled() || playerUuid == null) return;

        long now = System.currentTimeMillis();
        String key = playerUuid + ":" + (actionType != null ? actionType : "");

        ArrayDeque<Long> window = windows.computeIfAbsent(key, k -> new ArrayDeque<>());
        window.addLast(now);
        while (!window.isEmpty() && now - window.peekFirst() > 60_000L) {
            window.pollFirst();
        }

        if (window.size() < threshold()) return;

        Long lastAlert = alertCooldown.get(playerUuid);
        if (lastAlert != null && now - lastAlert < cooldownMs()) return;
        alertCooldown.put(playerUuid, now);

        String name = playerName != null ? playerName : "?";
        String detail = window.size() + " paiements/min"
                + (actionType != null && !actionType.isBlank() ? " [" + actionType + "]" : "")
                + " — seuil: " + threshold();

        broadcastToStaff(name, detail);

        if (dashboardAlert != null) {
            Map<String, Object> alert = new LinkedHashMap<>();
            alert.put("type", "JOBS_FARM");
            alert.put("player", name);
            alert.put("world", "");
            alert.put("detail", detail);
            dashboardAlert.accept(alert);
        }
    }

    private void broadcastToStaff(String playerName, String detail) {
        Component msg = Component.text("[SunGuard] ")
                .color(NamedTextColor.DARK_GRAY)
                .append(Component.text("Jobs Farm suspect: ").color(NamedTextColor.RED))
                .append(Component.text(playerName).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD))
                .append(Component.text(" — " + detail).color(NamedTextColor.GRAY))
                .append(Component.text(" [TP]").color(NamedTextColor.GREEN).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/tp " + playerName)))
                .append(Component.text(" [Sanctions]").color(NamedTextColor.YELLOW).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/sunguard sanction " + playerName)));
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (p.hasPermission(Permissions.ALERTS)) {
                p.sendMessage(msg);
            }
        }
    }

    private boolean enabled()    { return plugin.getConfig().getBoolean("jobs.farm-detection.enabled", true); }
    private int     threshold()  { return plugin.getConfig().getInt("jobs.farm-detection.max-payments-per-minute", 30); }
    private long    cooldownMs() { return plugin.getConfig().getLong("jobs.farm-detection.cooldown-minutes", 5) * 60_000L; }
}
