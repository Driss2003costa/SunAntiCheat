package sunanticheat.xray.analysis;

import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Données enrichies par joueur (analyse X-Ray détaillée) :
 *   - compteurs par type de minerai
 *   - histogramme par couche Y
 *   - répartition par monde et par région ("pays")
 *   - séries temporelles : heures (24 buckets) et jours (14 buckets)
 *   - veines récentes (les 64 derniers minages de minerais précieux, avec position)
 *   - flag "reviewed" : staff a marqué comme blanchi
 */
public final class XRayPlayerProfile {

    public static final int MAX_RECENT_SAMPLES = 64;
    public static final int HOURLY_BUCKETS = 24;
    public static final int DAILY_BUCKETS = 14;

    private final UUID uuid;
    private volatile String playerName;
    private final long createdAt;
    private volatile long lastEventAt;

    private final AtomicLong diamond = new AtomicLong();
    private final AtomicLong iron = new AtomicLong();
    private final AtomicLong gold = new AtomicLong();
    private final AtomicLong ancientDebris = new AtomicLong();
    private final AtomicLong emerald = new AtomicLong();
    private final AtomicLong lapis = new AtomicLong();
    private final AtomicLong redstone = new AtomicLong();
    private final AtomicLong copper = new AtomicLong();
    private final AtomicLong coal = new AtomicLong();
    private final AtomicLong common = new AtomicLong();
    private final AtomicLong netherrack = new AtomicLong();

    /** y → [diamond, iron, gold, ancientDebris, emerald, common] */
    private final Map<Integer, long[]> byY = new HashMap<>();
    /** world → counters (diamond, iron, gold, ancient, common) */
    private final Map<String, long[]> byWorld = new HashMap<>();
    /** region id → counters */
    private final Map<String, long[]> byRegion = new HashMap<>();

    /** epoch-hour → 1 seau de comptes par ore type */
    private final Map<Long, long[]> hourlyBuckets = new HashMap<>();
    /** epoch-day → 1 seau de comptes par ore type */
    private final Map<Long, long[]> dailyBuckets = new HashMap<>();

    /** Échantillons récents (FIFO bornée à MAX_RECENT_SAMPLES) — utilisés pour les veines. */
    private final Deque<MiningSample> recentSamples = new ArrayDeque<>();

    private volatile boolean reviewed = false;
    private volatile long reviewedAt = 0;
    private volatile String reviewedBy = "";

    public XRayPlayerProfile(UUID uuid, String name) {
        this.uuid = uuid;
        this.playerName = name;
        this.createdAt = System.currentTimeMillis();
    }

    public UUID uuid() { return uuid; }
    public String playerName() { return playerName; }
    public void setPlayerName(String n) { if (n != null) this.playerName = n; }
    public long createdAt() { return createdAt; }
    public long lastEventAt() { return lastEventAt; }

    public long diamond() { return diamond.get(); }
    public long iron() { return iron.get(); }
    public long gold() { return gold.get(); }
    public long ancientDebris() { return ancientDebris.get(); }
    public long emerald() { return emerald.get(); }
    public long lapis() { return lapis.get(); }
    public long redstone() { return redstone.get(); }
    public long copper() { return copper.get(); }
    public long coal() { return coal.get(); }
    public long common() { return common.get(); }
    public long netherrack() { return netherrack.get(); }

    public long valuable() { return diamond.get() + iron.get() + gold.get() + ancientDebris.get() + emerald.get(); }
    public long total() { return valuable() + lapis.get() + redstone.get() + copper.get() + coal.get() + common.get() + netherrack.get(); }
    public long totalCommon() { return common.get(); }

    public boolean reviewed() { return reviewed; }
    public long reviewedAt() { return reviewedAt; }
    public String reviewedBy() { return reviewedBy; }
    public void clearReview() { reviewed = false; reviewedAt = 0; reviewedBy = ""; }
    public void markReviewed(String who) {
        this.reviewed = true;
        this.reviewedAt = System.currentTimeMillis();
        this.reviewedBy = who != null ? who : "?";
    }

    /** Fournit une vue lecture-seule des compteurs. */
    public Map<String, Long> oreCountsView() {
        Map<String, Long> m = new LinkedHashMap<>();
        m.put("diamond", diamond.get());
        m.put("iron", iron.get());
        m.put("gold", gold.get());
        m.put("ancientDebris", ancientDebris.get());
        m.put("emerald", emerald.get());
        m.put("lapis", lapis.get());
        m.put("redstone", redstone.get());
        m.put("copper", copper.get());
        m.put("coal", coal.get());
        m.put("common", common.get());
        m.put("netherrack", netherrack.get());
        return m;
    }

