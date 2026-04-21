package sunanticheat.dashboard.announcements;

import java.util.ArrayList;
import java.util.List;

/**
 * Annonce planifiée : configuration, ciblage, variantes et statistiques.
 */
public class Announcement {

    /** Identifiant unique (UUID). */
    public String id;

    /** Nom interne pour l'admin. */
    public String name;

    /** Description optionnelle. */
    public String description;

    /** Annonce activée ou non. */
    public boolean enabled;

    // ── Scheduling ──────────────────────────────────────────────────────────
    /** "ONCE" | "INTERVAL" | "TIMES". */
    public String scheduleType = "INTERVAL";

    /** Timestamp de début : pour ONCE = date d'envoi ; sinon début de période. */
    public long startAt;

    /** Timestamp de fin (0 = infini). */
    public long endAt;

    /** Pour INTERVAL : fréquence en minutes. */
    public int intervalMinutes = 30;

    /** Pour TIMES : heures fixes au format HH:MM ("12:00", "18:00"). */
    public List<String> times = new ArrayList<>();

    // ── Ciblage ─────────────────────────────────────────────────────────────
    /** Si true, ignore worlds/ranks et envoie à tout le monde. */
    public boolean targetAll = true;

    /** Mondes cibles (si targetAll=false). */
    public List<String> targetWorlds = new ArrayList<>();

    /** Groupes LuckPerms cibles (primary group). */
    public List<String> targetRanks = new ArrayList<>();

    // ── Exclusion ───────────────────────────────────────────────────────────
    /** Groupes à exclure (prioritaire sur targetRanks). */
    public List<String> excludeRanks = new ArrayList<>();

    // ── Variants (A/B testing) ──────────────────────────────────────────────
    /** Liste de variantes : 1 seule = pas d'A/B testing. */
    public List<AnnouncementVariant> variants = new ArrayList<>();

    // ── Stats ───────────────────────────────────────────────────────────────
    /** Timestamp du dernier envoi. */
    public long lastSentAt;

    /** Timestamp de création. */
    public long createdAt;
}
