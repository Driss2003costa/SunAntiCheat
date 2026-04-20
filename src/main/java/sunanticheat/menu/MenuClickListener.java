package sunanticheat.menu;

import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.SkullMeta;

/**
 * Gère les clics : menu principal (54 slots), listes joueurs, fiche joueur, inventaire (lecture seule), etc.
 */
public class MenuClickListener implements Listener {

    private final MainMenuGui mainMenuGui;
    private final PlayerInventoryGui playerInventoryGui;

    public MenuClickListener(MainMenuGui mainMenuGui, PlayerInventoryGui playerInventoryGui) {
        this.mainMenuGui = mainMenuGui;
        this.playerInventoryGui = playerInventoryGui;
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }

        var holder = event.getInventory().getHolder();

        if (holder instanceof MainMenuHolder) {
            event.setCancelled(true);
            if (event.getSlot() == MainMenuGui.SLOT_XRAY) {
                if (!player.hasPermission("sunguard.xray.gui")) {
                    player.sendMessage("§cVous n'avez pas la permission d'ouvrir l'Anti X-Ray.");
                    return;
                }
                player.closeInventory();
                mainMenuGui.getXRayGui().open(player);
            } else if (event.getSlot() == MainMenuGui.SLOT_FREECAM) {
                if (!player.hasPermission("sunguard.freecam.gui")) {
                    player.sendMessage("§cVous n'avez pas la permission d'ouvrir l'Anti Freecam.");
                    return;
                }
                player.closeInventory();
                mainMenuGui.getFreecamGui().open(player);
            } else if (event.getSlot() == MainMenuGui.SLOT_CLIENT_INFO) {
                if (!player.hasPermission("sunguard.client.gui")) {
                    player.sendMessage("§cVous n'avez pas la permission de voir les infos client.");
                    return;
                }
                player.closeInventory();
                mainMenuGui.getClientInfoGui().open(player);
            } else if (event.getSlot() == MainMenuGui.SLOT_SANCTIONS) {
                if (!player.hasPermission("sunguard.sanction.gui")) {
                    player.sendMessage("§cVous n'avez pas la permission d'ouvrir le menu des sanctions.");
                    return;
                }
                player.closeInventory();
                if (mainMenuGui.getSanctionPlayerListGui() != null) {
                    mainMenuGui.getSanctionPlayerListGui().open(player);
                }
            } else if (event.getSlot() == MainMenuGui.SLOT_PLAYER_DATA) {
                if (!player.hasPermission("sunguard.playerdata.gui")) {
                    player.sendMessage("§cVous n'avez pas la permission d'ouvrir la fiche joueur.");
                    return;
                }
                player.closeInventory();
                if (mainMenuGui.getPlayerDataListGui() != null) {
                    mainMenuGui.getPlayerDataListGui().open(player);
                }
            } else if (event.getSlot() == MainMenuGui.SLOT_REPORTS) {
                if (!player.hasPermission("sunguard.report.view")) {
                    player.sendMessage("§cVous n'avez pas la permission de voir les reports.");
                    return;
                }
                player.closeInventory();
                if (mainMenuGui.getReportListGui() != null) {
                    mainMenuGui.getReportListGui().open(player);
                }
            } else if (event.getSlot() == MainMenuGui.SLOT_DEBUG) {
                if (!player.hasPermission("sunguard.debug")) {
                    player.sendMessage("§cVous n'avez pas la permission d'ouvrir le menu debug.");
                    return;
                }
                player.closeInventory();
                if (mainMenuGui.getDebugGui() != null) {
                    mainMenuGui.getDebugGui().open(player);
                }
            }
            return;
        }

        if (holder instanceof DebugGui.Holder) {
            event.setCancelled(true);
            int slot = event.getSlot();
            DebugGui debugGui = mainMenuGui.getDebugGui();
            if (debugGui == null) return;
            if (slot == DebugGui.SLOT_TEST_DISCORD) {
                player.closeInventory();
                debugGui.onTestDiscord(player);
            } else if (slot == DebugGui.SLOT_TEST_ALERT) {
                player.closeInventory();
                debugGui.onTestAlert(player);
            } else if (slot == DebugGui.SLOT_TEST_REPORT_DISCORD) {
                player.closeInventory();
                debugGui.onTestReportDiscord(player);
            } else if (slot == DebugGui.SLOT_BACK) {
                player.closeInventory();
                mainMenuGui.open(player);
            }
            return;
        }

