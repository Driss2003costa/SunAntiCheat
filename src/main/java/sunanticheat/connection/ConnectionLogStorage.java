package sunanticheat.connection;

import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Historique des connexions par joueur : IP, date join/quit.
 */
public class ConnectionLogStorage {

    private static final int MAX_SESSIONS_PER_PLAYER = 100;

    private final File file;
    private final Map<UUID, List<ConnectionSession>> byPlayer = new ConcurrentHashMap<>();
    private final Map<UUID, ConnectionSession> currentSession = new ConcurrentHashMap<>();

    public ConnectionLogStorage(JavaPlugin plugin) {
        this.file = new File(plugin.getDataFolder(), "connection-history.yml");
        load();
    }

    public void onJoin(UUID uuid, String name, String ip) {
        long now = System.currentTimeMillis();
        ConnectionSession session = new ConnectionSession(ip, now, 0);
        currentSession.put(uuid, session);
        byPlayer.compute(uuid, (k, list) -> {
            List<ConnectionSession> l = list != null ? list : new ArrayList<>();
            l.add(0, session);
            while (l.size() > MAX_SESSIONS_PER_PLAYER) l.remove(l.size() - 1);
            return l;
        });
        save();
    }

    /** Met à jour les données GeoIP de la session en cours d'un joueur. */
    public void updateGeoIp(UUID uuid, String countryCode, String country) {
        ConnectionSession session = currentSession.get(uuid);
        if (session != null) {
            session.setGeoIp(countryCode, country);
            save();
        }
    }

    public void onQuit(UUID uuid) {
        ConnectionSession session = currentSession.remove(uuid);
        if (session != null) {
            session.setLeaveTime(System.currentTimeMillis());
        }
        save();
    }

    /** Dernières sessions pour un joueur (plus récentes en premier). */
    public List<ConnectionSession> getSessions(UUID uuid, int limit) {
        List<ConnectionSession> list = byPlayer.get(uuid);
        if (list == null) return Collections.emptyList();
        return list.stream().limit(limit).toList();
    }

    public void save() {
        YamlConfiguration cfg = new YamlConfiguration();
        for (Map.Entry<UUID, List<ConnectionSession>> e : byPlayer.entrySet()) {
            String key = e.getKey().toString();
            List<Map<String, Object>> arr = new ArrayList<>();
            for (ConnectionSession s : e.getValue()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("ip", s.getIp());
                m.put("join", s.getJoinTime());
                m.put("leave", s.getLeaveTime());
                if (s.getCountryCode() != null && !s.getCountryCode().isEmpty())
                    m.put("countryCode", s.getCountryCode());
                if (s.getCountry() != null && !s.getCountry().isEmpty())
                    m.put("country", s.getCountry());
                arr.add(m);
            }
            cfg.set("players." + key, arr);
        }
        try {
            cfg.save(file);
        } catch (IOException ignored) {
        }
    }

    @SuppressWarnings("unchecked")
    public void load() {
        byPlayer.clear();
        currentSession.clear();
        if (!file.exists()) return;
        YamlConfiguration cfg = YamlConfiguration.loadConfiguration(file);
        var section = cfg.getConfigurationSection("players");
        if (section == null) return;
        for (String key : section.getKeys(false)) {
            UUID uuid;
            try {
                uuid = UUID.fromString(key);
            } catch (Exception ex) { continue; }
            List<?> list = section.getList(key);
            if (list == null) continue;
            List<ConnectionSession> sessions = new ArrayList<>();
            for (Object o : list) {
                if (!(o instanceof Map)) continue;
                Map<String, Object> m = (Map<String, Object>) o;
                String ip = String.valueOf(m.get("ip"));
                long join = ((Number) m.getOrDefault("join", 0L)).longValue();
                long leave = ((Number) m.getOrDefault("leave", 0L)).longValue();
                ConnectionSession s = new ConnectionSession(ip, join, leave);
                Object cc = m.get("countryCode");
                Object cn = m.get("country");
                if (cc != null || cn != null) {
                    s.setGeoIp(cc != null ? cc.toString() : "", cn != null ? cn.toString() : "");
                }
                sessions.add(s);
            }
            if (!sessions.isEmpty()) byPlayer.put(uuid, sessions);
        }
    }

    public static final class ConnectionSession {
        private final String ip;
        private final long joinTime;
        private long leaveTime;
        private String countryCode;
        private String country;

        public ConnectionSession(String ip, long joinTime, long leaveTime) {
            this.ip = ip != null ? ip : "?";
            this.joinTime = joinTime;
            this.leaveTime = leaveTime;
        }

        public void setLeaveTime(long leaveTime) {
            this.leaveTime = leaveTime;
        }

        public void setGeoIp(String countryCode, String country) {
            this.countryCode = countryCode;
            this.country = country;
        }

        public String getIp()          { return ip; }
        public long   getJoinTime()    { return joinTime; }
        public long   getLeaveTime()   { return leaveTime; }
        public String getCountryCode() { return countryCode != null ? countryCode : ""; }
        public String getCountry()     { return country != null ? country : ""; }
    }
}
