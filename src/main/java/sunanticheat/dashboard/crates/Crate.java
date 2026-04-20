package sunanticheat.dashboard.crates;

import java.util.ArrayList;
import java.util.List;

/**
 * POJO repr\u00e9sentant une crate configurable.
 */
public class Crate {
    public String id;
    public String name;
    public String displayName;
    public String description;
    public String icon;
    public String color;

    public String placeholderMaterial;
    public String itemAdderBlockId;

    public boolean usesPhysicalKey;
    public String keyMaterial;
    public int keyCustomModelData;
    public String keyItemAdderId;
    public String keyDisplayName;

    /** "CSGO" | "WHEEL" | "FADE" | "SIMPLE" */
    public String animation = "SIMPLE";

    // Pity system
    public boolean pityEnabled;
    public int pityOpens;
    public CrateRarity pityGuarantee = CrateRarity.RARE;

    // Daily limit
    public boolean dailyLimitEnabled;
    public int dailyLimit;

    // FX
    public String openSound;
    public String rewardSound;
    public boolean fireworkOnWin;
    public boolean particlesEnabled;

    // Broadcasts
    public boolean broadcastOnOpen;
    /** Placeholders: {player}, {crate}, {item}. */
    public String broadcastFormat = "&6{player} &ea obtenu &6{item} &edans &6{crate}&e!";

    public List<CrateItem> items = new ArrayList<>();
    public long totalOpens;
    public long createdAt;
}
