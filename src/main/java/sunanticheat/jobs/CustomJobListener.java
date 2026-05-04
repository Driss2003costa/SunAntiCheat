package sunanticheat.jobs;

import org.bukkit.Material;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Fish;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.event.inventory.CraftItemEvent;
import org.bukkit.event.player.PlayerFishEvent;
import org.bukkit.inventory.ItemStack;

public final class CustomJobListener implements Listener {

    private final CustomJobService service;

    public CustomJobListener(CustomJobService service) {
        this.service = service;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) {
        service.processAction(e.getPlayer(), "break", e.getBlock().getType().name(), e.getBlock().getLocation());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onKill(EntityDeathEvent e) {
        LivingEntity killed = e.getEntity();
        Player killer = killed.getKiller();
        if (killer == null) return;
        service.processAction(killer, "kill", killed.getType().name());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onFish(PlayerFishEvent e) {
        if (e.getState() != PlayerFishEvent.State.CAUGHT_FISH) return;
        Entity caught = e.getCaught();
        String target;
        if (caught instanceof Fish fish) {
            target = fish.getType().name();
        } else {
            target = "FISH";
        }
        service.processAction(e.getPlayer(), "fish", target);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCraft(CraftItemEvent e) {
        if (!(e.getWhoClicked() instanceof Player player)) return;
        ItemStack result = e.getRecipe().getResult();
        if (result.getType() == Material.AIR) return;
        service.processAction(player, "craft", result.getType().name());
    }
}
