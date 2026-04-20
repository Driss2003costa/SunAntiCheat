package sunanticheat.dashboard.alerts;

public record AlertEntry(
        long timestamp,
        String type,
        String playerName,
        String world,
        String detail
) {}
