package sunanticheat.dashboard.alts;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerLoginEvent;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.Permissions;
import sunanticheat.dashboard.sanctions.SanctionStore;
import sunanticheat.dashboard.sanctions.SanctionType;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Enregistre chaque connexion dans AltAccountStore et alerte le staff si l'IP
 * est partagée avec un compte actuellement banni.
 */
public final class AltConnectionListener implements Listener {

    private final JavaPlugin plugin;
    private final AltAccountStore altStore;
    private final SanctionStore sanctionStore;
    private final Map<String, Long> lastAlertByIp = new ConcurrentHashMap<>();
    private static final long ALERT_COOLDOWN_MS = 5 * 60_000L;
    /** Consumer optionnel pour le système de points de violation. args = [checkType, uuid, name]. */
    private volatile Consumer<String[]> violationConsumer;

    public AltConnectionListener(JavaPlugin plugin, AltAccountStore altStore,
                                  SanctionStore sanctionStore, Consumer<String[]> violationConsumer) {
        this.plugin = plugin;
        this.altStore = altStore;
        this.sanctionStore = sanctionStore;
        this.violationConsumer = violationConsumer;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onLogin(PlayerLoginEvent event) {
        Player player = event.getPlayer();
        String uuid  = player.getUniqueId().toString();
        String name  = player.getName();
        String ip    = event.getAddress().getHostAddress();

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            altStore.upsert(ip, uuid, name);
            checkBannedAlts(player, ip, uuid, name);
        });
    }

    private void checkBannedAlts(Player player, String ip, String uuid, String name) {
        List<AltAccountStore.AltEntry> others = altStore.getAccountsForIp(ip, uuid);
        if (others.isEmpty()) return;

        List<String> bannedAlts = new ArrayList<>();
        for (AltAccountStore.AltEntry alt : others) {
            if (sanctionStore.activeSanction(alt.uuid(), null, null, SanctionType.BAN) != null) {
                bannedAlts.add(alt.name());
            }
        }
        if (bannedAlts.isEmpty()) return;

        long now = System.currentTimeMillis();
        if (now - lastAlertByIp.getOrDefault(ip, 0L) < ALERT_COOLDOWN_MS) return;
        lastAlertByIp.put(ip, now);

        String altsStr = String.join(", ", bannedAlts);
        Component msg = Component.text("[SunGuard] ")
                .color(NamedTextColor.DARK_GRAY)
                .append(Component.text("Alt-ban suspect: ").color(NamedTextColor.RED))
                .append(Component.text(name).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD))
                .append(Component.text(" — IP partagée avec : ").color(NamedTextColor.GRAY))
                .append(Component.text(altsStr).color(NamedTextColor.RED).decorate(TextDecoration.BOLD))
                .append(Component.text(" [Profil]").color(NamedTextColor.YELLOW).decorate(TextDecoration.BOLD)
                        .clickEvent(ClickEvent.runCommand("/sunguard sanction " + name)));

        Bukkit.getScheduler().runTask(plugin, () -> {
            for (Player p : Bukkit.getOnlinePlayers()) {
                if (p.hasPermission(Permissions.ALERTS)) p.sendMessage(msg);
            }
        });
        if (violationConsumer != null) {
            violationConsumer.accept(new String[]{ "alt-ban", uuid, name });
        }
    }
}
