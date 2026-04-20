package sunanticheat.dashboard.analytics;

public record AnalyticsSnapshot(
        long timestamp,
        int playersOnline,
        double tps,
        int ramUsedMb,
        int chunksLoaded
) {}
