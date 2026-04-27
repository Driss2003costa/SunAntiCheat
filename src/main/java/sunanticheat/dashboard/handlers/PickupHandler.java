package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.OfflinePlayer;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.pickup.ItemPickupStorage;
import sunanticheat.pickup.ItemPickupStorage.PickupEntry;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET /api/pickup/player/{name} — historique items ramassés (48h) + agrégation par matériau
 */
public final class PickupHandler {

    private final ItemPickupStorage storage;

    public PickupHandler(ItemPickupStorage storage) {
        this.storage = storage;
    }

    public void player(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                       String name) throws IOException {
        if (HttpHelper.requireAtLeast(ex, jwt, users, DashboardRole.MOD) == null) return;

        OfflinePlayer op = Bukkit.getOfflinePlayer(name);

        // Entrées brutes (50 dernières)
        List<PickupEntry> raw = storage.getPickups(op.getUniqueId());
        List<Map<String, Object>> entries = new ArrayList<>();
        int shown = Math.min(raw.size(), 200);
        for (int i = 0; i < shown; i++) {
            PickupEntry e = raw.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("material", e.material.name());
            m.put("amount", e.amount);
            m.put("timestamp", e.timestamp);
            entries.add(m);
        }

        // Agrégation par matériau, triée par quantité desc
        Map<Material, Integer> agg = storage.getAggregatedByMaterial(op.getUniqueId());
        List<Map<String, Object>> aggregated = new ArrayList<>();
        agg.entrySet().stream()
                .sorted(Map.Entry.<Material, Integer>comparingByValue().reversed())
                .forEach(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("material", e.getKey().name());
                    m.put("totalAmount", e.getValue());
                    aggregated.add(m);
                });

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("playerName", op.getName() != null ? op.getName() : name);
        out.put("playerUuid", op.getUniqueId().toString());
        out.put("retentionHours", 48);
        out.put("totalEntries", raw.size());
        out.put("entries", entries);
        out.put("aggregated", aggregated);
        HttpHelper.json(ex, 200, out);
    }
}
