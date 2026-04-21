package sunanticheat.dashboard.vip;

import com.google.gson.Gson;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.luckperms.LuckPermsBridge;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.time.Duration;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Logger;

/**
 * Service central d'activation/révocation/gift/extension d'abonnements VIP.
 * Toutes les actions serveur (LuckPerms, dispatchCommand, sendMessage) sont
 * exécutées sur le main thread via Bukkit.getScheduler().runTask.
 */
public final class VipActivationService {

    private static final Gson GSON = new Gson();
    private static final SimpleDateFormat DATE_FMT = new SimpleDateFormat("dd/MM/yyyy");

    private final JavaPlugin plugin;
    private final VipStore store;
    private final Logger logger;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public VipActivationService(JavaPlugin plugin, VipStore store, Logger logger) {
        this.plugin = plugin;
        this.store = store;
        this.logger = logger;
    }

    /**
     * Active un abonnement après paiement validé.
     */
    public void activateSubscription(String playerName, String planId, String gateway,
                                     String gatewayTxId, double amountPaid, String currency) {
        if (playerName == null || planId == null) {
            logger.warning("[Dashboard/VIP] activate : playerName/planId null, abort");
            return;
        }
        VipPlan plan = store.getPlan(planId);
        if (plan == null) {
            logger.warning("[Dashboard/VIP] activate : plan introuvable " + planId);
            return;
        }

        // Résolution UUID (peut renvoyer null si offline mode et jamais vu)
        String uuid = null;
        try {
            OfflinePlayer op = Bukkit.getOfflinePlayer(playerName);
            if (op != null && op.getUniqueId() != null) uuid = op.getUniqueId().toString();
        } catch (Throwable t) {
            logger.warning("[Dashboard/VIP] resolve UUID fail: " + t.getMessage());
        }

        long now = System.currentTimeMillis();
        VipSubscription sub = new VipSubscription();
        sub.id = UUID.randomUUID().toString();
        sub.planId = plan.id;
        sub.planName = plan.displayName == null ? plan.name : plan.displayName;
        sub.playerUuid = uuid;
        sub.playerName = playerName;
        sub.startedAt = now;
        sub.expiresAt = now + (long) plan.durationDays * 86_400_000L;
        sub.status = "ACTIVE";
        sub.gateway = gateway;
        sub.gatewayTxId = gatewayTxId;
        sub.amountPaid = amountPaid;
        sub.currency = currency == null ? "EUR" : currency.toUpperCase();
        sub.rankApplied = false;
        sub.createdAt = now;
        store.createSubscription(sub);

        VipTransaction tx = new VipTransaction();
        tx.subscriptionId = sub.id;
        tx.playerName = playerName;
        tx.type = "PURCHASE";
        tx.amount = amountPaid;
        tx.currency = sub.currency;
        tx.gateway = gateway;
        tx.gatewayTxId = gatewayTxId;
        tx.status = "COMPLETED";
        tx.timestamp = now;
        store.recordTransaction(tx);

        final String finalUuid = uuid;
        final long finalExpires = sub.expiresAt;
        final String subId = sub.id;

        Bukkit.getScheduler().runTask(plugin, () -> {
            try {
                // LuckPerms
                if (plan.rank != null && !plan.rank.isBlank() && finalUuid != null) {
                    LuckPermsBridge.addGroup(finalUuid, plan.rank).thenAccept(success -> {
                        VipSubscription s = store.getSubscription(subId);
                        if (s != null) {
                            s.rankApplied = Boolean.TRUE.equals(success);
                            store.updateSubscription(subId, s);
                        }
                    });
                }
                // Commandes d'activation
                if (plan.commandsOnActivate != null) {
                    for (String cmd : plan.commandsOnActivate) {
                        if (cmd == null || cmd.isBlank()) continue;
                        try {
                            Bukkit.dispatchCommand(Bukkit.getConsoleSender(),
                                    cmd.replace("{player}", playerName));
                        } catch (Throwable t) {
                            logger.warning("[Dashboard/VIP] cmd activate fail: " + t.getMessage());
                        }
                    }
                }
                // Message au joueur si en ligne
                Player online = Bukkit.getPlayerExact(playerName);
                if (online != null && online.isOnline()) {
                    try {
                        online.sendTitle("§6✦ Merci pour ton VIP !",
                                "§e" + (plan.displayName == null ? plan.name : plan.displayName),
                                10, 80, 10);
                    } catch (Throwable ignored) {}
                    String rankStr = plan.rank == null ? "" : plan.rank;
                    online.sendMessage("§a✓ Ton rang VIP §6" + rankStr
                            + "§a est actif jusqu'au " + DATE_FMT.format(new Date(finalExpires)));
                }
            } catch (Throwable t) {
                logger.warning("[Dashboard/VIP] activate main-thread fail: " + t.getMessage());
            }
        });

        // Notification Discord (async)
        sendDiscordNotification("🎉 **" + playerName + "** a acheté **"
                + (plan.displayName == null ? plan.name : plan.displayName)
                + "** (" + plan.priceEur + "€) via " + gateway);
    }

