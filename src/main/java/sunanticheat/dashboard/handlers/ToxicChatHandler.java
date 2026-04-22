package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.chat.ToxicChatStore;

import java.io.IOException;
import java.util.*;

public final class ToxicChatHandler {
    private final ToxicChatStore store;
    public ToxicChatHandler(ToxicChatStore store) { this.store = store; }

    public void stats(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("topPlayers", store.topPlayers(20));
        out.put("recent", store.recentFlagged(50));
        out.put("wordlistSize", store.getWordlist().size());
        HttpHelper.json(ex, 200, out);
    }

    public void wordlist(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        HttpHelper.json(ex, 200, Map.of("words", store.getWordlist()));
    }

    @SuppressWarnings("unchecked")
    public void updateWordlist(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.CONTENT_MANAGE)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        List<String> words = body != null ? (List<String>) body.get("words") : null;
        if (words == null) { HttpHelper.error(ex, 400, "words manquant"); return; }
        store.saveWordlist(words);
        HttpHelper.json(ex, 200, Map.of("ok", true, "size", store.getWordlist().size()));
    }

    @SuppressWarnings("unchecked")
    /** POST /api/chat/reset — MOD+ (reset du score toxicité d'un joueur = modération) */
    public void reset(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.MODERATE_PLAYERS)) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        String player = body != null ? (String) body.get("player") : null;
        if (player == null) { HttpHelper.error(ex, 400, "player manquant"); return; }
        store.resetPlayer(player);
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }
}
