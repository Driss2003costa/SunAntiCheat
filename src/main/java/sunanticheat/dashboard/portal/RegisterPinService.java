package sunanticheat.dashboard.portal;

import sunanticheat.dashboard.auth.RateLimiter;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Map;
import java.util.logging.Logger;

public final class RegisterPinService {

    private static final int MAX_ATTEMPTS  = 3;
    private static final long PIN_TTL_MS   = 300_000L; // 5 minutes

    private final PlayerAccountStore store;
    private final Logger logger;
    private final SecureRandom random = new SecureRandom();

    // 3 demandes par IP par 10 minutes
    private final RateLimiter rateLimiter = new RateLimiter(3, 10 * 60_000L);

    public RegisterPinService(PlayerAccountStore store, Logger logger) {
        this.store  = store;
        this.logger = logger;
    }

    /** Retourne true si on peut procéder, false si l'IP est rate-limitée. */
    public boolean tryRequest(String ip) {
        return rateLimiter.tryAcquire(ip);
    }

    /** Génère un PIN à 6 chiffres, le stocke haché, et retourne la valeur en clair. */
    public String generatePin(String uuid, String username) {
        String pin     = String.format("%06d", random.nextInt(1_000_000));
        String pinHash = sha256(pin);
        store.upsertPin(uuid, username, pinHash, System.currentTimeMillis() + PIN_TTL_MS);
        return pin;
    }

    public sealed interface VerifyResult permits VerifyResult.Ok, VerifyResult.Invalid,
                                                  VerifyResult.Expired, VerifyResult.MaxAttempts {
        record Ok(String username)           implements VerifyResult {}
        record Invalid(int attemptsLeft)     implements VerifyResult {}
        record Expired()                     implements VerifyResult {}
        record MaxAttempts()                 implements VerifyResult {}
    }

    public VerifyResult verifyPin(String uuid, String pin) {
        Map<String, Object> entry = store.getPin(uuid);
        if (entry == null) return new VerifyResult.Invalid(0);

        long expiresAt = (Long) entry.get("expires_at");
        if (System.currentTimeMillis() > expiresAt) {
            store.deletePin(uuid);
            return new VerifyResult.Expired();
        }

        int attempts = ((Number) entry.get("attempts")).intValue();
        if (attempts >= MAX_ATTEMPTS) {
            store.deletePin(uuid);
            return new VerifyResult.MaxAttempts();
        }

        String storedHash = (String) entry.get("pin_hash");
        if (!sha256(pin).equals(storedHash)) {
            store.incrementPinAttempts(uuid);
            return new VerifyResult.Invalid(Math.max(0, MAX_ATTEMPTS - (attempts + 1)));
        }

        String username = (String) entry.get("username");
        store.deletePin(uuid);
        return new VerifyResult.Ok(username);
    }

    private static String sha256(String input) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
