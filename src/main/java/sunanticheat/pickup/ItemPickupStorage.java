package sunanticheat.pickup;

import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Historique des items ramassés par joueur (48 dernières heures).
 * Agrégation par type de matériau + date.
 */
public class ItemPickupStorage {

    private static final long RETENTION_MS = 48L * 60 * 60 * 1000;

    public static final class PickupEntry {
        public final Material material;
        public final int amount;
        public final long timestamp;

        public PickupEntry(Material material, int amount, long timestamp) {
            this.material = material;
            this.amount = amount;
            this.timestamp = timestamp;
        }
    }

    private final Map<UUID, List<PickupEntry>> byPlayer = new ConcurrentHashMap<>();

    public void recordPickup(Player player, ItemStack item) {
        if (item == null || item.getType() == Material.AIR) return;
        UUID uuid = player.getUniqueId();
        long now = System.currentTimeMillis();
        PickupEntry entry = new PickupEntry(item.getType(), item.getAmount(), now);
        byPlayer.compute(uuid, (k, list) -> {
            List<PickupEntry> l = list != null ? list : new ArrayList<>();
            l.add(0, entry);
            return pruneOld(l, now);
        });
    }

    /** Supprime les entrées de plus de 48h. */
    private List<PickupEntry> pruneOld(List<PickupEntry> list, long now) {
        long cutoff = now - RETENTION_MS;
        list.removeIf(e -> e.timestamp < cutoff);
        return list;
    }

    /** Liste des ramassages des 48 dernières heures (plus récents en premier). */
    public List<PickupEntry> getPickups(UUID uuid) {
        List<PickupEntry> list = byPlayer.get(uuid);
        if (list == null) return Collections.emptyList();
        long cutoff = System.currentTimeMillis() - RETENTION_MS;
        return list.stream().filter(e -> e.timestamp >= cutoff).toList();
    }

    /** Agrège par matériau : somme des quantités sur 48h. */
    public Map<Material, Integer> getAggregatedByMaterial(UUID uuid) {
        List<PickupEntry> entries = getPickups(uuid);
        Map<Material, Integer> agg = new LinkedHashMap<>();
        for (PickupEntry e : entries) {
            agg.merge(e.material, e.amount, Integer::sum);
        }
        return agg;
    }
}
