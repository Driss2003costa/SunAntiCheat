package sunanticheat.dashboard.dailyreward;

import net.milkbowl.vault.economy.Economy;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Sound;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.dashboard.crates.ItemBuilder;

import java.util.concurrent.TimeUnit;

/**
 * Listener d'\u00e9v\u00e9nements et gestionnaire de la commande /daily.
 */
public final class DailyRewardListener implements Listener, CommandExecutor {

    private final JavaPlugin plugin;
    private final DailyRewardStore store;
    private final Economy economy;

    public DailyRewardListener(JavaPlugin plugin, DailyRewardStore store, Economy economy) {
        this.plugin = plugin;
        this.store = store;
        this.economy = economy;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent e) {
        final Player p = e.getPlayer();
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (!p.isOnline()) return;
            DailyRewardConfig cfg = store.getConfig();
            if (cfg == null || !cfg.enabled) return;
            if (!store.canClaim(p.getUniqueId().toString())) return;
            try { p.sendTitle("\u00a76\u2726 Daily Reward !", "\u00a7e/daily pour r\u00e9clamer", 10, 60, 10); } catch (Throwable ignored) {}
            p.sendMessage("\u00a76[Daily] \u00a7eVotre r\u00e9compense quotidienne est disponible ! \u00a7a/daily");
        }, 60L);
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage("Joueurs uniquement.");
            return true;
        }
        Player p = (Player) sender;
        String uuid = p.getUniqueId().toString();
        DailyRewardConfig cfg = store.getConfig();
        if (cfg == null || !cfg.enabled) {
            p.sendMessage("\u00a7c\u2717 Le syst\u00e8me de r\u00e9compense quotidienne est d\u00e9sactiv\u00e9.");
            return true;
        }

        DailyRewardDay reward = store.claim(uuid, p.getName());
        if (reward == null) {
            if (!store.canClaim(uuid)) {
                DailyRewardStore.PlayerState st = store.getPlayerState(uuid);
                long remaining = 0L;
                if (st != null) {
                    long next = st.lastClaimAt + TimeUnit.HOURS.toMillis(20);
                    remaining = Math.max(0L, next - System.currentTimeMillis());
                }
                long hours = remaining / 3600000L;
                long minutes = (remaining % 3600000L) / 60000L;
                p.sendMessage("\u00a7c\u2717 D\u00e9j\u00e0 r\u00e9clam\u00e9 aujourd'hui \u2014 revenez dans "
                        + hours + "h" + minutes + "m.");
            } else {
                p.sendMessage("\u00a7c\u2717 Aucune r\u00e9compense configur\u00e9e pour aujourd'hui.");
            }
            return true;
        }

        if (reward.items != null) {
            for (DailyRewardItem di : reward.items) {
                if (di == null) continue;
                ItemStack is = ItemBuilder.build(di.material, di.customModelData, di.itemAdderId,
                        Math.max(1, di.amount), di.displayName, di.lore, di.enchantments);
                if (is != null) {
                    for (ItemStack leftover : p.getInventory().addItem(is).values()) {
                        p.getWorld().dropItemNaturally(p.getLocation(), leftover);
                    }
                }
            }
        }
        if (reward.commands != null) {
            for (String cmd : reward.commands) {
                if (cmd == null || cmd.isEmpty()) continue;
                String resolved = cmd.replace("{player}", p.getName());
                try { Bukkit.dispatchCommand(Bukkit.getConsoleSender(), resolved); }
                catch (Throwable t) { plugin.getLogger().warning("[Daily] cmd fail: " + t.getMessage()); }
            }
        }
        if (reward.bonusCoins > 0 && economy != null) {
            try { economy.depositPlayer(p, reward.bonusCoins); } catch (Throwable ignored) {}
        }

        String title = "\u00a76\u2726 " + (reward.displayName == null ? ("Jour " + reward.day)
                : ChatColor.translateAlternateColorCodes('&', reward.displayName));
        try { p.sendTitle(title, "\u00a7eJour " + reward.day, 10, 60, 10); } catch (Throwable ignored) {}
        try { p.playSound(p.getLocation(), Sound.BLOCK_NOTE_BLOCK_PLING, 1f, 1.5f); } catch (Throwable ignored) {}

        if (reward.day > 0 && reward.day % 7 == 0) {
            Bukkit.broadcastMessage(ChatColor.translateAlternateColorCodes('&',
                    "&6" + p.getName() + " &eest au &6jour " + reward.day + " &ede connexions !"));
        }
        return true;
    }
}
