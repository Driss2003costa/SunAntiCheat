package sunanticheat.dashboard.honeypot;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Map;
import java.util.function.Consumer;

/**
 * Détecte quand un joueur casse un bloc honeypot.
 *
 * Mesure le nombre de faces solides adjacentes au moment du cassage :
 *   6 → impossible à atteindre sans phasing/reach hack — certitude absolue
 *   5 → 1 seul bloc creusé directement sur l'ore   — quasi-certitude X-Ray
 *   4 → 2 blocs creusés en ligne droite             — très suspect
 *   ≤3 → chemin plus large, pourrait être strip mine — alerte seule
 *
 * La commande console (run-command) n'est exécutée que si solidFaces ≥ minSolidFacesForAction.
 */
public final class HoneypotListener implements Listener {

    private final HoneypotStore store;
    private final Consumer<Map<String, Object>> alertSink;
    private final JavaPlugin plugin;
    private final Consumer<String[]> vpConsumer;

    private final boolean suppressDrops;
    private final int minSolidFacesForAction;
    private final String runCommand;

    public HoneypotListener(HoneypotStore store,
                             Consumer<Map<String, Object>> alertSink,
                             JavaPlugin plugin,
                             Consumer<String[]> vpConsumer) {
        this.store      = store;
        this.alertSink  = alertSink;
        this.plugin     = plugin;
        this.vpConsumer = vpConsumer;

        var cfg = plugin.getConfig();
        this.suppressDrops         = cfg.getBoolean("honeypot.actions.suppress-drops", false);
        this.minSolidFacesForAction = cfg.getInt("honeypot.actions.min-solid-faces-for-action", 5);
        this.runCommand             = cfg.getString("honeypot.actions.run-command", "");
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) {
        Block b = e.getBlock();
        HoneypotTrap trap = store.findByBlock(b.getWorld().getName(), b.getX(), b.getY(), b.getZ());
        if (trap == null) return;

        Player p = e.getPlayer();
        if (p.isOp()) return;
        if (p.hasPermission("sunguard.bypass.xray")) return;

        // Compter les faces solides AVANT que le bloc ne soit retiré
        int solidFaces = HoneypotAutoPlanter.countSolidFaces(b);

        if (suppressDrops) e.setDropItems(false);

        store.recordTrigger(trap, p.getName(), p.getUniqueId().toString(), solidFaces);

        // Label de confiance
        String confidence = solidFaces >= 6 ? "CERTAIN"
                          : solidFaces >= 5 ? "QUASI-CERTAIN"
                          : solidFaces >= 4 ? "TRÈS SUSPECT"
                          : "SUSPECT";

        // Broadcast staff
        Component msg = Component.text("[Honeypot] ", NamedTextColor.DARK_GRAY)
                .append(Component.text("X-RAY ", NamedTextColor.RED).decorate(TextDecoration.BOLD))
                .append(Component.text(confidence + " · ", NamedTextColor.GOLD))
                .append(Component.text(p.getName(), NamedTextColor.YELLOW).decorate(TextDecoration.BOLD))
                .append(Component.text(" a cassé " + trap.getLabel()
                        + " [" + solidFaces + "/6 faces solides]"
                        + " @ " + trap.getX() + "," + trap.getY() + "," + trap.getZ()
                        + " (" + trap.getWorld() + ")", NamedTextColor.GRAY));

        for (Player online : Bukkit.getOnlinePlayers()) {
            if (online.hasPermission("sunguard.alerts")) online.sendMessage(msg);
        }

        // WebSocket / AlertStore
        if (alertSink != null) {
            alertSink.accept(Map.of(
                    "type",       "HONEYPOT",
                    "player",     p.getName(),
                    "world",      trap.getWorld(),
                    "detail",     trap.getLabel() + " [" + solidFaces + "/6] @ "
                                  + trap.getX() + "," + trap.getY() + "," + trap.getZ()
            ));
        }

        // Points de violation
        if (vpConsumer != null) {
            vpConsumer.accept(new String[]{"honeypot", p.getUniqueId().toString(), p.getName()});
        }

        // Commande console (uniquement si confiance suffisante)
        if (!runCommand.isBlank() && solidFaces >= minSolidFacesForAction) {
            String cmd = runCommand.replace("%player%", p.getName());
            Bukkit.getScheduler().runTask(plugin, () ->
                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd));
        }
    }
}
