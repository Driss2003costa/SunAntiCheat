package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.portal.PlayerAccountStore;
import sunanticheat.dashboard.portal.PlayerJwtUtil;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

public final class PublicPlayerHandler {

    private final PlayerAccountStore accountStore;
    private final PlayerJwtUtil playerJwt;

    public PublicPlayerHandler(PlayerAccountStore accountStore, PlayerJwtUtil playerJwt) {
        this.accountStore = accountStore;
        this.playerJwt    = playerJwt;
    }

    /** GET /api/public/player/me */
    public void me(HttpExchange ex) throws IOException {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            HttpHelper.error(ex, 401, "Non authentifié"); return;
        }

        String uuid, username;
        try {
            var claims = playerJwt.validate(header.substring(7));
            uuid     = claims.getSubject();
            username = claims.get("username", String.class);
        } catch (Exception e) {
            HttpHelper.error(ex, 401, "Token invalide ou expiré"); return;
        }

        Map<String, Object> account = accountStore.getByUuid(uuid);
        if (account == null) { HttpHelper.error(ex, 404, "Compte introuvable"); return; }

        boolean online = Bukkit.getOnlinePlayers().stream()
                .anyMatch(p -> p.getUniqueId().toString().equals(uuid));

        Map<String, Object> result = new LinkedHashMap<>(account);
        result.put("online", online);

        HttpHelper.json(ex, 200, result);
    }
}
