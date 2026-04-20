package sunanticheat.dashboard.dailyreward;

import java.util.ArrayList;
import java.util.List;

/**
 * D\u00e9finition d'un jour dans le cycle de r\u00e9compenses quotidiennes.
 */
public class DailyRewardDay {
    public int day;
    public String displayName;
    public String icon;
    public String color;
    public List<DailyRewardItem> items = new ArrayList<>();
    public List<String> commands = new ArrayList<>();
    public int bonusCoins;

    public DailyRewardDay() {}

    public DailyRewardDay(int day, String displayName, int bonusCoins) {
        this.day = day;
        this.displayName = displayName;
        this.bonusCoins = bonusCoins;
    }
}
