package sunanticheat.dashboard.crates;

import java.util.ArrayList;
import java.util.List;

/**
 * POJO repr\u00e9sentant un item loot potentiel d'une crate.
 * S\u00e9rialis\u00e9 via Gson (champs publics).
 */
public class CrateItem {
    public String id;
    public String displayName;
    public String material;
    public int customModelData;
    public String itemAdderId;
    public int amount = 1;
    public int weight = 1;
    public List<String> enchantments = new ArrayList<>();
    public List<String> lore = new ArrayList<>();
    public List<String> commands = new ArrayList<>();
    public boolean isCommand;
    public CrateRarity rarity = CrateRarity.COMMON;
    public boolean broadcastOnWin;
}
