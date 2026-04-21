package sunanticheat.dashboard.shop;

/**
 * POJO d'une transaction shop enregistrée par le ShopEconomyListener.
 */
public class ShopTransaction {
    public String id;
    public String shopId;
    public String shopName;
    public String itemId;
    public String itemDisplayName;
    public String itemMaterial;
    public String playerUuid;
    public String playerName;
    public String type; // "BUY" | "SELL"
    public int amount;
    public double pricePer;
    public double totalPrice;
    public long timestamp;
}
