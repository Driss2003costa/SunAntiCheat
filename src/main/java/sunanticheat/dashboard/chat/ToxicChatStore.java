package sunanticheat.dashboard.chat;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Scoring anti-toxicité.
 * Chaque message contenant un mot de la wordlist → incrémente le score du joueur.
 * Seuils : niv 1 (3pts) = warn, niv 2 (6pts) = mute auto, niv 3 (10pts) = kick.
 */
public final class ToxicChatStore {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final Persistence stateStorage;
    private final Persistence wordlistStorage;
    private final Logger logger;

    private final Map<String, Integer> scoreByPlayer = new ConcurrentHashMap<>();
    private final Map<String, Long> lastMsgAt = new ConcurrentHashMap<>();
    private final List<Map<String, Object>> flaggedMessages = Collections.synchronizedList(new ArrayList<>());
    private final Set<String> wordlist = ConcurrentHashMap.newKeySet();

    // Cooldown : n'incrémente pas plusieurs fois si le même joueur spam les mêmes mots en 10s
    private final Map<String, Long> scoreCooldown = new ConcurrentHashMap<>();

    public ToxicChatStore(File dataFolder, Logger logger, BlobStorage blobs) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        this.stateStorage = new Persistence(blobs, "chat_toxicity", new File(dir, "chat-toxicity.json"));
        this.wordlistStorage = new Persistence(blobs, "chat_wordlist", new File(dir, "chat-wordlist.txt"));
        ensureDefaultWordlist();
        loadWordlist();
        load();
    }

    public Set<String> getWordlist() { return new TreeSet<>(wordlist); }

    public void saveWordlist(List<String> words) {
        wordlist.clear();
        for (String w : words) if (w != null && !w.isBlank()) wordlist.add(w.trim().toLowerCase());
        try { wordlistStorage.write(String.join("\n", new TreeSet<>(wordlist))); }
        catch (Exception e) { logger.warning("[Dashboard/Chat] save wordlist: " + e.getMessage()); }
    }

    /** @return niveau 0=ok, 1=warn, 2=mute, 3=kick (selon score). Retourne mots matchés pour audit. */
    public Result analyze(String player, String playerUuid, String message) {
        List<String> matched = new ArrayList<>();
        String lower = message.toLowerCase();
        for (String w : wordlist) {
            if (lower.contains(w)) matched.add(w);
        }
        if (matched.isEmpty()) return new Result(0, matched, 0);

        long now = System.currentTimeMillis();
        Long cooldownUntil = scoreCooldown.get(player);
        boolean incrementScore = cooldownUntil == null || cooldownUntil < now;

        if (incrementScore) {
            int inc = matched.size();
            scoreByPlayer.merge(player, inc, Integer::sum);
            scoreCooldown.put(player, now + 10_000);
        }
        lastMsgAt.put(player, now);

        int score = scoreByPlayer.getOrDefault(player, 0);
        int level = score >= 10 ? 3 : score >= 6 ? 2 : score >= 3 ? 1 : 0;

        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("timestamp", now);
        entry.put("player", player);
        entry.put("playerUuid", playerUuid);
        entry.put("message", message);
        entry.put("matched", matched);
        entry.put("score", score);
        entry.put("level", level);
        synchronized (flaggedMessages) {
            flaggedMessages.add(entry);
            if (flaggedMessages.size() > 1000) flaggedMessages.remove(0);
        }
        save();
        return new Result(level, matched, score);
    }

    public List<Map<String, Object>> topPlayers(int limit) {
        List<Map.Entry<String, Integer>> sorted = new ArrayList<>(scoreByPlayer.entrySet());
        sorted.sort((a, b) -> Integer.compare(b.getValue(), a.getValue()));
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < Math.min(limit, sorted.size()); i++) {
            var e = sorted.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("player", e.getKey());
            m.put("score", e.getValue());
            m.put("lastMsgAt", lastMsgAt.getOrDefault(e.getKey(), 0L));
            out.add(m);
        }
        return out;
    }

    public List<Map<String, Object>> recentFlagged(int limit) {
        synchronized (flaggedMessages) {
            int from = Math.max(0, flaggedMessages.size() - limit);
            List<Map<String, Object>> sub = new ArrayList<>(flaggedMessages.subList(from, flaggedMessages.size()));
            Collections.reverse(sub);
            return sub;
        }
    }

    public void resetPlayer(String player) {
        scoreByPlayer.remove(player);
        scoreCooldown.remove(player);
        save();
    }

    public record Result(int level, List<String> matched, int totalScore) {}

    // ── Persist ───────────────────────────────────────────────────────────────
    private void ensureDefaultWordlist() {
        if (wordlistStorage.exists()) return;
        String defaults = String.join("\n",
                "nique", "pute", "pd", "tapette", "connard", "enculé", "encule",
                "fdp", "ntm", "fuck", "bitch", "asshole", "nigger", "faggot", "retard",
                "bougnoule", "sale arabe", "sale juif", "sale noir"
        );
        try { wordlistStorage.write(defaults); } catch (Exception ignored) {}
    }

    private void loadWordlist() {
        try {
            String content = wordlistStorage.read();
            if (content == null) return;
            for (String line : content.split("\\r?\\n")) {
                if (!line.isBlank()) wordlist.add(line.trim().toLowerCase());
            }
        } catch (Exception e) { logger.warning("[Dashboard/Chat] load wordlist: " + e.getMessage()); }
    }

    public synchronized void save() {
        try {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("scores", scoreByPlayer);
            root.put("lastMsg", lastMsgAt);
            synchronized (flaggedMessages) { root.put("flagged", new ArrayList<>(flaggedMessages)); }
            stateStorage.write(GSON.toJson(root));
        } catch (Exception e) { logger.warning("[Dashboard/Chat] save: " + e.getMessage()); }
    }

    @SuppressWarnings("unchecked")
    private void load() {
        String content = stateStorage.read();
        if (content == null || content.isBlank()) return;
        try {
            Map<String, Object> root = GSON.fromJson(content, Map.class);
            if (root == null) return;
            Map<String, Number> s = (Map<String, Number>) root.get("scores");
            if (s != null) s.forEach((k, v) -> scoreByPlayer.put(k, v.intValue()));
            Map<String, Number> lm = (Map<String, Number>) root.get("lastMsg");
            if (lm != null) lm.forEach((k, v) -> lastMsgAt.put(k, v.longValue()));
            List<Map<String, Object>> f = (List<Map<String, Object>>) root.get("flagged");
            if (f != null) flaggedMessages.addAll(f);
        } catch (Exception e) { logger.warning("[Dashboard/Chat] load: " + e.getMessage()); }
    }
}
