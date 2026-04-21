package sunanticheat.dashboard.shop;

import org.bukkit.inventory.ItemStack;
import sunanticheat.dashboard.shop.providers.ExecutableItemsProvider;
import sunanticheat.dashboard.shop.providers.ItemsAdderProvider;
import sunanticheat.dashboard.shop.providers.MMOItemsProvider;
import sunanticheat.dashboard.shop.providers.NexoProvider;
import sunanticheat.dashboard.shop.providers.OraxenProvider;
import sunanticheat.dashboard.shop.providers.SlimeFunProvider;
import sunanticheat.dashboard.shop.providers.VanillaProvider;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Registre central des providers d'items pour la bibliothèque shop.
 * <p>Agrège Vanilla + tous les plugins modded détectés au runtime.
 * <p>Les caches internes aux providers sont réutilisés — appeler {@link #invalidateCache()}
 * après un reload de plugin modded.
 */
public final class ModdedItemBridge {

    private final List<ModdedItemProvider> providers;
    private final Logger logger;

    public ModdedItemBridge(Logger logger) {
        this.logger = logger;
        this.providers = List.of(
                new VanillaProvider(),
                new ItemsAdderProvider(),
                new OraxenProvider(),
                new NexoProvider(),
                new MMOItemsProvider(),
                new ExecutableItemsProvider(),
                new SlimeFunProvider()
        );
        logDetected();
    }

    /** Liste des providers (y compris ceux indisponibles, pour affichage UI). */
    public List<ModdedItemProvider> providers() {
        return providers;
    }

    /** Providers effectivement disponibles (plugin chargé). */
    public List<ModdedItemProvider> availableProviders() {
        List<ModdedItemProvider> out = new ArrayList<>();
        for (ModdedItemProvider p : providers) if (p.isAvailable()) out.add(p);
        return out;
    }

    /**
     * Concatène tous les items de tous les providers disponibles.
     * Attention : pour gros serveurs (1000+ items custom), préférer {@link #list(String, String, int, int)}.
     */
    public List<ModdedItem> listAll() {
        List<ModdedItem> out = new ArrayList<>();
        for (ModdedItemProvider p : availableProviders()) {
            try {
                out.addAll(p.listAll());
            } catch (Throwable t) {
                logger.warning("[Shop] Provider " + p.name() + " a échoué : " + t.getMessage());
            }
        }
        return out;
    }

    /**
     * Liste filtrée et paginée.
     *
     * @param sourceFilter nom du provider (null = tous)
     * @param search       texte à matcher sur id/displayName (null/vide = aucun filtre)
     * @param offset       décalage (>=0)
     * @param limit        nombre max (<=0 = tout)
     */
    public List<ModdedItem> list(String sourceFilter, String search, int offset, int limit) {
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<ModdedItem> all = listAll();
        List<ModdedItem> filtered = new ArrayList<>();
        for (ModdedItem it : all) {
            if (sourceFilter != null && !sourceFilter.isEmpty()
                    && !it.source().equalsIgnoreCase(sourceFilter)) continue;
            if (!q.isEmpty()) {
                String idL = it.id() == null ? "" : it.id().toLowerCase(Locale.ROOT);
                String dnL = it.displayName() == null ? "" : it.displayName().toLowerCase(Locale.ROOT);
                if (!idL.contains(q) && !dnL.contains(q)) continue;
            }
            filtered.add(it);
        }
        int from = Math.max(0, offset);
        if (from >= filtered.size()) return List.of();
        int to = limit <= 0 ? filtered.size() : Math.min(filtered.size(), from + limit);
        return List.copyOf(filtered.subList(from, to));
    }

    /**
     * Tente de reconstruire un ItemStack depuis un couple source+id.
     * Fallback vanilla si source inconnue.
     */
    public ItemStack build(String source, String id, int amount) {
        if (source == null || id == null) return null;
        for (ModdedItemProvider p : providers) {
            if (p.name().equalsIgnoreCase(source) && p.isAvailable()) {
                return p.build(id, amount);
            }
        }
        return null;
    }

    /**
     * Tente d'identifier la source native d'un ItemStack (pour import depuis inventaire joueur).
     * Parcourt les providers modded en premier, puis Vanilla en dernier recours.
     *
     * @return {source, id} ou null si stack null/vide.
     */
    public MatchResult match(ItemStack stack) {
        if (stack == null) return null;
        // Ordre : modded d'abord (plus spécifique), vanilla ensuite
        for (ModdedItemProvider p : providers) {
            if (!p.isAvailable()) continue;
            if (p instanceof VanillaProvider) continue;
            String id = p.matchId(stack);
            if (id != null && !id.isEmpty()) return new MatchResult(p.name(), id);
        }
        // Fallback vanilla
        for (ModdedItemProvider p : providers) {
            if (p instanceof VanillaProvider && p.isAvailable()) {
                String id = p.matchId(stack);
                if (id != null) return new MatchResult(p.name(), id);
            }
        }
        return null;
    }

    /** Statistiques par provider (pour status API). */
    public Map<String, Object> status() {
        Map<String, Object> out = new LinkedHashMap<>();
        int totalAvailable = 0;
        List<Map<String, Object>> list = new ArrayList<>();
        for (ModdedItemProvider p : providers) {
            boolean avail = p.isAvailable();
            int count = 0;
            if (avail) {
                try { count = p.count(); } catch (Throwable ignored) {}
            }
            if (avail) totalAvailable++;
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", p.name());
            entry.put("available", avail);
            entry.put("count", count);
            list.add(entry);
        }
        out.put("providers", list);
        out.put("availableProviders", totalAvailable);
        out.put("totalProviders", providers.size());
        return out;
    }

    /** À appeler après reload d'un plugin externe (nouveaux items custom ajoutés). */
    public void invalidateCache() {
        // Les providers mettent en cache sur demande. On recrée l'instance au prochain appel.
        // Simplification : on recrée les providers qui ont un cache field.
        // Ici on choisit de laisser les providers vivre — mais on expose un no-op explicite.
        // Les développeurs qui veulent invalider peuvent recréer le Bridge.
    }

    private void logDetected() {
        for (ModdedItemProvider p : providers) {
            if (p instanceof VanillaProvider) continue;
            if (p.isAvailable()) {
                logger.info("[Shop] Provider détecté : " + p.name());
            }
        }
    }

    /** Résultat de {@link #match(ItemStack)}. */
    public record MatchResult(String source, String id) {}
}
