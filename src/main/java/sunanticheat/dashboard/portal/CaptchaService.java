package sunanticheat.dashboard.portal;

import java.security.SecureRandom;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * CAPTCHA texte/maths interne. Aucun service externe.
 *
 * Cycle de vie :
 *   1) {@link #generate()} crée un challenge (question + réponse) avec un id et TTL.
 *   2) Le client renvoie {id, answer} dans la requête sensible.
 *   3) {@link #verifyAndConsume(String, String)} retourne true si correct (et
 *      invalide le challenge immédiatement, single-use).
 */
public final class CaptchaService {

    public static final long TTL_MS = 5 * 60_000L;
    private static final SecureRandom RND = new SecureRandom();

    /** Challenge actif : id → (réponse normalisée, deadline). */
    private final ConcurrentHashMap<String, Entry> store = new ConcurrentHashMap<>();

    private static final class Entry {
        final String answer;
        final long   expiresAt;
        Entry(String a, long e) { this.answer = a; this.expiresAt = e; }
    }

    public record Challenge(String id, String question, long expiresIn) {}

    /** Génère un nouveau challenge (addition/soustraction simple). */
    public Challenge generate() {
        purgeExpired();
        int a = 2 + RND.nextInt(8);   // 2..9
        int b = 1 + RND.nextInt(8);   // 1..8
        boolean add = RND.nextBoolean();
        // Soustraction : on garantit un résultat positif
        if (!add && b > a) { int tmp = a; a = b; b = tmp; }
        int result = add ? a + b : a - b;
        String question = a + (add ? " + " : " − ") + b + " = ?";
        String id       = UUID.randomUUID().toString();
        long   exp      = System.currentTimeMillis() + TTL_MS;
        store.put(id, new Entry(Integer.toString(result), exp));
        return new Challenge(id, question, TTL_MS / 1000);
    }

    /**
     * Vérifie un challenge. Retourne true si correct.
     * <b>Single-use</b> : que la réponse soit bonne ou mauvaise, l'entrée est retirée
     * pour éviter qu'un attaquant ré-essaie sur le même id.
     */
    public boolean verifyAndConsume(String id, String answer) {
        if (id == null || answer == null) return false;
        Entry e = store.remove(id);
        if (e == null) return false;
        if (System.currentTimeMillis() > e.expiresAt) return false;
        return e.answer.equals(answer.trim());
    }

    public void purgeExpired() {
        long now = System.currentTimeMillis();
        store.entrySet().removeIf(e -> e.getValue().expiresAt < now);
    }

    public int activeCount() { return store.size(); }
}
