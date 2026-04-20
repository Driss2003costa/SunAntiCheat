package sunanticheat.report;

import java.util.UUID;

/** Un signalement (report) d'un joueur par un autre. */
public final class ReportEntry {

    private final String id;
    private final UUID reporterUuid;
    private final String reporterName;
    private final UUID reportedUuid;
    private final String reportedName;
    private final String reason;
    private final long timestamp;
    private volatile boolean resolved;

    public ReportEntry(UUID reporterUuid, String reporterName, UUID reportedUuid, String reportedName, String reason, long timestamp) {
        this.id = UUID.randomUUID().toString();
        this.reporterUuid = reporterUuid;
        this.reporterName = reporterName != null ? reporterName : "?";
        this.reportedUuid = reportedUuid;
        this.reportedName = reportedName != null ? reportedName : "?";
        this.reason = reason != null ? reason : "";
        this.timestamp = timestamp;
        this.resolved = false;
    }

    /** Constructeur interne pour la désérialisation (avec id et resolved connus). */
    public ReportEntry(String id, UUID reporterUuid, String reporterName, UUID reportedUuid, String reportedName, String reason, long timestamp, boolean resolved) {
        this.id = id != null ? id : UUID.randomUUID().toString();
        this.reporterUuid = reporterUuid;
        this.reporterName = reporterName != null ? reporterName : "?";
        this.reportedUuid = reportedUuid;
        this.reportedName = reportedName != null ? reportedName : "?";
        this.reason = reason != null ? reason : "";
        this.timestamp = timestamp;
        this.resolved = resolved;
    }

    public String getId() { return id; }
    public UUID getReporterUuid() { return reporterUuid; }
    public String getReporterName() { return reporterName; }
    public UUID getReportedUuid() { return reportedUuid; }
    public String getReportedName() { return reportedName; }
    public String getReason() { return reason; }
    public long getTimestamp() { return timestamp; }
    public boolean isResolved() { return resolved; }
    public void setResolved(boolean resolved) { this.resolved = resolved; }
}
