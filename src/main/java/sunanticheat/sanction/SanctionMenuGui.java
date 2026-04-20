package sunanticheat.sanction;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.SkullMeta;

import java.util.List;

/**
 * Menu complet des sanctions pour un joueur cible : kick, ban, mute, freeze, inventaire, TP, dégâts, etc.
 */
public class SanctionMenuGui {

    // Slots (inv 54)
    public static final int SLOT_HEAD = 4;
    public static final int SLOT_KICK = 10;
    public static final int SLOT_BAN_PERM = 11;
    public static final int SLOT_BAN_TEMP = 12;
    public static final int SLOT_MUTE_PERM = 13;
    public static final int SLOT_MUTE_TEMP = 14;
    public static final int SLOT_WARN = 15;
    public static final int SLOT_FREEZE = 19;
    public static final int SLOT_UNFREEZE = 20;
    public static final int SLOT_SPECTATOR = 21;
    public static final int SLOT_SURVIVAL = 22;
    public static final int SLOT_STRIP = 23;
    public static final int SLOT_CLEAR_INV = 24;
    public static final int SLOT_TP_SPAWN = 28;
    public static final int SLOT_HEAL = 29;
    public static final int SLOT_FEED = 30;
    public static final int SLOT_DAMAGE = 31;
    public static final int SLOT_BURN = 32;
    public static final int SLOT_LIGHTNING = 33;
    public static final int SLOT_MSG = 40;
    public static final int SLOT_BACK = 44;

    private static final int GUI_SIZE = 54;
    private final SanctionService sanctionService;
    private SanctionDurationGui durationGui;
    private SanctionPlayerListGui playerListGui;

    public SanctionMenuGui(SanctionService sanctionService) {
        this.sanctionService = sanctionService;
    }

    public void setDurationGui(SanctionDurationGui durationGui) {
        this.durationGui = durationGui;
    }

    public void setPlayerListGui(SanctionPlayerListGui playerListGui) {
        this.playerListGui = playerListGui;
    }