        if (holder instanceof ClientInfoListHolder) {
            event.setCancelled(true);
            ItemStack clicked = event.getCurrentItem();
            if (clicked != null && clicked.getType() == Material.PLAYER_HEAD && clicked.getItemMeta() instanceof SkullMeta skullMeta && skullMeta.getOwningPlayer() != null) {
                Player target = skullMeta.getOwningPlayer().getPlayer();
                if (target != null && target.isOnline()) {
                    player.closeInventory();
                    mainMenuGui.getClientInfoGui().openDetail(player, target);
                }
            }
            return;
        }

        if (holder instanceof ClientInfoDetailHolder) {
            event.setCancelled(true);
            return;
        }

        if (holder instanceof PlayerListHolder) {
            event.setCancelled(true);
            ItemStack clicked = event.getCurrentItem();
            if (clicked != null && clicked.getType() == Material.PLAYER_HEAD && clicked.getItemMeta() instanceof SkullMeta skullMeta && skullMeta.getOwningPlayer() != null) {
                Player target = skullMeta.getOwningPlayer().getPlayer();
                if (target != null && target.isOnline()) {
                    player.closeInventory();
                    playerInventoryGui.open(player, target);
                }
            }
            return;
        }

        if (holder instanceof PlayerDataListHolder) {
            event.setCancelled(true);
            ItemStack clicked = event.getCurrentItem();
            if (clicked != null && clicked.getType() == Material.PLAYER_HEAD && clicked.getItemMeta() instanceof SkullMeta skullMeta && skullMeta.getOwningPlayer() != null) {
                Player target = skullMeta.getOwningPlayer().getPlayer();
                if (target != null && target.isOnline() && mainMenuGui.getPlayerDataListGui() != null) {
                    player.closeInventory();
                    mainMenuGui.getPlayerDataListGui().getDetailGui().open(player, target);
                }
            }
            return;
        }

        if (holder instanceof PlayerDataDetailHolder detailHolder) {
            event.setCancelled(true);
            int slot = event.getSlot();
            if (slot == 49 && mainMenuGui.getPlayerDataListGui() != null) {
                player.closeInventory();
                mainMenuGui.getPlayerDataListGui().open(player);
            } else if (slot == 48 && mainMenuGui.getSanctionHistoryGui() != null && player.hasPermission("sunguard.sanction.gui")) {
                player.closeInventory();
                java.util.UUID targetUuid = detailHolder.getTargetUuid();
                String targetName = org.bukkit.Bukkit.getOfflinePlayer(targetUuid).getName();
                mainMenuGui.getSanctionHistoryGui().open(player, targetUuid, targetName);
            } else if (slot == 50 && player.hasPermission("sunguard.inventory.gui")) {
                player.closeInventory();
                playerInventoryGui.open(player, detailHolder.getTargetUuid());
            }
            return;
        }

        if (holder instanceof PlayerInventoryHolder) {
            event.setCancelled(true);
        }

        if (holder instanceof sunanticheat.blocklog.BlockLogGuiHolder) {
            event.setCancelled(true);
            if (event.getSlot() == sunanticheat.blocklog.BlockLogGui.SLOT_BACK) {
                player.closeInventory();
            }
            return;
        }

        if (holder instanceof sunanticheat.sanction.SanctionHistoryGui.Holder) {
            event.setCancelled(true);
        }

        if (holder instanceof sunanticheat.report.ReportListGui.Holder reportHolder) {
            event.setCancelled(true);
            sunanticheat.report.ReportEntry entry = sunanticheat.report.ReportListGui.getEntryAt(reportHolder, event.getSlot());
            if (entry != null && player.hasPermission("sunguard.report.view")) {
                org.bukkit.entity.Player reported = org.bukkit.Bukkit.getPlayer(entry.getReportedUuid());
                if (reported != null && reported.isOnline()) {
                    player.closeInventory();
                    mainMenuGui.openSanctionMenuFor(player, reported);
                }
            }
        }
    }
}
