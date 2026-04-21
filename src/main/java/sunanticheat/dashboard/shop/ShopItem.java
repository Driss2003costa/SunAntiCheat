package sunanticheat.dashboard.shop;

import java.util.List;
import java.util.Map;

/**
 * Item d'un shop EconomyShopGUI (≈ entrée dans shops/section.yml).
 *
 * <p>Le champ {@code sourceData} contient les clés brutes spécifiques au provider
 * (ex: {@code type: ITEMSADDER, itemsadder: myitems:ruby_sword}). La structure exacte
 * est produite par chaque {@link ModdedItemProvider} via {@link ModdedItem#shopYaml()}.
 *
 * @param slot               Emplacement dans le GUI (0..size-1).
 * @param source             Provider d'origine ("Vanilla", "ItemsAdder", ...).
 * @param nativeId           ID natif côté provider (ex: "DIAMOND", "myitems:ruby_sword").
 * @param material           Material Bukkit de repli (toujours renseigné).
 * @param displayName        Nom affiché (peut contenir des couleurs '&').
 * @param lore               Lore (peut être vide).
 * @param amount             Quantité par transaction (1 par défaut).
 * @param buyPrice           Prix d'achat (null = non achetable).
 * @param sellPrice          Prix de vente (null = non vendable).
 * @param limitPerPlayerDay  Limite d'achats par joueur / 24h (0 = illimité).
 * @param limitServerDay     Limite d'achats globale serveur / 24h (0 = illimité).
 * @param stock              Stock total (0 = illimité).
 * @param permission         Permission requise pour acheter (null = aucune).
 * @param commands           Commandes console à exécuter après achat.
 * @param enabled            Actif ou masqué.
 * @param sourceData         Bloc YAML brut spécifique au provider (merge direct).
 */
public record ShopItem(
        int slot,
        String source,
        String nativeId,
        String material,
        String displayName,
        List<String> lore,
        int amount,
        Double buyPrice,
        Double sellPrice,
        int limitPerPlayerDay,
        int limitServerDay,
        int stock,
        String permission,
        List<String> commands,
        boolean enabled,
        Map<String, Object> sourceData
) {}
