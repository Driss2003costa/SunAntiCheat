package sunanticheat.jobs.polish;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import sunanticheat.jobs.CustomJob;

import java.time.Duration;

/**
 * Affichage du Title/Subtitle géant à l'écran lors des moments forts.
 *
 *  - Level up : "Niveau X" en grand, sous-titre = nom du métier
 *  - Milestone (10/25/50/max) : titre flashy + lore court
 *  - Event win : "Évènement remporté" + bonus reçu
 *
 * Diffusion broadcast pour les milestones serveur (lvl max).
 */
public final class JobTitlesService {

    public void showLevelUp(Player player, CustomJob job, int newLevel) {
        Component main = Component.text("✦ Niveau " + newLevel + " ✦",
                TextColor.color(0xFFD060)).decoration(
                net.kyori.adventure.text.format.TextDecoration.BOLD, true);
        Component sub  = Component.text(job.name(), NamedTextColor.WHITE);
        Title t = Title.title(main, sub, Title.Times.times(
                Duration.ofMillis(300), Duration.ofSeconds(2), Duration.ofMillis(500)));
        player.showTitle(t);
    }

    public void showMilestone(Player player, CustomJob job, int newLevel, String tagline) {
        Component main = Component.text("⚜ " + tagline + " ⚜",
                TextColor.color(0xFFC940)).decoration(
                net.kyori.adventure.text.format.TextDecoration.BOLD, true);
        Component sub = Component.text("Niveau " + newLevel + " — " + job.name(),
                NamedTextColor.YELLOW);
        Title t = Title.title(main, sub, Title.Times.times(
                Duration.ofMillis(400), Duration.ofSeconds(3), Duration.ofMillis(700)));
        player.showTitle(t);
    }

    public void announceMaxLevel(Player player, CustomJob job) {
        Component msg = Component.text("✦ ", NamedTextColor.GOLD)
                .append(Component.text(player.getName(), NamedTextColor.YELLOW))
                .append(Component.text(" devient ", NamedTextColor.WHITE))
                .append(Component.text("Maître " + job.name() + " ", NamedTextColor.GOLD))
                .append(Component.text("✦", NamedTextColor.GOLD));
        Bukkit.getServer().broadcast(msg);
    }

    public void showEventWin(Player player, String eventId, double money, double xp) {
        Component main = Component.text("✦ ÉVÈNEMENT REMPORTÉ ✦", TextColor.color(0xFFD060))
                .decoration(net.kyori.adventure.text.format.TextDecoration.BOLD, true);
        Component sub  = Component.text("+" + (long) xp + " XP · +" + (long) money + "$",
                NamedTextColor.GREEN);
        Title t = Title.title(main, sub, Title.Times.times(
                Duration.ofMillis(300), Duration.ofSeconds(3), Duration.ofMillis(700)));
        player.showTitle(t);
    }

    /**
     * Détermine le titre symbolique d'un palier.
     * @return null si le niveau n'est pas un palier remarquable.
     */
    public static String taglineFor(int level, int maxLevel) {
        if (maxLevel > 0 && level >= maxLevel) return "MAÎTRE";
        return switch (level) {
            case 10 -> "Initié";
            case 25 -> "Expert";
            case 50 -> "Légende";
            case 75 -> "Maître Vétéran";
            default -> null;
        };
    }
}