    /** Révoque/expire un abonnement et retire le rank. */
    public void revokeSubscription(VipSubscription sub, String reason) {
        if (sub == null) return;
        boolean isRefund = reason != null && reason.toLowerCase().contains("refund");
        sub.status = isRefund ? "REFUNDED" : "EXPIRED";
        store.updateSubscription(sub.id, sub);

        final VipPlan plan = store.getPlan(sub.planId);
        final String uuid = sub.playerUuid;
        final String playerName = sub.playerName;
        final boolean hadRank = sub.rankApplied;

        Bukkit.getScheduler().runTask(plugin, () -> {
            try {
                if (hadRank && plan != null && plan.rank != null && !plan.rank.isBlank() && uuid != null) {
                    LuckPermsBridge.removeGroup(uuid, plan.rank);
                }
                if (plan != null && plan.commandsOnExpire != null) {
                    for (String cmd : plan.commandsOnExpire) {
                        if (cmd == null || cmd.isBlank()) continue;
                        try {
                            Bukkit.dispatchCommand(Bukkit.getConsoleSender(),
                                    cmd.replace("{player}", playerName == null ? "" : playerName));
                        } catch (Throwable t) {
                            logger.warning("[Dashboard/VIP] cmd expire fail: " + t.getMessage());
                        }
                    }
                }
                if (playerName != null) {
                    Player online = Bukkit.getPlayerExact(playerName);
                    if (online != null && online.isOnline()) {
                        online.sendMessage("§c✦ Ton rang VIP a expiré. Merci de ton soutien !");
                    }
                }
            } catch (Throwable t) {
                logger.warning("[Dashboard/VIP] revoke main-thread fail: " + t.getMessage());
            }
        });

        if (isRefund) {
            sendDiscordNotification("↩️ Remboursement : **" + sub.playerName + "** ("
                    + sub.planName + ", " + sub.amountPaid + " " + sub.currency + ")");
        }
    }

    /** Offre un abonnement (gateway MANUAL_GIFT, amount 0). */
    public void giftSubscription(String playerName, String planId, String adminUsername) {
        if (playerName == null || planId == null) return;
        VipPlan plan = store.getPlan(planId);
        if (plan == null) {
            logger.warning("[Dashboard/VIP] gift : plan introuvable " + planId);
            return;
        }

        String uuid = null;
        try {
            OfflinePlayer op = Bukkit.getOfflinePlayer(playerName);
            if (op != null && op.getUniqueId() != null) uuid = op.getUniqueId().toString();
        } catch (Throwable ignored) {}

        long now = System.currentTimeMillis();
        VipSubscription sub = new VipSubscription();
        sub.id = UUID.randomUUID().toString();
        sub.planId = plan.id;
        sub.planName = plan.displayName == null ? plan.name : plan.displayName;
        sub.playerUuid = uuid;
        sub.playerName = playerName;
        sub.startedAt = now;
        sub.expiresAt = now + (long) plan.durationDays * 86_400_000L;
        sub.status = "ACTIVE";
        sub.gateway = "MANUAL_GIFT";
        sub.gatewayTxId = "gift-" + sub.id;
        sub.amountPaid = 0.0;
        sub.currency = "EUR";
        sub.rankApplied = false;
        sub.createdAt = now;
        store.createSubscription(sub);

        VipTransaction tx = new VipTransaction();
        tx.subscriptionId = sub.id;
        tx.playerName = playerName;
        tx.type = "GIFT";
        tx.amount = 0.0;
        tx.currency = "EUR";
        tx.gateway = "MANUAL";
        tx.gatewayTxId = sub.gatewayTxId;
        tx.status = "COMPLETED";
        tx.adminUsername = adminUsername;
        tx.timestamp = now;
        store.recordTransaction(tx);

        final String finalUuid = uuid;
        final String subId = sub.id;
        final long finalExpires = sub.expiresAt;
        Bukkit.getScheduler().runTask(plugin, () -> {
            try {
                if (plan.rank != null && !plan.rank.isBlank() && finalUuid != null) {
                    LuckPermsBridge.addGroup(finalUuid, plan.rank).thenAccept(success -> {
                        VipSubscription s = store.getSubscription(subId);
                        if (s != null) {
                            s.rankApplied = Boolean.TRUE.equals(success);
                            store.updateSubscription(subId, s);
                        }
                    });
                }
                if (plan.commandsOnActivate != null) {
                    for (String cmd : plan.commandsOnActivate) {
                        if (cmd == null || cmd.isBlank()) continue;
                        try {
                            Bukkit.dispatchCommand(Bukkit.getConsoleSender(),
                                    cmd.replace("{player}", playerName));
                        } catch (Throwable ignored) {}
                    }
                }
                Player online = Bukkit.getPlayerExact(playerName);
                if (online != null && online.isOnline()) {
                    try {
                        online.sendTitle("§6✦ Cadeau VIP !",
                                "§e" + (plan.displayName == null ? plan.name : plan.displayName),
                                10, 80, 10);
                    } catch (Throwable ignored) {}
                    online.sendMessage("§a✓ Un admin t'a offert le rang VIP jusqu'au "
                            + DATE_FMT.format(new Date(finalExpires)));
                }
            } catch (Throwable t) {
                logger.warning("[Dashboard/VIP] gift main-thread fail: " + t.getMessage());
            }
        });

        sendDiscordNotification("🎁 **" + (adminUsername == null ? "admin" : adminUsername)
                + "** a offert **" + (plan.displayName == null ? plan.name : plan.displayName)
                + "** à **" + playerName + "**");
    }

