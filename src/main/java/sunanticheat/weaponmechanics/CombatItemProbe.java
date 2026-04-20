package sunanticheat.weaponmechanics;

import org.bukkit.Material;
import org.bukkit.Tag;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;

/**
 * Arme WeaponMechanics ou arme de combat vanilla (épée, hache, arc, arbalète, trident, masse).
 */
public final class CombatItemProbe {

    private CombatItemProbe() {}

    public static boolean isWeaponLike(ItemStack stack) {
        if (stack == null || stack.getType().isAir()) return false;
        if (WeaponMechanicsItemProbe.isWeaponMechanicsWeapon(stack)) return true;
        return isVanillaCombatWeapon(stack.getType());
    }

    private static boolean isVanillaCombatWeapon(Material m) {
        if (Tag.ITEMS_SWORDS.isTagged(m)) return true;
        if (Tag.ITEMS_AXES.isTagged(m)) return true;
        if (m == Material.BOW || m == Material.CROSSBOW || m == Material.TRIDENT) return true;
        if (m == Material.MACE) return true;
        return false;
    }

    public static boolean playerCarriesWeapon(Player player) {
        if (player == null) return false;
        PlayerInventory inv = player.getInventory();
        for (ItemStack s : inv.getContents()) {
            if (isWeaponLike(s)) return true;
        }
        for (ItemStack s : inv.getArmorContents()) {
            if (isWeaponLike(s)) return true;
        }
        return isWeaponLike(inv.getItemInOffHand());
    }
}
