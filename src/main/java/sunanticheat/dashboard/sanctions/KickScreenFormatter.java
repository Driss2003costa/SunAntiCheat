package sunanticheat.dashboard.sanctions;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Construit le message de déconnexion stylisé qu'un joueur banni/kick voit
 * quand il essaie de se connecter ou est expulsé.
 *
 * Le rendu utilise les codes couleur Minecraft legacy (§) pour rester
 * compatible Bukkit/Paper. Format multi-lignes en encadré ASCII.
 *
 * Exemple :
 *
 *   §c§l✖ §4§lTU AS ÉTÉ BANNI §c§l✖
 *   §8━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   §7Raison       §8» §f§lTriche - X-Ray
 *   §7Sévérité     §8» §c⛔ Critique
 *   §7Catégorie    §8» §6⚔ Triche / hack
 *   §7Durée        §8» §f30 jours
 *   §7Expire le    §8» §f27/05/2026 à 22:14
 *   §7Restant      §8» §a30 j 0 h 0 min
 *   §7Modérateur   §8» §badmin
 *   §7ID           §8» §8§o#a1b2c3d4
 *
 *   §8━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *   §7Tu penses être banni à tort ?
 *   §7Fais ton appel sur §b§nhttps://discord.gg/xxx
 */
public final class KickScreenFormatter {

    private static final DateTimeFormatter EXPIRY_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm", Locale.FRENCH).withZone(ZoneId.systemDefault());

    private final String appealUrl;
    private final String serverName;

    public KickScreenFormatter(String serverName, String appealUrl) {
        this.serverName = serverName != null ? serverName : "Serveur";
        this.appealUrl = appealUrl;
    }

    /**
     * Génère le message multi-ligne pour un BAN ou IP_BAN.
     */
    public String formatBan(SanctionEntry s) {
        StringBuilder b = new StringBuilder();
        appendHeader(b, s);
        appendBlankLine(b);
        appendField(b, "Raison",     "§f§l" + safe(s.reason));
        appendField(b, "Sévérité",   severityText(s));
        appendField(b, "Catégorie",  categoryText(s));
        if (s.isPermanent()) {
            appendField(b, "Durée",  "§4§lPERMANENT");
        } else {
            appendField(b, "Durée",     "§f" + formatDuration(s.expiresAt - s.issuedAt));
            appendField(b, "Expire le", "§f" + EXPIRY_FMT.format(Instant.ofEpochMilli(s.expiresAt)));
            appendField(b, "Restant",   "§a" + formatDuration(s.remainingMs()));
        }
        appendField(b, "Modérateur", "§b" + safe(s.issuedBy));
        appendField(b, "ID",         "§8§o#" + (s.id == null ? "?" : s.id.substring(0, Math.min(8, s.id.length()))));
        appendBlankLine(b);
        appendDivider(b);
        appendBlankLine(b);
        appendCentered(b, "§7Tu penses être banni à tort ?");
        if (appealUrl != null && !appealUrl.isBlank()) {
            appendCentered(b, "§7Fais ton appel sur");
            appendCentered(b, "§b§n" + appealUrl);
        } else {
            appendCentered(b, "§7Contacte un modérateur sur le serveur Discord.");
        }
        return b.toString().stripTrailing();
    }

    /** Format simple pour les KICKs (pas de durée, pas d'appeal). */
    public String formatKick(SanctionEntry s) {
        StringBuilder b = new StringBuilder();
        b.append("§e§l⚠ §6§lKICK §e§l⚠\n");
        b.append("§8━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n");
        b.append("§7Raison §8» §f§l").append(safe(s.reason)).append("\n");
        b.append("§7Par §8» §b").append(safe(s.issuedBy)).append("\n");
        b.append("\n§7Tu peux te reconnecter immédiatement.");
        return b.toString();
    }

    /** Message in-game qu'un joueur muet voit quand il essaie de parler. */
    public String formatMutedMessage(SanctionEntry s) {
        StringBuilder b = new StringBuilder();
        b.append("§c§l[MUTE] §cTu es réduit au silence.\n");
        b.append("§7Raison §8» §f").append(safe(s.reason)).append("\n");
        if (s.isPermanent()) {
            b.append("§7Durée §8» §4PERMANENT");
        } else {
            b.append("§7Reste §8» §a").append(formatDuration(s.remainingMs()));
        }
        return b.toString();
    }

    // ── Internals ──────────────────────────────────────────────────────────

    private void appendHeader(StringBuilder b, SanctionEntry s) {
        SanctionType t = s.typeEnum();
        Severity sev = s.severityEnum();
        String headerColor = sev == Severity.CRITICAL ? "§4§l"
                           : sev == Severity.HIGH     ? "§c§l"
                           : sev == Severity.MEDIUM   ? "§6§l"
                           :                            "§e§l";
        String title;
        if (t == SanctionType.IP_BAN)       title = "BANNISSEMENT IP";
        else if (s.isPermanent())            title = "BAN PERMANENT";
        else                                 title = "BANNISSEMENT TEMPORAIRE";

        b.append("§c§l✖ ").append(headerColor).append(title).append(" §c§l✖\n");
        appendDivider(b);
    }

    private void appendDivider(StringBuilder b) {
        b.append("§8━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }

    private void appendBlankLine(StringBuilder b) { b.append("\n"); }

    private void appendField(StringBuilder b, String key, String value) {
        b.append("§7").append(padRight(key, 13)).append(" §8» ").append(value).append("\n");
    }

    private void appendCentered(StringBuilder b, String text) {
        // Le client MC ne center pas réellement — on prefixe avec quelques espaces
        // pour donner un effet de centrage sur la disconnect screen.
        b.append("  ").append(text).append("\n");
    }

    private static String padRight(String s, int len) {
        if (s == null) s = "";
        if (s.length() >= len) return s;
        StringBuilder sb = new StringBuilder(s);
        while (sb.length() < len) sb.append(' ');
        return sb.toString();
    }

    private static String safe(String s) { return s == null ? "" : s; }

    private static String severityText(SanctionEntry s) {
        Severity sev = s.severityEnum();
        return switch (sev) {
            case LOW      -> "§e🟡 Léger";
            case MEDIUM   -> "§6🟠 Modéré";
            case HIGH     -> "§c🔴 Élevé";
            case CRITICAL -> "§4⛔ Critique";
        };
    }

    private static String categoryText(SanctionEntry s) {
        try {
            SanctionCategory c = SanctionCategory.valueOf(s.category);
            return "§f" + c.emoji + " " + c.label;
        } catch (Exception e) {
            return "§f" + safe(s.category);
        }
    }

    /** Format human-readable d'une durée en ms (jours/heures/min). */
    public static String formatDuration(long ms) {
        if (ms < 0) ms = 0;
        Duration d = Duration.ofMillis(ms);
        long days = d.toDays();
        long hours = d.toHoursPart();
        long mins = d.toMinutesPart();
        if (days > 0)  return days + " j " + hours + " h";
        if (hours > 0) return hours + " h " + mins + " min";
        if (mins > 0)  return mins + " min";
        return d.toSeconds() + " s";
    }
}
