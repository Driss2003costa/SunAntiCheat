package sunanticheat.dashboard.crates;

import org.bukkit.Bukkit;
import org.bukkit.NamespacedKey;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Auto-enregistre/désenregistre les crates physiques quand un admin pose ou
 * casse un bloc-crate marqué (PDC {@code crate_block_id}).
 *
 * Workflow :
 *  1. /crate giveblock <name> → l'admin reçoit un ItemStack marqué.
 *  2. L'admin pose le bloc dans le monde naturellement (clic-droit comme tout
 *     autre bloc). Cet event est intercepté ici.
 *  3. Si un ItemsAdder block ID est défini, on remplace le bloc vanilla qui
 *     vient d'être posé par le bloc custom (one-tick later, via scheduler).
 *  4. La crate est enregistrée dans le store comme PlacedCrate.
 *  5. Si l'admin casse le bloc, on désinscrit du store (le bloc lui-même est
 *     géré par BlockBreakEvent normal — on ne drop pas l'item-bloc spécial
 *     pour éviter qu'un joueur récupère par hasard une crate).
 */
public final class CrateBlockPlaceListener implements Listener {

    private final JavaPlugin plugin;
    private final CrateStore store;
    private final NamespacedKey blockTag;

    public CrateBlockPlaceListener(JavaPlugin plugin, CrateStore store) {
        this.plugin = plugin;
        this.store = store;
        this.blockTag = new NamespacedKey(plugin, "crate_block_id");
    }

    public NamespacedKey blockTag() { return blockTag; }

    /** Appelé par {@link CrateListener#cmdGiveBlock} pour produire l'item à donner. */
    public ItemStack buildBlockItem(Crate crate) {
        if (crate == null) return null;

        // Si ItemsAdder block ID défini → on essaie de partir d'un item ItemsAdder
        // visuellement correct. Sinon Material vanilla (CHEST par défaut).
        ItemStack base = null;
        if (crate.itemAdderBlockId != null && !crate.itemAdderBlockId.isBlank()
                && ItemAdderBridge.isAvailable()) {
            base = ItemAdderBridge.buildItem(crate.itemAdderBlockId, 1);
        }
        if (base == null) {
            String matName = (crate.placeholderMaterial != null && !crate.placeholderMaterial.isBlank())
                    ? crate.placeholderMaterial : "CHEST";
            org.bukkit.Material mat;
            try { mat = org.bukkit.Material.valueOf(matName.toUpperCase()); }
            catch (Exception e) { mat = org.bukkit.Material.CHEST; }
            if (!mat.isBlock()) mat = org.bukkit.Material.CHEST;
            base = new ItemStack(mat, 1);
        }

        ItemMeta meta = base.getItemMeta();
        if (meta != null) {
            String dn = crate.displayName == null ? crate.name : crate.displayName;
            meta.setDisplayName("§6§l[Crate] §r" + org.bukkit.ChatColor.translateAlternateColorCodes('&', dn));
            meta.setLore(java.util.Arrays.asList(
                    "§7Bloc spécial Crate.",
                    "§7Pose-le où tu veux : il sera",
                    "§7auto-enregistré comme crate.",
                    "",
                    "§8Crate ID : §7" + crate.id));
            meta.getPersistentDataContainer().set(blockTag, PersistentDataType.STRING, crate.id);
            base.setItemMeta(meta);
        }
        return base;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent e) {
        ItemStack inHand = e.getItemInHand();
        if (inHand == null) return;
        ItemMeta meta = inHand.getItemMeta();
        if (meta == null) return;
        PersistentDataContainer pdc = meta.getPersistentDataContainer();
        String crateId = pdc.get(blockTag, PersistentDataType.STRING);
        if (crateId == null) return;

        Crate crate = store.getCrate(crateId);
        if (crate == null) {
            e.getPlayer().sendMessage("§c✗ Cette crate n'existe plus.");
            return;
        }

        Block placed = e.getBlockPlaced();
        Player player = e.getPlayer();

        // Si la crate a un bloc ItemsAdder défini, on remplace le bloc vanilla
        // tout juste posé par le bloc custom au tick suivant (BlockPlaceEvent
        // ne permet pas de poser un CustomBlock directement).
        if (crate.itemAdderBlockId != null && !crate.itemAdderBlockId.isBlank()
                && ItemAdderBridge.isAvailable()) {
            final org.bukkit.Location loc = placed.getLocation();
            final String iaId = crate.itemAdderBlockId;
            Bukkit.getScheduler().runTask(plugin, () -> {
                boolean ok = ItemAdderBridge.placeCustomBlock(iaId, loc);
                if (!ok) {
                    player.sendMessage("§e⚠ Bloc ItemsAdder « " + iaId + " » introuvable, fallback vanilla.");
                }
            });
        }

        // Enregistrement dans le store
        store.addPlacedCrate(new PlacedCrate(
                crate.id,
                placed.getWorld().getName(),
                placed.getX(), placed.getY(), placed.getZ()));

        player.sendMessage("§a✓ Crate §6« " + crate.name + " »§a enregistrée à §e"
                + placed.getX() + "§7, §e" + placed.getY() + "§7, §e" + placed.getZ()
                + " §8(" + placed.getWorld().getName() + ")");
        player.sendMessage("§7Clique-droit pour ouvrir.");
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) {
        Block b = e.getBlock();
        PlacedCrate pc = store.getPlacedCrate(b.getWorld().getName(), b.getX(), b.getY(), b.getZ());
        if (pc == null) return;
        store.removePlacedCrate(b.getWorld().getName(), b.getX(), b.getY(), b.getZ());
        e.getPlayer().sendMessage("§e✓ Crate désinscrite à cet emplacement.");
    }
}
