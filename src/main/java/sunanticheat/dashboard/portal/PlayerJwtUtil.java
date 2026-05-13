package sunanticheat.dashboard.portal;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;

public final class PlayerJwtUtil {

    /** Durée de vie d'un token portail : 15 min (sécurité dure en cas de vol). */
    public  static final long EXPIRY_MS = 15L * 60 * 1000;
    /**
     * Fenêtre pendant laquelle on émet un token rafraîchi à chaque appel
     * authentifié pour maintenir la session active sans demander de reconnexion.
     * Tant que l'utilisateur navigue, son token est renouvelé.
     */
    public  static final long REFRESH_AFTER_MS = 5L * 60 * 1000;
    private final SecretKey key;

    public PlayerJwtUtil(String secret) {
        byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
        if (raw.length < 32) raw = Arrays.copyOf(raw, 32);
        this.key = Keys.hmacShaKeyFor(raw);
    }

    public String generate(String uuid, String username, String role) {
        return Jwts.builder()
                .subject(uuid)
                .claim("username", username)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + EXPIRY_MS))
                .signWith(key)
                .compact();
    }

    public Claims validate(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * Décide si un token doit être rafraîchi : retourne {@code true} dès que
     * l'expiration est dans moins de {@link #REFRESH_AFTER_MS}.
     * Permet une expiration glissante : tant que l'utilisateur fait des
     * requêtes, son token est renouvelé ; idle &gt; 15 min → reconnexion.
     */
    public boolean shouldRefresh(Claims claims) {
        if (claims == null || claims.getExpiration() == null) return false;
        long remaining = claims.getExpiration().getTime() - System.currentTimeMillis();
        return remaining > 0 && remaining < (EXPIRY_MS - REFRESH_AFTER_MS);
    }
}