    /** Prolonge un abonnement (crée aussi la transaction MANUAL_EXTENSION). */
    public void extendSubscription(VipSubscription sub, int additionalDays, String adminUsername) {
        if (sub == null || additionalDays == 0) return;
        long now = System.currentTimeMillis();
        long base = sub.expiresAt > now ? sub.expiresAt : now;
        sub.expiresAt = base + (long) additionalDays * 86_400_000L;

        boolean wasExpired = "EXPIRED".equalsIgnoreCase(sub.status) || "REFUNDED".equalsIgnoreCase(sub.status);
        if (wasExpired) sub.status = "ACTIVE";
        store.updateSubscription(sub.id, sub);

        VipTransaction tx = new VipTransaction();
        tx.subscriptionId = sub.id;
        tx.playerName = sub.playerName;
        tx.type = "MANUAL_EXTENSION";
        tx.amount = 0.0;
        tx.currency = sub.currency == null ? "EUR" : sub.currency;
        tx.gateway = "MANUAL";
        tx.gatewayTxId = "ext-" + UUID.randomUUID();
        tx.status = "COMPLETED";
        tx.adminUsername = adminUsername;
        tx.timestamp = now;
        store.recordTransaction(tx);

        if (wasExpired) {
            VipPlan plan = store.getPlan(sub.planId);
            final String uuid = sub.playerUuid;
            final String subId = sub.id;
            Bukkit.getScheduler().runTask(plugin, () -> {
                if (plan != null && plan.rank != null && !plan.rank.isBlank() && uuid != null) {
                    LuckPermsBridge.addGroup(uuid, plan.rank).thenAccept(success -> {
                        VipSubscription s = store.getSubscription(subId);
                        if (s != null) {
                            s.rankApplied = Boolean.TRUE.equals(success);
                            store.updateSubscription(subId, s);
                        }
                    });
                }
            });
        }

        sendDiscordNotification("⏰ Extension : **" + sub.playerName + "** +"
                + additionalDays + "j (" + (adminUsername == null ? "admin" : adminUsername) + ")");
    }

    /** Envoi d'une notification Discord via webhook (async, silencieux si échec). */
    private void sendDiscordNotification(String message) {
        String url = plugin.getConfig().getString("vip.discord-webhook", "");
        if (url == null || url.isBlank() || message == null) return;
        try {
            String body = GSON.toJson(Map.of("content", message));
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            http.sendAsync(req, HttpResponse.BodyHandlers.discarding())
                    .exceptionally(ex -> {
                        logger.warning("[Dashboard/VIP] Discord webhook fail: " + ex.getMessage());
                        return null;
                    });
        } catch (Throwable t) {
            logger.warning("[Dashboard/VIP] Discord webhook fail: " + t.getMessage());
        }
    }
}
