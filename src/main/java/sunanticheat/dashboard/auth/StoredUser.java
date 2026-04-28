package sunanticheat.dashboard.auth;

/**
 * Représentation persistée d'un compte dashboard.
 * Sérialisée en JSON par Gson.
 */
public final class StoredUser {
    public String username;
    public String passwordHash;
    public String role;        // "ADMIN" | "MOD" | "VIEWER"
    public long   createdAt;
    public long   lastLoginAt; // 0 = jamais connecté

    // ── 2FA TOTP ───────────────────────────────────────────────────────
    public String totpSecret;   // base32 (null si pas configuré)
    public boolean totpEnabled; // true seulement après vérification réussie

    /**
     * Id d'un rôle custom (PermissionStore.customRoles). Si défini, ses
     * permissions remplacent celles du rôle enum (ADMIN/MOD/VIEWER) pour les
     * checks via Permission. Le champ `role` reste utilisé pour la hiérarchie
     * (atLeast).
     */
    public String customRoleId;

    public StoredUser() {}

    public StoredUser(String username, String passwordHash, String role, long createdAt) {
        this.username     = username;
        this.passwordHash = passwordHash;
        this.role         = role != null ? role.toUpperCase() : "MOD";
        this.createdAt    = createdAt;
        this.lastLoginAt  = 0L;
        this.totpSecret   = null;
        this.totpEnabled  = false;
    }
}
