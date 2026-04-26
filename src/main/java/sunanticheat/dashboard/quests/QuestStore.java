package sunanticheat.dashboard.quests;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

public final class QuestStore {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final Persistence questsStorage;
    private final Persistence progressStorage;
    private final Logger logger;
    private final JavaPlugin plugin;

    private final Map<String, Quest> quests = new ConcurrentHashMap<>();
    // questId -> (playerUuid -> progress)
    private final Map<String, Map<String, Integer>> progress = new ConcurrentHashMap<>();
    // questId -> set of playerUuids that completed
    private final Map<String, Set<String>> completed = new ConcurrentHashMap<>();

    public QuestStore(JavaPlugin plugin, File dataFolder, Logger logger, BlobStorage blobs) {
        this.plugin = plugin;
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        this.questsStorage = new Persistence(blobs, "quests", new File(dir, "quests.json"));
        this.progressStorage = new Persistence(blobs, "quests_progress", new File(dir, "quests-progress.json"));
        load();
    }

    public Collection<Quest> all() { return new ArrayList<>(quests.values()); }
    public Quest get(String id) { return quests.get(id); }

    public Quest add(String title, String description, String icon, String color,
                     Quest.Type type, String target, int goal,
                     String rewardCommand, String rewardLabel,
                     boolean enabled, boolean repeatable) {
        String id = UUID.randomUUID().toString();
        Quest q = new Quest(id, title, description, icon, color, type, target, goal,
                rewardCommand, rewardLabel, enabled, repeatable, System.currentTimeMillis());
        quests.put(id, q);
        saveQuests();
        return q;
    }

    public Quest update(String id, Map<String, Object> patch) {
        Quest q = quests.get(id);
        if (q == null) return null;
        if (patch.containsKey("title")) q.setTitle((String) patch.get("title"));
        if (patch.containsKey("description")) q.setDescription((String) patch.get("description"));
        if (patch.containsKey("icon")) q.setIcon((String) patch.get("icon"));
        if (patch.containsKey("color")) q.setColor((String) patch.get("color"));
        if (patch.containsKey("type")) {
            try { q.setType(Quest.Type.valueOf(((String) patch.get("type")).toUpperCase())); } catch (Exception ignored) {}
        }
        if (patch.containsKey("target")) q.setTarget((String) patch.get("target"));
        if (patch.containsKey("goal")) q.setGoal(((Number) patch.get("goal")).intValue());
        if (patch.containsKey("rewardCommand")) q.setRewardCommand((String) patch.get("rewardCommand"));
        if (patch.containsKey("rewardLabel")) q.setRewardLabel((String) patch.get("rewardLabel"));
        if (patch.containsKey("enabled")) q.setEnabled((Boolean) patch.get("enabled"));
        if (patch.containsKey("repeatable")) q.setRepeatable((Boolean) patch.get("repeatable"));
        saveQuests();
        return q;
    }

    public boolean delete(String id) {
        boolean r = quests.remove(id) != null;
        progress.remove(id);
        completed.remove(id);
        if (r) { saveQuests(); saveProgress(); }
        return r;
    }

    /** Incrémente la progression et déclenche reward si objectif atteint. */
    public void increment(Player p, Quest.Type type, String target, int amount) {
        String uuid = p.getUniqueId().toString();
        for (Quest q : quests.values()) {
            if (!q.isEnabled() || q.getType() != type) continue;
            if (!q.getTarget().equalsIgnoreCase("ANY") && !q.getTarget().equalsIgnoreCase(target)) continue;

            Set<String> done = completed.computeIfAbsent(q.getId(), k -> ConcurrentHashMap.newKeySet());
            if (done.contains(uuid) && !q.isRepeatable()) continue;

            Map<String, Integer> playerProgress = progress.computeIfAbsent(q.getId(), k -> new ConcurrentHashMap<>());
            int before = playerProgress.getOrDefault(uuid, 0);
            int after = before + amount;
            playerProgress.put(uuid, after);

            if (before < q.getGoal() && after >= q.getGoal()) {
                done.add(uuid);
                complete(p, q);
                if (q.isRepeatable()) playerProgress.put(uuid, 0);
            }
        }
        saveProgress();
    }

