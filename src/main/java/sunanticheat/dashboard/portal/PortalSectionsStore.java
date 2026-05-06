package sunanticheat.dashboard.portal;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Persiste l'état activé/désactivé de chaque section publique du portail joueur.
 * Par défaut, toutes les sections sont activées.
 */
public final class PortalSectionsStore {

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

    /** Définitions statiques des sections connues (ordre d'affichage). */
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
    private final Map<String, Boolean> states = new ConcurrentHashMap<>();

    public PortalSectionsStore(File dataFolder, Logger logger, BlobStorage blobs) {
        this.logger = logger;
        File legacy = new File(new File(dataFolder, "dashboard"), "portal-sections.json");
        this.storage = new Persistence(blobs, "portal-sections", legacy);
        load();
    }

    public boolean isEnabled(String key) {
        return states.getOrDefault(key, true); // par défaut activé
    }

    /** Retourne l'état de toutes les sections définies. */
    public Map<String, Boolean> getAll() {
        Map<String, Boolean> result = new LinkedHashMap<>();
        for (SectionDef def : ALL_SECTIONS) {
            result.put(def.key, states.getOrDefault(def.key, true));
        }
        return result;
    }

    public void setEnabled(String key, boolean enabled) {
        states.put(key, enabled);
        save();
    }

    public void setAll(Map<String, Boolean> patch) {
        for (Map.Entry<String, Boolean> e : patch.entrySet()) {
            states.put(e.getKey(), e.getValue());
        }
        save();
    }

    @SuppressWarnings("unchecked")
    private void load() {
        try {
            String json = storage.read();
            if (json == null || json.isBlank()) return;
            Map<String, Boolean> loaded = GSON.fromJson(json, new TypeToken<Map<String, Boolean>>(){}.getType());
            if (loaded != null) states.putAll(loaded);
        } catch (Exception e) {
            logger.warning("[PortalSections] Erreur de chargement : " + e.getMessage());
        }
    }

    private void save() {
        try {
            storage.write(GSON.toJson(getAll()));
        } catch (Exception e) {
            logger.warning("[PortalSections] Erreur de sauvegarde : " + e.getMessage());
        }
    }
}
