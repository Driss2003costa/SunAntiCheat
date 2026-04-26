package sunanticheat.dashboard.audit;

import java.util.Map;

/**
 * Une entrée du log d'audit. Append-only, immutable après écriture.
 *
 * Fields publics pour Gson serialization.
 */
public final class AuditEntry {
    public String id;
    public long timestamp;
    public String user;          // "admin", "moduser", ...
    public String role;          // ADMIN | MOD | VIEWER
    public String action;        // ex: "USER_CREATED", "PLAYER_BANNED", "PERMISSION_CHANGED"
    public String target;        // joueur / id / nom de l'objet impacté
    public String details;       // texte humain ("Steve banni 7 jours pour X-Ray")
    public String ip;            // IP du caller (ou "system" pour actions auto)
    public Map<String, Object> meta;  // données additionnelles (ancien/nouvelle valeur, etc.)

    public AuditEntry() {}

    public AuditEntry(String user, String role, String action, String target,
                      String details, String ip, Map<String, Object> meta) {
        this.id = java.util.UUID.randomUUID().toString();
        this.timestamp = System.currentTimeMillis();
        this.user = user;
        this.role = role;
        this.action = action;
        this.target = target;
        this.details = details;
        this.ip = ip;
        this.meta = meta;
    }
}
