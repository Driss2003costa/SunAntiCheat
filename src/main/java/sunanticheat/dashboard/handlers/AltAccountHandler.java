package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.alts.AltAccountStore;
import sunanticheat.dashboard.auth.Permission;
import sunanticheat.dashboard.sanctions.SanctionStore;
import sunanticheat.dashboard.sanctions.SanctionType;

import java.io.IOException;
import java.util.*;

/**
 * GET /api/players/{name}/alts — liste tous les comptes partageant une IP avec ce joueur.
 * Indique si chaque compte est actuellement banni.
 * Permission : MODERATE_PLAYERS (MOD+).
 */
public final class AltAccountHandler {

    private final AltAccountStore altStore;
    private final SanctionStore sanctionStore;

    public AltAccountHandler(AltAccountStore altStore, SanctionStore sanctionStore) {
        this.altStore = altStore;
        this.sanctionStore = sanctionStore;
    }

    public void alts(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                     String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u, Permission.MODERATE_PLAYERS)) return;

        @SuppressWarnings("deprecation")
        OfflinePlayer off = Bukkit.getOfflinePlayer(playerName);
        if (off.getUniqueId() == null) {
            HttpHelper.json(ex, 200, Map.of("playerName", playerName, "alts", List.of()));
            return;
        }
        String uuid = off.getUniqueId().toString();

        List<AltAccountStore.AltEntry> entries = altStore.getAltsForPlayer(uuid);
        List<Map<String, Object>> alts = new ArrayList<>();
        for (AltAccountStore.AltEntry e : entries) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name",      e.name());
            m.put("uuid",      e.uuid());
            m.put("ip",        e.ip());
            m.put("firstSeen", e.firstSeen());
            m.put("lastSeen",  e.lastSeen());
            m.put("banned",    sanctionStore.activeSanction(e.uuid(), e.name(), null, SanctionType.BAN) != null);
            alts.add(m);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("playerName", playerName);
        result.put("uuid",       uuid);
        result.put("alts",       alts);
        HttpHelper.json(ex, 200, result);
    }
}
