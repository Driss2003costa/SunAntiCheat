package sunanticheat.inventory;

import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.alerts.StaffAlertService;

import java.util.*;

/**
 * Scanne les inventaires à la connexion et au respawn.
 * Détecte : enchantements au-dessus du niveau vanilla max, combinaisons illégales.
 */
public final class InventoryAnomalyListener implements Listener {

    private final JavaPlugin plugin;
    private final StaffAlertService alertService;

    private static final Map<Enchantment, Integer> MAX_LEVELS    = new HashMap<>();
    private static final List<Enchantment[]>        ILLEGAL_PAIRS = new ArrayList<>();

    static {
        MAX_LEVELS.put(Enchantment.SHARPNESS,              5);
        MAX_LEVELS.put(Enchantment.SMITE,                  5);
        MAX_LEVELS.put(Enchantment.BANE_OF_ARTHROPODS,     5);
        MAX_LEVELS.put(Enchantment.KNOCKBACK,              2);
        MAX_LEVELS.put(Enchantment.FIRE_ASPECT,            2);
        MAX_LEVELS.put(Enchantment.LOOTING,                3);
        MAX_LEVELS.put(Enchantment.SWEEPING_EDGE,          3);
        MAX_LEVELS.put(Enchantment.EFFICIENCY,             5);
        MAX_LEVELS.put(Enchantment.SILK_TOUCH,             1);
        MAX_LEVELS.put(Enchantment.FORTUNE,                3);
        MAX_LEVELS.put(Enchantment.POWER,                  5);
        MAX_LEVELS.put(Enchantment.PUNCH,                  2);
        MAX_LEVELS.put(Enchantment.FLAME,                  1);
        MAX_LEVELS.put(Enchantment.INFINITY,               1);
        MAX_LEVELS.put(Enchantment.PROTECTION,             4);
        MAX_LEVELS.put(Enchantment.FIRE_PROTECTION,        4);
        MAX_LEVELS.put(Enchantment.FEATHER_FALLING,        4);
        MAX_LEVELS.put(Enchantment.BLAST_PROTECTION,       4);
        MAX_LEVELS.put(Enchantment.PROJECTILE_PROTECTION,  4);
        MAX_LEVELS.put(Enchantment.RESPIRATION,            3);
        MAX_LEVELS.put(Enchantment.AQUA_AFFINITY,          1);
        MAX_LEVELS.put(Enchantment.THORNS,                 3);
        MAX_LEVELS.put(Enchantment.DEPTH_STRIDER,          3);
        MAX_LEVELS.put(Enchantment.FROST_WALKER,           2);
        MAX_LEVELS.put(Enchantment.UNBREAKING,             3);
        MAX_LEVELS.put(Enchantment.MENDING,                1);
        MAX_LEVELS.put(Enchantment.BINDING_CURSE,          1);
        MAX_LEVELS.put(Enchantment.VANISHING_CURSE,        1);
        MAX_LEVELS.put(Enchantment.LOYALTY,                3);
        MAX_LEVELS.put(Enchantment.IMPALING,               5);
        MAX_LEVELS.put(Enchantment.RIPTIDE,                3);
        MAX_LEVELS.put(Enchantment.CHANNELING,             1);
        MAX_LEVELS.put(Enchantment.MULTISHOT,              1);
        MAX_LEVELS.put(Enchantment.QUICK_CHARGE,           3);
        MAX_LEVELS.put(Enchantment.PIERCING,               4);
        MAX_LEVELS.put(Enchantment.SOUL_SPEED,             3);
        MAX_LEVELS.put(Enchantment.SWIFT_SNEAK,            3);
        MAX_LEVELS.put(Enchantment.LUCK_OF_THE_SEA,        3);
        MAX_LEVELS.put(Enchantment.LURE,                   3);

        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.SILK_TOUCH,          Enchantment.FORTUNE });
        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.SILK_TOUCH,          Enchantment.LOOTING });
        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.INFINITY,            Enchantment.MENDING });
        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.RIPTIDE,             Enchantment.LOYALTY });
        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.DEPTH_STRIDER,       Enchantment.FROST_WALKER });
        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.PROTECTION,          Enchantment.FIRE_PROTECTION });
        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.PROTECTION,          Enchantment.BLAST_PROTECTION });
        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.PROTECTION,          Enchantment.PROJECTILE_PROTECTION });
        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.SHARPNESS,           Enchantment.SMITE });
        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.SHARPNESS,           Enchantment.BANE_OF_ARTHROPODS });
        ILLEGAL_PAIRS.add(new Enchantment[]{ Enchantment.SMITE,               Enchantment.BANE_OF_ARTHROPODS });
    }

    public InventoryAnomalyListener(JavaPlugin plugin, StaffAlertService alertService) {
        this.plugin = plugin;
        this.alertService = alertService;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        scheduleCheck(event.getPlayer());
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onRespawn(PlayerRespawnEvent event) {
        scheduleCheck(event.getPlayer());
    }

    private void scheduleCheck(Player player) {
        plugin.getServer().getScheduler().runTaskLater(plugin, () -> scanPlayer(player), 5L);
    }

    private void scanPlayer(Player player) {
        if (!player.isOnline()) return;
        List<String> violations = new ArrayList<>();
        for (ItemStack item : player.getInventory().getContents()) {
            checkItem(item, violations);
        }
        for (ItemStack item : player.getInventory().getArmorContents()) {
            checkItem(item, violations);
        }
        if (!violations.isEmpty()) {
            // Cap à 3 violations dans le message pour éviter la troncature
            List<String> shown = violations.size() > 3
                    ? violations.subList(0, 3)
                    : violations;
            String detail = String.join(", ", shown)
                    + (violations.size() > 3 ? " (+" + (violations.size() - 3) + " autres)" : "");
            alertService.alertInventoryAnomaly(player, detail);
        }
    }

    private void checkItem(ItemStack item, List<String> violations) {
        if (item == null || !item.hasItemMeta()) return;
        Map<Enchantment, Integer> enchants = item.getItemMeta().getEnchants();

        for (Map.Entry<Enchantment, Integer> e : enchants.entrySet()) {
            Integer maxLevel = MAX_LEVELS.get(e.getKey());
            if (maxLevel != null && e.getValue() > maxLevel) {
                violations.add(e.getKey().getKey().getKey()
                        + " " + e.getValue() + " (max " + maxLevel + ")");
            }
        }
        for (Enchantment[] pair : ILLEGAL_PAIRS) {
            if (enchants.containsKey(pair[0]) && enchants.containsKey(pair[1])) {
                violations.add("combo:" + pair[0].getKey().getKey()
                        + "+" + pair[1].getKey().getKey());
            }
        }
    }
}