    public void open(Player viewer, Player target) {
        if (target == null || !target.isOnline()) {
            viewer.sendMessage(Component.text("Ce joueur n'est plus en ligne.").color(NamedTextColor.RED));
            return;
        }
        SanctionMenuHolder holder = new SanctionMenuHolder(target);
        String name = target.getName();
        Inventory inv = Bukkit.createInventory(holder, GUI_SIZE,
                Component.text("Sanctions — " + name).color(NamedTextColor.DARK_RED).decorate(TextDecoration.BOLD));
        holder.setInventory(inv);

        ItemStack border = new ItemStack(Material.GRAY_STAINED_GLASS_PANE);
        ItemMeta borderMeta = border.getItemMeta();
        if (borderMeta != null) borderMeta.displayName(Component.text(" "));
        border.setItemMeta(borderMeta);
        for (int i = 0; i < 9; i++) inv.setItem(i, border);
        for (int i = 45; i < GUI_SIZE; i++) inv.setItem(i, border);
        for (int r = 1; r < 5; r++) {
            inv.setItem(r * 9, border);
            inv.setItem(r * 9 + 8, border);
        }

        // Tête du joueur cible
        ItemStack head = new ItemStack(Material.PLAYER_HEAD);
        head.editMeta(SkullMeta.class, m -> {
            m.setOwningPlayer(target);
            m.displayName(Component.text(name).color(NamedTextColor.GOLD).decorate(TextDecoration.BOLD));
            m.lore(List.of(
                    Component.text("Cible des sanctions").color(NamedTextColor.GRAY),
                    Component.text("Mute: " + (sanctionService.isMuted(target) ? "Oui" : "Non")).color(NamedTextColor.GRAY),
                    Component.text("Freeze: " + (sanctionService.isFrozen(target.getUniqueId()) ? "Oui" : "Non")).color(NamedTextColor.GRAY)
            ));
        });
        inv.setItem(SLOT_HEAD, head);

        inv.setItem(SLOT_KICK, item(Material.IRON_DOOR, "Kick", NamedTextColor.RED, "Expulser le joueur du serveur"));
        inv.setItem(SLOT_BAN_PERM, item(Material.BARRIER, "Bannir (définitif)", NamedTextColor.DARK_RED, "Bannir définitivement"));
        inv.setItem(SLOT_BAN_TEMP, item(Material.CLOCK, "Bannir (temporaire)", NamedTextColor.GOLD, "Choisir une durée"));
        inv.setItem(SLOT_MUTE_PERM, item(Material.GRAY_DYE, "Mute (définitif)", NamedTextColor.DARK_GRAY, "Interdire de parler"));
        inv.setItem(SLOT_MUTE_TEMP, item(Material.LIGHT_GRAY_DYE, "Mute (temporaire)", NamedTextColor.GRAY, "Choisir une durée"));
        inv.setItem(SLOT_WARN, item(Material.PAPER, "Avertissement", NamedTextColor.YELLOW, "Envoyer un avertissement au joueur"));

        inv.setItem(SLOT_FREEZE, item(Material.ICE, "Geler", NamedTextColor.AQUA, "Bloquer les déplacements"));
        inv.setItem(SLOT_UNFREEZE, item(Material.PACKED_ICE, "Dégeler", NamedTextColor.GREEN, "Autoriser à nouveau les déplacements"));
        inv.setItem(SLOT_SPECTATOR, item(Material.ENDER_EYE, "Mode Spectateur", NamedTextColor.LIGHT_PURPLE, "Passer en mode spectateur"));
        inv.setItem(SLOT_SURVIVAL, item(Material.GRASS_BLOCK, "Mode Survie", NamedTextColor.DARK_GREEN, "Remettre en survie"));
        inv.setItem(SLOT_STRIP, item(Material.LEATHER_CHESTPLATE, "Retirer équipement", NamedTextColor.GOLD, "Vider inventaire + armure"));
        inv.setItem(SLOT_CLEAR_INV, item(Material.CHEST, "Vider inventaire", NamedTextColor.GOLD, "Vider l'inventaire (garder armure)"));

        inv.setItem(SLOT_TP_SPAWN, item(Material.COMPASS, "TP Spawn", NamedTextColor.YELLOW, "Téléporter au spawn du monde"));
        inv.setItem(SLOT_HEAL, item(Material.GOLDEN_APPLE, "Soigner", NamedTextColor.GREEN, "Vie + faim au max"));
        inv.setItem(SLOT_FEED, item(Material.COOKED_BEEF, "Nourrir", NamedTextColor.GREEN, "Faim au max"));
        inv.setItem(SLOT_DAMAGE, item(Material.STONE_SWORD, "½ cœur dégât", NamedTextColor.RED, "Infliger un demi-cœur de dégât"));
        inv.setItem(SLOT_BURN, item(Material.BLAZE_POWDER, "Enflammer", NamedTextColor.GOLD, "Mettre le feu (8 sec)"));
        inv.setItem(SLOT_LIGHTNING, item(Material.BLAZE_ROD, "Effet foudre", NamedTextColor.YELLOW, "Effet visuel foudre (sans dégât)"));

        inv.setItem(SLOT_MSG, item(Material.WRITABLE_BOOK, "Message personnalisé", NamedTextColor.LIGHT_PURPLE, "Envoyer un message au joueur"));
        inv.setItem(SLOT_BACK, item(Material.ARROW, "Retour", NamedTextColor.WHITE, "Liste des joueurs"));

        viewer.openInventory(inv);
    }

    private ItemStack item(Material mat, String name, TextColor color, String lore) {
        ItemStack i = new ItemStack(mat);
        i.editMeta(ItemMeta.class, m -> {
            m.displayName(Component.text(name).color(color).decoration(TextDecoration.BOLD, false));
            m.lore(List.of(Component.text(lore).color(NamedTextColor.GRAY)));
        });
        return i;
    }

    public SanctionService getSanctionService() {
        return sanctionService;
    }

    public SanctionDurationGui getDurationGui() {
        return durationGui;
    }

    public SanctionPlayerListGui getPlayerListGui() {
        return playerListGui;
    }
}

