package sunanticheat.dashboard;

/**
 * Utilisateur authentifié sur le dashboard.
 *
 *  - role         : rôle enum built-in (ADMIN/MOD/VIEWER) — utilisé pour les
 *                   checks de hiérarchie atLeast()
 *  - customRoleId : id optionnel d'un rôle custom (créé par admin) — si défini,
 *                   ses permissions remplacent celles du rôle enum lors des
 *                   checks via PermissionStore
 *
 * Le `role` enum reste obligatoire pour la rétro-compatibilité avec
 * `requireAtLeast()` et tous les chemins de check par hiérarchie. Pour un
 * staff custom qui doit pouvoir faire des actions MOD sans être ADMIN,
 * on lui met role=MOD + customRoleId="helper".
 */
public record DashboardUser(String username, String passwordHash, DashboardRole role, String customRoleId) {

    /** Constructeur historique sans customRoleId (rôle enum pur). */
    public DashboardUser(String username, String passwordHash, DashboardRole role) {
        this(username, passwordHash, role, null);
    }

    public boolean isAdmin() {
        return role == DashboardRole.ADMIN;
    }

    /** Identifiant à utiliser pour le check de permission : custom ou enum.name(). */
    public String roleIdForPermissionCheck() {
        return (customRoleId != null && !customRoleId.isBlank()) ? customRoleId : role.name();
    }
}
