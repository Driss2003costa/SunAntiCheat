package sunanticheat.dashboard.honeypot;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

public final class HoneypotStore {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final Persistence storage;
    private final Logger logger;
    private final Map<String, HoneypotTrap> trapsById = new ConcurrentHashMap<>();
    private final Map<String, String> keyToId = new ConcurrentHashMap<>();
    private final List<Map<String, Object>> alerts = Collections.synchronizedList(new ArrayList<>());

    public HoneypotStore(File dataFolder, Logger logger, BlobStorage blobs) {
        this.logger = logger;
        File legacy = new File(new File(dataFolder, "dashboard"), "honeypot.json");
        this.storage = new Persistence(blobs, "honeypot", legacy);
        load();
    }

    public Collection<HoneypotTrap> all() { return new ArrayList<>(trapsById.values()); }
    public List<Map<String, Object>> recentAlerts(int limit) {
        synchronized (alerts) {
            int from = Math.max(0, alerts.size() - limit);
            return new ArrayList<>(alerts.subList(from, alerts.size()));
        }
    }

    public HoneypotTrap add(String label, String world, int x, int y, int z, String material) {
        String id = UUID.randomUUID().toString();
        HoneypotTrap t = new HoneypotTrap(id, label, world, x, y, z, material, System.currentTimeMillis(), 0, 0);
        trapsById.put(id, t);
        keyToId.put(t.key(), id);
        save();
        return t;
    }

    public boolean delete(String id) {
        HoneypotTrap t = trapsById.remove(id);
        if (t != null) { keyToId.remove(t.key()); save(); return true; }
        return false;
    }

    public HoneypotTrap findByBlock(String world, int x, int y, int z) {
        String id = keyToId.get(world + ":" + x + ":" + y + ":" + z);
        return id != null ? trapsById.get(id) : null;
    }

    public void recordTrigger(HoneypotTrap trap, String player, String playerUuid) {
        trap.setLastTriggered(System.currentTimeMillis());
        trap.incTrigger();
        Map<String, Object> alert = new LinkedHashMap<>();
        alert.put("timestamp", System.currentTimeMillis());
        alert.put("trapId", trap.getId());
        alert.put("label", trap.getLabel());
        alert.put("player", player);
        alert.put("playerUuid", playerUuid);
        alert.put("world", trap.getWorld());
        alert.put("x", trap.getX()); alert.put("y", trap.getY()); alert.put("z", trap.getZ());
        synchronized (alerts) { alerts.add(alert); if (alerts.size() > 500) alerts.remove(0); }
        save();
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    public synchronized void save() {
        try {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("traps", new ArrayList<>(trapsById.values()));
            synchronized (alerts) { root.put("alerts", new ArrayList<>(alerts)); }
            storage.write(GSON.toJson(root));
        } catch (Exception e) { logger.warning("[Dashboard/Honeypot] save fail: " + e.getMessage()); }
    }

    @SuppressWarnings("unchecked")
    private void load() {
        String json = storage.read();
        if (json == null || json.isBlank()) return;
        try {
            Map<String, Object> root = GSON.fromJson(json, Map.class);
            if (root == null) return;
            List<HoneypotTrap> traps = GSON.fromJson(GSON.toJson(root.get("traps")), new TypeToken<List<HoneypotTrap>>(){}.getType());
            if (traps != null) for (HoneypotTrap t : traps) { trapsById.put(t.getId(), t); keyToId.put(t.key(), t.getId()); }
            List<Map<String, Object>> savedAlerts = (List<Map<String, Object>>) root.get("alerts");
            if (savedAlerts != null) { synchronized (alerts) { alerts.addAll(savedAlerts); } }
        } catch (Exception e) { logger.warning("[Dashboard/Honeypot] load fail: " + e.getMessage()); }
    }
}
