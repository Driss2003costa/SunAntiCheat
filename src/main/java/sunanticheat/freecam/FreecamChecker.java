package sunanticheat.freecam;

import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.util.Vector;

/**
 * Vérifie si une action (casser, interagir) est cohérente avec la position et le regard
 * enregistrés par le serveur. En freecam, le client envoie une caméra fictive donc
 * les actions peuvent être "hors du champ de vision" ou hors portée.
 */
public final class FreecamChecker {

    /** Portée max légitime (blocs). Au-delà = reach hack ou freecam. */
    private static final double MAX_REACH = 6.0;

    /**
     * Cône de vision (degré). Un bloc doit être dans ce cône devant le joueur.
     * 120° = assez permissif (lag, angles). Freecam casse souvent "derrière" ou sur les côtés.
     */
    private static final double VIEW_CONE_DEGREES = 120.0;
    private static final double VIEW_CONE_RAD = Math.toRadians(VIEW_CONE_DEGREES);
    /** cos(angle_max). Si dot(look, toBlock) >= ce seuil, le bloc est "devant". */
    private static final double MIN_DOT = Math.cos(VIEW_CONE_RAD);

    private FreecamChecker() {}

    /**
     * Retourne true si le bloc est dans la ligne de vision du joueur (selon le serveur)
     * et à portée. False = action suspecte (freecam / reach).
     */
    public static boolean isBlockInLineOfSightAndReach(Player player, Block block) {
        if (player == null || block == null) return false;
        Location eye = player.getEyeLocation();
        Vector eyeVec = eye.toVector();
        // Centre du bloc
        Vector blockCenter = block.getLocation().add(0.5, 0.5, 0.5).toVector();
        Vector toBlock = blockCenter.clone().subtract(eyeVec);
        double distance = toBlock.length();
        if (distance < 1e-6) return true; // dessus du bloc
        toBlock.normalize();

        // Portée
        if (distance > MAX_REACH) return false;

        // Direction du regard (normalisée)
        Vector look = eye.getDirection();
        double dot = look.dot(toBlock);
        return dot >= MIN_DOT;
    }

    /** Retourne true si le bloc est à portée légitime. */
    public static boolean isWithinReach(Player player, Block block) {
        if (player == null || block == null) return false;
        double distance = player.getEyeLocation().distance(block.getLocation().add(0.5, 0.5, 0.5));
        return distance <= MAX_REACH;
    }
}
