package sunanticheat.dashboard.events;

import java.util.List;

public final class CalendarEvent {
    private final String id;
    private String title;
    private String description;
    private long startAt;
    private int durationMinutes;
    private String color;
    private String icon;
    private List<String> broadcastMessages; // ["Event commence dans %d"]
    private List<Integer> broadcastOffsetsMinutes; // [60, 30, 5]
    private String startCommand; // commande console à exécuter au début (optionnel)
    private String endCommand;   // commande console à exécuter à la fin (optionnel)
    private final long createdAt;

    // état runtime
    private boolean started;
    private boolean ended;

    public CalendarEvent(String id, String title, String description, long startAt, int durationMinutes,
                         String color, String icon,
                         List<String> broadcastMessages, List<Integer> broadcastOffsetsMinutes,
                         String startCommand, String endCommand, long createdAt,
                         boolean started, boolean ended) {
        this.id = id;
        this.title = title != null ? title : "Event";
        this.description = description != null ? description : "";
        this.startAt = startAt;
        this.durationMinutes = durationMinutes > 0 ? durationMinutes : 60;
        this.color = color != null ? color : "#F59E0B";
        this.icon = icon != null ? icon : "🎉";
        this.broadcastMessages = broadcastMessages;
        this.broadcastOffsetsMinutes = broadcastOffsetsMinutes;
        this.startCommand = startCommand;
        this.endCommand = endCommand;
        this.createdAt = createdAt;
        this.started = started;
        this.ended = ended;
    }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public long getStartAt() { return startAt; }
    public int getDurationMinutes() { return durationMinutes; }
    public String getColor() { return color; }
    public String getIcon() { return icon; }
    public List<String> getBroadcastMessages() { return broadcastMessages; }
    public List<Integer> getBroadcastOffsetsMinutes() { return broadcastOffsetsMinutes; }
    public String getStartCommand() { return startCommand; }
    public String getEndCommand() { return endCommand; }
    public long getCreatedAt() { return createdAt; }
    public boolean isStarted() { return started; }
    public boolean isEnded() { return ended; }

    public void setTitle(String v) { title = v; }
    public void setDescription(String v) { description = v; }
    public void setStartAt(long v) { startAt = v; }
    public void setDurationMinutes(int v) { durationMinutes = v; }
    public void setColor(String v) { color = v; }
    public void setIcon(String v) { icon = v; }
    public void setBroadcastMessages(List<String> v) { broadcastMessages = v; }
    public void setBroadcastOffsetsMinutes(List<Integer> v) { broadcastOffsetsMinutes = v; }
    public void setStartCommand(String v) { startCommand = v; }
    public void setEndCommand(String v) { endCommand = v; }
    public void setStarted(boolean v) { started = v; }
    public void setEnded(boolean v) { ended = v; }
}
