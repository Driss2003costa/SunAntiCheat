package sunanticheat.jobs;

import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.*;

public final class CustomJobGui implements Listener {

    private static final String TITLE_PREFIX = "§8Métiers — §6SunAntiCheat";
    private final CustomJobService service;

    public CustomJobGui(CustomJobService service) {
        this.service = service;
    }

    public void open(Player player) {
        Map<String, CustomJob> jobs = service.getJobs();
        int size = Math.max(9, ((jobs.size() / 9) + 1) * 9);
        Inventory inv = Bukkit.createInventory(null, size, TITLE_PREFIX);

        String uuid = player.getUniqueId().toString();
        int slot = 0;
        for (CustomJob job : jobs.values()) {
            Material mat = safeMaterial(job.icon());
            ItemStack item = new ItemStack(mat);
            ItemMeta meta = item.getItemMeta();
            if (meta == null) { slot++; continue; }

            boolean joined = service.getStore().hasJob(uuid, job.id());
            Map<String, Object> pj = joined ? service.getStore().getPlayerJob(uuid, job.id()) : null;
            int level = pj != null ? ((Number) pj.get("level")).intValue() : 0;
            double xp  = pj != null ? ((Number) pj.get("xp")).doubleValue() : 0;
            double earned = pj != null ? ((Number) pj.get("total_earned")).doubleValue() : 0;

            meta.setDisplayName((joined ? "§a" : "§7") + job.name());
            List<String> lore = new ArrayList<>();
            lore.add("§7" + job.description());
            lore.add("");
            if (joined) {
                long xpNext = !job.isMaxLevel(level) ? job.xpForNextLevel(level) : 0;
                lore.add("§eNiveau : §f" + level + (job.maxLevel() > 0 ? " / " + job.maxLevel() : ""));
                lore.add("§eXP : §f" + Math.round(xp)
                        + (xpNext > 0 ? " §7/ §f" + Math.round(xp + xpNext - job.xpForLevel(level)) + " requis" : " §7(max)"));
                lore.add("§eGains totaux : §f" + String.format("%.2f $", earned));
                lore.add("§eMultiplicateur : §fx" + String.format("%.1f", job.rewardMultiplier(level)));
                lore.add("");
                lore.add("§cClic pour quitter ce métier");
            } else {
                lore.add("§7Niveau max : " + (job.maxLevel() > 0 ? job.maxLevel() : "∞"));
                lore.add("");
                lore.add("§aClic pour rejoindre ce métier");
            }
            meta.setLore(lore);
            item.setItemMeta(meta);
            inv.setItem(slot++, item);
        }

        player.openInventory(inv);
    }

    @EventHandler
    public void onClick(InventoryClickEvent e) {
        if (!(e.getWhoClicked() instanceof Player player)) return;
        if (e.getView().getTitle() == null) return;
        if (!e.getView().getTitle().startsWith(TITLE_PREFIX)) return;

        e.setCancelled(true);
        ItemStack clicked = e.getCurrentItem();
        if (clicked == null || clicked.getType() == Material.AIR) return;
        ItemMeta meta = clicked.getItemMeta();
        if (meta == null || meta.getDisplayName() == null) return;

        // Extract job from display name (strip color codes)
        String displayName = meta.getDisplayName().replaceAll("§.", "");
        for (CustomJob job : service.getJobs().values()) {
            if (job.name().equalsIgnoreCase(displayName)) {
                String uuid = player.getUniqueId().toString();
                boolean joined = service.getStore().hasJob(uuid, job.id());
                if (joined) {
                    service.leave(player, job.id());
                } else {
                    service.join(player, job.id());
                }
                player.closeInventory();
                // Reopen with updated state
                Bukkit.getScheduler().runTaskLater(
                        Objects.requireNonNull(Bukkit.getPluginManager().getPlugin("SunAntiCheat")),
                        () -> open(player), 2L);
                return;
            }
        }
    }

    private static Material safeMaterial(String name) {
        try { return Material.valueOf(name.toUpperCase()); }
        catch (IllegalArgumentException e) { return Material.BOOK; }
    }
}
