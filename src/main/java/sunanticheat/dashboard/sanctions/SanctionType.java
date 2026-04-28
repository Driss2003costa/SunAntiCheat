package sunanticheat.dashboard.sanctions;

/**
 * Type de sanction. Détermine le comportement appliqué :
 *  - KICK    : déconnecte le joueur, pas d'effet persistant
 *  - BAN     : kick + empêche toute reconnexion (UUID)
 *  - IP_BAN  : ban + empêche reconnexion depuis cette IP
 *  - MUTE    : bloque les chat-events (+/me, /msg, etc.)
 *  - WARN    : juste un message au joueur, traçable, sert pour escalade
 */
public enum SanctionType {
    KICK,
    BAN,
    IP_BAN,
    MUTE,
    WARN;

    public boolean isPersistent() {
        return this == BAN || this == IP_BAN || this == MUTE;
    }

    public boolean preventsLogin() {
        return this == BAN || this == IP_BAN;
    }
}
