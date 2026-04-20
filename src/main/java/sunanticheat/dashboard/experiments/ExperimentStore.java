package sunanticheat.dashboard.experiments;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

public final class ExperimentStore {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final File file;
    private final Logger logger;
    private final Map<String, Experiment> experiments = new ConcurrentHashMap<>();
    private final Random random = new Random();

    public ExperimentStore(File dataFolder, Logger logger) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        dir.mkdirs();
        this.file = new File(dir, "experiments.json");
        load();
    }

    public Collection<Experiment> all() { return new ArrayList<>(experiments.values()); }
    public Experiment get(String id) { return experiments.get(id); }

    public Experiment add(String name, String description, List<Experiment.Variant> variants) {
        String id = UUID.randomUUID().toString();
        Experiment e = new Experiment(id, name, description, false, variants, System.currentTimeMillis());
        experiments.put(id, e);
        save();
        return e;
    }

    @SuppressWarnings("unchecked")
    public Experiment update(String id, Map<String, Object> patch) {
        Experiment e = experiments.get(id);
        if (e == null) return null;
        if (patch.containsKey("name")) e.setName((String) patch.get("name"));
        if (patch.containsKey("description")) e.setDescription((String) patch.get("description"));
        if (patch.containsKey("enabled")) {
            boolean newState = Boolean.TRUE.equals(patch.get("enabled"));
            if (newState && !e.isEnabled()) e.setStartedAt(System.currentTimeMillis());
            if (!newState && e.isEnabled()) e.setEndedAt(System.currentTimeMillis());
            e.setEnabled(newState);
        }
        if (patch.containsKey("variants")) {
            List<Map<String, Object>> raw = (List<Map<String, Object>>) patch.get("variants");
            List<Experiment.Variant> list = new ArrayList<>();
            if (raw != null) for (Map<String, Object> m : raw) {
                Experiment.Variant v = new Experiment.Variant();
                v.key = (String) m.get("key");
                v.label = (String) m.getOrDefault("label", v.key);
                v.weight = ((Number) m.getOrDefault("weight", 1)).intValue();
                v.config = (Map<String, Object>) m.getOrDefault("config", new LinkedHashMap<>());
                list.add(v);
            }
            e.setVariants(list);
        }
        save();
        return e;
    }

    public boolean delete(String id) {
        boolean r = experiments.remove(id) != null;
        if (r) save();
        return r;
    }

    /** Assigne (ou retrouve) la variante pour un joueur donné (pondération stable par UUID). */
    public Experiment.Variant assign(String experimentId, String playerUuid) {
        Experiment e = experiments.get(experimentId);
        if (e == null || !e.isEnabled() || e.getVariants().isEmpty()) return null;
        String existing = e.getAssignments().get(playerUuid);
        if (existing != null) {
            for (Experiment.Variant v : e.getVariants()) if (existing.equals(v.key)) return v;
        }
        int total = 0;
        for (Experiment.Variant v : e.getVariants()) total += Math.max(1, v.weight);
        int pick = random.nextInt(total);
        int acc = 0;
        for (Experiment.Variant v : e.getVariants()) {
            acc += Math.max(1, v.weight);
            if (pick < acc) {
                e.getAssignments().put(playerUuid, v.key);
                v.assignedCount++;
                save();
                return v;
            }
        }
        return e.getVariants().get(0);
    }

    public void trackMetric(String experimentId, String playerUuid, String metric, double value) {
        Experiment e = experiments.get(experimentId);
        if (e == null) return;
        String key = e.getAssignments().get(playerUuid);
        if (key == null) return;
        for (Experiment.Variant v : e.getVariants()) {
            if (v.key.equals(key)) {
                v.metrics.merge(metric, value, Double::sum);
                break;
            }
        }
        save();
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    public synchronized void save() {
        try {
            Files.writeString(file.toPath(), GSON.toJson(new ArrayList<>(experiments.values())), StandardCharsets.UTF_8);
        } catch (IOException ex) { logger.warning("[Dashboard/Experiments] save: " + ex.getMessage()); }
    }

    private void load() {
        if (!file.exists()) return;
        try {
            List<Experiment> list = GSON.fromJson(Files.readString(file.toPath(), StandardCharsets.UTF_8),
                    new TypeToken<List<Experiment>>(){}.getType());
            if (list != null) for (Experiment e : list) experiments.put(e.getId(), e);
        } catch (Exception ex) { logger.warning("[Dashboard/Experiments] load: " + ex.getMessage()); }
    }
}
