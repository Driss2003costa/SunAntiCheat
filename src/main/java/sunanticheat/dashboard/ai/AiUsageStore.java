package sunanticheat.dashboard.ai;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Suivi de la consommation Gemini : tokens input/output, requêtes, coût estimé.
 *
 * Persisté dans plugins/SunAntiCheat/dashboard/ai_usage.json.
 * Agrège par jour (YYYY-MM-DD) + totaux.
 */
public final class AiUsageStore {

    /** Tarifs estimés par modèle (USD / million de tokens). Mis à jour avril 2026. */
    private static final Map<String, double[]> PRICING = new LinkedHashMap<>();
    static {
        // { input, output } en USD / 1M tokens
        // Gemini
        PRICING.put("gemini-2.0-flash",       new double[]{ 0.10, 0.40 });
        PRICING.put("gemini-2.0-flash-lite",  new double[]{ 0.075, 0.30 });
        PRICING.put("gemini-2.5-flash",       new double[]{ 0.30, 2.50 });
        PRICING.put("gemini-2.5-pro",         new double[]{ 1.25, 5.00 });
        PRICING.put("gemini-1.5-flash",       new double[]{ 0.075, 0.30 });
        PRICING.put("gemini-1.5-pro",         new double[]{ 1.25, 5.00 });
        // OpenAI
        PRICING.put("gpt-4o-mini",            new double[]{ 0.15, 0.60 });
        PRICING.put("gpt-4o",                 new double[]{ 2.50, 10.00 });
        PRICING.put("gpt-4-turbo",            new double[]{ 10.00, 30.00 });
        PRICING.put("gpt-4.1-mini",           new double[]{ 0.40, 1.60 });
        PRICING.put("gpt-4.1",                new double[]{ 2.00, 8.00 });
        PRICING.put("gpt-3.5-turbo",          new double[]{ 0.50, 1.50 });
        PRICING.put("o1-mini",                new double[]{ 3.00, 12.00 });
        PRICING.put("o3-mini",                new double[]{ 1.10, 4.40 });
    }

    /** 1 USD ≈ 0.92 EUR (approximation, utilisé uniquement pour l'affichage côté UI). */
    private static final double USD_TO_EUR = 0.92;

    public static final class DailyUsage {
        public String date;           // "2026-04-22"
        public long inputTokens;
        public long outputTokens;
        public long requests;
        public double costUsd;

        public DailyUsage() {}
        public DailyUsage(String date) { this.date = date; }

        public void add(long inTok, long outTok, double cost) {
            this.inputTokens += inTok;
            this.outputTokens += outTok;
            this.requests += 1;
            this.costUsd += cost;
        }
    }

    public static final class UsageSnapshot {
        public DailyUsage today;
        public List<DailyUsage> last7Days;
        public DailyUsage allTime;
        public Map<String, double[]> pricing;   // affiché côté UI pour transparence
        public double usdToEur;
    }

    private final Persistence storage;
    private final Logger logger;
    private final Gson gson = new GsonBuilder().setPrettyPrinting().serializeNulls().create();

    private final Map<String, DailyUsage> dailyByDate = new LinkedHashMap<>();
    private final DailyUsage allTime = new DailyUsage("all-time");

    public AiUsageStore(File dataFolder, Logger logger, BlobStorage blobs) {
        this.logger = logger;
        File legacy = new File(new File(dataFolder, "dashboard"), "ai_usage.json");
        this.storage = new Persistence(blobs, "ai_usage", legacy);
        load();
    }

    private synchronized void load() {
        String json = storage.read();
        if (json == null || json.isBlank()) return;
        try {
            Map<String, Object> root = gson.fromJson(json, new TypeToken<Map<String, Object>>() {}.getType());
            if (root == null) return;
            Object days = root.get("daily");
            if (days != null) {
                String daysJson = gson.toJson(days);
                List<DailyUsage> list = gson.fromJson(daysJson, new TypeToken<List<DailyUsage>>() {}.getType());
                if (list != null) for (DailyUsage d : list) if (d.date != null) dailyByDate.put(d.date, d);
            }
            Object at = root.get("allTime");
            if (at != null) {
                DailyUsage atObj = gson.fromJson(gson.toJson(at), DailyUsage.class);
                if (atObj != null) {
                    allTime.inputTokens = atObj.inputTokens;
                    allTime.outputTokens = atObj.outputTokens;
                    allTime.requests = atObj.requests;
                    allTime.costUsd = atObj.costUsd;
                }
            }
        } catch (Exception e) {
            logger.warning("[AI Usage] load erreur: " + e.getMessage());
        }
    }

    private synchronized void save() {
        try {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("daily", new ArrayList<>(dailyByDate.values()));
            root.put("allTime", allTime);
            storage.write(gson.toJson(root));
        } catch (Exception e) {
            logger.warning("[AI Usage] save erreur: " + e.getMessage());
        }
    }

    /** Enregistre un appel Gemini (tokens + modèle) et calcule le coût estimé. */
    public synchronized void record(String model, long inputTokens, long outputTokens) {
        if (inputTokens < 0) inputTokens = 0;
        if (outputTokens < 0) outputTokens = 0;
        double cost = estimateCost(model, inputTokens, outputTokens);

        String today = todayKey();
        DailyUsage d = dailyByDate.computeIfAbsent(today, DailyUsage::new);
        d.add(inputTokens, outputTokens, cost);
        allTime.add(inputTokens, outputTokens, cost);

        // Purge au-delà de 60 jours pour éviter que le fichier grossisse
        if (dailyByDate.size() > 60) {
            String cutoff = dateBefore(60);
            dailyByDate.entrySet().removeIf(e -> e.getKey().compareTo(cutoff) < 0);
        }

        save();
    }

    /** Retourne le snapshot complet pour l'endpoint. */
    public synchronized UsageSnapshot snapshot() {
        UsageSnapshot s = new UsageSnapshot();
        String today = todayKey();
        s.today = dailyByDate.getOrDefault(today, new DailyUsage(today));
        s.allTime = allTime;
        s.pricing = PRICING;
        s.usdToEur = USD_TO_EUR;

        // Derniers 7 jours (même ceux à 0)
        List<DailyUsage> week = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            String date = dateBefore(i);
            week.add(dailyByDate.getOrDefault(date, new DailyUsage(date)));
        }
        s.last7Days = week;
        return s;
    }

    /** Calcul coût estimé en USD. Retourne 0 si modèle inconnu. */
    public static double estimateCost(String model, long inputTokens, long outputTokens) {
        double[] rates = PRICING.get(model);
        if (rates == null) return 0;
        return (inputTokens * rates[0] / 1_000_000.0)
             + (outputTokens * rates[1] / 1_000_000.0);
    }

    private static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date());
    }

    private static String dateBefore(int daysAgo) {
        long ms = System.currentTimeMillis() - daysAgo * 86_400_000L;
        return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date(ms));
    }
}
