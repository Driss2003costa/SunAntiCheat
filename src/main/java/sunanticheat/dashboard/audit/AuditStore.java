package sunanticheat.dashboard.audit;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Logger;

/**
 * Store append-only des entries d'audit.
 *
 * Persistance : dashboard/audit_log.json
 * Limite : 50 000 entries (rotation FIFO si dépassé).
 * Save async-debounced : on écrit le fichier au max toutes les 5 secondes.
 */
public final class AuditStore {

    private static final int MAX_ENTRIES = 50_000;
    private static final long SAVE_DEBOUNCE_MS = 5_000;

    private final File file;
    private final Logger logger;
    private final Gson gson = new GsonBuilder().serializeNulls().create();

    private final Deque<AuditEntry> entries = new ArrayDeque<>();
    private final AtomicLong lastSaveAt = new AtomicLong(0);
    private volatile boolean dirty = false;

    public AuditStore(File dataFolder, Logger logger) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        if (!dir.exists()) dir.mkdirs();
        this.file = new File(dir, "audit_log.json");
        load();
    }

    private synchronized void load() {
        if (!file.exists()) return;
        try {
            String json = Files.readString(file.toPath(), StandardCharsets.UTF_8);
            List<AuditEntry> list = gson.fromJson(json, new TypeToken<List<AuditEntry>>() {}.getType());
            if (list != null) entries.addAll(list);
        } catch (IOException e) {
            logger.warning("[Audit] load erreur: " + e.getMessage());
        }
    }

    public synchronized void append(AuditEntry e) {
        if (e == null) return;
        entries.addLast(e);
        // Rotation FIFO si on dépasse
        while (entries.size() > MAX_ENTRIES) entries.pollFirst();
        dirty = true;
        // Save debounced
        long now = System.currentTimeMillis();
        if (now - lastSaveAt.get() > SAVE_DEBOUNCE_MS) {
            save();
        }
    }

    public synchronized void save() {
        if (!dirty) return;
        try {
            String json = gson.toJson(new ArrayList<>(entries));
            Files.writeString(file.toPath(), json, StandardCharsets.UTF_8);
            lastSaveAt.set(System.currentTimeMillis());
            dirty = false;
        } catch (IOException e) {
            logger.warning("[Audit] save erreur: " + e.getMessage());
        }
    }

    /**
     * Liste les entries filtrées (toutes les valeurs sont optionnelles).
     * Retourne par ordre antichronologique (plus récent en premier).
     */
    public synchronized List<AuditEntry> list(String userFilter, String actionFilter,
                                                String targetFilter, long sinceTs,
                                                int limit, int offset) {
        List<AuditEntry> all = new ArrayList<>(entries);
        Collections.reverse(all);

        List<AuditEntry> filtered = new ArrayList<>();
        for (AuditEntry e : all) {
            if (e == null) continue;
            if (sinceTs > 0 && e.timestamp < sinceTs) continue;
            if (userFilter != null && !userFilter.isBlank()
                    && !userFilter.equalsIgnoreCase(e.user)) continue;
            if (actionFilter != null && !actionFilter.isBlank()
                    && !e.action.toUpperCase().contains(actionFilter.toUpperCase())) continue;
            if (targetFilter != null && !targetFilter.isBlank()
                    && (e.target == null
                        || !e.target.toLowerCase().contains(targetFilter.toLowerCase()))) continue;
            filtered.add(e);
        }

        int from = Math.max(0, offset);
        int to = Math.min(filtered.size(), from + Math.max(1, limit));
        if (from >= filtered.size()) return List.of();
        return new ArrayList<>(filtered.subList(from, to));
    }

    public synchronized int totalCount() { return entries.size(); }

    /** Liste des actions distinctes (pour le filtre frontend). */
    public synchronized Set<String> distinctActions() {
        Set<String> out = new TreeSet<>();
        for (AuditEntry e : entries) if (e.action != null) out.add(e.action);
        return out;
    }
}
