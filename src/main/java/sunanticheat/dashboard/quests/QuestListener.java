package sunanticheat.dashboard.quests;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.event.inventory.CraftItemEvent;
import org.bukkit.event.player.PlayerFishEvent;

public final class QuestListener implements Listener {

    private final QuestStore store;

    public QuestListener(QuestStore store) { this.store = store; }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) {
        store.increment(e.getPlayer(), Quest.Type.BREAK_BLOCK, e.getBlock().getType().name(), 1);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent e) {
        store.increment(e.getPlayer(), Quest.Type.PLACE_BLOCK, e.getBlock().getType().name(), 1);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onKill(EntityDeathEvent e) {
        Player killer = e.getEntity().getKiller();
        if (killer == null) return;
        String type = e.getEntityType().name();
        store.increment(killer, Quest.Type.KILL_ENTITY, type, 1);
        if (e.getEntity() instanceof Player) {
            store.increment(killer, Quest.Type.KILL_PLAYER, "ANY", 1);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCraft(CraftItemEvent e) {
        if (!(e.getWhoClicked() instanceof Player p)) return;
        if (e.getRecipe() == null || e.getRecipe().getResult() == null) return;
        String item = e.getRecipe().getResult().getType().name();
        store.increment(p, Quest.Type.CRAFT_ITEM, item, 1);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onFish(PlayerFishEvent e) {
        if (e.getState() != PlayerFishEvent.State.CAUGHT_FISH) return;
        store.increment(e.getPlayer(), Quest.Type.FISH_CATCH, "ANY", 1);
    }
}
