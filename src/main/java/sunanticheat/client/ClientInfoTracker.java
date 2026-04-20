package sunanticheat.client;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Stocke les infos client par joueur (marque, premium, mods, packs).
 */
public class ClientInfoTracker {

    private final Map<UUID, ClientInfo> byUuid = new ConcurrentHashMap<>();

    public ClientInfo getOrCreate(UUID uuid) {
        return byUuid.computeIfAbsent(uuid, k -> new ClientInfo());
    }

    public ClientInfo getInfo(UUID uuid) {
        return byUuid.get(uuid);
    }

    public void remove(UUID uuid) {
        byUuid.remove(uuid);
    }
}
