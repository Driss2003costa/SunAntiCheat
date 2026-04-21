package sunanticheat.dashboard.announcements;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Store persistant des annonces (dashboard/announcements.json).
 * Contient la liste des annonces et une map lastSentMap pour le scheduling INTERVAL.
 */
public final class AnnouncementStore {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().serializeNulls().create();

    private final File file;
    private final Logger logger;
    private final Map<String, Announcement> announcements = new ConcurrentHashMap<>();
    private final Map<String, Long> lastSentMap = new ConcurrentHashMap<>();

    public AnnouncementStore(File dataFolder, Logger logger) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        dir.mkdirs();
        this.file = new File(dir, "announcements.json");
        load();
    }

    public synchronized List<Announcement> list() {
        return new ArrayList<>(announcements.values());
    }

    public Announcement get(String id) {
        return id == null ? null : announcements.get(id);
    }

    /** Crée une annonce : génère UUID + createdAt, assure les variants. */
    public synchronized Announcement create(Announcement a) {
        if (a == null) return null;
        a.id = UUID.randomUUID().toString();
        a.createdAt = System.currentTimeMillis();
        if (a.variants == null) a.variants = new ArrayList<>();
        for (AnnouncementVariant v : a.variants) {
            if (v.id == null || v.id.isEmpty()) v.id = UUID.randomUUID().toString();
        }
        announcements.put(a.id, a);
        save();
        return a;
    }

    /** Met à jour une annonce existante (remplacement complet sauf id/createdAt). */
    public synchronized Announcement update(String id, Announcement patch) {
        if (id == null || patch == null) return null;
        Announcement existing = announcements.get(id);
        if (existing == null) return null;
        patch.id = existing.id;
        patch.createdAt = existing.createdAt;
        if (patch.variants == null) patch.variants = new ArrayList<>();
        for (AnnouncementVariant v : patch.variants) {
            if (v.id == null || v.id.isEmpty()) v.id = UUID.randomUUID().toString();
        }
        announcements.put(id, patch);
        save();
        return patch;
    }

    public synchronized boolean delete(String id) {
        if (id == null) return false;
        boolean removed = announcements.remove(id) != null;
        lastSentMap.remove(id);
        if (removed) save();
        return removed;
    }

    /** Enregistre un envoi : incrémente les compteurs et mémorise le timestamp. */
    public synchronized void recordSend(String announcementId, String variantId, int receiverCount) {
        Announcement a = announcements.get(announcementId);
        if (a == null) return;
        long now = System.currentTimeMillis();
        a.lastSentAt = now;
        lastSentMap.put(announcementId, now);
        if (variantId != null && a.variants != null) {
            for (AnnouncementVariant v : a.variants) {
                if (variantId.equals(v.id)) {
                    v.sentCount += Math.max(0, receiverCount);
                    break;
                }
            }
        }
        save();
    }

    /** Incrémente le compteur de clics d'une variante. */
    public synchronized void recordClick(String announcementId, String variantId) {
        Announcement a = announcements.get(announcementId);
        if (a == null || variantId == null || a.variants == null) return;
        for (AnnouncementVariant v : a.variants) {
            if (variantId.equals(v.id)) {
                v.clickCount++;
                save();
                return;
            }
        }
    }

    /** Désactive automatiquement une annonce (fin de période atteinte). */
    public synchronized void disable(String id) {
        Announcement a = announcements.get(id);
        if (a == null) return;
        a.enabled = false;
        save();
    }

    public long getLastSent(String announcementId) {
        Long v = lastSentMap.get(announcementId);
        if (v != null) return v;
        Announcement a = announcements.get(announcementId);
        return a == null ? 0L : a.lastSentAt;
    }

    // ── Persist ─────────────────────────────────────────────────────────────
    public synchronized void save() {
        try {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("announcements", new ArrayList<>(announcements.values()));
            root.put("lastSentMap", new LinkedHashMap<>(lastSentMap));
            Files.writeString(file.toPath(), GSON.toJson(root), StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.warning("[Dashboard/Announcements] save: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void load() {
        if (!file.exists()) return;
        try {
            Map<String, Object> root = GSON.fromJson(
                    Files.readString(file.toPath(), StandardCharsets.UTF_8), Map.class);
            if (root == null) return;
            Type listType = new TypeToken<List<Announcement>>(){}.getType();
            List<Announcement> list = GSON.fromJson(GSON.toJson(root.get("announcements")), listType);
            if (list != null) for (Announcement a : list) {
                if (a.id != null) announcements.put(a.id, a);
            }
            Map<String, Object> lsm = (Map<String, Object>) root.get("lastSentMap");
            if (lsm != null) {
                for (Map.Entry<String, Object> e : lsm.entrySet()) {
                    if (e.getValue() instanceof Number) {
                        lastSentMap.put(e.getKey(), ((Number) e.getValue()).longValue());
                    }
                }
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/Announcements] load: " + e.getMessage());
        }
    }
}
