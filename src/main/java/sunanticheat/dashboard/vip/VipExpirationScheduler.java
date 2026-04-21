package sunanticheat.dashboard.vip;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

/**
 * Scheduler qui révoque les abonnements expirés et notifie ceux qui expirent sous 3 jours.
 * Tick toutes les heures, démarrage 5 minutes après start().
 */
public final class VipExpirationScheduler {

    private final JavaPlugin plugin;
    private final VipStore store;
    private final VipActivationService activation;
    private final Logger logger;
    private BukkitTask task;

    public VipExpirationScheduler(JavaPlugin plugin, VipStore store,
                                  VipActivationService activation, Logger logger) {
        this.plugin = plugin;
        this.store = store;
        this.activation = activation;
        this.logger = logger;
    }

    public void start() {
        if (task != null) return;
        task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::tick,
                20L * 60 * 5,        // 5 minutes
                20L * 60 * 60);      // 1 heure
    }

    public void stop() {
        if (task != null) {
            try { task.cancel(); } catch (Throwable ignored) {}
            task = null;
        }
    }

    private void tick() {
        try {
            // 1) Expirations
            for (VipSubscription sub : store.findExpired()) {
                try {
                    activation.revokeSubscription(sub, "Expiration normale");
                } catch (Throwable t) {
                    logger.warning("[Dashboard/VIP] expire fail " + sub.id + ": " + t.getMessage());
                }
            }

            // 2) Notifs J-3
            long now = System.currentTimeMillis();
            long dayMs = TimeUnit.DAYS.toMillis(1);
            for (VipSubscription sub : store.findExpiringSoon(3)) {
                if (sub == null) continue;
                if (now - sub.lastNotificationSent < dayMs) continue;
                try {
                    if (sub.playerName != null) {
                        Bukkit.getScheduler().runTask(plugin, () -> {
                            Player online = Bukkit.getPlayerExact(sub.playerName);
                            if (online != null && online.isOnline()) {
                                online.sendMessage("§e⚠ Ton VIP expire dans moins de 3 jours !");
                            }
                        });
                    }
                    // Notification Discord via activation (réutilise le webhook)
                    // On ne passe pas par activation pour éviter un couplage ; on log juste.
                    sub.lastNotificationSent = now;
                    store.updateSubscription(sub.id, sub);
                } catch (Throwable t) {
                    logger.warning("[Dashboard/VIP] notif J-3 fail: " + t.getMessage());
                }
            }
        } catch (Throwable t) {
            logger.warning("[Dashboard/VIP] scheduler tick fail: " + t.getMessage());
        }
    }
}
