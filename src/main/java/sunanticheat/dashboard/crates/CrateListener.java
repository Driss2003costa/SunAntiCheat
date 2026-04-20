package sunanticheat.dashboard.crates;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.NamespacedKey;
import org.bukkit.OfflinePlayer;
import org.bukkit.block.Block;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

/**
 * Listener d'interaction avec les crates plac\u00e9es et gestionnaire de la commande /crate.
 */
public final class CrateListener implements Listener, CommandExecutor {

    private final JavaPlugin plugin;
    private final CrateStore store;
    private final NamespacedKey keyTag;
    private final Random rng = new Random();

    public CrateListener(JavaPlugin plugin, CrateStore store) {
        this.plugin = plugin;
        this.store = store;
        this.keyTag = new NamespacedKey(plugin, "crate_id");
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onInteract(PlayerInteractEvent e) {
        if (e.getAction() != Action.RIGHT_CLICK_BLOCK) return;
        Block block = e.getClickedBlock();
        if (block == null) return;
        PlacedCrate placed = store.getPlacedCrate(block.getWorld().getName(),
                block.getX(), block.getY(), block.getZ());
        if (placed == null) return;
        Crate crate = store.getCrate(placed.crateId);
        if (crate == null || crate.items == null || crate.items.isEmpty()) return;

        e.setCancelled(true);
        Player player = e.getPlayer();
        String uuid = player.getUniqueId().toString();

        if (!hasKey(player, crate)) {
            String kn = crate.keyDisplayName == null ? "la cl\u00e9 de cette crate" : crate.keyDisplayName;
            player.sendMessage("\u00a7c\u2717 Vous avez besoin de "
                    + ChatColor.translateAlternateColorCodes('&', kn));
            return;
        }

        if (crate.dailyLimitEnabled && crate.dailyLimit > 0
                && !store.canOpenToday(crate.id, uuid, crate.dailyLimit)) {
            player.sendMessage("\u00a7c\u2717 Limite quotidienne atteinte pour cette crate.");
            return;
        }

        if (!consumeKey(player, crate)) {
            player.sendMessage("\u00a7c\u2717 Impossible de consommer la cl\u00e9.");
            return;
        }

        // Pity filtering
        List<CrateItem> pool = crate.items;
        boolean pityTriggered = false;
        if (crate.pityEnabled && crate.pityOpens > 0
                && store.getOpenCount(crate.id, uuid) + 1 >= crate.pityOpens) {
            CrateRarity guaranteed = crate.pityGuarantee == null ? CrateRarity.RARE : crate.pityGuarantee;
            List<CrateItem> filtered = new ArrayList<>();
            for (CrateItem it : crate.items) {
                if (it == null || it.rarity == null) continue;
                if (it.rarity.ordinal() >= guaranteed.ordinal()) filtered.add(it);
            }
            if (!filtered.isEmpty()) {
                pool = filtered;
                pityTriggered = true;
            }
        }

        final CrateItem wonItem = WeightedRandom.pick(pool, it -> it.weight, rng);
        if (wonItem == null) {
            player.sendMessage("\u00a7c\u2717 Aucun item gagnable dans cette crate.");
            return;
        }

        store.incrementOpenCount(crate.id, uuid);
        store.recordDailyOpen(crate.id, uuid);
        if (pityTriggered) store.resetOpenCount(crate.id, uuid);

        final boolean didPity = pityTriggered;

        CrateAnimations.play(plugin, player, crate, wonItem, () -> {
            // DONNE la r\u00e9compense (main thread garanti par CrateAnimations.finish)
            if (!wonItem.isCommand) {
                ItemStack is = ItemBuilder.build(wonItem.material, wonItem.customModelData,
                        wonItem.itemAdderId, Math.max(1, wonItem.amount),
                        wonItem.displayName, wonItem.lore, wonItem.enchantments);
                if (is != null) {
                    for (ItemStack leftover : player.getInventory().addItem(is).values()) {
                        player.getWorld().dropItemNaturally(player.getLocation(), leftover);
                    }
                }
            }
            if (wonItem.commands != null) {
                for (String cmd : wonItem.commands) {
                    if (cmd == null || cmd.isEmpty()) continue;
                    String resolved = cmd.replace("{player}", player.getName());
                    try {
                        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), resolved);
                    } catch (Throwable t) {
                        plugin.getLogger().warning("[Crates] cmd fail: " + t.getMessage());
                    }
                }
            }

            CrateOpen open = new CrateOpen(
                    crate.id, crate.name == null ? crate.displayName : crate.name,
                    uuid, player.getName(),
                    wonItem.id, wonItem.displayName, wonItem.material,
                    wonItem.rarity, System.currentTimeMillis());
            store.recordOpen(open);

            if (wonItem.broadcastOnWin || crate.broadcastOnOpen) {
                String fmt = crate.broadcastFormat == null || crate.broadcastFormat.isEmpty()
                        ? "&6{player} &ea obtenu &6{item} &edans &6{crate}&e!"
                        : crate.broadcastFormat;
                String msg = fmt
                        .replace("{player}", player.getName())
                        .replace("{crate}", crate.displayName == null ? crate.name : crate.displayName)
                        .replace("{item}", wonItem.displayName == null ? "?" : wonItem.displayName);
                Bukkit.broadcastMessage(ChatColor.translateAlternateColorCodes('&', msg));
            }

            if (didPity) {
                player.sendMessage("\u00a76\u2726 Bonus pity d\u00e9clench\u00e9 !");
            }
        });
    }

    // ── Keys ──────────────────────────────────────────────────────────────────

    private boolean hasKey(Player player, Crate crate) {
        if (crate.usesPhysicalKey) {
            for (ItemStack is : player.getInventory().getContents()) {
                if (isCrateKey(is, crate.id)) return true;
            }
            return false;
        }
        return store.getKeys(crate.id, player.getUniqueId().toString()) > 0;
    }

    private boolean consumeKey(Player player, Crate crate) {
        if (crate.usesPhysicalKey) {
            ItemStack[] contents = player.getInventory().getContents();
            for (int i = 0; i < contents.length; i++) {
                ItemStack is = contents[i];
                if (isCrateKey(is, crate.id)) {
                    is.setAmount(is.getAmount() - 1);
                    player.getInventory().setItem(i, is.getAmount() > 0 ? is : null);
                    return true;
                }
            }
            return false;
        }
        return store.consumeKey(crate.id, player.getUniqueId().toString());
    }

    private boolean isCrateKey(ItemStack is, String crateId) {
        if (is == null || crateId == null) return false;
        ItemMeta meta = is.getItemMeta();
        if (meta == null) return false;
        PersistentDataContainer pdc = meta.getPersistentDataContainer();
        String tag = pdc.get(keyTag, PersistentDataType.STRING);
        return crateId.equals(tag);
    }

    /** Construit l'item-cl\u00e9 physique d'une crate (marqu\u00e9 avec son id). */
    public ItemStack buildKeyItem(Crate crate) {
        if (crate == null) return null;
        String name = crate.keyDisplayName == null ? "Cl\u00e9 de crate" : crate.keyDisplayName;
        List<String> lore = new ArrayList<>();
        lore.add("&7Ouvre : &6" + (crate.displayName == null ? crate.name : crate.displayName));
        ItemStack is = ItemBuilder.build(
                crate.keyMaterial == null ? "TRIPWIRE_HOOK" : crate.keyMaterial,
                crate.keyCustomModelData,
                crate.keyItemAdderId, 1,
                name, lore, null);
        if (is == null) return null;
        ItemMeta meta = is.getItemMeta();
        if (meta != null) {
            meta.getPersistentDataContainer().set(keyTag, PersistentDataType.STRING, crate.id);
            is.setItemMeta(meta);
        }
        return is;
    }

    // ── Commande /crate ───────────────────────────────────────────────────────

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sender.sendMessage("\u00a7eUsage: /crate <place|preview|givekey|list>");
            return true;
        }
        String sub = args[0].toLowerCase();
        switch (sub) {
            case "place": return cmdPlace(sender, args);
            case "preview": return cmdPreview(sender, args);
            case "givekey": return cmdGiveKey(sender, args);
            case "list": return cmdList(sender);
            default:
                sender.sendMessage("\u00a7cSous-commande inconnue.");
                return true;
        }
    }

    private boolean cmdPlace(CommandSender sender, String[] args) {
        if (!(sender instanceof Player)) { sender.sendMessage("\u00a7cJoueur uniquement."); return true; }
        if (!sender.hasPermission("sunguard.dashboard")) { sender.sendMessage("\u00a7cPermission requise."); return true; }
        if (args.length < 2) { sender.sendMessage("\u00a7eUsage: /crate place <crateName>"); return true; }
        Player p = (Player) sender;
        Crate crate = store.getCrateByName(args[1]);
        if (crate == null) { p.sendMessage("\u00a7cCrate introuvable: " + args[1]); return true; }
        Block target = p.getTargetBlockExact(5);
        if (target == null || target.getType().isAir()) {
            p.sendMessage("\u00a7cVisez un bloc \u00e0 5 blocs maximum.");
            return true;
        }
        store.addPlacedCrate(new PlacedCrate(crate.id,
                target.getWorld().getName(), target.getX(), target.getY(), target.getZ()));
        p.sendMessage("\u00a7a\u2713 Crate \u00ab" + crate.name + "\u00bb plac\u00e9e \u00e0 "
                + target.getX() + "," + target.getY() + "," + target.getZ());
        return true;
    }

    private boolean cmdPreview(CommandSender sender, String[] args) {
        if (!(sender instanceof Player)) { sender.sendMessage("\u00a7cJoueur uniquement."); return true; }
        if (args.length < 2) { sender.sendMessage("\u00a7eUsage: /crate preview <crateName>"); return true; }
        Player p = (Player) sender;
        Crate crate = store.getCrateByName(args[1]);
        if (crate == null) { p.sendMessage("\u00a7cCrate introuvable."); return true; }

        String title = "\u00a76Preview - " + (crate.displayName == null ? crate.name : crate.displayName);
        if (title.length() > 32) title = title.substring(0, 32);
        Inventory inv = Bukkit.createInventory(null, 54, title);

        int totalWeight = 0;
        for (CrateItem it : crate.items) if (it != null) totalWeight += Math.max(0, it.weight);
        int slot = 0;
        for (CrateItem it : crate.items) {
            if (it == null || slot >= 54) continue;
            double chance = totalWeight > 0 ? (100.0 * Math.max(0, it.weight) / totalWeight) : 0.0;
            List<String> lore = new ArrayList<>();
            if (it.lore != null) lore.addAll(it.lore);
            lore.add("&7Raret\u00e9 : " + (it.rarity == null ? "?" : it.rarity.displayName));
            lore.add("&7Chance : &e" + String.format("%.2f", chance) + "%");
            ItemStack is = ItemBuilder.build(it.material, it.customModelData, it.itemAdderId,
                    Math.max(1, it.amount), it.displayName, lore, it.enchantments);
            if (is != null) inv.setItem(slot++, is);
        }
        p.openInventory(inv);
        return true;
    }

    private boolean cmdGiveKey(CommandSender sender, String[] args) {
        if (!sender.hasPermission("sunguard.dashboard")) { sender.sendMessage("\u00a7cPermission requise."); return true; }
        if (args.length < 3) { sender.sendMessage("\u00a7eUsage: /crate givekey <player> <crateName> [amount]"); return true; }
        String targetName = args[1];
        Crate crate = store.getCrateByName(args[2]);
        if (crate == null) { sender.sendMessage("\u00a7cCrate introuvable."); return true; }
        int amount = 1;
        if (args.length >= 4) {
            try { amount = Math.max(1, Integer.parseInt(args[3])); } catch (NumberFormatException ignored) {}
        }

        OfflinePlayer off = Bukkit.getOfflinePlayer(targetName);
        UUID uuid = off.getUniqueId();

        if (crate.usesPhysicalKey) {
            Player online = off.getPlayer();
            if (online == null) {
                sender.sendMessage("\u00a7cCette crate utilise une cl\u00e9 physique : le joueur doit \u00eatre en ligne.");
                return true;
            }
            ItemStack key = buildKeyItem(crate);
            if (key == null) { sender.sendMessage("\u00a7cImpossible de construire la cl\u00e9."); return true; }
            key.setAmount(Math.max(1, amount));
            for (ItemStack leftover : online.getInventory().addItem(key).values()) {
                online.getWorld().dropItemNaturally(online.getLocation(), leftover);
            }
        } else {
            store.giveKey(crate.id, uuid.toString(), amount);
        }
        sender.sendMessage("\u00a7a\u2713 " + amount + " cl\u00e9(s) \u00ab" + crate.name + "\u00bb donn\u00e9e(s) \u00e0 " + targetName);
        return true;
    }

    private boolean cmdList(CommandSender sender) {
        List<Crate> all = store.listCrates();
        if (all.isEmpty()) { sender.sendMessage("\u00a7eAucune crate configur\u00e9e."); return true; }
        sender.sendMessage("\u00a76Crates (" + all.size() + ") :");
        for (Crate c : all) {
            int count = c.items == null ? 0 : c.items.size();
            sender.sendMessage("\u00a77- \u00a7f" + c.name + " \u00a78("
                    + (c.displayName == null ? "" : ChatColor.translateAlternateColorCodes('&', c.displayName))
                    + "\u00a78, " + count + " items)");
        }
        return true;
    }
}
