package sunanticheat.dashboard.crates;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Logger;

/**
 * Persistance des crates (config, ouvertures, cl\u00e9s, placements, pity, daily-limit).
 * Tous les acc\u00e8s mutables sont synchronis\u00e9s sur l'instance.
 */
public final class CrateStore {

    private static final Gson GSON = new GsonBuilder().serializeNulls().setPrettyPrinting().create();
    private static final int MAX_OPENS = 500;

    private final Logger logger;
    private final File cratesFile;
    private final File opensFile;
    private final File keysFile;
    private final File placedFile;
    private final File statsFile;
    private final File dailyFile;

    private final Map<String, Crate> crates = new LinkedHashMap<>();
    private final List<CrateOpen> opens = new ArrayList<>();
    /** crateId -> (playerUuid -> keyCount) */
    private final Map<String, Map<String, Integer>> keys = new HashMap<>();
    private final List<PlacedCrate> placed = new ArrayList<>();
    /** crateId -> (playerUuid -> openCount pour pity). */
    private final Map<String, Map<String, Integer>> openCounts = new HashMap<>();
    /** crateId -> (playerUuid -> lastOpenTimestamp). Reset quotidien via date du jour. */
    private final Map<String, Map<String, Long>> dailyOpens = new HashMap<>();

    public CrateStore(File dataFolder, Logger logger) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        if (!dir.exists()) dir.mkdirs();
        this.cratesFile = new File(dir, "crates.json");
        this.opensFile = new File(dir, "crates_opens.json");
        this.keysFile = new File(dir, "crates_keys.json");
        this.placedFile = new File(dir, "crates_placed.json");
        this.statsFile = new File(dir, "crates_stats.json");
        this.dailyFile = new File(dir, "crates_daily.json");
        load();
    }

    // ── Crates CRUD ───────────────────────────────────────────────────────────

    public synchronized List<Crate> listCrates() {
        return new ArrayList<>(crates.values());
    }

    public synchronized Crate getCrate(String id) {
        if (id == null) return null;
        return crates.get(id);
    }

    public synchronized Crate getCrateByName(String name) {
        if (name == null) return null;
        for (Crate c : crates.values()) {
            if (name.equalsIgnoreCase(c.name)) return c;
        }
        return null;
    }

    public synchronized Crate createCrate(Crate c) {
        if (c == null) return null;
        if (c.id == null || c.id.isEmpty()) c.id = UUID.randomUUID().toString();
        if (c.createdAt <= 0L) c.createdAt = System.currentTimeMillis();
        if (c.items == null) c.items = new ArrayList<>();
        crates.put(c.id, c);
        save();
        return c;
    }

    public synchronized void updateCrate(String id, Crate c) {
        if (id == null || c == null) return;
        c.id = id;
        Crate existing = crates.get(id);
        if (existing != null && c.createdAt <= 0L) c.createdAt = existing.createdAt;
        if (existing != null) c.totalOpens = existing.totalOpens;
        if (c.items == null) c.items = new ArrayList<>();
        crates.put(id, c);
        save();
    }

    public synchronized void deleteCrate(String id) {
        if (id == null) return;
        crates.remove(id);
        keys.remove(id);
        openCounts.remove(id);
        dailyOpens.remove(id);
        placed.removeIf(p -> id.equals(p.crateId));
        save();
    }

    // ── Opens ─────────────────────────────────────────────────────────────────

    public synchronized void recordOpen(CrateOpen open) {
        if (open == null) return;
        opens.add(0, open);
        while (opens.size() > MAX_OPENS) opens.remove(opens.size() - 1);
        Crate c = crates.get(open.crateId);
        if (c != null) c.totalOpens++;
        save();
    }

    public synchronized List<CrateOpen> listOpens(String crateId, int limit) {
        List<CrateOpen> out = new ArrayList<>();
        for (CrateOpen o : opens) {
            if (crateId == null || crateId.equals(o.crateId)) {
                out.add(o);
                if (out.size() >= Math.max(1, limit)) break;
            }
        }
        return out;
    }

    // ── Keys (virtuelles) ─────────────────────────────────────────────────────

    public synchronized void giveKey(String crateId, String playerUuid, int count) {
        if (crateId == null || playerUuid == null || count <= 0) return;
        Map<String, Integer> m = keys.computeIfAbsent(crateId, k -> new HashMap<>());
        m.merge(playerUuid, count, Integer::sum);
        save();
    }

    public synchronized int getKeys(String crateId, String playerUuid) {
        if (crateId == null || playerUuid == null) return 0;
        Map<String, Integer> m = keys.get(crateId);
        if (m == null) return 0;
        Integer v = m.get(playerUuid);
        return v == null ? 0 : v;
    }

    public synchronized boolean consumeKey(String crateId, String playerUuid) {
        if (crateId == null || playerUuid == null) return false;
        Map<String, Integer> m = keys.get(crateId);
        if (m == null) return false;
        Integer v = m.get(playerUuid);
        if (v == null || v <= 0) return false;
        int next = v - 1;
        if (next <= 0) m.remove(playerUuid);
        else m.put(playerUuid, next);
        save();
        return true;
    }

    public synchronized Map<String, Integer> getAllKeysForPlayer(String playerUuid) {
        Map<String, Integer> out = new HashMap<>();
        if (playerUuid == null) return out;
        for (Map.Entry<String, Map<String, Integer>> e : keys.entrySet()) {
            Integer v = e.getValue().get(playerUuid);
            if (v != null && v > 0) out.put(e.getKey(), v);
        }
        return out;
    }

    // ── Placements ────────────────────────────────────────────────────────────

    public synchronized void addPlacedCrate(PlacedCrate p) {
        if (p == null) return;
        // Remplace un existant aux m\u00eames coordonn\u00e9es
        placed.removeIf(pc -> pc.world.equals(p.world) && pc.x == p.x && pc.y == p.y && pc.z == p.z);
        placed.add(p);
        save();
    }

    public synchronized void removePlacedCrate(String world, int x, int y, int z) {
        placed.removeIf(pc -> pc.world.equals(world) && pc.x == x && pc.y == y && pc.z == z);
        save();
    }

    public synchronized PlacedCrate getPlacedCrate(String world, int x, int y, int z) {
        if (world == null) return null;
        for (PlacedCrate pc : placed) {
            if (world.equals(pc.world) && pc.x == x && pc.y == y && pc.z == z) return pc;
        }
        return null;
    }

    public synchronized List<PlacedCrate> listPlacedCrates(String crateId) {
        List<PlacedCrate> out = new ArrayList<>();
        for (PlacedCrate pc : placed) {
            if (crateId == null || crateId.equals(pc.crateId)) out.add(pc);
        }
        return out;
    }

    // ── Pity ──────────────────────────────────────────────────────────────────

    public synchronized void incrementOpenCount(String crateId, String playerUuid) {
        if (crateId == null || playerUuid == null) return;
        Map<String, Integer> m = openCounts.computeIfAbsent(crateId, k -> new HashMap<>());
        m.merge(playerUuid, 1, Integer::sum);
        save();
    }

    public synchronized int getOpenCount(String crateId, String playerUuid) {
        if (crateId == null || playerUuid == null) return 0;
        Map<String, Integer> m = openCounts.get(crateId);
        if (m == null) return 0;
        Integer v = m.get(playerUuid);
        return v == null ? 0 : v;
    }

    public synchronized void resetOpenCount(String crateId, String playerUuid) {
        if (crateId == null || playerUuid == null) return;
        Map<String, Integer> m = openCounts.get(crateId);
        if (m != null) m.remove(playerUuid);
        save();
    }

    // ── Daily limit ───────────────────────────────────────────────────────────

    private static long startOfDay() {
        return ZonedDateTime.now(ZoneId.systemDefault())
                .toLocalDate().atStartOfDay(ZoneId.systemDefault())
                .toInstant().toEpochMilli();
    }

    public synchronized int getOpensToday(String crateId, String playerUuid) {
        if (crateId == null || playerUuid == null) return 0;
        Map<String, Long> m = dailyOpens.get(crateId);
        if (m == null) return 0;
        Long last = m.get(playerUuid);
        if (last == null) return 0;
        // Le fichier stocke un compteur encod\u00e9 sur les 32 bits de poids faible
        // et le timestamp du jour sur les 32 bits de poids fort.
        long todayKey = startOfDay() / 86400000L;
        long storedKey = last >>> 32;
        if (storedKey != todayKey) return 0;
        return (int) (last & 0xFFFFFFFFL);
    }

    public synchronized boolean canOpenToday(String crateId, String playerUuid, int limit) {
        if (limit <= 0) return true;
        return getOpensToday(crateId, playerUuid) < limit;
    }

    public synchronized void recordDailyOpen(String crateId, String playerUuid) {
        if (crateId == null || playerUuid == null) return;
        Map<String, Long> m = dailyOpens.computeIfAbsent(crateId, k -> new HashMap<>());
        long todayKey = startOfDay() / 86400000L;
        int current = getOpensToday(crateId, playerUuid);
        long encoded = (todayKey << 32) | ((long) (current + 1) & 0xFFFFFFFFL);
        m.put(playerUuid, encoded);
        save();
    }

    // ── Persist ───────────────────────────────────────────────────────────────

    public synchronized void save() {
        try {
            Files.writeString(cratesFile.toPath(),
                    GSON.toJson(new ArrayList<>(crates.values())), StandardCharsets.UTF_8);
            Files.writeString(opensFile.toPath(), GSON.toJson(opens), StandardCharsets.UTF_8);
            Files.writeString(keysFile.toPath(), GSON.toJson(keys), StandardCharsets.UTF_8);
            Files.writeString(placedFile.toPath(), GSON.toJson(placed), StandardCharsets.UTF_8);
            Files.writeString(statsFile.toPath(), GSON.toJson(openCounts), StandardCharsets.UTF_8);
            Files.writeString(dailyFile.toPath(), GSON.toJson(dailyOpens), StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.warning("[Dashboard/Crates] save fail: " + e.getMessage());
        }
    }

    private void load() {
        try {
            if (cratesFile.exists()) {
                Type t = new TypeToken<List<Crate>>(){}.getType();
                List<Crate> list = GSON.fromJson(
                        Files.readString(cratesFile.toPath(), StandardCharsets.UTF_8), t);
                if (list != null) for (Crate c : list) if (c != null && c.id != null) {
                    if (c.items == null) c.items = new ArrayList<>();
                    crates.put(c.id, c);
                }
            }
            if (opensFile.exists()) {
                Type t = new TypeToken<List<CrateOpen>>(){}.getType();
                List<CrateOpen> list = GSON.fromJson(
                        Files.readString(opensFile.toPath(), StandardCharsets.UTF_8), t);
                if (list != null) opens.addAll(list);
            }
            if (keysFile.exists()) {
                Type t = new TypeToken<Map<String, Map<String, Integer>>>(){}.getType();
                Map<String, Map<String, Integer>> m = GSON.fromJson(
                        Files.readString(keysFile.toPath(), StandardCharsets.UTF_8), t);
                if (m != null) keys.putAll(m);
            }
            if (placedFile.exists()) {
                Type t = new TypeToken<List<PlacedCrate>>(){}.getType();
                List<PlacedCrate> list = GSON.fromJson(
                        Files.readString(placedFile.toPath(), StandardCharsets.UTF_8), t);
                if (list != null) placed.addAll(list);
            }
            if (statsFile.exists()) {
                Type t = new TypeToken<Map<String, Map<String, Integer>>>(){}.getType();
                Map<String, Map<String, Integer>> m = GSON.fromJson(
                        Files.readString(statsFile.toPath(), StandardCharsets.UTF_8), t);
                if (m != null) openCounts.putAll(m);
            }
            if (dailyFile.exists()) {
                Type t = new TypeToken<Map<String, Map<String, Long>>>(){}.getType();
                Map<String, Map<String, Long>> m = GSON.fromJson(
                        Files.readString(dailyFile.toPath(), StandardCharsets.UTF_8), t);
                if (m != null) dailyOpens.putAll(m);
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/Crates] load fail: " + e.getMessage());
        }
    }
}
