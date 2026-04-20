package sunanticheat.dashboard.crates;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Color;
import org.bukkit.FireworkEffect;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.entity.Firework;
import org.bukkit.entity.Player;
import org.bukkit.inventory.meta.FireworkMeta;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Animations Bukkit d'ouverture de crate. Tout est jou\u00e9 sur le thread principal
 * via le scheduler Bukkit.
 */
public final class CrateAnimations {

    private static final Random RNG = new Random();

    private CrateAnimations() {}

    public static void play(Plugin plugin, Player player, Crate crate, CrateItem wonItem, Runnable onComplete) {
        if (plugin == null || player == null || crate == null || wonItem == null) {
            if (onComplete != null) safeRun(onComplete);
            return;
        }
        String anim = crate.animation == null ? "SIMPLE" : crate.animation.toUpperCase();
        playOpenSound(player, crate);
        switch (anim) {
            case "CSGO": playCsgo(plugin, player, crate, wonItem, onComplete); break;
            case "WHEEL": playWheel(plugin, player, crate, wonItem, onComplete); break;
            case "FADE": playFade(plugin, player, crate, wonItem, onComplete); break;
            case "SIMPLE":
            default:
                finish(plugin, player, crate, wonItem, onComplete);
                break;
        }
    }

    private static void playOpenSound(Player p, Crate c) {
        try {
            Sound s = parseSound(c.openSound, Sound.BLOCK_CHEST_OPEN);
            p.playSound(p.getLocation(), s, 1f, 1f);
        } catch (Throwable ignored) {}
    }

    private static Sound parseSound(String name, Sound fallback) {
        if (name == null || name.isEmpty()) return fallback;
        try { return Sound.valueOf(name.toUpperCase()); } catch (Throwable t) { return fallback; }
    }

    private static void playCsgo(Plugin plugin, Player player, Crate crate, CrateItem wonItem, Runnable onComplete) {
        List<CrateItem> pool = new ArrayList<>(crate.items);
        if (pool.isEmpty()) pool.add(wonItem);

        // Construit la s\u00e9quence : ~30 items al\u00e9atoires termin\u00e9s par wonItem
        List<CrateItem> seq = new ArrayList<>();
        for (int i = 0; i < 30; i++) seq.add(pool.get(RNG.nextInt(pool.size())));
        seq.add(wonItem);

        final int total = seq.size();
        final int[] idx = {0};
        final int[] delay = {1};

        new BukkitRunnable() {
            int tick = 0;
            int next = 0;
            @Override public void run() {
                if (!player.isOnline()) { cancel(); return; }
                if (idx[0] >= total) {
                    cancel();
                    finish(plugin, player, crate, wonItem, onComplete);
                    return;
                }
                if (tick >= next) {
                    CrateItem it = seq.get(idx[0]);
                    String name = it.rarity != null ? it.rarity.prefix : "";
                    name += it.displayName == null ? "Item" : it.displayName;
                    player.sendTitle(ChatColor.translateAlternateColorCodes('&', name),
                            "\u00a78\u25b6 \u25c0", 0, 10, 0);
                    try { player.playSound(player.getLocation(), Sound.UI_BUTTON_CLICK, 0.6f, 1f); } catch (Throwable ignored) {}
                    idx[0]++;
                    // Ralentit progressivement
                    delay[0] = 1 + (idx[0] / 6);
                    next = tick + delay[0];
                }
                tick++;
            }
        }.runTaskTimer(plugin, 1L, 1L);
    }

    private static void playWheel(Plugin plugin, Player player, Crate crate, CrateItem wonItem, Runnable onComplete) {
        List<CrateItem> pool = new ArrayList<>(crate.items);
        if (pool.isEmpty()) pool.add(wonItem);

        new BukkitRunnable() {
            int tick = 0;
            @Override public void run() {
                if (!player.isOnline()) { cancel(); return; }
                if (tick >= 40) {
                    cancel();
                    finish(plugin, player, crate, wonItem, onComplete);
                    return;
                }
                CrateItem it = tick == 39 ? wonItem : pool.get(RNG.nextInt(pool.size()));
                String name = (it.rarity != null ? it.rarity.prefix : "") +
                        (it.displayName == null ? "Item" : it.displayName);
                String bar = "\u00a7e\u2192 " + ChatColor.translateAlternateColorCodes('&', name) + " \u00a7e\u2190";
                player.sendTitle(" ", bar, 0, 10, 0);
                try { player.playSound(player.getLocation(), Sound.UI_BUTTON_CLICK, 0.5f, 1.2f); } catch (Throwable ignored) {}
                tick++;
            }
        }.runTaskTimer(plugin, 1L, 2L);
    }

