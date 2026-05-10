package sunanticheat.dashboard.quests;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * Charge la bibliothèque de quêtes depuis {@code resources/quest_templates.json}.
 *
 * Chaque template contient les deux langues (fr/en) et sert de point de départ
 * pour créer une quête active : {@link #toQuestPayload(String)} renvoie un
 * Map prêt à être passé à {@link QuestStore#add(...)}.
 */
public final class QuestTemplateLoader {

    private static final Gson GSON = new Gson();

    private final Logger logger;
    private List<Map<String, Object>> templates = Collections.emptyList();
    private List<Map<String, Object>> categories = Collections.emptyList();

    public QuestTemplateLoader(Logger logger) {
        this.logger = logger;
        load();
    }

    @SuppressWarnings("unchecked")
    private void load() {
        try (InputStream is = getClass().getResourceAsStream("/quest_templates.json")) {
            if (is == null) {
                logger.warning("[Dashboard/Quests] quest_templates.json introuvable dans le JAR");
                return;
            }
            BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            Type t = new TypeToken<Map<String, Object>>() {}.getType();
            Map<String, Object> root = GSON.fromJson(r, t);
            if (root != null) {
                Object cats = root.get("categories");
                if (cats instanceof List) categories = (List<Map<String, Object>>) cats;
                Object tpls = root.get("templates");
                if (tpls instanceof List) templates = (List<Map<String, Object>>) tpls;
            }
            logger.info("[Dashboard/Quests] " + templates.size() + " templates chargés ("
                    + categories.size() + " catégories)");
        } catch (Throwable th) {
            logger.warning("[Dashboard/Quests] Échec chargement templates : " + th.getMessage());
        }
    }

    /** Liste exposée à l'admin (déjà au format JSON-friendly). */
    public Map<String, Object> publicView() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("categories", categories);
        out.put("templates", templates);
        return out;
    }

    /** Trouve un template par son id. */
    public Map<String, Object> get(String id) {
        if (id == null) return null;
        return templates.stream()
                .filter(t -> id.equals(t.get("id")))
                .findFirst()
                .orElse(null);
    }

    /**
     * Convertit un template en payload utilisable directement par
     * {@link QuestStore#add(String, String, String, String, String, String, Quest.Type, String, int, String, String, String, boolean, boolean, Long)}.
     *
     * @param templateId  l'id du template
     * @return Map avec les champs prêts pour création, ou null si template introuvable
     */
    public Map<String, Object> toQuestPayload(String templateId) {
        Map<String, Object> tpl = get(templateId);
        if (tpl == null) return null;

        Map<String, Object> payload = new LinkedHashMap<>();

        // Titles localisés
        Map<?, ?> title = tpl.get("title") instanceof Map ? (Map<?, ?>) tpl.get("title") : null;
        Map<?, ?> desc  = tpl.get("description") instanceof Map ? (Map<?, ?>) tpl.get("description") : null;
        Map<?, ?> rwd   = tpl.get("rewardLabel") instanceof Map ? (Map<?, ?>) tpl.get("rewardLabel") : null;

        payload.put("title",         title != null ? str(title.get("fr")) : "Quête");
        payload.put("titleEn",       title != null ? str(title.get("en")) : null);
        payload.put("description",   desc  != null ? str(desc.get("fr"))  : "");
        payload.put("descriptionEn", desc  != null ? str(desc.get("en"))  : null);
        payload.put("rewardLabel",   rwd   != null ? str(rwd.get("fr"))   : "");
        payload.put("rewardLabelEn", rwd   != null ? str(rwd.get("en"))   : null);

        payload.put("icon",          tpl.getOrDefault("icon", "⭐"));
        payload.put("color",         tpl.getOrDefault("color", "#8B5CF6"));
        payload.put("type",          tpl.getOrDefault("type", "BREAK_BLOCK"));
        payload.put("target",        tpl.getOrDefault("target", "ANY"));
        payload.put("goal",          tpl.getOrDefault("goal", 1));
        payload.put("rewardCommand", tpl.getOrDefault("rewardCommand", ""));
        payload.put("repeatable",    Boolean.TRUE.equals(tpl.get("repeatable")));
        payload.put("category",      tpl.getOrDefault("category", ""));

        return payload;
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
}
