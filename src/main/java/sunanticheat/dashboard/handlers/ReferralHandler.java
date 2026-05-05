package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import io.jsonwebtoken.Claims;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.portal.PlayerJwtUtil;
import sunanticheat.dashboard.social.ReferralStore;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

public final class ReferralHandler {

    private final ReferralStore referralStore;
    private final PlayerJwtUtil playerJwt;

    public ReferralHandler(ReferralStore referralStore, PlayerJwtUtil playerJwt) {
        this.referralStore = referralStore;
        this.playerJwt     = playerJwt;
    }

    /** GET /api/public/referral/me — retourne le code + stats du joueur connecté */
    public void myCode(HttpExchange ex) throws IOException {
        String uuid = auth(ex); if (uuid == null) return;
        String code = referralStore.getOrCreateCode(uuid);
        if (code == null) { HttpHelper.error(ex, 500, "Erreur génération code"); return; }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("code",            code);
        resp.put("total",           referralStore.getTotalCount(uuid));
        resp.put("validated",       referralStore.getValidatedCount(uuid));
        HttpHelper.json(ex, 200, resp);
    }

    /** GET /api/public/referral/check?code=SUN-XXXX — vérifie si un code est valide (public, sans auth) */
    public void checkCode(HttpExchange ex) throws IOException {
        String code = HttpHelper.queryParam(ex, "code");
        if (code == null || code.isBlank()) {
            HttpHelper.json(ex, 200, Map.of("valid", false));
            return;
        }
        String owner = referralStore.getOwnerByCode(code.toUpperCase().trim());
        HttpHelper.json(ex, 200, Map.of("valid", owner != null));
    }

    // ── Auth helper ───────────────────────────────────────────────────────────

    private String auth(HttpExchange ex) throws IOException {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            HttpHelper.error(ex, 401, "Non authentifié"); return null;
        }
        try {
            Claims claims = playerJwt.validate(header.substring(7));
            return claims.getSubject();
        } catch (Exception e) {
            HttpHelper.error(ex, 401, "Token invalide ou expiré"); return null;
        }
    }
}
