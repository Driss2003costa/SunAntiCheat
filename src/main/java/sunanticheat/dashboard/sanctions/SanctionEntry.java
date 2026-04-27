package sunanticheat.dashboard.sanctions;

import java.util.UUID;

/**
 * Une sanction (kick/ban/mute/warn). POJO sérialisable Gson.
 * Tous les champs publics pour faciliter la sérialisation REST.
 */
public final class SanctionEntry {

    public String id;
    public String type;            // SanctionType.name()
    public String severity;        // Severity.name()
    public String category;        // SanctionCategory.name() ou string libre
    public String targetUuid;
    public String targetName;
    public String targetIp;        // optionnel — utile pour IP_BAN
    public String issuedBy;        // username du staff
    public long   issuedAt;
    public Long   expiresAt;       // null = permanent
    public String reason;
    public String evidenceUrl;     // URL screenshot/vidéo (optionnel)
    public String notes;           // notes internes staff (non visibles joueur)
    public boolean silent;         // true = pas de broadcast public
    public boolean revoked;        // unbanned/unmuted
    public String revokedBy;
    public Long   revokedAt;
    public String revokeReason;
    public String templateId;      // si issu d'un template prédéfini

    public SanctionEntry() {}

    public static SanctionEntry create(SanctionType type, Severity sev, String category,
                                       String targetUuid, String targetName, String targetIp,
                                       String issuedBy, long durationMs,
                                       String reason, String evidenceUrl, String notes,
                                       boolean silent, String templateId) {
        SanctionEntry e = new SanctionEntry();
        e.id = UUID.randomUUID().toString();
        e.type = type.name();
        e.severity = sev.name();
        e.category = category != null ? category : "OTHER";
        e.targetUuid = targetUuid;
        e.targetName = targetName;
        e.targetIp = targetIp;
        e.issuedBy = issuedBy;
        e.issuedAt = System.currentTimeMillis();
        e.expiresAt = (durationMs > 0) ? e.issuedAt + durationMs : null;
        e.reason = reason;
        e.evidenceUrl = evidenceUrl;
        e.notes = notes;
        e.silent = silent;
        e.revoked = false;
        e.templateId = templateId;
        return e;
    }

    /** Sanction toujours active (pas révoquée + pas expirée). */
    public boolean isActive() {
        if (revoked) return false;
        if (expiresAt == null) return true;
        return expiresAt > System.currentTimeMillis();
    }

    public boolean isPermanent() { return expiresAt == null; }

    public long remainingMs() {
        if (expiresAt == null) return Long.MAX_VALUE;
        return Math.max(0, expiresAt - System.currentTimeMillis());
    }

    public SanctionType typeEnum() {
        try { return SanctionType.valueOf(type); }
        catch (Exception e) { return SanctionType.WARN; }
    }

    public Severity severityEnum() {
        try { return Severity.valueOf(severity); }
        catch (Exception e) { return Severity.LOW; }
    }
}
