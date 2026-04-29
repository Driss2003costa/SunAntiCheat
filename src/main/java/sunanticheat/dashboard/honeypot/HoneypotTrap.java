package sunanticheat.dashboard.honeypot;

public final class HoneypotTrap {
    private final String id;
    private String label;
    private String world;
    private int x, y, z;
    private String material; // e.g. "DIAMOND_BLOCK"
    private final long createdAt;
    private long lastTriggered;
    private int triggerCount;
    /** true = posé automatiquement par HoneypotAutoPlanter (false = placement manuel admin). */
    private boolean autoPlaced;

    public HoneypotTrap(String id, String label, String world, int x, int y, int z,
                        String material, long createdAt, long lastTriggered, int triggerCount) {
        this(id, label, world, x, y, z, material, createdAt, lastTriggered, triggerCount, false);
    }

    public HoneypotTrap(String id, String label, String world, int x, int y, int z,
                        String material, long createdAt, long lastTriggered, int triggerCount,
                        boolean autoPlaced) {
        this.id = id; this.label = label != null ? label : "trap";
        this.world = world; this.x = x; this.y = y; this.z = z;
        this.material = material != null ? material : "DIAMOND_BLOCK";
        this.createdAt = createdAt;
        this.lastTriggered = lastTriggered;
        this.triggerCount = triggerCount;
        this.autoPlaced = autoPlaced;
    }

    public String getId() { return id; }
    public String getLabel() { return label; }
    public String getWorld() { return world; }
    public int getX() { return x; } public int getY() { return y; } public int getZ() { return z; }
    public String getMaterial() { return material; }
    public long getCreatedAt() { return createdAt; }
    public long getLastTriggered() { return lastTriggered; }
    public int getTriggerCount() { return triggerCount; }
    public boolean isAutoPlaced() { return autoPlaced; }

    public void setLabel(String s) { label = s; }
    public void setLastTriggered(long t) { lastTriggered = t; }
    public void incTrigger() { triggerCount++; }

    public String key() { return world + ":" + x + ":" + y + ":" + z; }
}
