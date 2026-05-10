package sunanticheat.dashboard.quests;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.logging.Logger;

/**
 * Pioche automatiquement entre 4 et 8 templates de la bibliothèque toutes les
 * semaines pour les proposer comme quêtes actives temporaires (7 jours).
 *
 * État persisté dans dashboard/quests-rotation.json :
 *  - lastRotationAt : timestamp de la dernière rotation
 *  - rotationQuestIds : IDs des quêtes actuellement en rotation
 *
 * À chaque rotation : on supprime les anciennes quêtes de rotation (si encore
 * actives), on pioche N templates random (4-8 inclus), on crée les quêtes avec
 * un endsAt à +7 jours et on enregistre les nouveaux IDs.
 *
 * Le scheduler tourne toutes les heures et déclenche une rotation si le
 * délai d'une semaine est écoulé. À la première mise en route (état vide),
 * une rotation est immédiatement déclenchée.
 */
public final class QuestRotationService {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private static final long ROTATION_INTERVAL_MS = 7L * 24 * 3600 * 1000;
    private static final long QUEST_DURATION_MS    = 7L * 24 * 3600 * 1000;
    private static final int  MIN_COUNT = 4;
    private static final int  MAX_COUNT = 8;

    private final JavaPlugin plugin;
    private final QuestStore store;
    private final QuestTemplateLoader templates;
    private final Persistence storage;
    private final Logger logger;

    private List<String> rotationQuestIds = new ArrayList<>();
    private long lastRotationAt = 0;

    public QuestRotationService(JavaPlugin plugin, QuestStore store, QuestTemplateLoader templates,
                                File dataFolder, Logger logger, BlobStorage blobs) {
        this.plugin = plugin;
        this.store = store;
        this.templates = templates;
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        this.storage = new Persistence(blobs, "quests_rotation",
                new File(dir, "quests-rotation.json"));
        load();
    }

    /** Démarre le scheduler horaire qui déclenche les rotations hebdomadaires. */
    public void start() {
        // Check toutes les heures (20 ticks/s × 60s × 60min)
        Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::checkAndRotate,
                20L * 30, 20L * 60 * 60);
    }

    private synchronized void checkAndRotate() {
        long now = System.currentTimeMillis();
        if (now - lastRotationAt >= ROTATION_INTERVAL_MS) {
            try { rotate(); }
            catch (Throwable t) {
                logger.warning("[Quests/Rotation] échec rotation : " + t.getMessage());
            }
        }
    }

    /** Force une rotation immédiate (appelée par scheduler ou bouton admin). */
    public synchronized List<Quest> rotate() {
        // 1) Supprimer les anciennes quêtes de rotation
        for (String id : rotationQuestIds) {
            if (id != null) store.delete(id);
        }
        rotationQuestIds.clear();

        // 2) Préparer la liste de templates et la mélanger
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tplList = (List<Map<String, Object>>) templates.publicView()
                .getOrDefault("templates", Collections.emptyList());
        if (tplList.isEmpty()) {
            logger.warning("[Quests/Rotation] aucun template, rotation annulée");
            return Collections.emptyList();
        }
        List<Map<String, Object>> shuffled = new ArrayList<>(tplList);
        Collections.shuffle(shuffled);

        // 3) Choisir N entre [MIN, MAX] inclus
        int n = ThreadLocalRandom.current().nextInt(MIN_COUNT, MAX_COUNT + 1);
        n = Math.min(n, shuffled.size());

        // 4) Créer chaque quête avec une expiration à +7 jours
        long endsAt = System.currentTimeMillis() + QUEST_DURATION_MS;
        List<Quest> created = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            Map<String, Object> tpl = shuffled.get(i);
            String tplId = String.valueOf(tpl.get("id"));
            Map<String, Object> payload = templates.toQuestPayload(tplId);
            if (payload == null) continue;

            Quest.Type type;
            try {
                type = Quest.Type.valueOf(String.valueOf(payload.getOrDefault("type", "BREAK_BLOCK")).toUpperCase());
            } catch (Exception e) { type = Quest.Type.BREAK_BLOCK; }

            Quest q = store.add(
                    (String) payload.get("title"),
                    (String) payload.getOrDefault("description", ""),
                    (String) payload.get("titleEn"),
                    (String) payload.get("descriptionEn"),
                    (String) payload.getOrDefault("icon", "⭐"),
                    (String) payload.getOrDefault("color", "#8B5CF6"),
                    type,
                    (String) payload.getOrDefault("target", "ANY"),
                    ((Number) payload.getOrDefault("goal", 1)).intValue(),
                    (String) payload.get("rewardCommand"),
                    (String) payload.getOrDefault("rewardLabel", ""),
                    (String) payload.get("rewardLabelEn"),
                    true,
                    Boolean.TRUE.equals(payload.get("repeatable")),
                    endsAt
            );
            rotationQuestIds.add(q.getId());
            created.add(q);
        }

        lastRotationAt = System.currentTimeMillis();
        save();
        logger.info("[Quests/Rotation] " + created.size() + " quêtes hebdomadaires créées");
        return created;
    }

    /** Statut pour l'API admin : prochaine rotation, IDs actifs, etc. */
    public synchronized Map<String, Object> status() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("lastRotationAt", lastRotationAt);
        out.put("nextRotationAt", lastRotationAt + ROTATION_INTERVAL_MS);
        out.put("intervalMs", ROTATION_INTERVAL_MS);
        out.put("minCount", MIN_COUNT);
        out.put("maxCount", MAX_COUNT);
        out.put("rotationQuestIds", new ArrayList<>(rotationQuestIds));
        // Joindre titres pour affichage
        List<Map<String, Object>> active = new ArrayList<>();
        for (String id : rotationQuestIds) {
            Quest q = store.get(id);
            if (q == null) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", q.getId());
            m.put("title", q.getTitle());
            m.put("icon", q.getIcon());
            m.put("endsAt", q.getEndsAt());
            active.add(m);
        }
        out.put("activeQuests", active);
        return out;
    }

    // ── Persistance ─────────────────────────────────────────────────────────
    private synchronized void save() {
        try {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("lastRotationAt", lastRotationAt);
            root.put("rotationQuestIds", rotationQuestIds);
            storage.write(GSON.toJson(root));
        } catch (Throwable t) {
            logger.warning("[Quests/Rotation] save fail : " + t.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void load() {
        try {
            String raw = storage.read();
            if (raw == null || raw.isBlank()) return;
            Type t = new TypeToken<Map<String, Object>>() {}.getType();
            Map<String, Object> root = GSON.fromJson(raw, t);
            if (root == null) return;
            Object last = root.get("lastRotationAt");
            if (last instanceof Number) lastRotationAt = ((Number) last).longValue();
            Object ids = root.get("rotationQuestIds");
            if (ids instanceof List) {
                rotationQuestIds = new ArrayList<>();
                for (Object o : (List<Object>) ids) if (o != null) rotationQuestIds.add(o.toString());
            }
        } catch (Throwable t) {
            logger.warning("[Quests/Rotation] load fail : " + t.getMessage());
        }
    }
}
