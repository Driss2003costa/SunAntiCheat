package sunanticheat.dashboard.shop;

import java.util.List;
import java.util.Map;

/**
 * Représentation d'un item (vanilla ou modded) exposée au dashboard.
 *
 * @param source           Nom du provider d'origine ("Vanilla", "ItemsAdder", "Oraxen", ...).
 * @param id               Identifiant unique côté provider (ex: "myitems:ruby_sword", "DIAMOND_SWORD").
 * @param displayName      Nom lisible (avec couleurs Minecraft §x si fournies par le plugin).
 * @param material         Material Bukkit de repli (ex: "DIAMOND_SWORD", "PAPER"). Toujours renseigné.
 * @param category         Catégorie optionnelle (utile pour l'UI : "WEAPON", "FOOD", ...).
 * @param customModelData  CustomModelData si connu (0 = aucun).
 * @param iconUrl          URL d'icône si connue (CDN externe, assets plugin...). Optionnel.
 * @param lore             Lore de l'item (lignes), peut être vide.
 * @param shopYaml         Bloc YAML prêt à écrire dans EconomyShopGUI (clé/valeur). Spécifique au provider.
 */
public record ModdedItem(
        String source,
        String id,
        String displayName,
        String material,
        String category,
        int customModelData,
        String iconUrl,
        List<String> lore,
        Map<String, Object> shopYaml
) {}
