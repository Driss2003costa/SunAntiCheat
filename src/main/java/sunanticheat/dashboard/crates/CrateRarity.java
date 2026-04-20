package sunanticheat.dashboard.crates;

/**
 * Rareté d'un item de crate. Contient une couleur hex (dashboard),
 * un préfixe de couleur Minecraft et un nom d'affichage en français.
 */
public enum CrateRarity {
    COMMON("#9CA3AF", "\u00a77", "Commun"),
    UNCOMMON("#10B981", "\u00a7a", "Peu commun"),
    RARE("#3B82F6", "\u00a79", "Rare"),
    EPIC("#8B5CF6", "\u00a75", "\u00c9pique"),
    LEGENDARY("#F59E0B", "\u00a76", "L\u00e9gendaire"),
    MYTHIC("#EF4444", "\u00a7c", "Mythique");

    public final String color;
    public final String prefix;
    public final String displayName;

    CrateRarity(String color, String prefix, String displayName) {
        this.color = color;
        this.prefix = prefix;
        this.displayName = displayName;
    }
}
