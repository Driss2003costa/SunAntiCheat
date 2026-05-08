package sunanticheat.dashboard.portal;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Mode maintenance GLOBAL du portail joueur. Quand activé, toutes les routes
 * /api/public/* et /api/custom-jobs/me/* renvoient 503 pour les non-OP, et le
 * frontend affiche un écran lockdown plein page (sauf pour les OP).
 *
 * Persisté dans BlobStorage sous {@code portal-maintenance}.
 */
public final class PortalMaintenanceMode {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static final class State {
        public boolean enabled;
        public String  message;
        /** Epoch-ms de fin estimée. 0 = pas de minuteur. */
        public long endsAt;
        public long startedAt;
        public String startedBy;
        public long updatedAt;
        public String updatedBy;

        public State() {
            this.enabled = false;
            this.message = "";
            this.endsAt = 0;
            this.startedAt = 0;
            this.startedBy = "";
            this.updatedAt = 0;
            this.updatedBy = "";
        }
    }

    private final Persistence storage;
    private final Logger logger;
    private volatile State state = new State();

    public PortalMaintenanceMode(File dataFolder, Logger logger, BlobStorage blobs) {
        this.logger = logger;
        File legacy = new File(new File(dataFolder, "dashboard"), "portal-maintenance.json");
        this.storage = new Persistence(blobs, "portal-maintenance", legacy);
        load();
    }

    public synchronized State snapshot() {
        State s = new State();
        s.enabled = state.enabled;
        s.message = state.message;
        s.endsAt  = state.endsAt;
        s.startedAt = state.startedAt;
        s.startedBy = state.startedBy;
        s.updatedAt = state.updatedAt;
        s.updatedBy = state.updatedBy;
        return s;
    }

    public boolean isActive() { return state.enabled; }
    public String message()   { return state.message; }
    public long endsAt()      { return state.endsAt; }

    public synchronized void enable(String message, long endsAt, String by) {
        long now = System.currentTimeMillis();
        if (!state.enabled) {
            state.startedAt = now;
            state.startedBy = by != null ? by : "";
        }
        state.enabled = true;
        state.message = message != null ? message : "";
        state.endsAt = Math.max(0, endsAt);
        state.updatedAt = now;
        state.updatedBy = by != null ? by : "";
        save();
    }

    public synchronized void disable(String by) {
        state.enabled = false;
        state.endsAt = 0;
        state.updatedAt = System.currentTimeMillis();
        state.updatedBy = by != null ? by : "";
        save();
    }

    public synchronized Map<String, Object> exportPublic() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("enabled", state.enabled);
        m.put("message", state.message);
        m.put("endsAt",  state.endsAt);
        m.put("startedAt", state.startedAt);
        return m;
    }

    public synchronized Map<String, Object> exportAdmin() {
        Map<String, Object> m = exportPublic();
        m.put("startedBy", state.startedBy);
        m.put("updatedAt", state.updatedAt);
        m.put("updatedBy", state.updatedBy);
        return m;
    }

    private void load() {
        try {
            String json = storage.read();
            if (json == null || json.isBlank()) return;
            State loaded = GSON.fromJson(json, State.class);
            if (loaded != null) state = loaded;
        } catch (Exception e) {
            logger.warning("[PortalMaintenance] Erreur chargement : " + e.getMessage());
        }
    }

    private void save() {
        try { storage.write(GSON.toJson(state)); }
        catch (Exception e) { logger.warning("[PortalMaintenance] Erreur sauvegarde : " + e.getMessage()); }
    }
}
