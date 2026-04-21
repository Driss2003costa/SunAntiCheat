package sunanticheat.dashboard.shop;

import java.util.List;

/**
 * Représente une section shop EconomyShopGUI (= un fichier shops/XXX.yml).
 *
 * @param id         Identifiant (nom de fichier sans extension).
 * @param filename   Nom complet du fichier (ex: "mining.yml").
 * @param name       Nom affiché (display-name du shop, si défini).
 * @param icon       Material de l'icône (dans le menu principal).
 * @param size       Nombre de slots du shop (9, 18, 27, 36, 45, 54).
 * @param itemCount  Nombre d'items configurés.
 * @param items      Items (optionnel selon l'endpoint).
 */
public record ShopSection(
        String id,
        String filename,
        String name,
        String icon,
        int size,
        int itemCount,
        List<ShopItem> items
) {}