    private static void playFade(Plugin plugin, Player player, Crate crate, CrateItem wonItem, Runnable onComplete) {
        new BukkitRunnable() {
            int tick = 0;
            @Override public void run() {
                if (!player.isOnline()) { cancel(); return; }
                if (tick >= 60) {
                    cancel();
                    finish(plugin, player, crate, wonItem, onComplete);
                    return;
                }
                if (tick < 40) {
                    player.sendTitle("\u00a78\u2026", "\u00a77R\u00e9v\u00e9lation en cours\u2026", 0, 20, 0);
                } else {
                    String name = (wonItem.rarity != null ? wonItem.rarity.prefix : "") +
                            (wonItem.displayName == null ? "Item" : wonItem.displayName);
                    player.sendTitle("\u00a76\u2726", ChatColor.translateAlternateColorCodes('&', name), 0, 20, 0);
                }
                tick++;
            }
        }.runTaskTimer(plugin, 1L, 1L);
    }

    private static void finish(Plugin plugin, Player player, Crate crate, CrateItem wonItem, Runnable onComplete) {
        String title = "\u00a76\u2726 R\u00e9compense !";
        String sub = (wonItem.rarity != null ? wonItem.rarity.prefix : "") +
                (wonItem.displayName == null ? "Item" : wonItem.displayName);
        try { player.sendTitle(title, ChatColor.translateAlternateColorCodes('&', sub), 10, 60, 10); } catch (Throwable ignored) {}
        try {
            Sound s = parseSound(crate.rewardSound, Sound.ENTITY_PLAYER_LEVELUP);
            player.playSound(player.getLocation(), s, 1f, 1f);
        } catch (Throwable ignored) {}
        if (crate.fireworkOnWin) spawnFirework(player.getLocation(), wonItem);
        if (crate.particlesEnabled) spawnParticles(player.getLocation());
        if (onComplete != null) {
            // Donne la r\u00e9compense sur le tick suivant (au cas o\u00f9)
            Bukkit.getScheduler().runTask(plugin, () -> safeRun(onComplete));
        }
    }

    private static void spawnFirework(Location loc, CrateItem wonItem) {
        if (loc == null || loc.getWorld() == null) return;
        try {
            Firework fw = loc.getWorld().spawn(loc, Firework.class);
            FireworkMeta meta = fw.getFireworkMeta();
            Color color = colorFor(wonItem);
            meta.addEffect(FireworkEffect.builder()
                    .with(FireworkEffect.Type.BALL_LARGE)
                    .withColor(color)
                    .withFade(Color.WHITE)
                    .withTrail()
                    .withFlicker()
                    .build());
            meta.setPower(1);
            fw.setFireworkMeta(meta);
        } catch (Throwable ignored) {}
    }

    private static Color colorFor(CrateItem it) {
        if (it == null || it.rarity == null) return Color.WHITE;
        switch (it.rarity) {
            case COMMON: return Color.SILVER;
            case UNCOMMON: return Color.GREEN;
            case RARE: return Color.BLUE;
            case EPIC: return Color.PURPLE;
            case LEGENDARY: return Color.ORANGE;
            case MYTHIC: return Color.RED;
            default: return Color.WHITE;
        }
    }

    private static void spawnParticles(Location loc) {
        if (loc == null || loc.getWorld() == null) return;
        try {
            loc.getWorld().spawnParticle(Particle.HAPPY_VILLAGER, loc.clone().add(0, 1, 0), 30, 0.5, 0.5, 0.5);
        } catch (Throwable ignored) {
            try { loc.getWorld().spawnParticle(Particle.valueOf("VILLAGER_HAPPY"), loc.clone().add(0, 1, 0), 30, 0.5, 0.5, 0.5); } catch (Throwable ignored2) {}
        }
    }

    private static void safeRun(Runnable r) {
        try { r.run(); } catch (Throwable ignored) {}
    }
}
