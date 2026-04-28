package sunanticheat.dashboard.playerlog;

import java.util.Map;
import java.util.UUID;

/**
 * Une entrée du log d'activité par joueur.
 *
 * Champs publics pour Gson (sérialisation REST).
 *
 * Le `payload` est un Map<String,Object> sérialisé en JSON pour stocker des
 * détails riches selon la catégorie (ex: pour DEATH on stocke killer, weapon ;
 * pour CHEST on stocke le type de container, le bloc lieu, etc.).
 */
public final class PlayerLogEntry {

    public String id;
    public long   timestamp;
    public String playerUuid;
    public String playerName;
    public String category;     // LOGIN / DEATH / CHAT / CONTAINER / TELEPORT / ECONOMY / GAMEPLAY / MODERATION
    public String action;       // JOIN / QUIT / DEATH / CHAT_MESSAGE / CHEST_OPEN / TP_HOME / ...
    public String world;
    public Integer x;           // null si pas applicable
    public Integer y;
    public Integer z;
    public String target;       // joueur tué, item ramassé, message, ...
    public Map<String, Object> payload;  // détails JSON

    public PlayerLogEntry() {}

    public static PlayerLogEntry of(String playerUuid, String playerName,
                                     String category, String action) {
        PlayerLogEntry e = new PlayerLogEntry();
        e.id = UUID.randomUUID().toString();
        e.timestamp = System.currentTimeMillis();
        e.playerUuid = playerUuid;
        e.playerName = playerName;
        e.category = category;
        e.action = action;
        return e;
    }

    public PlayerLogEntry at(String world, int x, int y, int z) {
        this.world = world; this.x = x; this.y = y; this.z = z; return this;
    }

    public PlayerLogEntry withTarget(String target) {
        this.target = target; return this;
    }

    public PlayerLogEntry withPayload(Map<String, Object> p) {
        this.payload = p; return this;
    }
}
