package sunanticheat.dashboard.chat;

import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.function.Consumer;

public final class ToxicChatListener implements Listener {

    private final ToxicChatStore store;
    private final JavaPlugin plugin;
    private final Consumer<java.util.Map<String, Object>> alertSink;

    public ToxicChatListener(JavaPlugin plugin, ToxicChatStore store, Consumer<java.util.Map<String, Object>> alertSink) {
        this.plugin = plugin;
        this.store = store;
        this.alertSink = alertSink;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncChatEvent e) {
        Player p = e.getPlayer();
        String message = PlainTextComponentSerializer.plainText().serialize(e.message());
        ToxicChatStore.Result r = store.analyze(p.getName(), p.getUniqueId().toString(), message);
        if (r.level() == 0) return;

        Bukkit.getScheduler().runTask(plugin, () -> {
            if (r.level() == 1) {
                p.sendMessage(Component.text("⚠ Merci de rester respectueux.", NamedTextColor.YELLOW));
            } else if (r.level() == 2) {
                p.sendMessage(Component.text("⚠ Vous êtes muté 5 min pour propos toxiques répétés.", NamedTextColor.RED));
                Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "mute " + p.getName() + " 5m propos toxiques auto");
            } else if (r.level() >= 3) {
                Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "kick " + p.getName() + " propos toxiques répétés");
            }
            if (alertSink != null) {
                alertSink.accept(java.util.Map.of(
                        "type", "TOXIC_CHAT",
                        "player", p.getName(),
                        "world", p.getWorld().getName(),
                        "detail", "level=" + r.level() + " score=" + r.totalScore() + " matched=" + r.matched()
                ));
            }
        });
    }
}
