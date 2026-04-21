package sunanticheat.dashboard.shop;

import org.bukkit.inventory.ItemStack;

import java.util.List;

/**
 * Contrat d'un provider d'items pour la bibliothèque shop du dashboard.
 * <p>
 * Chaque implémentation utilise la réflexion pour dialoguer avec son plugin :
 * <b>aucune dépendance de compilation</b> n'est requise.
 */
public interface ModdedItemProvider {

    /** Nom du plugin/source (ex: "ItemsAdder", "Oraxen", "Vanilla"). */
    String name();

    /** True si le plugin est installé et chargé. */
    boolean isAvailable();

    /**
     * Liste exhaustive des items connus du provider.
     * <p>Retour : jamais null, peut être vide (plugin absent ou provider sans catalogue fini,
     * ex: vanilla renvoie ~1200 Materials).
     */
    List<ModdedItem> listAll();

    /** Construit un ItemStack à partir d'un id connu du provider. Peut retourner null. */
    ItemStack build(String id, int amount);

    /**
     * Tente de reconnaître un ItemStack comme provenant de ce provider.
     * Utile pour "import depuis inventaire joueur" : permet d'écrire l'ID natif
     * plutôt que du NBT brut dans le shop YAML.
     * @return id natif si reconnu, null sinon.
     */
    default String matchId(ItemStack stack) { return null; }

    /**
     * Nombre d'items exposés. Par défaut : listAll().size().
     * Les providers peuvent l'optimiser (ex: compteur direct de l'API).
     */
    default int count() {
        return listAll().size();
    }
}
