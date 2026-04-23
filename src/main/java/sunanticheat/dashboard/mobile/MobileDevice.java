package sunanticheat.dashboard.mobile;

/**
 * Représente un device mobile enregistré pour recevoir les push notifications.
 */
public final class MobileDevice {
    public String expoPushToken;   // ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
    public String username;        // user dashboard auquel le device est associé
    public String deviceName;      // ex: "Pixel 8 (android)"
    public long registeredAt;
    public long lastSeenAt;

    public MobileDevice() {}
    public MobileDevice(String token, String username, String deviceName) {
        this.expoPushToken = token;
        this.username = username;
        this.deviceName = deviceName;
        this.registeredAt = System.currentTimeMillis();
        this.lastSeenAt = this.registeredAt;
    }
}
