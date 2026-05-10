package sunanticheat.dashboard.auth;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;

/**
 * Vérifie qu'un nom d'utilisateur correspond à un joueur OP du serveur Minecraft.
 * Utilisé pour restreindre l'accès au panel admin (dashboard web) aux seuls OPs.
 */
public final class OpCheck {

    private OpCheck() {}

    /**
     * Retourne {@code true} si {@code username} correspond à un joueur déclaré OP
     * dans {@code ops.json}. Comparaison insensible à la casse.
     * <p>
     * Implémenté via {@link Bukkit#getOperators()} pour éviter tout appel bloquant
     * réseau (contrairement à {@code getOfflinePlayer(String)}).
     */
    public static boolean isOp(String username) {
        if (username == null || username.isBlank()) return false;
        try {
            for (OfflinePlayer op : Bukkit.getOperators()) {
                String name = op.getName();
                if (name != null && name.equalsIgnoreCase(username)) return true;
            }
        } catch (Throwable ignored) {
            // Si Bukkit n'est pas dispo (tests, etc.), refuse par défaut.
        }
        return false;
    }
}
