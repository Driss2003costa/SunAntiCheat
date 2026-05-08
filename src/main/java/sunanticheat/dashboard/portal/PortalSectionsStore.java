package sunanticheat.dashboard.portal;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Stocke l'état de chaque section publique du portail joueur.
 *
 * Modèle :
 *   - {@code enabled}    : la section est-elle déployée du tout (false = coupée pour tous, OP inclus côté UI)
 *   - {@code status}     : un des 4 statuts {@link FeatureStatus} (OPERATIONAL/DEGRADED/MAINTENANCE/DISABLED)
 *   - {@code message}    : message libre affiché dans le bandeau (incident, ETA, etc.)
 *   - {@code updatedAt}  : timestamp ms du dernier changement
 *   - {@code updatedBy}  : pseudo du staff ayant modifié
 *
 * Compatibilité : ancien format ({@code Map<String, Boolean>}) toujours lu →
 * {@code true} ⇒ enabled+OPERATIONAL, {@code false} ⇒ disabled.
 */
public final class PortalSectionsStore {

    public enum FeatureStatus {
        /** Tout va bien — accès normal pour tous. */
        OPERATIONAL,
        /** Accessible mais avec un problème connu (lenteur, bug mineur, etc.) — bandeau visible. */
        DEGRADED,
        /** Maintenance en cours — accès BLOQUÉ pour les non-OP, les OP peuvent passer outre. */
        MAINTENANCE,
        /** Section complètement coupée (équivalent enabled=false) — personne ne passe. */
        DISABLED
    }

    public static final class FeatureState {
        public boolean enabled;
        public FeatureStatus status;
        public String message;
        public long updatedAt;
        public String updatedBy;

        public FeatureState() {
            this.enabled = true;
            this.status = FeatureStatus.OPERATIONAL;
            this.message = "";
            this.updatedAt = 0;
            this.updatedBy = "";
        }

        public FeatureState(boolean enabled, FeatureStatus status, String message, long updatedAt, String updatedBy) {
            this.enabled = enabled;
            this.status = status != null ? status : FeatureStatus.OPERATIONAL;
            this.message = message != null ? message : "";
            this.updatedAt = updatedAt;
            this.updatedBy = updatedBy != null ? updatedBy : "";
        }

        /** True si cette section est utilisable par un joueur normal (non-OP). */
        public boolean accessibleToPlayers() {
            if (!enabled) return false;
            return status != FeatureStatus.MAINTENANCE && status != FeatureStatus.DISABLED;
        }

        /** True si la section est utilisable par un OP (ignore MAINTENANCE mais pas DISABLED). */
        public boolean accessibleToOps() {
            if (!enabled) return false;
            return status != FeatureStatus.DISABLED;
        }
    }

    public static final class SectionDef {
        public final String key;
        public final String label;
        public final String description;
        public final String icon;

        public SectionDef(String key, String label, String description, String icon) {
            this.key = key;
            this.label = label;
            this.description = description;
            this.icon = icon;
        }
    }

    public static final List<SectionDef> ALL_SECTIONS = List.of(
        new SectionDef("leaderboard",     "Classement",       "Page de classement public (temps de jeu, économie)",        "🏆"),
        new SectionDef("public_profiles", "Profils publics",  "Consultation du profil d'un joueur par son pseudo",         "👤"),
        new SectionDef("register",        "Inscription",      "Formulaire d'inscription de nouveaux joueurs",              "📝"),
        new SectionDef("shop",            "Boutique",         "Boutique de crates, VIP et abonnements",                    "🛍"),
        new SectionDef("quests",          "Quêtes",           "Liste des quêtes disponibles et progression joueur",        "🎯"),
        new SectionDef("career",          "Carrière",         "Système de métiers et d'emplois",                           "💼"),
        new SectionDef("friends",         "Amis",             "Gestion des amis et demandes d'amitié",                     "🤝"),
        new SectionDef("messages",        "Messages",         "Messagerie privée entre joueurs",                           "💬"),
        new SectionDef("minigames",       "Mini-jeux",        "Section mini-jeux et arènes",                               "🎮")
    );

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final Persistence storage;
    private final Logger logger;
    private final Map<String, FeatureState> states = new ConcurrentHashMap<>();

    public PortalSectionsStore(File dataFolder, Logger logger, BlobStorage blobs) {
        this.logger = logger;
        File legacy = new File(new File(dataFolder, "dashboard"), "portal-sections.json");
        this.storage = new Persistence(blobs, "portal-sections", legacy);
        load();
    }

