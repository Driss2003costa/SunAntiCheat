package sunanticheat.sanction;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.SkullMeta;

/**
 * Gère les clics dans les GUIs de sanctions : liste joueurs, menu sanctions, choix de durée.
 */
public class SanctionMenuClickListener implements Listener {

    private static final String DEFAULT_REASON = "Sanctionné par le staff";

    private final SanctionMenuGui sanctionMenuGui;
    private final SanctionHistoryStorage historyStorage;

    public SanctionMenuClickListener(SanctionMenuGui sanctionMenuGui) {
        this.sanctionMenuGui = sanctionMenuGui;
        this.historyStorage = null;
    }

    public SanctionMenuClickListener(SanctionMenuGui sanctionMenuGui, SanctionHistoryStorage historyStorage) {
        this.sanctionMenuGui = sanctionMenuGui;
        this.historyStorage = historyStorage;
    }

    private void logSanction(String type, Player target, Player staff, String reason, long durationMillis) {
        if (historyStorage != null) {
            historyStorage.add(new SanctionHistoryEntry(type, target.getUniqueId(), target.getName(),
                    staff.getUniqueId(), staff.getName(), reason != null ? reason : DEFAULT_REASON, durationMillis, System.currentTimeMillis()));
        }
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player staff)) {
            return;
        }
        var holder = event.getInventory().getHolder();

        if (holder instanceof SanctionPlayerListHolder) {
            event.setCancelled(true);
            ItemStack clicked = event.getCurrentItem();
            if (clicked != null && clicked.getType() == Material.PLAYER_HEAD && clicked.getItemMeta() instanceof SkullMeta skullMeta && skullMeta.getOwningPlayer() != null) {
                Player target = skullMeta.getOwningPlayer().getPlayer();
                if (target != null && target.isOnline()) {
                    staff.closeInventory();
                    sanctionMenuGui.open(staff, target);
                }
            }
            return;
        }

        if (holder instanceof SanctionMenuHolder menuHolder) {
            event.setCancelled(true);
            Player target = menuHolder.getTarget();
            if (target == null || !target.isOnline()) {
                staff.sendMessage(Component.text("Ce joueur n'est plus en ligne.").color(NamedTextColor.RED));
                staff.closeInventory();
                return;
            }
            SanctionService svc = sanctionMenuGui.getSanctionService();
            int slot = event.getSlot();

            switch (slot) {
                case SanctionMenuGui.SLOT_KICK -> {
                    logSanction("KICK", target, staff, DEFAULT_REASON, 0);
                    svc.kick(target, DEFAULT_REASON);
                    staff.sendMessage(Component.text(target.getName() + " a été expulsé.").color(NamedTextColor.GREEN));
                    staff.closeInventory();
                }
                case SanctionMenuGui.SLOT_BAN_PERM -> {
                    logSanction("BAN_PERM", target, staff, DEFAULT_REASON, 0);
                    svc.banPermanent(target, DEFAULT_REASON, staff.getName());
                    staff.sendMessage(Component.text(target.getName() + " a été banni définitivement.").color(NamedTextColor.GREEN));
                    staff.closeInventory();
                }
                case SanctionMenuGui.SLOT_BAN_TEMP -> {
                    staff.closeInventory();
                    sanctionMenuGui.getDurationGui().open(staff, target, SanctionDurationHolder.TYPE_BAN_TEMP);
                }
                case SanctionMenuGui.SLOT_MUTE_PERM -> {
                    logSanction("MUTE_PERM", target, staff, DEFAULT_REASON, 0);
                    svc.mutePermanent(target);
                    staff.sendMessage(Component.text(target.getName() + " est muté définitivement.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_MUTE_TEMP -> {
                    staff.closeInventory();
                    sanctionMenuGui.getDurationGui().open(staff, target, SanctionDurationHolder.TYPE_MUTE_TEMP);
                }
                case SanctionMenuGui.SLOT_WARN -> {
                    logSanction("WARN", target, staff, "Comportement inapproprié.", 0);
                    svc.warn(target, "Comportement inapproprié. Merci de respecter le règlement.");
                    staff.sendMessage(Component.text("Avertissement envoyé à " + target.getName()).color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_FREEZE -> {
                    logSanction("FREEZE", target, staff, "", 0);
                    svc.freeze(target);
                    staff.sendMessage(Component.text(target.getName() + " est gelé.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_UNFREEZE -> {
                    logSanction("UNFREEZE", target, staff, "", 0);
                    svc.unfreeze(target);
                    staff.sendMessage(Component.text(target.getName() + " n'est plus gelé.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_SPECTATOR -> {
                    logSanction("SPECTATOR", target, staff, "", 0);
                    svc.setSpectator(target);
                    staff.sendMessage(Component.text(target.getName() + " est en mode spectateur.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_SURVIVAL -> {
                    logSanction("SURVIVAL", target, staff, "", 0);
                    svc.setSurvival(target);
                    staff.sendMessage(Component.text(target.getName() + " est en mode survie.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_STRIP -> {
                    logSanction("STRIP", target, staff, "", 0);
                    svc.stripInventory(target);
                    staff.sendMessage(Component.text("Équipement de " + target.getName() + " retiré.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_CLEAR_INV -> {
                    logSanction("CLEAR_INV", target, staff, "", 0);
                    svc.clearInventory(target);
                    staff.sendMessage(Component.text("Inventaire de " + target.getName() + " vidé.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_TP_SPAWN -> {
                    logSanction("TP_SPAWN", target, staff, "", 0);
                    svc.teleportSpawn(target);
                    staff.sendMessage(Component.text(target.getName() + " téléporté au spawn.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_HEAL -> {
                    logSanction("HEAL", target, staff, "", 0);
                    svc.heal(target);
                    staff.sendMessage(Component.text(target.getName() + " soigné.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_FEED -> {
                    logSanction("FEED", target, staff, "", 0);
                    svc.feed(target);
                    staff.sendMessage(Component.text(target.getName() + " nourri.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_DAMAGE -> {
                    logSanction("DAMAGE", target, staff, "", 0);
                    svc.damage(target, 0.5);
                    staff.sendMessage(Component.text("Dégâts infligés à " + target.getName()).color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_BURN -> {
                    logSanction("BURN", target, staff, "", 0);
                    svc.burn(target, 8 * 20); // 8 secondes
                    staff.sendMessage(Component.text(target.getName() + " enflammé.").color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_LIGHTNING -> {
                    logSanction("LIGHTNING", target, staff, "", 0);
                    svc.lightningEffect(target);
                    staff.sendMessage(Component.text("Effet foudre sur " + target.getName()).color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_MSG -> {
                    logSanction("MSG", target, staff, "Rappel du règlement", 0);
                    svc.sendCustomMessage(target, "Rappel du règlement — merci de le respecter.");
                    staff.sendMessage(Component.text("Message envoyé à " + target.getName()).color(NamedTextColor.GREEN));
                }
                case SanctionMenuGui.SLOT_BACK -> {
                    staff.closeInventory();
                    if (sanctionMenuGui.getPlayerListGui() != null) {
                        sanctionMenuGui.getPlayerListGui().open(staff);
                    }
                }
                default -> {}
            }
            return;
        }

        if (holder instanceof SanctionDurationHolder durationHolder) {
            event.setCancelled(true);
            Player target = durationHolder.getTarget();
            if (target == null || !target.isOnline()) {
                staff.sendMessage(Component.text("Ce joueur n'est plus en ligne.").color(NamedTextColor.RED));
                staff.closeInventory();
                return;
            }
            String type = durationHolder.getType();
            int slot = event.getSlot();
            Long duration = null;
            switch (slot) {
                case SanctionDurationGui.SLOT_1M -> duration = SanctionDurationGui.DURATION_1M;
                case SanctionDurationGui.SLOT_5M -> duration = SanctionDurationGui.DURATION_5M;
                case SanctionDurationGui.SLOT_15M -> duration = SanctionDurationGui.DURATION_15M;
                case SanctionDurationGui.SLOT_1H -> duration = SanctionDurationGui.DURATION_1H;
                case SanctionDurationGui.SLOT_6H -> duration = SanctionDurationGui.DURATION_6H;
                case SanctionDurationGui.SLOT_1D -> duration = SanctionDurationGui.DURATION_1D;
                case SanctionDurationGui.SLOT_7D -> duration = SanctionDurationGui.DURATION_7D;
                case SanctionDurationGui.SLOT_30D -> duration = SanctionDurationGui.DURATION_30D;
                case SanctionDurationGui.SLOT_BACK -> {
                    staff.closeInventory();
                    sanctionMenuGui.open(staff, target);
                }
                default -> {}
            }
            if (duration != null && slot != SanctionDurationGui.SLOT_BACK) {
                staff.closeInventory();
                sanctionMenuGui.getDurationGui().applyDuration(staff, target, type, duration);
                if (SanctionDurationHolder.TYPE_MUTE_TEMP.equals(type) && sanctionMenuGui.getPlayerListGui() != null) {
                    sanctionMenuGui.getPlayerListGui().open(staff);
                }
            }
        }
    }
}
