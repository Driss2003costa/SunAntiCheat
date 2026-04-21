package sunanticheat.dashboard.shop;

import java.util.ArrayList;
import java.util.List;

/**
 * POJO représentant un shop du dashboard (qui sera synchronisé vers EconomyShopGUI+).
 * Champs publics pour compatibilité directe avec Gson.
 */
public class Shop {
    public String id;
    public String name;
    public String displayName;
    public String description;

    public String iconMaterial;
    public int iconCustomModelData;
    public String iconItemAdderId;

    public String category;
    public int order;
    public int rows; // 1-6

    public String permission;
    public String commandToOpen;

    public List<ShopItem> items = new ArrayList<>();
    public boolean enabled = true;

    public long createdAt;
    public long modifiedAt;

    public long totalTransactions;
    public double totalRevenue;
}