    /** True si la section est entièrement activée (pas DISABLED). */
    public boolean isEnabled(String key) {
        FeatureState s = stateOf(key);
        return s.enabled && s.status != FeatureStatus.DISABLED;
    }

    /** Statut courant (jamais null — défaut OPERATIONAL). */
    public FeatureStatus statusOf(String key) {
        return stateOf(key).status;
    }

    public FeatureState stateOf(String key) {
        return states.computeIfAbsent(key, k -> new FeatureState());
    }

    /** Vue immutable de tous les états (clé → état) pour les définitions connues. */
    public Map<String, FeatureState> getAll() {
        Map<String, FeatureState> result = new LinkedHashMap<>();
        for (SectionDef def : ALL_SECTIONS) {
            result.put(def.key, copy(stateOf(def.key)));
        }
        return result;
    }

    /** Map simple {key: enabled} — compatibilité avec l'ancien endpoint. */
    public Map<String, Boolean> getEnabledMap() {
        Map<String, Boolean> result = new LinkedHashMap<>();
        for (SectionDef def : ALL_SECTIONS) {
            FeatureState s = stateOf(def.key);
            result.put(def.key, s.enabled && s.status != FeatureStatus.DISABLED);
        }
        return result;
    }

    public void setEnabled(String key, boolean enabled, String by) {
        FeatureState s = stateOf(key);
        s.enabled = enabled;
        if (!enabled) s.status = FeatureStatus.DISABLED;
        else if (s.status == FeatureStatus.DISABLED) s.status = FeatureStatus.OPERATIONAL;
        s.updatedAt = System.currentTimeMillis();
        s.updatedBy = by != null ? by : "";
        save();
    }

    public void setStatus(String key, FeatureStatus status, String message, String by) {
        FeatureState s = stateOf(key);
        s.status = status != null ? status : FeatureStatus.OPERATIONAL;
        s.message = message != null ? message : "";
        if (status == FeatureStatus.DISABLED) s.enabled = false;
        else s.enabled = true;
        s.updatedAt = System.currentTimeMillis();
        s.updatedBy = by != null ? by : "";
        save();
    }

    public void setAllEnabled(Map<String, Boolean> patch, String by) {
        for (Map.Entry<String, Boolean> e : patch.entrySet()) {
            FeatureState s = stateOf(e.getKey());
            s.enabled = e.getValue();
            if (Boolean.FALSE.equals(e.getValue())) s.status = FeatureStatus.DISABLED;
            else if (s.status == FeatureStatus.DISABLED) s.status = FeatureStatus.OPERATIONAL;
            s.updatedAt = System.currentTimeMillis();
            s.updatedBy = by != null ? by : "";
        }
        save();
    }

    private void load() {
        try {
            String json = storage.read();
            if (json == null || json.isBlank()) return;
            JsonElement root = JsonParser.parseString(json);
            if (!root.isJsonObject()) return;
            JsonObject obj = root.getAsJsonObject();
            for (var entry : obj.entrySet()) {
                JsonElement v = entry.getValue();
                if (v.isJsonPrimitive() && v.getAsJsonPrimitive().isBoolean()) {
                    // legacy : { "shop": true }
                    boolean enabled = v.getAsBoolean();
                    states.put(entry.getKey(), new FeatureState(enabled,
                            enabled ? FeatureStatus.OPERATIONAL : FeatureStatus.DISABLED,
                            "", 0, ""));
                } else if (v.isJsonObject()) {
                    JsonObject so = v.getAsJsonObject();
                    boolean enabled = so.has("enabled") && so.get("enabled").getAsBoolean();
                    FeatureStatus st = FeatureStatus.OPERATIONAL;
                    if (so.has("status")) {
                        try { st = FeatureStatus.valueOf(so.get("status").getAsString()); }
                        catch (Exception ignored) {}
                    }
                    String msg = so.has("message") ? so.get("message").getAsString() : "";
                    long ts = so.has("updatedAt") ? so.get("updatedAt").getAsLong() : 0;
                    String by = so.has("updatedBy") ? so.get("updatedBy").getAsString() : "";
                    states.put(entry.getKey(), new FeatureState(enabled, st, msg, ts, by));
                }
            }
        } catch (Exception e) {
            logger.warning("[PortalSections] Erreur de chargement : " + e.getMessage());
        }
    }

    private void save() {
        try { storage.write(GSON.toJson(getAll())); }
        catch (Exception e) { logger.warning("[PortalSections] Erreur de sauvegarde : " + e.getMessage()); }
    }

    private static FeatureState copy(FeatureState s) {
        return new FeatureState(s.enabled, s.status, s.message, s.updatedAt, s.updatedBy);
    }
}
