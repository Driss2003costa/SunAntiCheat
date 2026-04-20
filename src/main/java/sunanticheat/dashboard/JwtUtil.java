package sunanticheat.dashboard;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;

public final class JwtUtil {

    private static final long EXPIRY_MS = 8L * 3600 * 1000; // 8 heures
    private final SecretKey key;

    public JwtUtil(String secret) {
        byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
        // HS256 exige au moins 32 octets
        if (raw.length < 32) raw = Arrays.copyOf(raw, 32);
        this.key = Keys.hmacShaKeyFor(raw);
    }

    public String generate(String username, DashboardRole role) {
        return Jwts.builder()
                .subject(username)
                .claim("role", role.name())
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
