package sunanticheat.dashboard.shop;

import java.util.ArrayList;
import java.util.List;

/**
 * Une page d'un shop multipage. Chaque page possède sa propre grille (rows × 9)
 * et sa propre liste d'items. Synchronisée vers EconomyShopGUI-Premium sous
 * la clé pages.page{n}.
 */
public class ShopPage {
    public String id;
    public String name;       // ex. "Page 1"
    public int rows;          // 1-6
    public List<ShopItem> items = new ArrayList<>();
}
