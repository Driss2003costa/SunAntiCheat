package sunanticheat.dashboard.quests;

public final class Quest {
    public enum Type { BREAK_BLOCK, PLACE_BLOCK, KILL_ENTITY, KILL_PLAYER, CRAFT_ITEM, FISH_CATCH, PLAY_TIME, FRIEND_COUNT, REFERRAL_COUNT }

    private final String id;
    private String title;
    private String description;
    /** Traductions anglaises optionnelles. null = portail en anglais retombe sur title/description. */
    private String titleEn;
    private String descriptionEn;
    private String icon;
    private String color;
    private Type type;
    private String target;
    private int goal;
    private String rewardCommand;
    private String rewardLabel;
    private String rewardLabelEn;
    private boolean enabled;
    private boolean repeatable;
    private final long createdAt;
    private Long endsAt; // null = permanent

    public Quest(String id, String title, String description, String icon, String color,
                 Type type, String target, int goal, String rewardCommand, String rewardLabel,
                 boolean enabled, boolean repeatable, long createdAt, Long endsAt) {
        this(id, title, description, null, null, icon, color, type, target, goal,
                rewardCommand, rewardLabel, null, enabled, repeatable, createdAt, endsAt);
    }

    public Quest(String id, String title, String description,
                 String titleEn, String descriptionEn,
                 String icon, String color,
                 Type type, String target, int goal,
                 String rewardCommand, String rewardLabel, String rewardLabelEn,
                 boolean enabled, boolean repeatable, long createdAt, Long endsAt) {
        this.id = id;
        this.title = title != null ? title : "Quête";
        this.description = description != null ? description : "";
        this.titleEn = isBlank(titleEn) ? null : titleEn;
        this.descriptionEn = isBlank(descriptionEn) ? null : descriptionEn;
        this.icon = icon != null ? icon : "⭐";
        this.color = color != null ? color : "#8B5CF6";
        this.type = type != null ? type : Type.BREAK_BLOCK;
        this.target = target != null ? target : "ANY";
        this.goal = goal > 0 ? goal : 1;
        this.rewardCommand = rewardCommand;
        this.rewardLabel = rewardLabel != null ? rewardLabel : "";
        this.rewardLabelEn = isBlank(rewardLabelEn) ? null : rewardLabelEn;
        this.enabled = enabled;
        this.repeatable = repeatable;
        this.createdAt = createdAt;
        this.endsAt = endsAt;
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getTitleEn() { return titleEn; }
    public String getDescriptionEn() { return descriptionEn; }
    public String getIcon() { return icon; }
    public String getColor() { return color; }
    public Type getType() { return type; }
    public String getTarget() { return target; }
    public int getGoal() { return goal; }
    public String getRewardCommand() { return rewardCommand; }
    public String getRewardLabel() { return rewardLabel; }
    public String getRewardLabelEn() { return rewardLabelEn; }
    public boolean isEnabled() { return enabled; }
    public boolean isRepeatable() { return repeatable; }
    public long getCreatedAt() { return createdAt; }
    public Long getEndsAt() { return endsAt; }

    public void setTitle(String v) { title = v; }
    public void setDescription(String v) { description = v; }
    public void setTitleEn(String v) { titleEn = isBlank(v) ? null : v; }
    public void setDescriptionEn(String v) { descriptionEn = isBlank(v) ? null : v; }
    public void setIcon(String v) { icon = v; }
    public void setColor(String v) { color = v; }
    public void setType(Type v) { type = v; }
    public void setTarget(String v) { target = v; }
    public void setGoal(int v) { goal = v; }
    public void setRewardCommand(String v) { rewardCommand = v; }
    public void setRewardLabel(String v) { rewardLabel = v; }
    public void setRewardLabelEn(String v) { rewardLabelEn = isBlank(v) ? null : v; }
    public void setEnabled(boolean v) { enabled = v; }
    public void setRepeatable(boolean v) { repeatable = v; }
    public void setEndsAt(Long v) { endsAt = v; }

    public boolean isExpired() { return endsAt != null && System.currentTimeMillis() > endsAt; }
}
