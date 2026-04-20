package sunanticheat.sanction;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.*;
import org.bukkit.BanList;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.Date;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Applique les sanctions : kick, ban, mute, freeze, inventaire, téléportation, dégâts, etc.
 */
public class SanctionService {

    private static final String DEFAULT_REASON = "Sanctionné par le staff";

    private final MuteStorage muteStorage;
    private final Set<UUID> frozen = ConcurrentHashMap.newKeySet();

    public SanctionService(MuteStorage muteStorage) {
        this.muteStorage = muteStorage;
    }

    public MuteStorage getMuteStorage() {
        return muteStorage;
    }

    public boolean isFrozen(UUID uuid) {
        return frozen.contains(uuid);
    }

    public void setFrozen(UUID uuid, boolean freeze) {
        if (freeze) frozen.add(uuid);
        else frozen.remove(uuid);
    }

    // ——— Kick ———
    public void kick(Player target, String reason) {
        target.kick(Component.text(reason != null && !reason.isEmpty() ? reason : DEFAULT_REASON).color(NamedTextColor.RED));
    }

    @SuppressWarnings("deprecation")
    public void banPermanent(Player target, String reason, String source) {
        String r = reason != null && !reason.isEmpty() ? reason : DEFAULT_REASON;
        Bukkit.getBanList(BanList.Type.NAME).addBan(target.getName(), r, null, source != null ? source : "SunAntiCheat");
        target.kick(Component.text("Vous êtes banni définitivement: " + r).color(NamedTextColor.RED));
    }

    @SuppressWarnings("deprecation")
    public void banTemporary(Player target, String reason, long endMillis, String source) {
        String r = reason != null && !reason.isEmpty() ? reason : DEFAULT_REASON;
        Bukkit.getBanList(BanList.Type.NAME).addBan(target.getName(), r, new Date(endMillis), source != null ? source : "SunAntiCheat");
        target.kick(Component.text("Vous êtes banni temporairement: " + r).color(NamedTextColor.RED));
    }

    @SuppressWarnings("deprecation")
    public void unban(String playerName) {
        Bukkit.getBanList(BanList.Type.NAME).pardon(playerName);
    }

    // ——— Mutes ———
    public void mutePermanent(Player target) {
        muteStorage.mute(target.getUniqueId(), 0L);
        target.sendMessage(Component.text("Vous êtes rendu muet définitivement.").color(NamedTextColor.RED));
    }

    public void muteTemporary(Player target, long endMillis) {
        muteStorage.mute(target.getUniqueId(), endMillis);
        long sec = (endMillis - System.currentTimeMillis()) / 1000;
        target.sendMessage(Component.text("Vous êtes muet pour " + sec + " secondes.").color(NamedTextColor.RED));
    }

    public void unmute(Player target) {
        muteStorage.unmute(target.getUniqueId());
        target.sendMessage(Component.text("Vous n'êtes plus muet.").color(NamedTextColor.GREEN));
    }

    public boolean isMuted(Player target) {
        return muteStorage.isMuted(target.getUniqueId());
    }

    // ——— Freeze ———
    public void freeze(Player target) {
        setFrozen(target.getUniqueId(), true);
        target.sendMessage(Component.text("Vous êtes gelé par le staff.").color(NamedTextColor.RED));
    }

    public void unfreeze(Player target) {
        setFrozen(target.getUniqueId(), false);
        target.sendMessage(Component.text("Vous n'êtes plus gelé.").color(NamedTextColor.GREEN));
    }

    // ——— Avertissement (message au joueur) ———
    public void warn(Player target, String message) {
        String msg = message != null && !message.isEmpty() ? message : "Comportement inapproprié.";
        target.sendMessage(Component.text("[Staff] " + msg).color(NamedTextColor.RED));
    }

    // ——— Mode de jeu ———
    public void setSpectator(Player target) {
        target.setGameMode(GameMode.SPECTATOR);
        target.sendMessage(Component.text("Mode spectateur activé par le staff.").color(NamedTextColor.GRAY));
    }

    public void setSurvival(Player target) {
        target.setGameMode(GameMode.SURVIVAL);
        target.sendMessage(Component.text("Mode survie rétabli.").color(NamedTextColor.GRAY));
    }

    // ——— Inventaire ———
    public void stripInventory(Player target) {
        target.getInventory().clear();
        target.getInventory().setArmorContents(new ItemStack[4]);
        target.sendMessage(Component.text("Votre équipement a été retiré par le staff.").color(NamedTextColor.RED));
    }

    public void clearInventory(Player target) {
        target.getInventory().clear();
        target.sendMessage(Component.text("Votre inventaire a été vidé par le staff.").color(NamedTextColor.RED));
    }

    // ——— Téléportation ———
    public void teleportSpawn(Player target) {
        Location spawn = target.getWorld().getSpawnLocation();
        if (spawn != null) {
            target.teleport(spawn);
            target.sendMessage(Component.text("Vous avez été téléporté au spawn.").color(NamedTextColor.GRAY));
        }
    }

    // ——— Vie / faim ———
    public void heal(Player target) {
        double maxHp = target.getAttribute(org.bukkit.attribute.Attribute.GENERIC_MAX_HEALTH) != null
                ? target.getAttribute(org.bukkit.attribute.Attribute.GENERIC_MAX_HEALTH).getValue() : 20.0;
        target.setHealth(maxHp);
        target.setFoodLevel(20);
        target.setSaturation(20f);
        target.sendMessage(Component.text("Vous avez été soigné par le staff.").color(NamedTextColor.GREEN));
    }

    public void feed(Player target) {
        target.setFoodLevel(20);
        target.setSaturation(20f);
        target.sendMessage(Component.text("Vous avez été nourri par le staff.").color(NamedTextColor.GREEN));
    }

    public void damage(Player target, double hearts) {
        double d = Math.min(hearts * 2, target.getHealth()); // 1 cœur = 2 dégâts
        target.setHealth(Math.max(0.01, target.getHealth() - d));
        target.sendMessage(Component.text("Vous avez reçu des dégâts.").color(NamedTextColor.RED));
    }

    public void burn(Player target, int ticks) {
        target.setFireTicks(Math.max(0, ticks));
        target.sendMessage(Component.text("Vous avez été enflammé.").color(NamedTextColor.RED));
    }

    // ——— Effets ———
    public void lightningEffect(Player target) {
        target.getWorld().strikeLightningEffect(target.getLocation());
        target.sendMessage(Component.text("Effet de foudre (cosmétique).").color(NamedTextColor.GRAY));
    }

    // ——— Message personnalisé ———
    public void sendCustomMessage(Player target, String message) {
        if (message != null && !message.isEmpty()) {
            target.sendMessage(Component.text("[Staff] " + message).color(NamedTextColor.GOLD));
        }
    }
}
