package sunanticheat.dashboard.shop;

import java.util.ArrayList;
import java.util.List;

/**
 * POJO représentant un shop du dashboard (qui sera synchronisé vers EconomyShopGUI+).
 * Champs publics pour compatibilité directe avec Gson.
 *
 * Multipage : la source de vérité est {@link #pages}. Les champs legacy
 * {@link #rows} et {@link #items} sont conservés uniquement pour la
 * désérialisation des anciens fichiers shops.json (migration au chargement).
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

    /** @deprecated remplacé par pages[].rows — conservé pour migration uniquement */
    @Deprecated public Integer rows;
    /** @deprecated remplacé par pages[].items — conservé pour migration uniquement */
    @Deprecated public List<ShopItem> items;

    public List<ShopPage> pages = new ArrayList<>();

    public String permission;
    public String commandToOpen;

    public boolean enabled = true;

    public long createdAt;
    public long modifiedAt;

    public long totalTransactions;
    public double totalRevenue;
}
