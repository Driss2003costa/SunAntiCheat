package sunanticheat.dashboard;

import sunanticheat.client.ClientInfoTracker;
import sunanticheat.connection.ConnectionLogStorage;
import sunanticheat.pickup.ItemPickupStorage;
import sunanticheat.playtime.PlaytimeTracker;
import sunanticheat.xray.XRayLogManager;
import sunanticheat.xray.XRayTracker;

/**
 * Regroupe les data sources du plugin principal passées au DashboardModule.
 */
public record GameDataBundle(
        ClientInfoTracker clientInfoTracker,
        PlaytimeTracker   playtimeTracker,
        ConnectionLogStorage connectionLog,
        ItemPickupStorage itemPickup,
        XRayTracker       xrayTracker,
        XRayLogManager    xrayLogManager
) {}
