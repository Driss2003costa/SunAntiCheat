package sunanticheat.dashboard.sanctions;

/**
 * Catégorie de sanction (utilisée pour les stats + filtres). Au-delà de
 * ces catégories canoniques, on supporte une string libre dans
 * `SanctionEntry.categoryRaw` pour les cas spécifiques.
 */
public enum SanctionCategory {
    CHEAT("⚔", "Triche / hack"),
    CHAT("💬", "Chat (insultes, spam, racisme)"),
    GRIEF("⚒", "Grief / vol"),
    EXPLOIT("🐛", "Exploit / dupe"),
    SPAM("📢", "Spam / pub"),
    STAFF("👮", "Abus de staff / faux staff"),
    EVASION("🎭", "Évasion de ban (alt account)"),
    OTHER("❓", "Autre");

    public final String emoji;
    public final String label;
    SanctionCategory(String emoji, String label) {
        this.emoji = emoji;
        this.label = label;
    }
}
