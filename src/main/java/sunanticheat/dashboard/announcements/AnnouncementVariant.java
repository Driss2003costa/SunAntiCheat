package sunanticheat.dashboard.announcements;

/**
 * Variante d'une annonce pour A/B testing. Contient le contenu, un éventuel
 * hover/click, un poids de distribution, et des compteurs de statistiques.
 */
public class AnnouncementVariant {

    /** Identifiant unique (UUID). */
    public String id;

    /** Nom humain de la variante ("Variante A", "Variante B", ...). */
    public String name;

    /** Contenu avec codes &/§ ; \n pour multi-ligne. */
    public String content;

    /** Texte du tooltip au survol ; null = pas de hover. */
    public String hoverText;

    /** Commande à exécuter au clic (sans /) ; null = non cliquable. */
    public String clickCommand;

    /** URL à ouvrir au clic ; mutuellement exclusif avec clickCommand. */
    public String clickUrl;

    /** Poids pour le tirage pondéré A/B (défaut 50). */
    public int weight = 50;

    /** Nombre cumulé d'envois (incrémenté par receivers). */
    public long sentCount;

    /** Nombre cumulé de clics enregistrés. */
    public long clickCount;
}
