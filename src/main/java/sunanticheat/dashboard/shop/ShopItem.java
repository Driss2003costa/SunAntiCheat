package sunanticheat.dashboard.shop;

import java.util.ArrayList;
import java.util.List;

/**
 * POJO représentant un item vendable/achetable d'un shop.
 * Les prix null signifient « non autorisé » (non achetable ou non vendable).
 */
public class ShopItem {
    public String id;
    public int slot; // 0-53

    public String material;
    public int customModelData;
    public String itemAdderId;
    public int amount = 1;

    public String displayName;
    public List<String> lore = new ArrayList<>();
    public List<String> enchantments = new ArrayList<>();

    public Double buyPrice;   // null = non achetable
    public Double sellPrice;  // null = non vendable
    public String priceType;  // "MONEY" | "EXP" | "ITEM"
    public String priceItem;  // si priceType = ITEM

    public int buyLimit;
    public int sellLimit;
    public int stockLimit;
    public int stockCurrent;
    public int buyCooldownSeconds;

    public String permission;

    public List<String> commandsOnBuy = new ArrayList<>();
    public String buyMessage;
    public String rewardType; // "ITEM" | "COMMAND"

    public boolean dynamicPricing;
    public double basePriceBuy;
    public double basePriceSell;
    public double priceElasticity;
}