    private void complete(Player p, Quest q) {
        Bukkit.getScheduler().runTask(plugin, () -> {
            p.sendMessage(Component.text("✨ Quête terminée : " + q.getIcon() + " " + q.getTitle(), NamedTextColor.GOLD));
            if (!q.getRewardLabel().isBlank()) {
                p.sendMessage(Component.text("🎁 Récompense : " + q.getRewardLabel(), NamedTextColor.GREEN));
            }
            if (q.getRewardCommand() != null && !q.getRewardCommand().isBlank()) {
                String cmd = q.getRewardCommand().replace("{player}", p.getName());
                if (cmd.startsWith("/")) cmd = cmd.substring(1);
                Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd);
            }
        });
    }

    public Map<String, Integer> progressFor(String questId) {
        return progress.getOrDefault(questId, Collections.emptyMap());
    }

    public Set<String> completedFor(String questId) {
        return completed.getOrDefault(questId, Collections.emptySet());
    }

    public Map<String, Object> playerProgress(String playerUuid) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (Quest q : quests.values()) {
            int cur = progress.getOrDefault(q.getId(), Collections.emptyMap()).getOrDefault(playerUuid, 0);
            boolean done = completed.getOrDefault(q.getId(), Collections.emptySet()).contains(playerUuid);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("questId", q.getId());
            m.put("title", q.getTitle());
            m.put("progress", cur);
            m.put("goal", q.getGoal());
            m.put("completed", done);
            out.put(q.getId(), m);
        }
        return out;
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    public synchronized void saveQuests() {
        try {
            questsStorage.write(GSON.toJson(new ArrayList<>(quests.values())));
        } catch (Exception e) { logger.warning("[Dashboard/Quests] saveQuests: " + e.getMessage()); }
    }

    public synchronized void saveProgress() {
        try {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("progress", progress);
            Map<String, List<String>> completedSer = new LinkedHashMap<>();
            completed.forEach((k, v) -> completedSer.put(k, new ArrayList<>(v)));
            root.put("completed", completedSer);
            progressStorage.write(GSON.toJson(root));
        } catch (Exception e) { logger.warning("[Dashboard/Quests] saveProgress: " + e.getMessage()); }
    }

    @SuppressWarnings("unchecked")
    private void load() {
        String questsJson = questsStorage.read();
        if (questsJson != null && !questsJson.isBlank()) {
            try {
                List<Map<String, Object>> list = GSON.fromJson(questsJson, List.class);
                if (list != null) for (Map<String, Object> m : list) {
                    Quest.Type t;
                    try { t = Quest.Type.valueOf(((String) m.get("type")).toUpperCase()); } catch (Exception ex) { t = Quest.Type.BREAK_BLOCK; }
                    Quest q = new Quest(
                            (String) m.get("id"),
                            (String) m.get("title"),
                            (String) m.get("description"),
                            (String) m.get("icon"),
                            (String) m.get("color"),
                            t,
                            (String) m.get("target"),
                            ((Number) m.getOrDefault("goal", 1)).intValue(),
                            (String) m.get("rewardCommand"),
                            (String) m.get("rewardLabel"),
                            Boolean.TRUE.equals(m.get("enabled")),
                            Boolean.TRUE.equals(m.get("repeatable")),
                            ((Number) m.getOrDefault("createdAt", System.currentTimeMillis())).longValue()
                    );
                    quests.put(q.getId(), q);
                }
            } catch (Exception e) { logger.warning("[Dashboard/Quests] load quests: " + e.getMessage()); }
        }

        String progressJson = progressStorage.read();
        if (progressJson != null && !progressJson.isBlank()) {
            try {
                Map<String, Object> root = GSON.fromJson(progressJson, Map.class);
                if (root != null) {
                    Map<String, Map<String, Number>> p = (Map<String, Map<String, Number>>) root.get("progress");
                    if (p != null) p.forEach((qid, playerMap) -> {
                        Map<String, Integer> inner = new ConcurrentHashMap<>();
                        playerMap.forEach((pid, val) -> inner.put(pid, val.intValue()));
                        progress.put(qid, inner);
                    });
                    Map<String, List<String>> c = (Map<String, List<String>>) root.get("completed");
                    if (c != null) c.forEach((qid, list) -> {
                        Set<String> s = ConcurrentHashMap.newKeySet();
                        s.addAll(list);
                        completed.put(qid, s);
                    });
                }
            } catch (Exception e) { logger.warning("[Dashboard/Quests] load progress: " + e.getMessage()); }
        }
    }
}
