package sunanticheat.dashboard.sanctions;

/**
 * Sévérité d'une sanction. Utilisée pour le tri visuel + couleur disconnect screen.
 *
 * LOW      : avertissement léger (jaune)
 * MEDIUM   : sanction modérée (orange)
 * HIGH     : sanction forte (rouge)
 * CRITICAL : faute grave, perma probable (rouge sang)
 */
public enum Severity {
    LOW("§e", "🟡", "low"),
    MEDIUM("§6", "🟠", "medium"),
    HIGH("§c", "🔴", "high"),
    CRITICAL("§4", "⛔", "critical");

    public final String chatColor;
    public final String emoji;
    public final String css;

    Severity(String chatColor, String emoji, String css) {
        this.chatColor = chatColor;
        this.emoji = emoji;
        this.css = css;
    }
}
