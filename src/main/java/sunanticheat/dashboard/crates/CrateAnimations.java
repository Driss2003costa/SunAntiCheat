package sunanticheat.dashboard.crates;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Color;
import org.bukkit.FireworkEffect;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.entity.Firework;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.FireworkMeta;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

/**
 * Animations Bukkit d'ouverture de crate. Tout est joué sur le thread principal
 * via le scheduler Bukkit.
 *
 * 4 styles disponibles (configuré via crate.animation) :
 *   - "CSGO"     : style case CS:GO — items défilent dans une row centrale
 *                  d'un coffre 27 slots, ralentit, s'arrête sur le won item
 *                  avec marqueur or au-dessus.
 *   - "ROULETTE" : roulette circulaire — items défilent autour du périmètre.
 *   - "MYSTERY"  : révélation mystère — item caché qui pulse, puis révélé.
 *   - "SIMPLE"   : aucune animation, donne directement.
 *
 * Tous utilisent un vrai inventaire Bukkit avec marker {@link CrateAnimationHolder}
 * pour bloquer les interactions du joueur (clic/drag).
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

        // Ferme tout inventaire ouvert pour éviter les conflits
        try { player.closeInventory(); } catch (Throwable ignored) {}

        playOpenSound(player, crate);

        switch (anim) {
            case "CSGO":
            case "WHEEL":     // alias historique
                playCsgoChest(plugin, player, crate, wonItem, onComplete);
                break;
            case "ROULETTE":
                playRoulette(plugin, player, crate, wonItem, onComplete);
                break;
            case "MYSTERY":
            case "FADE":      // alias historique
                playMystery(plugin, player, crate, wonItem, onComplete);
                break;
            case "SIMPLE":
            default:
                finish(plugin, player, crate, wonItem, onComplete);
                break;
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  CSGO — case opening style (la référence)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Spinner de coffre 27 slots :
     * - Slot 4 (top center)    : flèche or pointant vers le bas
     * - Slot 22 (bottom center): flèche or pointant vers le haut
     * - Slots 9-17 (row centre): items qui défilent vers la gauche
     * - Slot 13 (centre du centre) : c'est là que le won item s'arrête
     *
     * Easing : démarre rapide (1 tick/shift), ralentit jusqu'à 10 ticks/shift.
     * Total : ~80 ticks (4 secondes) avec ~32 shifts.
     * Sons : pitch dégressif (2.0 → 0.5) sur chaque tick.
     * Fin : flash vert sur les bordures, particules, firework, wonItem reste.
     */
    private static void playCsgoChest(Plugin plugin, Player player, Crate crate,
                                       CrateItem wonItem, Runnable onComplete) {
        List<CrateItem> pool = new ArrayList<>(crate.items);
        if (pool.isEmpty()) pool.add(wonItem);

        String title = "§8» §6Crate §8« §7Bonne chance !";
        if (title.length() > 32) title = title.substring(0, 32);

        CrateAnimationHolder holder = new CrateAnimationHolder(crate.id, player.getName());
        Inventory inv = Bukkit.createInventory(holder, 27, title);
        holder.setInventory(inv);

        // Bordures top + bottom : marqueur or
        ItemStack pointerDown = makeArrow(Material.YELLOW_STAINED_GLASS_PANE, "§e§l▼", "§7Item gagné");
        ItemStack pointerUp   = makeArrow(Material.YELLOW_STAINED_GLASS_PANE, "§e§l▲", "§7Item gagné");
        ItemStack borderFiller = makeArrow(Material.GRAY_STAINED_GLASS_PANE, "§r", "");

        for (int i = 0; i < 9; i++) inv.setItem(i, i == 4 ? pointerDown : borderFiller);
        for (int i = 18; i < 27; i++) inv.setItem(i, i == 22 ? pointerUp : borderFiller);

        // Pré-remplit la row centrale avec items aléatoires
        for (int i = 9; i < 18; i++) {
            inv.setItem(i, ItemBuilder.build(
                    pool.get(RNG.nextInt(pool.size())).material,
                    0, null, 1, null, null, null));
        }

        player.openInventory(inv);

        // Total shifts pour atteindre le bout. Le won item sera injecté
        // 4 shifts avant la fin (pour finir au slot 13 = centre).
        final int totalShifts = 32;
        final int wonItemInjectAt = totalShifts - 4;

        new BukkitRunnable() {
            int shifts = 0;
            int tickCounter = 0;
            int delay = 1;       // ticks entre 2 shifts (croît avec le temps)

            @Override
            public void run() {
                if (!player.isOnline() || holder.closing) {
                    cancel();
                    if (onComplete != null) safeRun(onComplete);
                    return;
                }

                if (shifts >= totalShifts) {
                    // Animation terminée — flash final + fin
                    cancel();
                    finalFlash(plugin, player, inv, holder, crate, wonItem, onComplete);
                    return;
                }

                if (tickCounter >= delay) {
                    tickCounter = 0;

                    // Décale tous les items de la row centrale vers la gauche
                    for (int s = 9; s < 17; s++) {
                        inv.setItem(s, inv.getItem(s + 1));
                    }
                    // Insère un nouvel item au slot 17 (le won item à un moment précis)
                    CrateItem next;
                    if (shifts == wonItemInjectAt) {
                        next = wonItem;
                    } else {
                        next = pool.get(RNG.nextInt(pool.size()));
                    }
                    inv.setItem(17, ItemBuilder.build(
                            next.material, 0, null, 1, null, null, null));

                    // Son tick — pitch dégressif (2.0 → 0.5)
                    float progress = (float) shifts / totalShifts;
                    float pitch = Math.max(0.5f, 2.0f - progress * 1.5f);
                    try {
                        player.playSound(player.getLocation(),
                                Sound.UI_BUTTON_CLICK, 0.4f, pitch);
                    } catch (Throwable ignored) {}

                    shifts++;

                    // Easing : delay augmente progressivement
                    // 0-15 shifts: delay 1 (rapide)
                    // 16-25 shifts: delay 2-4 (ralentit)
                    // 26-32 shifts: delay 5-10 (très lent, suspense)
                    if (shifts < 16) delay = 1;
                    else if (shifts < 22) delay = 2;
                    else if (shifts < 26) delay = 4;
                    else if (shifts < 30) delay = 7;
                    else delay = 10;
                }

                tickCounter++;
            }
        }.runTaskTimer(plugin, 1L, 1L);
    }

    /**
     * Effet final : les bordures clignotent vert, le won item est mis en valeur,
     * fireworks à la position du joueur, puis fermeture après 60 ticks.
     */
    private static void finalFlash(Plugin plugin, Player player, Inventory inv,
                                    CrateAnimationHolder holder, Crate crate,
                                    CrateItem wonItem, Runnable onComplete) {
        // Met le won item en valeur dans le slot 13 avec un meta amélioré
        ItemStack winShowcase = ItemBuilder.build(
                wonItem.material,
                wonItem.customModelData,
                wonItem.itemAdderId,
                1,
                wonItem.displayName != null ? wonItem.displayName
                        : (wonItem.rarity != null ? wonItem.rarity.prefix : "") + wonItem.material,
                buildShowcaseLore(wonItem),
                wonItem.enchantments);
        if (winShowcase == null) winShowcase = ItemBuilder.build(wonItem.material, 0, null, 1, null, null, null);
        inv.setItem(13, winShowcase);

        // Son final : level up
        try {
            Sound s = parseSound(crate.rewardSound, Sound.ENTITY_PLAYER_LEVELUP);
            player.playSound(player.getLocation(), s, 1.0f, 1.0f);
        } catch (Throwable ignored) {}

        // Title de victoire
        try {
            String t = "§6§l✦ Récompense ! ✦";
            String sub = (wonItem.rarity != null ? wonItem.rarity.prefix : "§e") +
                    (wonItem.displayName == null ? wonItem.material : wonItem.displayName);
            player.sendTitle(t,
                    ChatColor.translateAlternateColorCodes('&', sub),
                    5, 70, 20);
        } catch (Throwable ignored) {}

        // Effets feu d'artifice + particules
        if (crate.fireworkOnWin) spawnFirework(player.getLocation(), wonItem);
        if (crate.particlesEnabled) spawnCelebrationParticles(player.getLocation(), wonItem);

        // Clignotement vert/jaune des bordures pendant 60 ticks
        ItemStack greenPane = makeArrow(Material.LIME_STAINED_GLASS_PANE, "§a✓", "");
        ItemStack yellowPane = makeArrow(Material.YELLOW_STAINED_GLASS_PANE, "§e✦", "");
        new BukkitRunnable() {
            int t = 0;
            @Override
            public void run() {
                if (!player.isOnline() || holder.closing || t >= 30) {
                    cancel();
                    holder.finished = true;
                    // Donne la récompense via callback
                    if (onComplete != null) safeRun(onComplete);
                    // Ferme l'inventaire après un petit délai
                    Bukkit.getScheduler().runTaskLater(plugin, () -> {
                        if (player.isOnline() && !holder.closing) {
                            holder.closing = true;
                            try { player.closeInventory(); } catch (Throwable ignored) {}
                        }
                    }, 30L);
                    return;
                }
                ItemStack pane = (t % 2 == 0) ? greenPane : yellowPane;
                for (int i = 0; i < 9; i++) if (i != 4) inv.setItem(i, pane);
                for (int i = 18; i < 27; i++) if (i != 22) inv.setItem(i, pane);
                t++;
            }
        }.runTaskTimer(plugin, 0L, 4L);
    }

    private static List<String> buildShowcaseLore(CrateItem wonItem) {
        List<String> lore = new ArrayList<>();
        if (wonItem.rarity != null) {
            lore.add("§7Rareté : " + wonItem.rarity.prefix + wonItem.rarity.displayName);
        }
        if (wonItem.lore != null && !wonItem.lore.isEmpty()) {
            lore.add("");
            lore.addAll(wonItem.lore);
        }
        lore.add("");
        lore.add("§a§l✓ Gagné !");
        return lore;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  ROULETTE — circle around the perimeter
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Roulette circulaire dans un coffre 27 slots :
     * - Items défilent autour du périmètre du coffre dans le sens horaire
     * - Le centre (slot 13) reste figé, dévoile le won item progressivement
     * - Les particules entourent le slot du won item à la fin
     */
    private static void playRoulette(Plugin plugin, Player player, Crate crate,
                                      CrateItem wonItem, Runnable onComplete) {
        List<CrateItem> pool = new ArrayList<>(crate.items);
        if (pool.isEmpty()) pool.add(wonItem);

        CrateAnimationHolder holder = new CrateAnimationHolder(crate.id, player.getName());
        Inventory inv = Bukkit.createInventory(holder, 27, "§8» §dRoulette §8«");
        holder.setInventory(inv);

        // Slots du périmètre dans l'ordre horaire (top, right, bottom, left)
        final int[] perim = {0,1,2,3,4,5,6,7,8, 17, 26,25,24,23,22,21,20,19,18, 9};
        // Inner cells : tout sauf 13 et perim
        final int center = 13;
        for (int i = 0; i < 27; i++) {
            if (i == center) {
                inv.setItem(i, makeArrow(Material.MAGENTA_STAINED_GLASS_PANE, "§5§l?", "§7Mystère…"));
            } else if (!isInArray(perim, i)) {
                inv.setItem(i, makeArrow(Material.LIGHT_GRAY_STAINED_GLASS_PANE, "§r", ""));
            }
        }

        // Pré-remplit le périmètre avec items random
        for (int slot : perim) {
            inv.setItem(slot, ItemBuilder.build(
                    pool.get(RNG.nextInt(pool.size())).material, 0, null, 1, null, null, null));
        }

        player.openInventory(inv);

        new BukkitRunnable() {
            int t = 0;
            int delay = 1;
            int ticker = 0;
            int rotationOffset = 0;

            @Override
            public void run() {
                if (!player.isOnline() || holder.closing) {
                    cancel(); if (onComplete != null) safeRun(onComplete); return;
                }
                if (t >= 60) {
                    cancel();
                    // Reveal final
                    inv.setItem(center, ItemBuilder.build(
                            wonItem.material, wonItem.customModelData, wonItem.itemAdderId, 1,
                            wonItem.displayName, buildShowcaseLore(wonItem), wonItem.enchantments));
                    finalFlash(plugin, player, inv, holder, crate, wonItem, onComplete);
                    return;
                }
                if (ticker >= delay) {
                    ticker = 0;
                    rotationOffset++;
                    // Rotate les items autour du périmètre
                    ItemStack[] currents = new ItemStack[perim.length];
                    for (int i = 0; i < perim.length; i++) currents[i] = inv.getItem(perim[i]);
                    for (int i = 0; i < perim.length; i++) {
                        int newIdx = (i + 1) % perim.length;
                        inv.setItem(perim[newIdx], currents[i]);
                    }
                    // Replace 1 item au hasard pour de la variété
                    if (t % 5 == 0) {
                        int rand = perim[RNG.nextInt(perim.length)];
                        inv.setItem(rand, ItemBuilder.build(
                                pool.get(RNG.nextInt(pool.size())).material, 0, null, 1, null, null, null));
                    }
                    try {
                        float pitch = Math.max(0.5f, 2.0f - (t / 30f));
                        player.playSound(player.getLocation(), Sound.BLOCK_NOTE_BLOCK_HAT, 0.5f, pitch);
                    } catch (Throwable ignored) {}
                    t++;
                    if (t < 30) delay = 1;
                    else if (t < 45) delay = 2;
                    else delay = 4;
                }
                ticker++;
            }
        }.runTaskTimer(plugin, 1L, 1L);
    }

    private static boolean isInArray(int[] arr, int v) {
        for (int x : arr) if (x == v) return true;
        return false;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  MYSTERY — slow reveal with anticipation
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Mystery box : un seul item au centre qui pulse entre différentes raretés
     * (dégradé visuel) avec des panes qui flashent autour.
     * À ~3 secondes, révélation : le won item apparaît avec firework.
     */
    private static void playMystery(Plugin plugin, Player player, Crate crate,
                                     CrateItem wonItem, Runnable onComplete) {
        CrateAnimationHolder holder = new CrateAnimationHolder(crate.id, player.getName());
        Inventory inv = Bukkit.createInventory(holder, 27, "§8» §5§lMystère §8«");
        holder.setInventory(inv);

        Material[] glassCycle = {
                Material.PURPLE_STAINED_GLASS_PANE,
                Material.MAGENTA_STAINED_GLASS_PANE,
                Material.PINK_STAINED_GLASS_PANE,
                Material.RED_STAINED_GLASS_PANE,
                Material.ORANGE_STAINED_GLASS_PANE,
                Material.YELLOW_STAINED_GLASS_PANE,
        };
        Material[] mysteryItems = {
                Material.NETHER_STAR, Material.ENDER_EYE, Material.ENDER_PEARL,
                Material.HEART_OF_THE_SEA, Material.GHAST_TEAR, Material.DRAGON_BREATH,
        };

        // Centre bordé d'un cadre 3x3
        int[] frame = {12, 13, 14, 21, 22, 23, 4, 11, 15};
        for (int i = 0; i < 27; i++) {
            if (!isInArray(frame, i) && i != 13) {
                inv.setItem(i, makeArrow(Material.BLACK_STAINED_GLASS_PANE, "§r", ""));
            }
        }

        player.openInventory(inv);

        new BukkitRunnable() {
            int t = 0;
            @Override
            public void run() {
                if (!player.isOnline() || holder.closing) {
                    cancel(); if (onComplete != null) safeRun(onComplete); return;
                }
                if (t >= 60) {
                    // Reveal
                    cancel();
                    inv.setItem(13, ItemBuilder.build(
                            wonItem.material, wonItem.customModelData, wonItem.itemAdderId, 1,
                            wonItem.displayName, buildShowcaseLore(wonItem), wonItem.enchantments));
                    finalFlash(plugin, player, inv, holder, crate, wonItem, onComplete);
                    return;
                }
                // Pulse des glass panes du frame
                Material g = glassCycle[t % glassCycle.length];
                ItemStack pane = makeArrow(g, "§d§l?", "§7Mystère…");
                for (int slot : frame) {
                    if (slot != 13) inv.setItem(slot, pane);
                }
                // Item mystère qui change toutes les 5 ticks
                if (t % 5 == 0) {
                    Material m = mysteryItems[(t / 5) % mysteryItems.length];
                    inv.setItem(13, makeArrow(m, "§d§l?", "§7…"));
                }
                try {
                    float pitch = 0.5f + (t / 60f) * 1.5f;  // 0.5 → 2.0
                    player.playSound(player.getLocation(), Sound.BLOCK_NOTE_BLOCK_BELL, 0.4f, pitch);
                } catch (Throwable ignored) {}
                t++;
            }
        }.runTaskTimer(plugin, 1L, 2L);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Helpers
    // ════════════════════════════════════════════════════════════════════════

    private static ItemStack makeArrow(Material mat, String name, String lore) {
        ItemStack is = new ItemStack(mat);
        ItemMeta meta = is.getItemMeta();
        if (meta != null) {
            meta.setDisplayName(name);
            if (lore != null && !lore.isEmpty()) {
                meta.setLore(Arrays.asList(lore));
            }
            is.setItemMeta(meta);
        }
        return is;
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

    private static void finish(Plugin plugin, Player player, Crate crate, CrateItem wonItem, Runnable onComplete) {
        String title = "§6✦ Récompense !";
        String sub = (wonItem.rarity != null ? wonItem.rarity.prefix : "") +
                (wonItem.displayName == null ? "Item" : wonItem.displayName);
        try { player.sendTitle(title, ChatColor.translateAlternateColorCodes('&', sub), 10, 60, 10); } catch (Throwable ignored) {}
        try {
            Sound s = parseSound(crate.rewardSound, Sound.ENTITY_PLAYER_LEVELUP);
            player.playSound(player.getLocation(), s, 1f, 1f);
        } catch (Throwable ignored) {}
        if (crate.fireworkOnWin) spawnFirework(player.getLocation(), wonItem);
        if (crate.particlesEnabled) spawnCelebrationParticles(player.getLocation(), wonItem);
        if (onComplete != null) {
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

    private static void spawnCelebrationParticles(Location loc, CrateItem wonItem) {
        if (loc == null || loc.getWorld() == null) return;
        Location around = loc.clone().add(0, 1, 0);
        try {
            // Particules autour du joueur
            loc.getWorld().spawnParticle(Particle.HAPPY_VILLAGER, around, 30, 0.5, 0.5, 0.5);
            // Cercle de particules selon la rareté
            Particle ringParticle = particleForRarity(wonItem);
            for (int i = 0; i < 360; i += 20) {
                double rad = Math.toRadians(i);
                double x = Math.cos(rad) * 1.5;
                double z = Math.sin(rad) * 1.5;
                loc.getWorld().spawnParticle(ringParticle,
                        around.clone().add(x, 0, z), 1, 0, 0, 0, 0);
            }
        } catch (Throwable ignored) {
            // Fallback noms anciens
            try {
                loc.getWorld().spawnParticle(Particle.valueOf("VILLAGER_HAPPY"), around, 30, 0.5, 0.5, 0.5);
            } catch (Throwable ignored2) {}
        }
    }

    private static Particle particleForRarity(CrateItem it) {
        if (it == null || it.rarity == null) return Particle.HAPPY_VILLAGER;
        try {
            switch (it.rarity) {
                case LEGENDARY:
                case MYTHIC:
                    return Particle.valueOf("FLAME");
                case EPIC:
                    return Particle.valueOf("DRAGON_BREATH");
                case RARE:
                    return Particle.valueOf("ENCHANT");
                case UNCOMMON:
                    return Particle.HAPPY_VILLAGER;
                default:
                    return Particle.HAPPY_VILLAGER;
            }
        } catch (Throwable t) {
            return Particle.HAPPY_VILLAGER;
        }
    }

    private static void safeRun(Runnable r) {
        try { r.run(); } catch (Throwable ignored) {}
    }
}
