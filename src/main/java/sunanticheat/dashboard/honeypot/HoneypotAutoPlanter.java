package sunanticheat.dashboard.honeypot;

import org.bukkit.Bukkit;
import org.bukkit.Chunk;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.world.ChunkLoadEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.EnumSet;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Pose automatiquement un faux minerai dans chaque nouveau chunk généré.
 *
 * Principe de certitude : le bloc est entouré de pierre/deepslate sur les 6 faces.
 * Un joueur légitime ne peut pas le trouver par hasard ; un X-rayer le voit à travers
 * les blocs et creuse directement dessus. Le nombre de faces encore solides au moment
 * du cassage (mesuré dans HoneypotListener) confirme le degré de certitude.
 */
public final class HoneypotAutoPlanter implements Listener {

    private static final BlockFace[] FACES = {
        BlockFace.UP, BlockFace.DOWN, BlockFace.NORTH, BlockFace.SOUTH, BlockFace.EAST, BlockFace.WEST
    };

    // Blocs que l'on peut remplacer par le piège (pierre naturelle profonde)
    private static final Set<Material> REPLACEABLE = EnumSet.of(
        Material.STONE, Material.DEEPSLATE, Material.TUFF,
        Material.GRANITE, Material.DIORITE, Material.ANDESITE
    );

    // Blocs qui comptent comme "face solide pierre" autour du piège
    private static final Set<Material> SOLID_STONE = EnumSet.of(
        Material.STONE, Material.DEEPSLATE, Material.TUFF,
        Material.GRANITE, Material.DIORITE, Material.ANDESITE,
        Material.CALCITE, Material.SMOOTH_BASALT, Material.BASALT,
        Material.POLISHED_BASALT, Material.BLACKSTONE
    );

    private final JavaPlugin plugin;
    private final HoneypotStore store;
    private final boolean enabled;
    private final int minY;
    private final int maxY;
    private final double probability;
    private final Material oreMaterial;

    public HoneypotAutoPlanter(JavaPlugin plugin, HoneypotStore store) {
        this.plugin = plugin;
        this.store = store;
        var cfg = plugin.getConfig();
        this.enabled     = cfg.getBoolean("honeypot.auto-place.enabled", true);
        this.minY        = cfg.getInt("honeypot.auto-place.min-y", -60);
        this.maxY        = cfg.getInt("honeypot.auto-place.max-y", -10);
        this.probability = cfg.getDouble("honeypot.auto-place.probability-per-chunk", 0.3);

        String matStr = cfg.getString("honeypot.auto-place.ore-material", "DEEPSLATE_DIAMOND_ORE");
        Material m;
        try { m = Material.valueOf(matStr.toUpperCase()); }
        catch (IllegalArgumentException e) {
            plugin.getLogger().warning("[Honeypot] Matériau inconnu : " + matStr + " — utilisation de DEEPSLATE_DIAMOND_ORE");
            m = Material.DEEPSLATE_DIAMOND_ORE;
        }
        this.oreMaterial = m;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onChunkLoad(ChunkLoadEvent event) {
        if (!enabled) return;
        if (!event.isNewChunk()) return;
        if (event.getChunk().getWorld().getEnvironment() != World.Environment.NORMAL) return;

        // Décaler d'un tick pour laisser la population du chunk se terminer
        Chunk chunk = event.getChunk();
        Bukkit.getScheduler().runTask(plugin, () -> tryPlace(chunk));
    }

    private void tryPlace(Chunk chunk) {
        if (!chunk.isLoaded()) return;

        int range = maxY - minY;
        if (range <= 0) return;
        if (ThreadLocalRandom.current().nextDouble() >= probability) return;

        World world = chunk.getWorld();
        int baseX = chunk.getX() * 16;
        int baseZ = chunk.getZ() * 16;
        ThreadLocalRandom rng = ThreadLocalRandom.current();

        // 30 tentatives max pour trouver un emplacement valide dans ce chunk
        for (int attempt = 0; attempt < 30; attempt++) {
            // Éviter les bords du chunk (±2) pour que les 6 voisins soient accessibles
            int x = baseX + rng.nextInt(2, 14);
            int z = baseZ + rng.nextInt(2, 14);
            int y = minY + rng.nextInt(range);

            Block block = world.getBlockAt(x, y, z);
            if (!REPLACEABLE.contains(block.getType())) continue;
            if (!allFacesSolidStone(block)) continue;

            // Vérification supplémentaire : aucun honeypot existant dans un rayon de 16 blocs
            if (store.findByBlock(world.getName(), x, y, z) != null) continue;

            block.setType(oreMaterial, false);
            store.add("auto@" + x + "," + y + "," + z, world.getName(), x, y, z, oreMaterial.name(), true);
            plugin.getLogger().fine("[Honeypot] Piège auto posé @ " + x + "," + y + "," + z + " (" + world.getName() + ")");
            return;
        }
    }

    /** Vérifie que les 6 faces immédiates sont toutes de la pierre solide naturelle. */
    private static boolean allFacesSolidStone(Block center) {
        for (BlockFace face : FACES) {
            if (!SOLID_STONE.contains(center.getRelative(face).getType())) return false;
        }
        return true;
    }

    /** Exposé pour HoneypotListener : compte les faces encore solides au moment du cassage. */
    public static int countSolidFaces(Block center) {
        int count = 0;
        for (BlockFace face : FACES) {
            if (center.getRelative(face).getType().isSolid()) count++;
        }
        return count;
    }
}
