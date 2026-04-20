package sunanticheat.dashboard.dailyreward;

import java.util.ArrayList;
import java.util.List;

/**
 * Item individuel offert dans un jour de r\u00e9compense quotidienne.
 */
public class DailyRewardItem {
    public String material;
    public int customModelData;
    public String itemAdderId;
    public int amount = 1;
    public List<String> enchantments = new ArrayList<>();
    public List<String> lore = new ArrayList<>();
    public String displayName;
}
