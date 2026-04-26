package sunanticheat.dashboard.auth;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding window rate limiter par clé (IP, username, etc.).
 *
 * Usage :
 *   private static final RateLimiter LOGIN_LIMIT =
 *       new RateLimiter(5, 15 * 60 * 1000L);  // 5 tentatives / 15 min
 *
 *   if (!LOGIN_LIMIT.tryAcquire(ip)) { 429 + retry-after; return; }
 *
 * Persistance : aucune (in-memory). Restart = reset = OK.
 */
public final class RateLimiter {

    private final int maxAttempts;
    private final long windowMs;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    private static final class Window {
        long firstAttemptAt;
        int attempts;
    }

    public RateLimiter(int maxAttempts, long windowMs) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
    }

    /** Retourne true si on peut continuer, false si limite atteinte. */
    public boolean tryAcquire(String key) {
        if (key == null || key.isBlank()) return true;
        long now = System.currentTimeMillis();
        Window w = windows.computeIfAbsent(key, k -> new Window());
        synchronized (w) {
            if (w.firstAttemptAt == 0 || now - w.firstAttemptAt > windowMs) {
                // Nouvelle fenêtre
                w.firstAttemptAt = now;
                w.attempts = 1;
                return true;
            }
            if (w.attempts >= maxAttempts) return false;
            w.attempts++;
            return true;
        }
    }

    /** Force-reset après login réussi (par exemple). */
    public void reset(String key) {
        windows.remove(key);
    }

    /** Temps restant en ms avant que la fenêtre se réinitialise pour cette clé. */
    public long retryAfterMs(String key) {
        Window w = windows.get(key);
        if (w == null) return 0;
        long elapsed = System.currentTimeMillis() - w.firstAttemptAt;
        return Math.max(0, windowMs - elapsed);
    }

    /** Nombre de tentatives dans la fenêtre courante. */
    public int currentAttempts(String key) {
        Window w = windows.get(key);
        if (w == null) return 0;
        return w.attempts;
    }

    /** Purge périodique (à appeler depuis un scheduler si tu veux éviter la fuite mémoire). */
    public void purgeStale() {
        long now = System.currentTimeMillis();
        windows.entrySet().removeIf(e -> now - e.getValue().firstAttemptAt > windowMs * 2);
    }
}
