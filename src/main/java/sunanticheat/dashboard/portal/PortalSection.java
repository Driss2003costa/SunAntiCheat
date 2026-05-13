package sunanticheat.dashboard.portal;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Sections du portail front-end pouvant être individuellement restreintes par compte.
 *
 * Stockage : bitmask `INTEGER` dans `player_accounts.section_restrictions`.
 * Un bit à 1 signifie que la section est <b>bloquée</b> pour le joueur.
 */
public enum PortalSection {
    SHOP        ("shop",        1 <<  0),
    FRIENDS     ("friends",     1 <<  1),
    MESSAGES    ("messages",    1 <<  2),
    INVENTORY   ("inventory",   1 <<  3),
    QUESTS      ("quests",      1 <<  4),
    LEADERBOARD ("leaderboard", 1 <<  5),
    CAREER      ("career",      1 <<  6),
    MINIGAMES   ("minigames",   1 <<  7),
    PROFILE     ("profile",     1 <<  8),
    REFERRAL    ("referral",    1 <<  9),
    DAILY       ("daily",       1 << 10);

    public final String key;
    public final int    bit;

    PortalSection(String key, int bit) {
        this.key = key;
        this.bit = bit;
    }

    public static PortalSection fromKey(String k) {
        if (k == null) return null;
        for (PortalSection s : values()) if (s.key.equalsIgnoreCase(k)) return s;
        return null;
    }

    public static boolean isBlocked(int mask, PortalSection s) {
        return (mask & s.bit) != 0;
    }

    public static int withBlocked(int mask, PortalSection s)    { return mask |  s.bit; }
    public static int withAllowed(int mask, PortalSection s)    { return mask & ~s.bit; }

    /** Construit un mask depuis une liste de clés (ignorant celles inconnues). */
    public static int maskFromKeys(List<String> keys) {
        if (keys == null) return 0;
        int mask = 0;
        for (String k : keys) {
            PortalSection s = fromKey(k);
            if (s != null) mask |= s.bit;
        }
        return mask;
    }

    /** Renvoie la liste des clés bloquées dans un mask. */
    public static List<String> keysFromMask(int mask) {
        List<String> out = new ArrayList<>();
        for (PortalSection s : values()) if (isBlocked(mask, s)) out.add(s.key);
        return out;
    }

    public static Set<PortalSection> all() { return EnumSet.allOf(PortalSection.class); }
}
