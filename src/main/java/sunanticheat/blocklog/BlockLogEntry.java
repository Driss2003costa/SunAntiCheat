package sunanticheat.blocklog;

import java.util.UUID;

/**
 * Une entrée de log pour un bloc : cassé, placé ou interaction (clic droit).
 */
public final class BlockLogEntry {

    public enum Type {
        BREAK("Cassé"),
        PLACE("Placé"),
        INTERACT("Interaction");

        private final String label;

        Type(String label) {
            this.label = label;
        }

        public String getLabel() {
            return label;
        }
    }

    private final Type type;
    private final String playerName;
    private final UUID playerUuid;
    private final long timestamp;
    /** Pour BREAK : état du bloc avant cassage (restauration rollback). Null pour PLACE/INTERACT. */
    private final String serializedBlockState;

    public BlockLogEntry(Type type, String playerName, UUID playerUuid, long timestamp) {
        this(type, playerName, playerUuid, timestamp, null);
    }

    public BlockLogEntry(Type type, String playerName, UUID playerUuid, long timestamp, String serializedBlockState) {
        this.type = type;
        this.playerName = playerName != null ? playerName : "?";
        this.playerUuid = playerUuid;
        this.timestamp = timestamp;
        this.serializedBlockState = serializedBlockState;
    }

    public Type getType() {
        return type;
    }

    public String getPlayerName() {
        return playerName;
    }

    public UUID getPlayerUuid() {
        return playerUuid;
    }

    public long getTimestamp() {
        return timestamp;
    }

    /** État du bloc (BREAK uniquement) pour rollback. */
    public String getSerializedBlockState() {
        return serializedBlockState;
    }
}
