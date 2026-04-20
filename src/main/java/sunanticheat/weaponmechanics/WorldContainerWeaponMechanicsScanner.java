package sunanticheat.weaponmechanics;

import org.bukkit.Bukkit;
import org.bukkit.Chunk;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.BlockState;
import org.bukkit.block.Container;
import org.bukkit.block.Block;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Entity;
import org.bukkit.entity.ItemFrame;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.BlockStateMeta;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;
import sunanticheat.SunAntiCheat;
import sunanticheat.blocklog.BlockLogEntry;
import sunanticheat.blocklog.BlockLogStore;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Scan des conteneurs chargés dans un ensemble de mondes pour retirer les items WeaponMechanics.
 * Couvre : blocs conteneurs, pots décorés, entités à inventaire (minecarts, bateaux), ItemFrames,
 * shulkers imbriqués, inventaires joueur (main + armor + offhand), enderchests et DeepPockets Inventorio.
 */
public final class WorldContainerWeaponMechanicsScanner {

    private final JavaPlugin plugin;
    private BukkitTask runningTask;

    /** Résultat du dernier scan — lisible depuis n'importe quel thread. */
    private volatile ScanResult lastResult = null;

    public ScanResult getLastResult() { return lastResult; }

    public WorldContainerWeaponMechanicsScanner(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public boolean isRunning() {
        return runningTask != null;
    }

    public void stop() {
        if (runningTask != null) {
            runningTask.cancel();
            runningTask = null;
        }
    }

    public boolean startScan(CommandSender sender, Collection<World> worlds) {
        if (isRunning()) {
            sender.sendMessage("§cUn scan de conteneurs est déjà en cours.");
            return false;
        }
        if (worlds == null || worlds.isEmpty()) {
            sender.sendMessage("§cAucun monde valide à scanner.");
            return false;
        }

        ScanContext ctx = new ScanContext(sender, worlds);
        sender.sendMessage("§eScan WM démarré sur §f" + ctx.worldNames
                + "§e (blocs, entités, ItemFrames, pots, inventaires joueurs).");

        this.runningTask = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            try {
                runStep(ctx);
            } catch (Throwable t) {
                plugin.getLogger().warning("[WM chestscan] Erreur: " + t.getMessage());
                ctx.sender.sendMessage("§cScan interrompu suite à une erreur. Voir console.");
                finish(ctx);
            }
        }, 1L, 1L);
        return true;
    }

    private void runStep(ScanContext ctx) {
        int maxChunksPerTick = 2;
        int processedNow = 0;

        while (processedNow < maxChunksPerTick && !ctx.chunksToProcess.isEmpty()) {
            Chunk chunk = ctx.chunksToProcess.pollFirst();
            processedNow++;
            if (chunk == null || !chunk.isLoaded()) continue;
            ctx.chunksScanned++;
            scanChunkContainers(chunk, ctx);
            scanChunkEntities(chunk, ctx);
        }

        if (!ctx.playersDone && ctx.chunksToProcess.isEmpty()) {
            scanOnlinePlayers(ctx);
            ctx.playersDone = true;
        }

        if (ctx.chunksToProcess.isEmpty() && ctx.playersDone) {
            finish(ctx);
        }
    }

    // -------------------------------------------------------------------------
    // Bloc : conteneurs TileEntity + pots décorés
    // -------------------------------------------------------------------------

    private void scanChunkContainers(Chunk chunk, ScanContext ctx) {
        for (BlockState state : chunk.getTileEntities()) {
            Inventory inv = null;
            boolean allowNestedShulkers = true;

            if (state instanceof Container container) {
                inv = container.getInventory();
            } else {
                // DecoratedPot : implémente Container en Paper 1.20.2+ ; sinon accès via réflexion
                inv = tryGetDecoratedPotInventory(state);
                allowNestedShulkers = false; // les pots ne contiennent qu'un seul slot
            }

            if (inv == null) continue;

            ctx.containersScanned++;
            int removed = scanInventoryAndRemoveWeapons(inv, allowNestedShulkers);
            if (removed <= 0) continue;

            ctx.weaponItemsRemoved += removed;
            ctx.containersWithDetections++;

            try {
                state.update(true, false);
            } catch (Throwable ignored) {}

            String location = chunk.getWorld().getName() + " "
                    + state.getX() + "," + state.getY() + "," + state.getZ();

            SuspectInfo suspectInfo = findLastInteractor(state);
            if (suspectInfo != null && suspectInfo.playerName != null && !suspectInfo.playerName.isBlank()) {
                ctx.suspectHitsByName.merge(suspectInfo.playerName, 1, Integer::sum);
            }
            String suspectText = suspectInfo != null
                    ? " | suspect=" + suspectInfo.playerName + " (" + formatAge(suspectInfo.eventAgeMs) + ")"
                    : " | suspect=inconnu";

            plugin.getLogger().info("[WM chestscan] " + removed + " item(s) WM supprimé(s) dans conteneur " + location + suspectText);
            ctx.sender.sendMessage("§6[WM] §f" + removed + " item(s) supprimé(s) dans §e" + location
                    + " §7| suspect: §f" + (suspectInfo != null ? suspectInfo.playerName : "inconnu"));
            ctx.sender.sendMessage("§7Copier: §f/tp @s " + state.getX() + " " + state.getY() + " " + state.getZ()
                    + " §7(monde §f" + chunk.getWorld().getName() + "§7)");
            ctx.tpDetails.add(new TpDetail(
                    chunk.getWorld().getName(),
                    state.getX(), state.getY(), state.getZ(),
                    removed,
                    suspectInfo != null ? suspectInfo.playerName : "inconnu",
                    false, null));
        }
    }

    /** Tente d'accéder à l'inventaire d'un DecoratedPot, quelle que soit la version de l'API. */
    private static Inventory tryGetDecoratedPotInventory(BlockState state) {
        // Vérifie d'abord le nom de la classe pour éviter un cast coûteux sur chaque TileEntity
        if (!state.getClass().getSimpleName().contains("DecoratedPot")
                && !(state instanceof org.bukkit.block.DecoratedPot)) {
            return null;
        }
        try {
            // Paper 1.20.2+ : DecoratedPot implémente Container, donc getInventory() existe
            return (Inventory) state.getClass().getMethod("getInventory").invoke(state);
        } catch (Throwable ignored) {
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Entités : minecarts, bateaux à coffre, ItemFrames / GlowItemFrames
    // -------------------------------------------------------------------------

    private void scanChunkEntities(Chunk chunk, ScanContext ctx) {
        for (Entity entity : chunk.getEntities()) {
            if (entity instanceof Player) continue; // joueurs traités séparément

            // InventoryHolder couvre : StorageMinecart, HopperMinecart, ChestBoat, etc.
            if (entity instanceof InventoryHolder holder) {
                ctx.entityContainersScanned++;
                Inventory inv = holder.getInventory();
                int removed = scanInventoryAndRemoveWeapons(inv, true);
                if (removed > 0) {
                    ctx.weaponItemsRemoved += removed;
                    ctx.containersWithDetections++;
                    logEntityDetection(entity, removed, "entité " + entity.getType().name(), ctx);
                }
                continue;
            }

            // ItemFrame et GlowItemFrame
            if (entity instanceof ItemFrame frame) {
                ctx.itemFramesScanned++;
                ItemStack displayed = frame.getItem();
                if (displayed != null && !displayed.getType().isAir()
                        && WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(displayed)) {
                    frame.setItem(new ItemStack(Material.AIR));
                    ctx.weaponItemsRemoved++;
                    ctx.containersWithDetections++;
                    logEntityDetection(entity, 1, "ItemFrame/" + entity.getType().name(), ctx);
                }
            }
        }
    }

    private void logEntityDetection(Entity entity, int removed, String label, ScanContext ctx) {
        Location loc = entity.getLocation();
        String world = loc.getWorld() != null ? loc.getWorld().getName() : "?";
        int bx = loc.getBlockX(), by = loc.getBlockY(), bz = loc.getBlockZ();
        String location = world + " " + bx + "," + by + "," + bz;

        plugin.getLogger().info("[WM chestscan] " + removed + " item(s) WM supprimé(s) dans " + label + " @ " + location);
        ctx.sender.sendMessage("§6[WM] §f" + removed + " item(s) supprimé(s) dans §e" + label + " §7@ §f" + location);
        ctx.sender.sendMessage("§7Copier: §f/tp @s " + bx + " " + by + " " + bz
                + " §7(monde §f" + world + "§7)");
        ctx.tpDetails.add(new TpDetail(world, bx, by, bz, removed, "inconnu", false, null));
    }

    // -------------------------------------------------------------------------
    // Joueurs en ligne : enderchest, inventaire principal, DeepPockets Inventorio
    // -------------------------------------------------------------------------

    private void scanOnlinePlayers(ScanContext ctx) {
        Set<String> targetNames = new LinkedHashSet<>();
        for (World w : ctx.targetWorlds) {
            targetNames.add(w.getName().toLowerCase(Locale.ROOT));
        }

        for (Player player : Bukkit.getOnlinePlayers()) {
            if (player.getWorld() == null) continue;
            if (!targetNames.contains(player.getWorld().getName().toLowerCase(Locale.ROOT))) continue;

            // --- Enderchest ---
            ctx.enderChestsScanned++;
            int ecRemoved = scanInventoryAndRemoveWeapons(player.getEnderChest(), true);
            if (ecRemoved > 0) {
                ctx.weaponItemsRemoved += ecRemoved;
                logPlayerDetection(player, ecRemoved, "enderchest", ctx);
            }

            // --- Inventaire principal (slots + armure + offhand) ---
            ctx.playerInvsScanned++;
            int invRemoved = scanInventoryAndRemoveWeapons(player.getInventory(), true);
            if (invRemoved > 0) {
                ctx.weaponItemsRemoved += invRemoved;
                ctx.containersWithDetections++;
                logPlayerDetection(player, invRemoved, "inventaire", ctx);
            }

            // --- DeepPockets Inventorio (best-effort via réflexion / API Forge) ---
            int dpRemoved = tryInventorioDeepPockets(player);
            if (dpRemoved > 0) {
                ctx.weaponItemsRemoved += dpRemoved;
                ctx.containersWithDetections++;
                logPlayerDetection(player, dpRemoved, "Inventorio DeepPockets", ctx);
            }
        }
    }

    private void logPlayerDetection(Player player, int removed, String slot, ScanContext ctx) {
        Location loc = player.getLocation();
        String world = player.getWorld().getName();
        int bx = loc.getBlockX(), by = loc.getBlockY(), bz = loc.getBlockZ();

        plugin.getLogger().info("[WM chestscan] " + removed + " item(s) WM supprimé(s) " + slot
                + " joueur " + player.getName() + " (" + world + ")");
        ctx.sender.sendMessage("§6[WM] §f" + removed + " item(s) supprimé(s) dans le §e" + slot
                + " §7de §f" + player.getName());
        ctx.sender.sendMessage("§7Copier: §f/tp @s " + bx + " " + by + " " + bz
                + " §7(joueur §f" + player.getName() + "§7, monde §f" + world + "§7)");
        ctx.tpDetails.add(new TpDetail(world, bx, by, bz, removed, player.getName(), true, player.getName()));
    }

    /**
     * Tente d'accéder aux DeepPockets d'Inventorio sur serveur Mohist (Forge+Bukkit).
     * Inventorio stocke ses slots supplémentaires dans une capability Forge attachée au joueur.
     * En cas d'échec (mod absent / version incompatible), retourne 0 silencieusement.
     */
    private int tryInventorioDeepPockets(Player player) {
        try {
            // CraftPlayer → ServerPlayer (NMS)
            Object nmsPlayer = player.getClass().getMethod("getHandle").invoke(player);

            // Inventorio expose son inventaire via la classe PlayerInventoryAddon.
            // On cherche un champ ou méthode "inventoryAddon" / "extraInventory" sur le NMS player.
            for (java.lang.reflect.Field field : nmsPlayer.getClass().getDeclaredFields()) {
                String name = field.getName().toLowerCase(Locale.ROOT);
                if (!name.contains("inventorio") && !name.contains("addon") && !name.contains("deeppocket")) {
                    continue;
                }
                field.setAccessible(true);
                Object addon = field.get(nmsPlayer);
                if (addon == null) continue;

                // Tente de récupérer une Inventory Bukkit depuis l'addon
                for (java.lang.reflect.Method m : addon.getClass().getMethods()) {
                    if (m.getReturnType().isAssignableFrom(Inventory.class)
                            && m.getParameterCount() == 0) {
                        Inventory inv = (Inventory) m.invoke(addon);
                        if (inv != null) {
                            return scanInventoryAndRemoveWeapons(inv, true);
                        }
                    }
                }
            }
        } catch (Throwable ignored) {
            // Mod absent ou structure NMS incompatible — on ignore silencieusement
        }
        return 0;
    }

    // -------------------------------------------------------------------------
    // Logique de scan / suppression
    // -------------------------------------------------------------------------

    private int scanInventoryAndRemoveWeapons(Inventory inventory, boolean inspectNestedShulkers) {
        if (inventory == null) return 0;
        int removed = 0;
        ItemStack[] content = inventory.getContents();
        for (int i = 0; i < content.length; i++) {
            ItemStack stack = content[i];
            if (stack == null || stack.getType().isAir()) continue;

            if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(stack)) {
                inventory.setItem(i, null);
                removed++;
                continue;
            }
            if (!inspectNestedShulkers || !isShulkerItem(stack)) continue;

            int nested = scanShulkerItemAndRemoveWeapons(stack);
            if (nested > 0) {
                removed += nested;
                inventory.setItem(i, stack);
            }
        }
        return removed;
    }

    private int scanShulkerItemAndRemoveWeapons(ItemStack shulkerItem) {
        if (shulkerItem == null || !(shulkerItem.getItemMeta() instanceof BlockStateMeta meta)) return 0;
        BlockState state = meta.getBlockState();
        if (!(state instanceof org.bukkit.block.ShulkerBox box)) return 0;
        int nestedRemoved = scanInventoryAndRemoveWeapons(box.getInventory(), true);
        if (nestedRemoved > 0) {
            meta.setBlockState(box);
            shulkerItem.setItemMeta(meta);
        }
        return nestedRemoved;
    }

    private static boolean isShulkerItem(ItemStack stack) {
        return stack != null && stack.getType().name().endsWith("SHULKER_BOX");
    }

    // -------------------------------------------------------------------------
    // Fin du scan & rapport
    // -------------------------------------------------------------------------

    private void finish(ScanContext ctx) {
        stop();
        long elapsed = System.currentTimeMillis() - ctx.startedAtMs;
        boolean detected = ctx.containersWithDetections > 0;
        String topSuspect = resolveTopSuspect(ctx.suspectHitsByName);
        lastResult = new ScanResult(ctx, elapsed, topSuspect);

        String summary = "§aScan WM terminé: §f" + ctx.worldNames
                + " §7| §fchunks=" + ctx.chunksScanned
                + " §7| §fblocs=" + ctx.containersScanned
                + " §7| §fentités=" + ctx.entityContainersScanned
                + " §7| §fItemFrames=" + ctx.itemFramesScanned
                + " §7| §ftouchés=" + ctx.containersWithDetections
                + " §7| §fsupprimés=" + ctx.weaponItemsRemoved
                + " §7| §fenderchests=" + ctx.enderChestsScanned
                + " §7| §finv joueurs=" + ctx.playerInvsScanned
                + " §7| §fdurée=" + elapsed + "ms";

        ctx.sender.sendMessage(summary);
        ctx.sender.sendMessage(detected
                ? "§cDes armes WeaponMechanics ont été détectées."
                : "§aAucune arme WeaponMechanics détectée.");
        if (!ctx.suspectHitsByName.isEmpty()) {
            ctx.sender.sendMessage("§eSuspect principal (blocklog): §f" + topSuspect);
        }
        plugin.getLogger().info("[WM chestscan] " + stripColors(summary));
        if (!ctx.suspectHitsByName.isEmpty()) {
            plugin.getLogger().info("[WM chestscan] Suspect principal: " + topSuspect);
        }

        if (plugin instanceof SunAntiCheat sac) {
            var webhook = sac.getDiscordWebhook();
            if (webhook != null
                    && webhook.isEnabled()
                    && plugin.getConfig().getBoolean("discord.enabled", false)
                    && plugin.getConfig().getBoolean("discord.chest-scan-report", true)) {
                String title = detected ? "Chest Scan — Armes détectées" : "Chest Scan — Aucune détection";
                String body = buildDiscordSummary(ctx, elapsed, detected, topSuspect)
                        + buildDiscordDetectionsBlock(ctx.tpDetails);
                int embedColor = ctx.weaponItemsRemoved > 0 ? 0xFF0000 : 0x2ECC71;
                webhook.sendEmbed(title, body, embedColor);
            }
        }
    }

    private static String buildDiscordSummary(ScanContext ctx, long elapsedMs, boolean detected, String topSuspect) {
        String status = detected
                ? "**Statut** · :rotating_light: `ARMES WEAPONMECHANICS DÉTECTÉES`"
                : "**Statut** · :white_check_mark: `Aucune arme détectée`";
        StringBuilder sb = new StringBuilder();
        sb.append(status).append("\n");
        sb.append("**Demandeur** · `").append(ctx.sender.getName()).append("`\n");
        sb.append("**Mondes ciblés** · `").append(ctx.worldNames).append("`\n");
        sb.append("**Durée** · `").append(formatDurationShort(elapsedMs)).append("`\n\n");
        sb.append("__**Sommaire**__\n");
        sb.append("> • Chunks scannés : `").append(ctx.chunksScanned).append("`\n");
        sb.append("> • Blocs conteneurs : `").append(ctx.containersScanned).append("`\n");
        sb.append("> • Entités conteneurs : `").append(ctx.entityContainersScanned).append("` *(minecarts, bateaux)*\n");
        sb.append("> • ItemFrames : `").append(ctx.itemFramesScanned).append("`\n");
        sb.append("> • Conteneurs touchés : `").append(ctx.containersWithDetections).append("`\n");
        sb.append("> • Items WM supprimés : `").append(ctx.weaponItemsRemoved).append("`\n");
        sb.append("> • Enderchests scannés : `").append(ctx.enderChestsScanned).append("`\n");
        sb.append("> • Inventaires joueurs : `").append(ctx.playerInvsScanned).append("`\n");
        sb.append("> • Suspect principal (blocklog) : `").append(topSuspect).append("`");
        return sb.toString();
    }

    private static String buildDiscordDetectionsBlock(List<TpDetail> details) {
        if (details == null || details.isEmpty()) return "";
        final int maxLines = 15;
        int shown = Math.min(maxLines, details.size());
        StringBuilder sb = new StringBuilder();
        sb.append("\n\n__**Emplacements détectés**__");
        sb.append(" *(").append(shown).append("/").append(details.size()).append(" affiché(s) — commandes prêtes à copier)*\n");
        for (int i = 0; i < shown; i++) {
            TpDetail d = details.get(i);
            sb.append("\n");
            if (d.enderChest) {
                sb.append("**#").append(i + 1).append(" · Joueur**")
                        .append(" · `").append(d.playerName).append("`")
                        .append(" · monde `").append(d.world).append("`")
                        .append(" · `").append(d.removed).append("` item(s)\n");
            } else {
                sb.append("**#").append(i + 1).append(" · Conteneur**")
                        .append(" · monde `").append(d.world).append("`")
                        .append(" · suspect `").append(d.suspect).append("`")
                        .append(" · `").append(d.removed).append("` item(s)\n");
            }
            sb.append("```/tp @s ").append(d.x).append(" ").append(d.y).append(" ").append(d.z).append("```");
        }
        if (details.size() > maxLines) {
            sb.append("\n*… ").append(details.size() - maxLines).append(" emplacement(s) supplémentaire(s) — voir console.*");
        }
        sb.append("\n\n*Astuce : lance `/mvtp <monde>` avant le `/tp` si tu n'es pas dans le bon monde.*");
        return sb.toString();
    }

    // -------------------------------------------------------------------------
    // Utilitaires
    // -------------------------------------------------------------------------

    private SuspectInfo findLastInteractor(BlockState state) {
        if (!(plugin instanceof SunAntiCheat sac)) return null;
        BlockLogStore store = sac.getBlockLogStore();
        if (store == null || state == null || state.getWorld() == null) return null;
        Block block = state.getWorld().getBlockAt(state.getX(), state.getY(), state.getZ());
        for (BlockLogEntry entry : store.getEntries(block)) {
            if (entry.getType() != BlockLogEntry.Type.INTERACT) continue;
            String name = entry.getPlayerName() == null || entry.getPlayerName().isBlank() ? "inconnu" : entry.getPlayerName();
            long age = Math.max(0L, System.currentTimeMillis() - entry.getTimestamp());
            return new SuspectInfo(name, age);
        }
        return null;
    }

    private static String resolveTopSuspect(Map<String, Integer> suspectHitsByName) {
        if (suspectHitsByName == null || suspectHitsByName.isEmpty()) return "inconnu";
        String topName = "inconnu";
        int topCount = -1;
        for (Map.Entry<String, Integer> e : suspectHitsByName.entrySet()) {
            if (e.getValue() > topCount) {
                topName = e.getKey();
                topCount = e.getValue();
            }
        }
        return topName + " (" + topCount + " coffre(s))";
    }

    private static String formatAge(long millis) {
        long s = millis / 1000L;
        if (s < 60) return s + "s";
        long m = s / 60L;
        if (m < 60) return m + "m";
        long h = m / 60L;
        if (h < 48) return h + "h";
        return (h / 24L) + "j";
    }

    private static String formatDurationShort(long millis) {
        if (millis < 1000) return millis + " ms";
        long s = millis / 1000L;
        if (s < 60) return s + " s";
        long m = s / 60L;
        return m + "m " + (s % 60L) + "s";
    }

    private static String stripColors(String input) {
        return input.replaceAll("§[0-9a-fklmnor]", "");
    }

    // -------------------------------------------------------------------------
    // ScanResult (snapshot immutable, thread-safe)
    // -------------------------------------------------------------------------

    public static final class ScanResult {
        public final String worlds;
        public final long finishedAt;
        public final long durationMs;
        public final long chunksScanned;
        public final long containersScanned;
        public final long entityContainersScanned;
        public final long itemFramesScanned;
        public final long containersWithDetections;
        public final long weaponItemsRemoved;
        public final long enderChestsScanned;
        public final long playerInvsScanned;
        public final String topSuspect;
        public final List<Map<String, Object>> detections;

        private ScanResult(ScanContext ctx, long elapsed, String topSuspect) {
            this.worlds = ctx.worldNames;
            this.finishedAt = System.currentTimeMillis();
            this.durationMs = elapsed;
            this.chunksScanned = ctx.chunksScanned;
            this.containersScanned = ctx.containersScanned;
            this.entityContainersScanned = ctx.entityContainersScanned;
            this.itemFramesScanned = ctx.itemFramesScanned;
            this.containersWithDetections = ctx.containersWithDetections;
            this.weaponItemsRemoved = ctx.weaponItemsRemoved;
            this.enderChestsScanned = ctx.enderChestsScanned;
            this.playerInvsScanned = ctx.playerInvsScanned;
            this.topSuspect = topSuspect;
            List<Map<String, Object>> dets = new ArrayList<>();
            for (TpDetail d : ctx.tpDetails) {
                Map<String, Object> m2 = new LinkedHashMap<>();
                m2.put("world", d.world);
                m2.put("x", d.x); m2.put("y", d.y); m2.put("z", d.z);
                m2.put("removed", d.removed);
                m2.put("suspect", d.suspect);
                m2.put("enderChest", d.enderChest);
                m2.put("playerName", d.playerName);
                dets.add(m2);
            }
            this.detections = List.copyOf(dets);
        }

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("worlds", worlds);
            m.put("finishedAt", finishedAt);
            m.put("durationMs", durationMs);
            m.put("chunksScanned", chunksScanned);
            m.put("containersScanned", containersScanned);
            m.put("entityContainersScanned", entityContainersScanned);
            m.put("itemFramesScanned", itemFramesScanned);
            m.put("containersWithDetections", containersWithDetections);
            m.put("weaponItemsRemoved", weaponItemsRemoved);
            m.put("enderChestsScanned", enderChestsScanned);
            m.put("playerInvsScanned", playerInvsScanned);
            m.put("topSuspect", topSuspect);
            m.put("detections", detections);
            return m;
        }
    }

    // -------------------------------------------------------------------------
    // Classes internes
    // -------------------------------------------------------------------------

    private static final class TpDetail {
        private final String world;
        private final int x, y, z;
        private final int removed;
        private final String suspect;
        private final boolean enderChest;
        private final String playerName;

        private TpDetail(String world, int x, int y, int z, int removed, String suspect, boolean enderChest, String playerName) {
            this.world = world != null ? world : "?";
            this.x = x; this.y = y; this.z = z;
            this.removed = removed;
            this.suspect = suspect != null && !suspect.isBlank() ? suspect : "inconnu";
            this.enderChest = enderChest;
            this.playerName = playerName != null ? playerName : "?";
        }
    }

    private static final class SuspectInfo {
        private final String playerName;
        private final long eventAgeMs;

        private SuspectInfo(String playerName, long eventAgeMs) {
            this.playerName = playerName;
            this.eventAgeMs = eventAgeMs;
        }
    }

    private static final class ScanContext {
        private final CommandSender sender;
        private final List<World> targetWorlds;
        private final Deque<Chunk> chunksToProcess;
        private final String worldNames;
        private final long startedAtMs;

        private long chunksScanned;
        private long containersScanned;       // blocs TileEntity
        private long entityContainersScanned; // entités (minecarts, bateaux)
        private long itemFramesScanned;
        private long containersWithDetections;
        private long weaponItemsRemoved;
        private long enderChestsScanned;
        private long playerInvsScanned;
        private boolean playersDone;
        private final Map<String, Integer> suspectHitsByName = new HashMap<>();
        private final List<TpDetail> tpDetails = new ArrayList<>();

        private ScanContext(CommandSender sender, Collection<World> worlds) {
            this.sender = sender;
            this.targetWorlds = new ArrayList<>(worlds);
            this.worldNames = String.join(", ", this.targetWorlds.stream().map(World::getName).toList());
            this.startedAtMs = System.currentTimeMillis();
            this.chunksToProcess = new ArrayDeque<>();
            for (World w : this.targetWorlds) {
                Collections.addAll(this.chunksToProcess, w.getLoadedChunks());
            }
        }
    }
}
