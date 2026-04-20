package sunanticheat.dashboard.experiments;

import java.util.*;

public final class Experiment {

    public static final class Variant {
        public String key;        // "A", "B", "control", ...
        public String label;
        public int weight;        // pondération d'assignation (1..100)
        public Map<String, Object> config; // payload libre
        public int assignedCount;
        public Map<String, Double> metrics = new LinkedHashMap<>();

        public Variant() {}
        public Variant(String key, String label, int weight, Map<String, Object> config) {
            this.key = key;
            this.label = label;
            this.weight = weight > 0 ? weight : 1;
            this.config = config != null ? config : new LinkedHashMap<>();
        }
    }

    private final String id;
    private String name;
    private String description;
    private boolean enabled;
    private long startedAt;
    private long endedAt;
    private List<Variant> variants = new ArrayList<>();
    // playerUuid -> variantKey
    private Map<String, String> assignments = new HashMap<>();
    private final long createdAt;

    public Experiment(String id, String name, String description, boolean enabled,
                      List<Variant> variants, long createdAt) {
        this.id = id;
        this.name = name != null ? name : "Experiment";
        this.description = description != null ? description : "";
        this.enabled = enabled;
        this.variants = variants != null ? variants : new ArrayList<>();
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public boolean isEnabled() { return enabled; }
    public long getStartedAt() { return startedAt; }
    public long getEndedAt() { return endedAt; }
    public List<Variant> getVariants() { return variants; }
    public Map<String, String> getAssignments() { return assignments; }
    public long getCreatedAt() { return createdAt; }

    public void setName(String v) { name = v; }
    public void setDescription(String v) { description = v; }
    public void setEnabled(boolean v) { enabled = v; }
    public void setStartedAt(long v) { startedAt = v; }
    public void setEndedAt(long v) { endedAt = v; }
    public void setVariants(List<Variant> v) { variants = v != null ? v : new ArrayList<>(); }
    public void setAssignments(Map<String, String> v) { assignments = v != null ? v : new HashMap<>(); }
}
