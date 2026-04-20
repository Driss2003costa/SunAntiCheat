package sunanticheat.dashboard.crates;

/**
 * Crate physique plac\u00e9e dans le monde.
 */
public class PlacedCrate {
    public String crateId;
    public String world;
    public int x;
    public int y;
    public int z;

    public PlacedCrate() {}

    public PlacedCrate(String crateId, String world, int x, int y, int z) {
        this.crateId = crateId;
        this.world = world;
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public String key() {
        return world + "," + x + "," + y + "," + z;
    }
}
