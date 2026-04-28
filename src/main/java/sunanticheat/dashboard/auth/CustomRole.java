package sunanticheat.dashboard.auth;

import sunanticheat.dashboard.DashboardRole;

import java.util.ArrayList;
import java.util.List;

/**
 * Rôle custom défini par un admin (au-delà des 3 built-ins ADMIN/MOD/VIEWER).
 *
 * - id          : identifiant unique stable (ex: "helper_2024", "senior_mod")
 * - label       : nom affiché ("Helper", "Modérateur senior")
 * - color       : couleur d'affichage en hex ou nom CSS
 * - description : texte d'aide
 * - baseRole    : rôle enum de fallback pour la hiérarchie atLeast() — typiquement
 *                 MOD pour un staff, VIEWER pour un read-only custom
 * - permissions : liste des permissions accordées (codes Permission.name())
 */
public final class CustomRole {

    public String id;
    public String label;
    public String color;       // ex: "#3b82f6"
    public String description;
    public String baseRole;    // ADMIN / MOD / VIEWER
    public List<String> permissions = new ArrayList<>();

    public CustomRole() {}

    public CustomRole(String id, String label, String color, String description,
                      DashboardRole baseRole, List<String> permissions) {
        this.id = id;
        this.label = label;
        this.color = color != null ? color : "#3b82f6";
        this.description = description != null ? description : "";
        this.baseRole = baseRole != null ? baseRole.name() : DashboardRole.VIEWER.name();
        this.permissions = permissions != null ? permissions : new ArrayList<>();
    }

    public DashboardRole baseRoleEnum() {
        try { return DashboardRole.valueOf(baseRole); }
        catch (Exception e) { return DashboardRole.VIEWER; }
    }
}
