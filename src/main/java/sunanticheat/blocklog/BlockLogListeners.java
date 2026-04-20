package sunanticheat.blocklog;

import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Enregistre cassage, placement et interactions sur les blocs.
 * Clic droit ouvre le log uniquement si le joueur a la permission ET le mode inspection activé (/sunguard blocklog).
 */
public class BlockLogListeners implements Listener {

    private static final String PERM_CHECK = "sunguard.blocklog.check";

    private final BlockLogStore store;
    private final BlockLogGui gui;
    private final BlockLogInspectionMode inspectionMode;
    private final JavaPlugin plugin;
    private final boolean logBreak;
    private final boolean logPlace;
    private final boolean logInteract;

    public BlockLogListeners(BlockLogStore store, BlockLogGui gui, BlockLogInspectionMode inspectionMode,
                             JavaPlugin plugin, boolean logBreak, boolean logPlace, boolean logInteract) {
        this.store = store;
        this.gui = gui;
        this.inspectionMode = inspectionMode;
        this.plugin = plugin;
        this.logBreak = logBreak;
        this.logPlace = logPlace;
        this.logInteract = logInteract;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockBreak(BlockBreakEvent event) {
        if (!logBreak) return;
        Player p = event.getPlayer();
        store.add(event.getBlock(), BlockLogEntry.Type.BREAK, p.getName(), p.getUniqueId());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBlockPlace(BlockPlaceEvent event) {
        if (!logPlace) return;
        Player p = event.getPlayer();
        store.add(event.getBlock(), BlockLogEntry.Type.PLACE, p.getName(), p.getUniqueId());
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onPlayerInteract(PlayerInteractEvent event) {
        Block block = event.getClickedBlock();
        if (block == null) return;
        if (event.getAction() != org.bukkit.event.block.Action.RIGHT_CLICK_BLOCK) return;

        Player player = event.getPlayer();

        if (player.hasPermission(PERM_CHECK) && inspectionMode != null && inspectionMode.isActive(player.getUniqueId())) {
            event.setCancelled(true);
            plugin.getServer().getScheduler().runTask(plugin, () -> gui.open(player, block));
            return;
        }

        if (logInteract) {
            store.add(block, BlockLogEntry.Type.INTERACT, player.getName(), player.getUniqueId());
        }
    }
}