    /**
     * Enregistre un nouvel évènement. Synchronisé pour cohérence des maps.
     */
    public synchronized void record(MiningSample.OreType type, String world, String region,
                                    int x, int y, int z, long ts,
                                    boolean isCommon, boolean isNetherrack) {
        this.lastEventAt = ts;
        if (isCommon) common.incrementAndGet();
        else if (isNetherrack) netherrack.incrementAndGet();
        else if (type != null) {
            switch (type) {
                case DIAMOND -> diamond.incrementAndGet();
                case IRON -> iron.incrementAndGet();
                case GOLD -> gold.incrementAndGet();
                case ANCIENT_DEBRIS -> ancientDebris.incrementAndGet();
                case EMERALD -> emerald.incrementAndGet();
                case LAPIS -> lapis.incrementAndGet();
                case REDSTONE -> redstone.incrementAndGet();
                case COPPER -> copper.incrementAndGet();
                case COAL -> coal.incrementAndGet();
            }
        }
        // Per-Y histogram (taille 6 slots : diamond, iron, gold, ancient, emerald, common+netherrack)
        long[] yArr = byY.computeIfAbsent(y, k -> new long[6]);
        if (isCommon || isNetherrack) yArr[5]++;
        else if (type != null) {
            switch (type) {
                case DIAMOND -> yArr[0]++;
                case IRON -> yArr[1]++;
                case GOLD -> yArr[2]++;
                case ANCIENT_DEBRIS -> yArr[3]++;
                case EMERALD -> yArr[4]++;
                default -> {}
            }
        }
        // Per-world (5 slots : diamond, iron, gold, ancient, common+other)
        long[] wArr = byWorld.computeIfAbsent(world == null ? "?" : world, k -> new long[5]);
        applyToBreakdown(wArr, type, isCommon, isNetherrack);

        // Per-region
        long[] rArr = byRegion.computeIfAbsent(region == null ? "?" : region, k -> new long[5]);
        applyToBreakdown(rArr, type, isCommon, isNetherrack);

        // Time series
        long hourBucket = ts / (3_600_000L);
        long[] h = hourlyBuckets.computeIfAbsent(hourBucket, k -> new long[5]);
        applyToBreakdown(h, type, isCommon, isNetherrack);
        long dayBucket = ts / (86_400_000L);
        long[] d = dailyBuckets.computeIfAbsent(dayBucket, k -> new long[5]);
        applyToBreakdown(d, type, isCommon, isNetherrack);

        // Trim time series buckets
        if (hourlyBuckets.size() > HOURLY_BUCKETS * 4) {
            long cutoff = hourBucket - HOURLY_BUCKETS;
            hourlyBuckets.entrySet().removeIf(e -> e.getKey() < cutoff);
        }
        if (dailyBuckets.size() > DAILY_BUCKETS * 4) {
            long cutoffD = dayBucket - DAILY_BUCKETS;
            dailyBuckets.entrySet().removeIf(e -> e.getKey() < cutoffD);
        }

        // Veines (uniquement minerais précieux)
        if (type != null && type.isPrecious()) {
            recentSamples.addLast(new MiningSample(ts, type, world, region, x, y, z));
            while (recentSamples.size() > MAX_RECENT_SAMPLES) recentSamples.pollFirst();
        }
    }

    private static void applyToBreakdown(long[] arr, MiningSample.OreType type, boolean isCommon, boolean isNetherrack) {
        if (isCommon || isNetherrack) { arr[4]++; return; }
        if (type == null) return;
        switch (type) {
            case DIAMOND -> arr[0]++;
            case IRON -> arr[1]++;
            case GOLD -> arr[2]++;
            case ANCIENT_DEBRIS -> arr[3]++;
            default -> arr[4]++;
        }
    }

    public synchronized Map<Integer, long[]> byYSnapshot() {
        Map<Integer, long[]> copy = new HashMap<>();
        for (var e : byY.entrySet()) copy.put(e.getKey(), e.getValue().clone());
        return copy;
    }

    public synchronized Map<String, long[]> byWorldSnapshot() {
        Map<String, long[]> copy = new HashMap<>();
        for (var e : byWorld.entrySet()) copy.put(e.getKey(), e.getValue().clone());
        return copy;
    }

    public synchronized Map<String, long[]> byRegionSnapshot() {
        Map<String, long[]> copy = new HashMap<>();
        for (var e : byRegion.entrySet()) copy.put(e.getKey(), e.getValue().clone());
        return copy;
    }

    public synchronized Map<Long, long[]> hourlySnapshot() {
        Map<Long, long[]> copy = new HashMap<>();
        for (var e : hourlyBuckets.entrySet()) copy.put(e.getKey(), e.getValue().clone());
        return copy;
    }

    public synchronized Map<Long, long[]> dailySnapshot() {
        Map<Long, long[]> copy = new HashMap<>();
        for (var e : dailyBuckets.entrySet()) copy.put(e.getKey(), e.getValue().clone());
        return copy;
    }

    public synchronized List<MiningSample> recentSamplesList() {
        return Collections.unmodifiableList(new java.util.ArrayList<>(recentSamples));
    }
}
