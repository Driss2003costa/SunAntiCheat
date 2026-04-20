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

    public StoredUser() {}

    public StoredUser(String username, String passwordHash, String role, long createdAt) {
        this.username     = username;
        this.passwordHash = passwordHash;
        this.role         = role != null ? role.toUpperCase() : "MOD";
        this.createdAt    = createdAt;
        this.lastLoginAt  = 0L;
    }
}
