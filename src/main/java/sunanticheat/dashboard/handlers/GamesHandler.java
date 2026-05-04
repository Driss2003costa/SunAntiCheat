package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.games.Arena;
import sunanticheat.dashboard.games.GameArenaScanner;

import java.io.IOException;
import java.util.*;

/**
 * Endpoints /api/games/* — vue d'ensemble des arènes de mini-jeux.
 *
 *  GET /api/games/arenas → liste agrégée des arènes (CTF, Skywars, Thimble, TNT Run)
 *                          avec statut PLAYING/WAITING + joueurs présents
 */
public final class GamesHandler {

    private final GameArenaScanner scanner;

    public GamesHandler(GameArenaScanner scanner) {
        this.scanner = scanner;
    }

    public void publicArenas(HttpExchange ex) throws IOException {
        buildArenasResponse(ex);
    }

    public void arenas(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        buildArenasResponse(ex);
    }

    private void buildArenasResponse(HttpExchange ex) throws IOException {
        List<Arena> arenas = scanner.scanAll();
        List<Map<String, Object>> games = scanner.games();

        // Agrégats
        int playing = 0, waiting = 0;
        Map<String, int[]> perGame = new HashMap<>(); // [total, playing, waiting]
        for (Arena a : arenas) {
            int[] c = perGame.computeIfAbsent(a.game, k -> new int[3]);
            c[0]++;
            if ("PLAYING".equals(a.status)) { c[1]++; playing++; }
            else { c[2]++; waiting++; }
        }
        // Augmente la liste des games avec les counts
        for (Map<String, Object> g : games) {
            int[] c = perGame.getOrDefault(g.get("id"), new int[3]);
            g.put("totalArenas", c[0]);
            g.put("playingArenas", c[1]);
            g.put("waitingArenas", c[2]);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("arenas", arenas);
        out.put("games", games);
        out.put("totalArenas", arenas.size());
        out.put("playing", playing);
        out.put("waiting", waiting);
        HttpHelper.json(ex, 200, out);
    }
}
