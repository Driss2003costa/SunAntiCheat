package sunanticheat.dashboard.violations;

import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.discord.DiscordWebhook;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Gère l'accumulation des points de violation par joueur.
 *
 * Chaque alerte anticheat appelle {@link #record(String[])} via un Consumer
 * injecté dans StaffAlertService et AltConnectionListener.
 * args = [checkType, playerUuid, playerName]
 *
 * Quand un seuil est franchi pour la première fois, un embed est envoyé
 * sur le webhook Discord configuré sous violation-points.thresholds.
 */
public final class ViolationPointsService {

    private final JavaPlugin plugin;
    private final ViolationPointsStore store;
    private final DiscordWebhook discord;

    /** Dernier niveau de seuil notifié par UUID — évite le re-spam sur chaque point. */
    private final Map<String, Integer> lastNotifiedLevel = new ConcurrentHashMap<>();

    public ViolationPointsService(JavaPlugin plugin, ViolationPointsStore store, DiscordWebhook discord) {
        this.plugin  = plugin;
        this.store   = store;
        this.discord = discord;
    }

    /** Point d'entrée Consumer — args = [checkType, playerUuid, playerName]. */
    public void record(String[] args) {
        if (args == null || args.length < 3) return;
        record(args[0], args[1], args[2]);
    }

    public void record(String checkType, String playerUuid, String playerName) {
        if (!plugin.getConfig().getBoolean("violation-points.enabled", true)) return;

        int pts = plugin.getConfig().getInt("violation-points.points." + checkType, 0);
        if (pts <= 0) return;

        int prevTotal = store.getPoints(playerUuid);
        int newTotal  = store.addPoints(playerUuid, playerName, checkType, pts);

        checkThresholds(playerUuid, playerName, checkType, pts, prevTotal, newTotal);
    }

    @SuppressWarnings("unchecked")
    private void checkThresholds(String playerUuid, String playerName,
                                  String checkType, int ptsAdded,
                                  int prevTotal, int newTotal) {
        List<?> raw = plugin.getConfig().getList("violation-points.thresholds", List.of());
        List<Map<?, ?>> thresholds = new ArrayList<>();
        for (Object o : raw) {
            if (o instanceof Map<?, ?> m) thresholds.add(m);
        }
        thresholds.sort(Comparator.comparingInt(t -> num(t, "points", 0)));

        int crossedLevel = 0;
        Map<?, ?> crossedThreshold = null;
        for (int i = 0; i < thresholds.size(); i++) {
            int tp = num(thresholds.get(i), "points", 0);
            if (prevTotal < tp && newTotal >= tp) {
                crossedLevel = i + 1;
                crossedThreshold = thresholds.get(i);
            }
        }
        if (crossedThreshold == null) return;

        int lastLevel = lastNotifiedLevel.getOrDefault(playerUuid, 0);
        if (crossedLevel <= lastLevel) return;
        lastNotifiedLevel.put(playerUuid, crossedLevel);

        if (bool(crossedThreshold, "discord", true) && discord != null && discord.isEnabled()) {
            String label = str(crossedThreshold, "label", "Seuil " + crossedLevel);
            int    color = num(crossedThreshold, "color", 0xFF0000);
            sendDiscordEmbed(playerName, playerUuid, checkType, ptsAdded,
                    newTotal, label, color, thresholds);
        }
    }

    private void sendDiscordEmbed(String playerName, String playerUuid,
                                   String checkType, int ptsAdded, int totalPoints,
                                   String label, int color, List<Map<?, ?>> thresholds) {
        List<Map<String, Object>> recent = store.eventsForPlayer(playerUuid, 6);
        StringBuilder history = new StringBuilder();
        for (Map<String, Object> e : recent) {
            history.append("• `").append(e.get("checkType")).append("`")
                   .append(" **+").append(e.get("ptsAdded")).append(" pts**")
                   .append(" → ").append(e.get("totalAfter")).append(" pts total")
                   .append("\n");
        }

        String nextInfo = "";
        for (Map<?, ?> t : thresholds) {
            int tp = num(t, "points", 0);
            if (tp > totalPoints) {
                nextInfo = "\n**Prochain seuil :** " + str(t, "label", "?") + " à **" + tp + " pts**";
                break;
            }
        }

        String description =
                "**Joueur :** " + playerName +
                "\n**UUID :** `" + playerUuid + "`" +
                "\n**Score total :** **" + totalPoints + " pts**  (+**" + ptsAdded + "** via `" + checkType + "`)" +
                "\n**Seuil atteint :** " + label +
                nextInfo +
                "\n\n**Historique récent :**\n" + (history.length() > 0 ? history.toString().trim() : "—");

        discord.sendEmbed("🚨 Seuil de violation — " + playerName, description, color,
                "SunGuard · Violation Points", true);
    }

    public int getPoints(String playerUuid) { return store.getPoints(playerUuid); }

    public void resetPlayer(String playerUuid) {
        store.resetPoints(playerUuid);
        lastNotifiedLevel.remove(playerUuid);
    }

    public ViolationPointsStore store() { return store; }

    // ── helpers config ────────────────────────────────────────────────────────
    private static int     num (Map<?, ?> m, String k, int    def) { Object v = m.get(k); return v instanceof Number n ? n.intValue() : def; }
    private static String  str (Map<?, ?> m, String k, String def) { Object v = m.get(k); return v != null ? v.toString() : def; }
    private static boolean bool(Map<?, ?> m, String k, boolean def){ Object v = m.get(k); return v instanceof Boolean b ? b : def; }
}
