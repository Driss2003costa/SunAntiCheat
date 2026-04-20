package sunanticheat.dashboard.crates;

/**
 * Enregistrement d'une ouverture de crate.
 */
public class CrateOpen {
    public String crateId;
    public String crateName;
    public String playerUuid;
    public String playerName;
    public String itemId;
    public String itemName;
    public String itemMaterial;
    public CrateRarity rarity;
    public long openedAt;

    public CrateOpen() {}

    public CrateOpen(String crateId, String crateName, String playerUuid, String playerName,
                     String itemId, String itemName, String itemMaterial,
                     CrateRarity rarity, long openedAt) {
        this.crateId = crateId;
        this.crateName = crateName;
        this.playerUuid = playerUuid;
        this.playerName = playerName;
        this.itemId = itemId;
        this.itemName = itemName;
        this.itemMaterial = itemMaterial;
        this.rarity = rarity;
        this.openedAt = openedAt;
    }
}
