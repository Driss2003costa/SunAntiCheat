package sunanticheat.jobs.polish;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.entity.Player;
import sunanticheat.jobs.dynamics.MultiplierBreakdown;

/**
 * Affichage instantané des gains et bonus dans l'ActionBar (au-dessus du hotbar).
 *
 * Format : {@code +12 XP · 1.5$ · Hiver x2 · Combo x1.3}
 */
public final class JobActionBarService {

    public void show(Player player, double xpGain, double moneyGain,
                     int combo, double comboMult,
                     MultiplierBreakdown world) {
        Component msg = Component.text("+" + Math.round(xpGain) + " XP", TextColor.color(0x9DFFB0))
                .append(Component.text("  ·  ", NamedTextColor.DARK_GRAY));
        if (moneyGain > 0) {
            msg = msg.append(Component.text("+" + String.format("%.2f", moneyGain) + "$",
                    TextColor.color(0xFFD46B)))
                .append(Component.text("  ·  ", NamedTextColor.DARK_GRAY));
        }
        if (combo > 1) {
            msg = msg.append(Component.text("⚡ Combo x" + combo,
                    TextColor.color(0x6FE9FF)))
                .append(Component.text("  ·  ", NamedTextColor.DARK_GRAY));
        }
        if (world != null && world.hasBonus()) {
            msg = msg.append(Component.text(world.summary(),
                    TextColor.color(0xFFB070)));
        }
        player.sendActionBar(msg);
    }

    public void showSimple(Player player, String text) {
        player.sendActionBar(Component.text(text, NamedTextColor.GRAY));
    }
}
