package sunanticheat.dashboard.games;

/**
 * POJO d'arène — sérialisable Gson, pour réponse REST.
 */
public final class Arena {
    public String game;          // "CTF" / "Skywars" / ...
    public String gameLabel;     // "Capture the Flag" / "Skywars" / ...
    public String icon;          // emoji
    public String name;          // nom de l'arène
    public String world;         // nom du monde Bukkit (peut être null)
    public int minPlayers;
    public int maxPlayers;
    public int currentPlayers;
    public String status;        // PLAYING / WAITING
    public String players;       // noms concaténés (max 100 chars)
    public String extra;         // info libre (spawns, flags, etc.)
}
