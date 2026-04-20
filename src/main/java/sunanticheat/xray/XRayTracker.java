package sunanticheat.xray;

import org.bukkit.Material;
import org.bukkit.entity.Player;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Suivi des blocs minés par joueur pour la détection anti-x-ray.
 */
public class XRayTracker {

    private final Map<UUID, BlockMiningStats> statsByPlayer = new ConcurrentHashMap<>();

    public BlockMiningStats getOrCreate(UUID uuid) {
        return statsByPlayer.computeIfAbsent(uuid, k -> new BlockMiningStats());
    }

    public void recordBlockBreak(Player player, Material type) {
        BlockMiningStats stats = getOrCreate(player.getUniqueId());
        if (BlockMiningStats.isDiamondOre(type)) {
            stats.addDiamond();
        } else if (BlockMiningStats.isIronOre(type)) {
            stats.addIron();
        } else if (BlockMiningStats.isGoldOre(type)) {
            stats.addGold();
        } else if (BlockMiningStats.isAncientDebris(type)) {
            stats.addAncientDebris();
        } else if (BlockMiningStats.isNetherrack(type)) {
            stats.addNetherrack();
        } else if (BlockMiningStats.isCommonBlock(type)) {
            stats.addCommon();
        }
    }

    public BlockMiningStats getStats(UUID uuid) {
        return statsByPlayer.get(uuid);
    }

    public Map<UUID, BlockMiningStats> getAllStats() {
        return Map.copyOf(statsByPlayer);
    }

    /** Réinitialise les stats X-Ray d'un joueur (supprime toutes les données). */
    public boolean resetStats(UUID uuid) {
        return statsByPlayer.remove(uuid) != null;
    }

    /** Réinitialise les stats X-Ray de plusieurs joueurs. Retourne le nombre de joueurs réinitialisés. */
    public int resetStats(java.util.Collection<UUID> uuids) {
        int n = 0;
        for (UUID uuid : uuids) {
            if (statsByPlayer.remove(uuid) != null) n++;
        }
        return n;
    }

    /** Charge les stats depuis un snapshot journalier (fichier log). */
    public void loadSnapshot(java.util.Map<UUID, DaySnapshot> snapshot) {
        for (java.util.Map.Entry<UUID, DaySnapshot> e : snapshot.entrySet()) {
            BlockMiningStats stats = getOrCreate(e.getKey());
            DaySnapshot d = e.getValue();
            stats.setFromSnapshot(d.diamond, d.iron, d.gold, d.netherrack, d.ancientDebris, d.common);
        }
    }

    /** Snapshot des stats d'un joueur pour un jour (sérialisation log). */
    public static final class DaySnapshot {
        public final long diamond, iron, gold, netherrack, ancientDebris, common;
        public DaySnapshot(long diamond, long iron, long gold, long netherrack, long ancientDebris, long common) {
            this.diamond = diamond;
            this.iron = iron;
            this.gold = gold;
            this.netherrack = netherrack;
            this.ancientDebris = ancientDebris;
            this.common = common;
        }
    }
}
