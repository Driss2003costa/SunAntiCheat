package sunanticheat.dashboard.quests;

public final class Quest {
    public enum Type { BREAK_BLOCK, PLACE_BLOCK, KILL_ENTITY, KILL_PLAYER, CRAFT_ITEM, FISH_CATCH, PLAY_TIME }

    private final String id;
    private String title;
    private String description;
    private String icon;
    private String color;
    private Type type;
    private String target;
    private int goal;
    private String rewardCommand;
    private String rewardLabel;
    private boolean enabled;
    private boolean repeatable;
    private final long createdAt;
    private Long endsAt; // null = permanent

    public Quest(String id, String title, String description, String icon, String color,
                 Type type, String target, int goal, String rewardCommand, String rewardLabel,
                 boolean enabled, boolean repeatable, long createdAt, Long endsAt) {
        this.id = id;
        this.title = title != null ? title : "Quête";
        this.description = description != null ? description : "";
        this.icon = icon != null ? icon : "⭐";
        this.color = color != null ? color : "#8B5CF6";
        this.type = type != null ? type : Type.BREAK_BLOCK;
        this.target = target != null ? target : "ANY";
        this.goal = goal > 0 ? goal : 1;
        this.rewardCommand = rewardCommand;
        this.rewardLabel = rewardLabel != null ? rewardLabel : "";
        this.enabled = enabled;
        this.repeatable = repeatable;
        this.createdAt = createdAt;
        this.endsAt = endsAt;
    }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getIcon() { return icon; }
    public String getColor() { return color; }
    public Type getType() { return type; }
    public String getTarget() { return target; }
    public int getGoal() { return goal; }
    public String getRewardCommand() { return rewardCommand; }
    public String getRewardLabel() { return rewardLabel; }
    public boolean isEnabled() { return enabled; }
    public boolean isRepeatable() { return repeatable; }
    public long getCreatedAt() { return createdAt; }
    public Long getEndsAt() { return endsAt; }

    public void setTitle(String v) { title = v; }
    public void setDescription(String v) { description = v; }
    public void setIcon(String v) { icon = v; }
    public void setColor(String v) { color = v; }
    public void setType(Type v) { type = v; }
    public void setTarget(String v) { target = v; }
    public void setGoal(int v) { goal = v; }
    public void setRewardCommand(String v) { rewardCommand = v; }
    public void setRewardLabel(String v) { rewardLabel = v; }
    public void setEnabled(boolean v) { enabled = v; }
    public void setRepeatable(boolean v) { repeatable = v; }
    public void setEndsAt(Long v) { endsAt = v; }

    public boolean isExpired() { return endsAt != null && System.currentTimeMillis() > endsAt; }
}
