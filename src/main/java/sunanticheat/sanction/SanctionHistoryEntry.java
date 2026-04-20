package sunanticheat.sanction;

import java.util.UUID;

/** Une entrée d'historique de sanction (kick, ban, mute, etc.). */
public final class SanctionHistoryEntry {

    private final String type;
    private final UUID targetUuid;
    private final String targetName;
    private final UUID staffUuid;
    private final String staffName;
    private final String reason;
    private final long durationMillis;
    private final long timestamp;

    public SanctionHistoryEntry(String type, UUID targetUuid, String targetName,
                                 UUID staffUuid, String staffName, String reason,
                                 long durationMillis, long timestamp) {
        this.type = type != null ? type : "?";
        this.targetUuid = targetUuid;
        this.targetName = targetName != null ? targetName : "?";
        this.staffUuid = staffUuid;
        this.staffName = staffName != null ? staffName : "?";
        this.reason = reason != null ? reason : "";
        this.durationMillis = durationMillis;
        this.timestamp = timestamp;
    }

    public String getType() { return type; }
    public UUID getTargetUuid() { return targetUuid; }
    public String getTargetName() { return targetName; }
    public UUID getStaffUuid() { return staffUuid; }
    public String getStaffName() { return staffName; }
    public String getReason() { return reason; }
    public long getDurationMillis() { return durationMillis; }
    public long getTimestamp() { return timestamp; }
}
