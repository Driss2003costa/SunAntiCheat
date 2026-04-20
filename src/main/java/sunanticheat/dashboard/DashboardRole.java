package sunanticheat.dashboard;

public enum DashboardRole {
    /** Accès total — peut tout faire. */
    ADMIN,
    /** Modération : alertes, sanctions, reports. Pas d'accès aux réglages critiques. */
    MOD,
    /** Lecture seule — peut consulter mais pas modifier. */
    VIEWER;

    public boolean atLeast(DashboardRole required) {
        return this.ordinal() <= required.ordinal();
    }
}
