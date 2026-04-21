package sunanticheat.dashboard.vip;

/**
 * Abonnement VIP d'un joueur (instance d'un plan acheté).
 */
public class VipSubscription {
    public String id;
    public String planId;
    public String planName;
    public String playerUuid;
    public String playerName;
    public long startedAt;
    public long expiresAt;
    public String status;
    public String gateway;
    public String gatewayTxId;
    public double amountPaid;
    public String currency;
    public boolean rankApplied;
    public long lastNotificationSent;
    public long createdAt;
}
