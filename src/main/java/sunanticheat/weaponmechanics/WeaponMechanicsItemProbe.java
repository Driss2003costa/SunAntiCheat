package sunanticheat.weaponmechanics;

import org.bukkit.Bukkit;
import org.bukkit.NamespacedKey;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.plugin.Plugin;

import java.lang.reflect.Method;

/**
 * Détecte si un {@link ItemStack} est une arme WeaponMechanics : API officielle (réflexion)
 * si le plugin est présent, sinon heuristique sur les clés PDC (namespace weaponmechanics).
 */
public final class WeaponMechanicsItemProbe {

    private static volatile boolean reflectionTried;
    private static volatile Object infoHandler;
    private static volatile Method isWeaponMethod;

    private WeaponMechanicsItemProbe() {}

    public static boolean isWeaponMechanicsWeapon(ItemStack stack) {
        if (stack == null || stack.getType().isAir()) return false;
        ensureReflection();
        if (isWeaponMethod != null && infoHandler != null) {
            try {
                Object r = isWeaponMethod.invoke(infoHandler, stack);
                if (r instanceof Boolean b) return b;
            } catch (Throwable ignored) {}
        }
        return hasWeaponMechanicsPersistentData(stack);
    }

    private static void ensureReflection() {
        if (reflectionTried) return;
        synchronized (WeaponMechanicsItemProbe.class) {
            if (reflectionTried) return;
            reflectionTried = true;
            Plugin wm = Bukkit.getPluginManager().getPlugin("WeaponMechanics");
            if (wm == null) return;
            try {
                Object weaponHandler = wm.getClass().getMethod("getWeaponHandler").invoke(wm);
                if (weaponHandler == null) return;
                Object info = weaponHandler.getClass().getMethod("getInfoHandler").invoke(weaponHandler);
                if (info == null) return;
                for (String name : new String[] {"isWeapon", "isValidWeapon", "isWeaponItem"}) {
                    try {
                        Method m = info.getClass().getMethod(name, ItemStack.class);
                        if (m.getReturnType() == boolean.class || m.getReturnType() == Boolean.class) {
                            infoHandler = info;
                            isWeaponMethod = m;
                            return;
                        }
                    } catch (NoSuchMethodException ignored) {}
                }
            } catch (Throwable t) {
                Bukkit.getLogger().fine("[SunAntiCheat] WeaponMechanics API (réflexion) indisponible: " + t.getMessage());
            }
        }
    }

    static boolean hasWeaponMechanicsPersistentData(ItemStack stack) {
        ItemMeta meta = stack.getItemMeta();
        if (meta == null) return false;
        PersistentDataContainer pdc = meta.getPersistentDataContainer();
        for (NamespacedKey key : pdc.getKeys()) {
            String ns = key.getNamespace();
            if (ns != null && ns.toLowerCase().contains("weaponmechanic")) {
                return true;
            }
        }
        return false;
    }

    /** Réinitialise le cache API (ex. après reload du plugin WM). */
    public static void resetReflectionCache() {
        synchronized (WeaponMechanicsItemProbe.class) {
            reflectionTried = false;
            infoHandler = null;
            isWeaponMethod = null;
        }
    }

}
