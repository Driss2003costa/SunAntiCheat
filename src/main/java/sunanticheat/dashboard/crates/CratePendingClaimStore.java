package sunanticheat.dashboard.crates;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Stocke les clés achetées via le portail web et non encore livrées en jeu.
 * Pattern identique à DailyRewardStore.pendingWebClaims.
 * Thread-safe : tous les accès sont synchronisés.
 */
public final class CratePendingClaimStore {

    private static final Gson GSON = new GsonBuilder().serializeNulls().setPrettyPrinting().create();

    private final Logger logger;
    private final Persistence storage;

    /** playerUuid -> liste de claims en attente */
    private final Map<String, List<CratePendingClaim>> pending = new HashMap<>();

    public CratePendingClaimStore(File dataFolder, Logger logger, BlobStorage blobs) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        this.storage = new Persistence(blobs, "crates_pending_claims",
                new File(dir, "crates_pending_claims.json"));
        load();
    }

    public synchronized void addPendingClaim(String playerUuid, String crateId, int count) {
        if (playerUuid == null || crateId == null || count <= 0) return;
        String now = Instant.now().toString();
        pending.computeIfAbsent(playerUuid, k -> new ArrayList<>())
               .add(new CratePendingClaim(crateId, count, now));
        persist();
    }

    /** Retourne et supprime tous les claims en attente pour ce joueur. */
    public synchronized List<CratePendingClaim> consumePendingClaims(String playerUuid) {
        if (playerUuid == null) return Collections.emptyList();
        List<CratePendingClaim> claims = pending.remove(playerUuid);
        if (claims != null && !claims.isEmpty()) {
            persist();
            return claims;
        }
        return Collections.emptyList();
    }

    public synchronized boolean hasPendingClaims(String playerUuid) {
        if (playerUuid == null) return false;
        List<CratePendingClaim> list = pending.get(playerUuid);
        return list != null && !list.isEmpty();
    }

    // ── Persist ───────────────────────────────────────────────────────────────

    private void persist() {
        try {
            storage.write(GSON.toJson(pending));
        } catch (Exception e) {
            logger.warning("[Dashboard/CratePending] save fail: " + e.getMessage());
        }
    }

    private void load() {
        try {
            String s = storage.read();
            if (s != null && !s.isBlank()) {
                Map<String, List<CratePendingClaim>> m = GSON.fromJson(s,
                        new TypeToken<Map<String, List<CratePendingClaim>>>(){}.getType());
                if (m != null) pending.putAll(m);
            }
        } catch (Exception e) {
            logger.warning("[Dashboard/CratePending] load fail: " + e.getMessage());
        }
    }
}
