package sunanticheat.dashboard.portal;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;

public final class PlayerJwtUtil {

    private static final long EXPIRY_MS = 30L * 24 * 3600 * 1000; // 30 jours
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
}
