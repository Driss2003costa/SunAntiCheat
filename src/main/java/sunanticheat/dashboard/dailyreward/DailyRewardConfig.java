package sunanticheat.dashboard.dailyreward;

import java.util.ArrayList;
import java.util.List;

/**
 * Configuration globale du syst\u00e8me de r\u00e9compenses quotidiennes.
 */
public class DailyRewardConfig {
    public boolean enabled = true;
    public int cycleDays = 7;
    public boolean resetOnMiss = true;
    public List<DailyRewardDay> days = new ArrayList<>();

    public static DailyRewardConfig createDefault() {
        DailyRewardConfig cfg = new DailyRewardConfig();
        cfg.enabled = true;
        cfg.cycleDays = 7;
        cfg.resetOnMiss = true;
        cfg.days = new ArrayList<>();
        for (int i = 1; i <= 7; i++) {
            cfg.days.add(new DailyRewardDay(i, "Jour " + i, 100 * i));
        }
        return cfg;
    }
}
