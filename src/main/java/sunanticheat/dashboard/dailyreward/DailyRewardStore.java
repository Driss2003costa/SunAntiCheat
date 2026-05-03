package sunanticheat.dashboard.dailyreward;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.lang.reflect.Type;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

/**
 * Persistance de la configuration et de l'\u00e9tat du syst\u00e8me Daily Rewards.
 */
public final class DailyRewardStore {

    private static final Gson GSON = new GsonBuilder().serializeNulls().setPrettyPrinting().create();
    private static final int MAX_CLAIMS = 2000;

    public static class PlayerState {
        public long lastClaimAt;
        public int currentStreak;
    }

    private final Logger logger;
    private final Persistence configStorage;
    private final Persistence claimsStorage;
    private final Persistence stateStorage;
    private final Persistence pendingStorage;

    private DailyRewardConfig config;
    private final List<DailyRewardClaim> claims = new ArrayList<>();
    private final Map<String, PlayerState> state = new HashMap<>();
    /** Rewards claimed via the web portal for players who were offline at claim time. */
    private final Map<String, DailyRewardDay> pendingWebClaims = new ConcurrentHashMap<>();

    public DailyRewardStore(File dataFolder, Logger logger, BlobStorage blobs) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        this.configStorage  = new Persistence(blobs, "daily_config",   new File(dir, "daily_config.json"));
        this.claimsStorage  = new Persistence(blobs, "daily_claims",   new File(dir, "daily_claims.json"));
        this.stateStorage   = new Persistence(blobs, "daily_state",    new File(dir, "daily_state.json"));
        this.pendingStorage = new Persistence(blobs, "daily_pending",  new File(dir, "daily_pending.json"));
        load();
    }

    public synchronized DailyRewardConfig getConfig() { return config; }

    public synchronized void saveConfig(DailyRewardConfig cfg) {
        if (cfg == null) return;
        if (cfg.days == null) cfg.days = new ArrayList<>();
        if (cfg.cycleDays <= 0) cfg.cycleDays = Math.max(1, cfg.days.size());
        this.config = cfg;
        persistAll();
    }

    public synchronized boolean canClaim(String playerUuid) {
        if (playerUuid == null) return false;
        PlayerState st = state.get(playerUuid);
        if (st == null) return true;
        long timeSince = System.currentTimeMillis() - st.lastClaimAt;
        return timeSince > TimeUnit.HOURS.toMillis(20);
    }

    /** Retourne le num\u00e9ro du prochain jour \u00e0 r\u00e9clamer (1-based). */
    public synchronized int getStreak(String playerUuid) {
        if (playerUuid == null || config == null) return 1;
        PlayerState st = state.get(playerUuid);
        if (st == null) return 1;
        long hoursSince = (System.currentTimeMillis() - st.lastClaimAt) / 3600000L;
        if (hoursSince > 48 && config.resetOnMiss) return 1;
        int cycle = Math.max(1, config.cycleDays);
        return (st.currentStreak % cycle) + 1;
    }

    public synchronized DailyRewardDay claim(String playerUuid, String playerName) {
        if (playerUuid == null || config == null || !config.enabled) return null;
        if (!canClaim(playerUuid)) return null;
        int day = getStreak(playerUuid);
        DailyRewardDay reward = null;
        for (DailyRewardDay d : config.days) {
            if (d != null && d.day == day) { reward = d; break; }
        }
        if (reward == null) return null;

        PlayerState st = state.computeIfAbsent(playerUuid, k -> new PlayerState());
        st.lastClaimAt = System.currentTimeMillis();
        st.currentStreak = day;

        List<String> given = new ArrayList<>();
        if (reward.items != null) {
            for (DailyRewardItem it : reward.items) {
                if (it == null) continue;
                String name = it.displayName != null ? it.displayName : it.material;
                given.add(name + " x" + Math.max(1, it.amount));
            }
        }
        DailyRewardClaim claim = new DailyRewardClaim(playerUuid, playerName, day,
                st.lastClaimAt, given);
        claims.add(0, claim);
        while (claims.size() > MAX_CLAIMS) claims.remove(claims.size() - 1);

        persistAll();
        return reward;
    }

    public synchronized List<DailyRewardClaim> listClaims(String playerName, int days, int limit) {
        long cutoff = days > 0
                ? System.currentTimeMillis() - TimeUnit.DAYS.toMillis(days)
                : 0L;
        List<DailyRewardClaim> out = new ArrayList<>();
        for (DailyRewardClaim c : claims) {
            if (c == null) continue;
            if (c.claimedAt < cutoff) continue;
            if (playerName != null && !playerName.isEmpty()
                    && !playerName.equalsIgnoreCase(c.playerName)) continue;
            out.add(c);
            if (out.size() >= Math.max(1, limit)) break;
        }
        return out;
    }

    public synchronized Map<String, Object> statsOverDays(int days) {
        int d = Math.max(1, days);
        long cutoff = System.currentTimeMillis() - TimeUnit.DAYS.toMillis(d);

        List<DailyRewardClaim> window = new ArrayList<>();
        for (DailyRewardClaim c : claims) if (c != null && c.claimedAt >= cutoff) window.add(c);

        int total = window.size();
        java.util.Set<String> uniqueUuids = new java.util.HashSet<>();
        Map<String, Integer> claimsPerDayMap = new TreeMap<>();
        Map<Integer, Integer> claimsByDay = new LinkedHashMap<>();
        Map<String, int[]> perPlayer = new HashMap<>(); // uuid -> [count]
        Map<String, String> nameByUuid = new HashMap<>();

        for (DailyRewardClaim c : window) {
            if (c.playerUuid != null) uniqueUuids.add(c.playerUuid);
            String dateKey = ZonedDateTime.ofInstant(
                    java.time.Instant.ofEpochMilli(c.claimedAt), ZoneId.systemDefault())
                    .toLocalDate().toString();
            claimsPerDayMap.merge(dateKey, 1, Integer::sum);
            claimsByDay.merge(c.day, 1, Integer::sum);
            if (c.playerUuid != null) {
                perPlayer.computeIfAbsent(c.playerUuid, k -> new int[]{0})[0]++;
                if (c.playerName != null) nameByUuid.put(c.playerUuid, c.playerName);
            }
        }

        List<Map<String, Object>> claimsPerDay = new ArrayList<>();
        for (Map.Entry<String, Integer> e : claimsPerDayMap.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", e.getKey());
            m.put("count", e.getValue());
            claimsPerDay.add(m);
        }

        List<Map<String, Object>> topClaimers = new ArrayList<>();
        List<Map.Entry<String, int[]>> sorted = new ArrayList<>(perPlayer.entrySet());
        sorted.sort((a, b) -> Integer.compare(b.getValue()[0], a.getValue()[0]));
        for (int i = 0; i < Math.min(10, sorted.size()); i++) {
            Map.Entry<String, int[]> e = sorted.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            String uuid = e.getKey();
            PlayerState st = state.get(uuid);
            m.put("playerName", nameByUuid.getOrDefault(uuid, uuid));
            m.put("playerUuid", uuid);
            m.put("currentStreak", st == null ? 0 : st.currentStreak);
            m.put("totalClaims", e.getValue()[0]);
            topClaimers.add(m);
        }

        double avgStreak = 0.0;
        if (!state.isEmpty()) {
            long sum = 0L;
            for (PlayerState st : state.values()) sum += st == null ? 0 : st.currentStreak;
            avgStreak = (double) sum / state.size();
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalClaims", total);
        out.put("uniquePlayers", uniqueUuids.size());
        out.put("claimsPerDay", claimsPerDay);
        out.put("claimsByDay", claimsByDay);
        out.put("topClaimers", topClaimers);
        out.put("avgStreak", avgStreak);
        return out;
    }

    // ── Pending web claims ────────────────────────────────────────────────────

    public void addPendingWebClaim(String playerUuid, DailyRewardDay reward) {
        if (playerUuid == null || reward == null) return;
        pendingWebClaims.put(playerUuid, reward);
        persistPending();
    }

    /** Returns and removes the pending web claim for this player, or null if none. */
    public DailyRewardDay consumePendingWebClaim(String playerUuid) {
        if (playerUuid == null) return null;
        DailyRewardDay reward = pendingWebClaims.remove(playerUuid);
        if (reward != null) persistPending();
        return reward;
    }

    public boolean hasPendingWebClaim(String playerUuid) {
        return playerUuid != null && pendingWebClaims.containsKey(playerUuid);
    }

    public synchronized void resetPlayerStreak(String playerUuid) {
        if (playerUuid == null) return;
        state.remove(playerUuid);
        persistAll();
    }

    public synchronized PlayerState getPlayerState(String playerUuid) {
        if (playerUuid == null) return null;
        return state.get(playerUuid);
    }

    // ── Persist ───────────────────────────────────────────────────────────────

    private void persistAll() {
        try {
            configStorage.write(GSON.toJson(config));
            claimsStorage.write(GSON.toJson(claims));
            stateStorage.write(GSON.toJson(state));
        } catch (Exception e) {
            logger.warning("[Dashboard/DailyReward] save fail: " + e.getMessage());
        }
        persistPending();
    }

    private void persistPending() {
        try {
            pendingStorage.write(GSON.toJson(pendingWebClaims));
        } catch (Exception e) {
            logger.warning("[Dashboard/DailyReward] pending save fail: " + e.getMessage());
        }
    }

    private void load() {
        try {
            String s = configStorage.read();
            if (s != null && !s.isBlank()) {
                config = GSON.fromJson(s, DailyRewardConfig.class);
            }
            if (config == null) {
                config = DailyRewardConfig.createDefault();
            }
            if (config.days == null) config.days = new ArrayList<>();

            if ((s = claimsStorage.read()) != null && !s.isBlank()) {
                Type t = new TypeToken<List<DailyRewardClaim>>(){}.getType();
                List<DailyRewardClaim> list = GSON.fromJson(s, t);
                if (list != null) claims.addAll(list);
            }
            if ((s = stateStorage.read()) != null && !s.isBlank()) {
                Type t = new TypeToken<Map<String, PlayerState>>(){}.getType();
                Map<String, PlayerState> m = GSON.fromJson(s, t);
                if (m != null) state.putAll(m);
            }
            if ((s = pendingStorage.read()) != null && !s.isBlank()) {
                Type t = new TypeToken<Map<String, DailyRewardDay>>(){}.getType();
                Map<String, DailyRewardDay> m = GSON.fromJson(s, t);
                if (m != null) pendingWebClaims.putAll(m);
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/DailyReward] load fail: " + e.getMessage());
            if (config == null) config = DailyRewardConfig.createDefault();
        }
    }
}
