package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import sunanticheat.SunAntiCheat;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.portal.PlayerAccountStore;
import sunanticheat.dashboard.portal.PlayerJwtUtil;
import sunanticheat.dashboard.sanctions.SanctionEntry;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@SuppressWarnings("unchecked")

public final class PublicPlayerHandler {

    private final PlayerAccountStore accountStore;
    private final PlayerJwtUtil playerJwt;
    private final Plugin plugin;

    public PublicPlayerHandler(PlayerAccountStore accountStore, PlayerJwtUtil playerJwt, Plugin plugin) {
        this.accountStore = accountStore;
        this.playerJwt    = playerJwt;
        this.plugin       = plugin;
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

        // Playtime
        try {
            if (plugin instanceof SunAntiCheat sac && sac.getPlaytimeTracker() != null) {
                long seconds = sac.getPlaytimeTracker().getTotalPlaytimeSeconds(UUID.fromString(uuid));
                result.put("playtime_seconds", seconds);
                result.put("playtime_formatted", sunanticheat.playtime.PlaytimeTracker.formatPlaytime(seconds));
            }
        } catch (Throwable ignored) {}

        // Vault balance
        try {
            if (plugin instanceof SunAntiCheat sac && sac.getEconomy() != null) {
                org.bukkit.OfflinePlayer op = Bukkit.getOfflinePlayer(UUID.fromString(uuid));
                double balance = sac.getEconomy().getBalance(op);
                result.put("balance", balance);
            }
        } catch (Throwable ignored) {}

        // Active sanctions
        try {
            if (plugin instanceof SunAntiCheat sac
                    && sac.getDashboardModule() != null
                    && sac.getDashboardModule().getSanctionStore() != null) {

                List<SanctionEntry> sanctions = sac.getDashboardModule().getSanctionStore()
                        .list(null, null, null, Boolean.TRUE, 100, 0)
                        .stream()
                        .filter(s -> uuid.equals(s.targetUuid))
                        .toList();

                result.put("active_sanctions", sanctions.stream().map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",        s.id);
                    m.put("type",      s.type);
                    m.put("reason",    s.reason);
                    m.put("issued_by", s.issuedBy);
                    m.put("issued_at", s.issuedAt);
                    m.put("expires_at", s.expiresAt);
                    return m;
                }).toList());
            }
        } catch (Throwable ignored) {}

        HttpHelper.json(ex, 200, result);
    }

    /** PATCH /api/public/player/me/bio  — body : {"bio":"..."} */
    public void updateBio(HttpExchange ex) throws IOException {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            HttpHelper.error(ex, 401, "Non authentifié"); return;
        }
        String uuid;
        try {
            var claims = playerJwt.validate(header.substring(7));
            uuid = claims.getSubject();
        } catch (Exception e) {
            HttpHelper.error(ex, 401, "Token invalide ou expiré"); return;
        }

        Map<String, Object> body;
        try { body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }

        if (body == null || body.get("bio") == null) {
            HttpHelper.error(ex, 400, "Champ 'bio' requis"); return;
        }
        String bio = body.get("bio").toString().strip();
        if (bio.length() > 160) bio = bio.substring(0, 160);

        accountStore.updateBio(uuid, bio);
        HttpHelper.json(ex, 200, Map.of("ok", true, "bio", bio));
    }
}
