package sunanticheat.jobs.dynamics;

import java.time.LocalDate;
import java.time.Month;

/**
 * Saison logique du serveur, calculée à partir du mois courant.
 * Permet d'appliquer des bonus thématiques rotatifs aux métiers.
 */
public enum Season {
    WINTER ("Hiver",    "❄",  "winter"),
    SPRING ("Printemps","🌱", "spring"),
    SUMMER ("Été",      "☀",  "summer"),
    AUTUMN ("Automne",  "🍂", "autumn");

    public final String label;
    public final String icon;
    public final String configKey;

    Season(String label, String icon, String configKey) {
        this.label = label; this.icon = icon; this.configKey = configKey;
    }

    public static Season fromDate(LocalDate date) {
        Month m = date.getMonth();
        return switch (m) {
            case DECEMBER, JANUARY, FEBRUARY -> WINTER;
            case MARCH, APRIL, MAY           -> SPRING;
            case JUNE, JULY, AUGUST          -> SUMMER;
            case SEPTEMBER, OCTOBER, NOVEMBER -> AUTUMN;
        };
    }

    public static Season current() { return fromDate(LocalDate.now()); }
}
