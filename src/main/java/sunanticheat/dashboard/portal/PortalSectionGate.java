package sunanticheat.dashboard.portal;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import sunanticheat.dashboard.HttpHelper;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * Garde-fou serveur pour les routes publiques portail. Vérifie qu'une section
 * n'est pas en MAINTENANCE/DISABLED avant de répondre — sauf si le joueur est OP.
 *
 * Usage typique en début de handler :
 * <pre>{@code
 *   if (!PortalSectionGate.checkOrFail(ex, sectionsStore, playerJwt, "shop")) return;
 *   // ... reste du handler
 * }</pre>
 *
 * Renvoie {@code true} si l'accès est autorisé. Si refusé, écrit 503 + JSON
 * {@code { error, status, message }} et retourne {@code false}.
 */
public final class PortalSectionGate {

    private PortalSectionGate() {}

    public static boolean checkOrFail(HttpExchange ex, PortalSectionsStore store,
                                      PlayerJwtUtil playerJwt, String sectionKey) throws IOException {
        PortalSectionsStore.FeatureState s = store.stateOf(sectionKey);
        // OPERATIONAL ou DEGRADED → accès libre (DEGRADED = juste un avertissement informatif)
        if (s.accessibleToPlayers()) return true;

        // Si DISABLED → 503 ferme pour tous (même OP, par cohérence avec l'UI dashboard)
        if (!s.enabled || s.status == PortalSectionsStore.FeatureStatus.DISABLED) {
            HttpHelper.json(ex, 503, Map.of(
                    "error", "Section désactivée",
                    "sectionKey", sectionKey,
                    "status", s.status.name(),
                    "message", s.message));
            return false;
        }

        // MAINTENANCE → autorisé uniquement si l'utilisateur est OP serveur
        if (s.status == PortalSectionsStore.FeatureStatus.MAINTENANCE) {
            if (isRequestorOp(ex, playerJwt)) return true;
            HttpHelper.json(ex, 503, Map.of(
                    "error", "Section en maintenance",
                    "sectionKey", sectionKey,
                    "status", "MAINTENANCE",
                    "message", s.message));
            return false;
        }
        return true;
    }

    /**
     * True si la requête contient un Bearer JWT joueur valide ET que l'UUID est OP côté Bukkit.
     */
    public static boolean isRequestorOp(HttpExchange ex, PlayerJwtUtil playerJwt) {
        try {
            String header = ex.getRequestHeaders().getFirst("Authorization");
            if (header == null || !header.startsWith("Bearer ")) return false;
            var claims = playerJwt.validate(header.substring(7));
            String uuid = claims.getSubject();
            if (uuid == null || uuid.isBlank()) return false;
            OfflinePlayer op = Bukkit.getOfflinePlayer(UUID.fromString(uuid));
            return op != null && op.isOp();
        } catch (Throwable t) {
            return false;
        }
    }
}
