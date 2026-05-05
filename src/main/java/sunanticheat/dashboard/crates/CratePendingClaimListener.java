package sunanticheat.dashboard.crates;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.List;

/**
 * Livre à la connexion les clés achetées via le portail web pendant que le joueur était hors ligne.
 * Reproduit exactement le pattern de DailyRewardListener.onJoin().
 */
public final class CratePendingClaimListener implements Listener {

    private final JavaPlugin plugin;
    private final CrateStore crateStore;
    private final CratePendingClaimStore pendingStore;
    private final CrateListener crateListener;

    public CratePendingClaimListener(JavaPlugin plugin, CrateStore crateStore,
                                     CratePendingClaimStore pendingStore,
                                     CrateListener crateListener) {
        this.plugin        = plugin;
        this.crateStore    = crateStore;
        this.pendingStore  = pendingStore;
        this.crateListener = crateListener;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        final Player player = event.getPlayer();
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (!player.isOnline()) return;
            String uuid = player.getUniqueId().toString();
            List<CratePendingClaim> claims = pendingStore.consumePendingClaims(uuid);
            if (claims.isEmpty()) return;

            for (CratePendingClaim claim : claims) {
                Crate crate = crateStore.getCrate(claim.getCrateId());
                if (crate == null) continue;

                int count = Math.max(1, claim.getCount());

                if (crate.usesPhysicalKey) {
                    ItemStack key = crateListener.buildKeyItem(crate);
                    if (key != null) {
                        key.setAmount(count);
                        for (ItemStack leftover : player.getInventory().addItem(key).values()) {
                            player.getWorld().dropItemNaturally(player.getLocation(), leftover);
                        }
                    }
                } else {
                    crateStore.giveKey(crate.id, uuid, count);
                }

                String crateName = crate.displayName != null ? crate.displayName : crate.name;
                player.sendMessage("§a✦ Vous avez reçu §e" + count + " clé(s) §apour la crate §b"
                        + crateName + "§a !");
            }
        }, 60L);
    }
}
