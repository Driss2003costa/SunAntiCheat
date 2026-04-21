package sunanticheat.dashboard.vip;

/**
 * Transaction financière liée à un abonnement VIP.
 */
public class VipTransaction {
    public String id;
    public String subscriptionId;
    public String playerName;
    public String type;
    public double amount;
    public String currency;
    public String gateway;
    public String gatewayTxId;
    public String status;
    public String adminUsername;
    public long timestamp;
}
