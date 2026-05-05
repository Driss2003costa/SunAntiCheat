package sunanticheat.dashboard.crates;

public class CratePendingClaim {
    public String crateId;
    public int count;
    public String claimedAt;

    public CratePendingClaim() {}

    public CratePendingClaim(String crateId, int count, String claimedAt) {
        this.crateId   = crateId;
        this.count     = count;
        this.claimedAt = claimedAt;
    }

    public String getCrateId()   { return crateId; }
    public int    getCount()     { return count; }
    public String getClaimedAt() { return claimedAt; }
}
