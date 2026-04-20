package sunanticheat.dashboard.tasks;

import java.util.List;

/**
 * Une tâche planifiée : exécute une commande console à des heures précises chaque jour.
 * times : liste de "HH:MM" en 24h.
 */
public final class ScheduledTask {

    private final String id;
    private String name;
    private String command;
    private List<String> times;   // ["08:00", "12:30", "20:00"]
    private boolean enabled;
    private String color;         // hex couleur pour l'UI (ex: "#7C3AED")
    private String icon;          // emoji pour l'UI
    private long lastRun;         // timestamp dernier run
    private long createdAt;

    public ScheduledTask(String id, String name, String command, List<String> times,
                         boolean enabled, String color, String icon, long lastRun, long createdAt) {
        this.id = id;
        this.name = name != null ? name : "Tâche sans nom";
        this.command = command != null ? command : "";
        this.times = times != null ? times : List.of();
        this.enabled = enabled;
        this.color = color != null ? color : "#7C3AED";
        this.icon = icon != null ? icon : "⚡";
        this.lastRun = lastRun;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getCommand() { return command; }
    public List<String> getTimes() { return times; }
    public boolean isEnabled() { return enabled; }
    public String getColor() { return color; }
    public String getIcon() { return icon; }
    public long getLastRun() { return lastRun; }
    public long getCreatedAt() { return createdAt; }

    public void setName(String name)            { this.name = name; }
    public void setCommand(String command)      { this.command = command; }
    public void setTimes(List<String> times)    { this.times = times; }
    public void setEnabled(boolean enabled)     { this.enabled = enabled; }
    public void setColor(String color)          { this.color = color; }
    public void setIcon(String icon)            { this.icon = icon; }
    public void setLastRun(long lastRun)        { this.lastRun = lastRun; }
}
