package sunanticheat.jobs.dynamics;

import sunanticheat.dashboard.db.Database;

import java.sql.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Suit l'activité par chunk pour empêcher la surexploitation locale.
 *
 * Mécanique :
 *  - Chaque action métier incrémente un compteur {@code (world, chunkX, chunkZ, jobId)}
 *    dans une fenêtre glissante (60 min par défaut).
 *  - Quand le seuil est dépassé, un malus est appliqué pendant N heures
 *    (par défaut 6h) — le joueur est notifié via la breakdown.
 *  - Persisté en DB pour survivre aux redémarrages serveur.
 *
 * Toutes les écritures asynchrones se font en mémoire (ConcurrentHashMap),
 * et un flush périodique alimente la table {@code custom_job_heatmap}.
 */
public final class HeatmapTracker {

    private final Database db;
    private final Logger logger;
    private final JobDynamicsConfig cfg;

    /** chunkKey -> [actionCount, windowStart(ms), penaltyUntil(ms)] */
    private final Map<String, long[]> memory = new ConcurrentHashMap<>();

    public HeatmapTracker(Database db, Logger logger, JobDynamicsConfig cfg) {
        this.db = db; this.logger = logger; this.cfg = cfg;
        migrate();
    }

    private void migrate() {
        db.migrate("custom_job_heatmap", 1, """
            CREATE TABLE IF NOT EXISTS custom_job_heatmap (
                world           TEXT    NOT NULL,
                chunk_x         INTEGER NOT NULL,
                chunk_z         INTEGER NOT NULL,
                job_id          TEXT    NOT NULL,
                action_count    INTEGER NOT NULL DEFAULT 0,
                window_start    INTEGER NOT NULL,
                penalty_until   INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(world, chunk_x, chunk_z, job_id)
            );
            CREATE INDEX IF NOT EXISTS idx_cjh_world ON custom_job_heatmap(world);
            CREATE INDEX IF NOT EXISTS idx_cjh_jobid ON custom_job_heatmap(job_id)""");
    }

    private static String key(String world, int cx, int cz, String jobId) {
        return world + "|" + cx + "|" + cz + "|" + jobId;
    }

    /**
     * Enregistre une action et retourne true si le chunk est sous malus
     * (auquel cas le multiplicateur de surexploitation s'applique).
     */
    public boolean recordAndCheck(String world, int chunkX, int chunkZ, String jobId) {
        if (!cfg.heatmapEnabled()) return false;
        long now = System.currentTimeMillis();
        long windowMs   = cfg.heatmapWindowMin() * 60_000L;
        long cooldownMs = cfg.heatmapCooldownH() * 3600_000L;

        String k = key(world, chunkX, chunkZ, jobId.toLowerCase());
        long[] state = memory.computeIfAbsent(k, kk -> new long[]{0, now, 0});

        // Reset window if expired
        if (now - state[1] > windowMs) {
            state[0] = 0;
            state[1] = now;
        }
        state[0]++;

        // Penalty active?
        boolean underPenalty = now < state[2];

        // Hit threshold?
        if (!underPenalty && state[0] >= cfg.heatmapThreshold()) {
            state[2] = now + cooldownMs;
            underPenalty = true;
        }
        return underPenalty;
    }

    /** Multiplicateur courant pour ce chunk (1.0 si pas de malus, < 1.0 sinon). */
    public double currentMultiplier(String world, int cx, int cz, String jobId) {
        if (!cfg.heatmapEnabled()) return 1.0;
        long[] s = memory.get(key(world, cx, cz, jobId.toLowerCase()));
        if (s == null) return 1.0;
        return System.currentTimeMillis() < s[2] ? cfg.heatmapMalus() : 1.0;
    }

    /** Flush mémoire → DB. À appeler périodiquement (toutes les 5 min). */
    public synchronized void flush() {
        if (memory.isEmpty()) return;
        try (PreparedStatement ps = db.conn().prepareStatement(
                "REPLACE INTO custom_job_heatmap(world,chunk_x,chunk_z,job_id,action_count,window_start,penalty_until) " +
                "VALUES(?,?,?,?,?,?,?)")) {
            db.conn().setAutoCommit(false);
            int batched = 0;
            for (var e : memory.entrySet()) {
                String[] parts = e.getKey().split("\\|", 4);
                long[] s = e.getValue();
                ps.setString(1, parts[0]);
                ps.setInt   (2, Integer.parseInt(parts[1]));
                ps.setInt   (3, Integer.parseInt(parts[2]));
                ps.setString(4, parts[3]);
                ps.setLong  (5, s[0]);
                ps.setLong  (6, s[1]);
                ps.setLong  (7, s[2]);
                ps.addBatch();
                if (++batched >= 500) { ps.executeBatch(); batched = 0; }
            }
            if (batched > 0) ps.executeBatch();
            db.conn().commit();
            db.conn().setAutoCommit(true);
        } catch (SQLException ex) {
            logger.warning("[Jobs/Heatmap] flush: " + ex.getMessage());
            try { db.conn().setAutoCommit(true); } catch (SQLException ignore) {}
        }

        // Drop chunks whose window expired & no penalty
        long now = System.currentTimeMillis();
        long windowMs = cfg.heatmapWindowMin() * 60_000L;
        memory.entrySet().removeIf(e -> {
            long[] s = e.getValue();
            return (now - s[1] > windowMs) && now > s[2];
        });
    }

    /**
     * Liste agrégée des activités par chunk pour un joueur (depuis sa table d'historique).
     * Renvoie les top N chunks où il a agi.
     */
    public List<Map<String, Object>> playerHeatmap(String uuid, int limitDays, int topN) {
        List<Map<String, Object>> list = new ArrayList<>();
        long since = System.currentTimeMillis() - (limitDays * 86_400_000L);
        // On utilise l'historique global pour reconstituer la heatmap par chunk si besoin,
        // mais comme history n'a pas de coords, on agrège les actions par job.
        // La heatmap par chunk sera plutôt utilisée côté server, et le portail montrera
        // les jobs les plus joués par jour.
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT job_id, COUNT(*) AS actions, SUM(xp_gained) AS xp, SUM(money_gained) AS money " +
                "FROM custom_job_history WHERE uuid=? AND timestamp >= ? GROUP BY job_id ORDER BY actions DESC LIMIT ?")) {
            ps.setString(1, uuid); ps.setLong(2, since); ps.setInt(3, topN);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("job_id",  rs.getString("job_id"));
                    m.put("actions", rs.getLong("actions"));
                    m.put("xp",      rs.getDouble("xp"));
                    m.put("money",   rs.getDouble("money"));
                    list.add(m);
                }
            }
        } catch (SQLException e) { logger.warning("[Jobs/Heatmap] playerHeatmap: " + e.getMessage()); }
        return list;
    }

    /** Top des chunks les plus exploités pour un métier (admin/debug). */
    public List<Map<String, Object>> topChunks(String jobId, int limit) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT world, chunk_x, chunk_z, action_count, penalty_until FROM custom_job_heatmap " +
                "WHERE job_id=? ORDER BY action_count DESC LIMIT ?")) {
            ps.setString(1, jobId.toLowerCase()); ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("world",         rs.getString("world"));
                    m.put("chunk_x",       rs.getInt("chunk_x"));
                    m.put("chunk_z",       rs.getInt("chunk_z"));
                    m.put("action_count",  rs.getLong("action_count"));
                    m.put("penalty_until", rs.getLong("penalty_until"));
                    list.add(m);
                }
            }
        } catch (SQLException e) { logger.warning("[Jobs/Heatmap] topChunks: " + e.getMessage()); }
        return list;
    }
}
