package sunanticheat.dashboard.sanctions;

import java.util.ArrayList;
import java.util.List;

/**
 * Template de sanction prédéfini. Permet aux modos de sanctionner en 1 clic
 * avec une raison + sévérité + durée standardisées.
 *
 * Les templates sont chargés depuis le code (defaults) puis ajustables côté
 * dashboard (table kv_blobs scope=sanction_templates).
 */
public final class SanctionTemplate {

    public String id;
    public String label;             // "Triche - X-Ray"
    public String description;       // texte d'aide
    public String type;              // SanctionType
    public String severity;          // Severity
    public String category;          // SanctionCategory
    public String reason;            // raison à afficher au joueur
    public long   durationMs;        // 0 = permanent
    public String emoji;
    public boolean enabled = true;

    public SanctionTemplate() {}

    public SanctionTemplate(String id, String label, String description, String type,
                             String severity, String category, String reason,
                             long durationMs, String emoji) {
        this.id = id;
        this.label = label;
        this.description = description;
        this.type = type;
        this.severity = severity;
        this.category = category;
        this.reason = reason;
        this.durationMs = durationMs;
        this.emoji = emoji;
    }

    /** Defaults — utilisés au premier boot s'il n'y a rien en DB. */
    public static List<SanctionTemplate> defaults() {
        List<SanctionTemplate> out = new ArrayList<>();
        long DAY = 86_400_000L;
        long HOUR = 3_600_000L;

        // ── Triche ────────────────────────────────────────────────────────────
        out.add(new SanctionTemplate("cheat-xray", "Triche - X-Ray",
                "Joueur utilisant un texture pack ou client X-Ray pour voir les minerais",
                "BAN", "CRITICAL", "CHEAT", "X-Ray détecté", 30 * DAY, "🔍"));
        out.add(new SanctionTemplate("cheat-killaura", "Triche - KillAura",
                "Combat assisté (kill aura, reach, click pattern suspect)",
                "BAN", "CRITICAL", "CHEAT", "KillAura / cheat combat", 0, "⚔"));
        out.add(new SanctionTemplate("cheat-fly", "Triche - Fly / Movement",
                "Mouvements impossibles (fly, speed, jesus, glide)",
                "BAN", "HIGH", "CHEAT", "Fly / Speed hack", 14 * DAY, "🪂"));
        out.add(new SanctionTemplate("cheat-autoclicker", "Auto-clicker",
                "Macro / autoclicker (CPS anormalement constant et élevé)",
                "BAN", "HIGH", "CHEAT", "Auto-clicker / macro", 7 * DAY, "🖱"));

        // ── Chat ──────────────────────────────────────────────────────────────
        out.add(new SanctionTemplate("chat-spam", "Spam",
                "Messages répétés, flood, caractères aléatoires",
                "MUTE", "LOW", "CHAT", "Spam dans le chat", HOUR, "🔊"));
        out.add(new SanctionTemplate("chat-insult", "Insultes / toxicité",
                "Insultes, attaques personnelles, langage agressif",
                "MUTE", "MEDIUM", "CHAT", "Insultes / toxicité", 24 * HOUR, "💬"));
        out.add(new SanctionTemplate("chat-racism", "Racisme / discrimination",
                "Propos racistes, homophobes, discriminatoires",
                "BAN", "CRITICAL", "CHAT", "Discrimination / haine", 0, "🚫"));
        out.add(new SanctionTemplate("chat-pub", "Publicité",
                "Promotion d'un autre serveur, lien externe, recrutement",
                "MUTE", "MEDIUM", "SPAM", "Publicité interdite", 7 * DAY, "📢"));

        // ── Gameplay ──────────────────────────────────────────────────────────
        out.add(new SanctionTemplate("grief-major", "Grief majeur",
                "Destruction massive de constructions d'autres joueurs",
                "BAN", "HIGH", "GRIEF", "Grief de constructions", 7 * DAY, "⛏"));
        out.add(new SanctionTemplate("grief-theft", "Vol",
                "Vol dans coffres / inventaires d'autres joueurs",
                "BAN", "MEDIUM", "GRIEF", "Vol", 3 * DAY, "🔓"));
        out.add(new SanctionTemplate("exploit-dupe", "Exploit / dupe",
                "Utilisation d'un dupe ou d'un exploit non corrigé",
                "BAN", "CRITICAL", "EXPLOIT", "Exploit / dupe", 0, "🐛"));

        // ── Staff ─────────────────────────────────────────────────────────────
        out.add(new SanctionTemplate("staff-impersonate", "Faux staff",
                "Se fait passer pour un membre du staff",
                "BAN", "HIGH", "STAFF", "Usurpation d'identité staff", 30 * DAY, "🎭"));
        out.add(new SanctionTemplate("ban-evasion", "Évasion de ban",
                "Compte alt utilisé pour contourner un ban",
                "IP_BAN", "CRITICAL", "EVASION", "Évasion de ban", 0, "🪪"));

        // ── Légers ────────────────────────────────────────────────────────────
        out.add(new SanctionTemplate("warn-mild", "Avertissement",
                "Avertissement simple sans sanction",
                "WARN", "LOW", "OTHER", "Avertissement", 0, "⚠"));
        out.add(new SanctionTemplate("kick-cool", "Kick (refroidir)",
                "Kick simple pour faire descendre la tension",
                "KICK", "LOW", "OTHER", "Calme-toi un peu", 0, "🧊"));

        return out;
    }
}
