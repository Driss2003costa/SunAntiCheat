package sunanticheat.dashboard.dailyreward;

import java.util.ArrayList;
import java.util.List;

/**
 * Enregistrement d'une r\u00e9clamation de r\u00e9compense quotidienne.
 */
public class DailyRewardClaim {
    public String playerUuid;
    public String playerName;
    public int day;
    public long claimedAt;
    public List<String> itemsGiven = new ArrayList<>();

    public DailyRewardClaim() {}

    public DailyRewardClaim(String playerUuid, String playerName, int day, long claimedAt, List<String> itemsGiven) {
        this.playerUuid = playerUuid;
        this.playerName = playerName;
        this.day = day;
        this.claimedAt = claimedAt;
        this.itemsGiven = itemsGiven == null ? new ArrayList<>() : itemsGiven;
    }
}
