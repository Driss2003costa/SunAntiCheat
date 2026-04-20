package sunanticheat.blocklog;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Mode « édition » / inspection : quand actif pour un joueur, le clic droit sur un bloc ouvre le log.
 */
public class BlockLogInspectionMode {

    private final Set<UUID> active = ConcurrentHashMap.newKeySet();

    public boolean toggle(UUID playerUuid) {
        if (active.remove(playerUuid)) {
            return false;
        }
        active.add(playerUuid);
        return true;
    }

    public boolean isActive(UUID playerUuid) {
        return active.contains(playerUuid);
    }

    public void setActive(UUID playerUuid, boolean on) {
        if (on) active.add(playerUuid);
        else active.remove(playerUuid);
    }
}
