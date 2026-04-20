package sunanticheat.dashboard;

public record DashboardUser(String username, String passwordHash, DashboardRole role) {

    public boolean isAdmin() {
        return role == DashboardRole.ADMIN;
    }
}
