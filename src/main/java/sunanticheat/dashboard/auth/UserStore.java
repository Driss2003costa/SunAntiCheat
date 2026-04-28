package sunanticheat.dashboard.auth;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import org.bukkit.configuration.file.FileConfiguration;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Stocke les comptes dashboard dans dashboard/users.json.
 * Au premier démarrage, migre les comptes définis dans config.yml.
 */
public final class UserStore {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final Persistence storage;
    private final Logger logger;
    private final Map<String, StoredUser> users = new ConcurrentHashMap<>();

    public UserStore(File dataFolder, Logger logger, FileConfiguration config, BlobStorage blobs) {
        this.logger = logger;
        File legacyFile = new File(new File(dataFolder, "dashboard"), "users.json");
        this.storage = new Persistence(blobs, "users", legacyFile);

        String json = storage.read();
        if (json != null && !json.isBlank()) {
            load(json);
        } else {
            migrateFromConfig(config);
        }

        // Toujours garantir au moins 1 admin
        ensureDefaultAdmin();
    }

    // ── Authentification ──────────────────────────────────────────────────────

    public DashboardUser authenticate(String username, String password) {
        StoredUser u = users.get(username.toLowerCase());
        if (u == null) return null;
        if (!verify(password, u.passwordHash)) return null;
        u.lastLoginAt = System.currentTimeMillis();
        save();
        return toDashboardUser(u);
    }

    // ── Lecture ───────────────────────────────────────────────────────────────

    public Map<String, DashboardUser> asMap() {
        Map<String, DashboardUser> out = new LinkedHashMap<>();
        users.forEach((k, v) -> out.put(k, toDashboardUser(v)));
        return out;
    }

    public List<Map<String, Object>> listPublic() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (StoredUser u : users.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("username", u.username);
            m.put("role", u.role);
            m.put("createdAt", u.createdAt);
            m.put("lastLoginAt", u.lastLoginAt);
            m.put("totpEnabled", u.totpEnabled);
            out.add(m);
        }
        out.sort(Comparator.comparing(m -> (String) m.get("username")));
        return out;
    }

    /** Lit le StoredUser brut (pour les opérations 2FA). */
    public synchronized StoredUser getStoredUser(String username) {
        return username == null ? null : users.get(username.toLowerCase());
    }

    /** Active le 2FA pour un user après vérification du code TOTP. */
    public synchronized String setupTotp(String username, String secret) {
        StoredUser u = users.get(username.toLowerCase());
        if (u == null) return "Utilisateur introuvable";
        u.totpSecret = secret;
        u.totpEnabled = false; // Pas encore activé tant que le user n'a pas validé un code
        save();
        return null;
    }

    public synchronized String enableTotp(String username) {
        StoredUser u = users.get(username.toLowerCase());
        if (u == null) return "Utilisateur introuvable";
        if (u.totpSecret == null || u.totpSecret.isBlank()) return "Pas de secret configuré";
        u.totpEnabled = true;
        save();
        return null;
    }

    public synchronized String disableTotp(String username) {
        StoredUser u = users.get(username.toLowerCase());
        if (u == null) return "Utilisateur introuvable";
        u.totpSecret = null;
        u.totpEnabled = false;
        save();
        return null;
    }

    public boolean exists(String username) {
        return users.containsKey(username.toLowerCase());
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public String create(String username, String password, String role) {
        String key = username.toLowerCase();
        if (users.containsKey(key)) return "Ce nom d'utilisateur existe déjà.";
        if (username.length() < 3 || username.length() > 32)
            return "Le nom doit faire entre 3 et 32 caractères.";
        if (!username.matches("[a-zA-Z0-9_-]+"))
            return "Caractères autorisés : lettres, chiffres, _ et -.";
        if (password != null && password.length() < 6)
            return "Le mot de passe doit faire au moins 6 caractères.";

        DashboardRole r = parseRole(role);
        String hash = password != null && !password.isBlank()
                ? hash(password)
                : hash(generatePassword(16));
        StoredUser u = new StoredUser(username, hash, r.name(), System.currentTimeMillis());
        users.put(key, u);
        save();
        return null; // null = succès
    }

    public String changePassword(String username, String currentPassword, String newPassword, boolean byAdmin) {
        StoredUser u = users.get(username.toLowerCase());
        if (u == null) return "Utilisateur introuvable.";
        if (!byAdmin && !verify(currentPassword, u.passwordHash))
            return "Mot de passe actuel incorrect.";
        if (newPassword == null || newPassword.length() < 6)
            return "Le nouveau mot de passe doit faire au moins 6 caractères.";
        u.passwordHash = hash(newPassword);
        save();
        return null;
    }

    public String changeRole(String username, String newRole) {
        StoredUser u = users.get(username.toLowerCase());
        if (u == null) return "Utilisateur introuvable.";
        DashboardRole r = parseRole(newRole);
        // Garde au moins 1 admin
        if (u.role.equals("ADMIN") && r != DashboardRole.ADMIN && adminCount() <= 1)
            return "Impossible : il doit rester au moins un administrateur.";
        u.role = r.name();
        save();
        return null;
    }

    public String delete(String username, String requestedBy) {
        String key = username.toLowerCase();
        if (!users.containsKey(key)) return "Utilisateur introuvable.";
        if (key.equals(requestedBy.toLowerCase())) return "Vous ne pouvez pas supprimer votre propre compte.";
        StoredUser u = users.get(key);
        if (u.role.equals("ADMIN") && adminCount() <= 1)
            return "Impossible : il doit rester au moins un administrateur.";
        users.remove(key);
        save();
        return null;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private long adminCount() {
        return users.values().stream().filter(u -> "ADMIN".equals(u.role)).count();
    }

    private static DashboardUser toDashboardUser(StoredUser u) {
        DashboardRole role;
        try { role = DashboardRole.valueOf(u.role); } catch (Exception e) { role = DashboardRole.MOD; }
        return new DashboardUser(u.username, u.passwordHash, role, u.customRoleId);
    }

    private static DashboardRole parseRole(String role) {
        if (role == null) return DashboardRole.MOD;
        try { return DashboardRole.valueOf(role.toUpperCase()); } catch (Exception e) { return DashboardRole.MOD; }
    }

    private static String hash(String plain) {
        return BCrypt.withDefaults().hashToString(12, plain.toCharArray());
    }

    private static boolean verify(String plain, String hash) {
        if (plain == null || hash == null) return false;
        try { return BCrypt.verifyer().verify(plain.toCharArray(), hash.toCharArray()).verified; }
        catch (Exception e) { return false; }
    }

    // ── Persist ───────────────────────────────────────────────────────────────

    public synchronized void save() {
        try {
            storage.write(GSON.toJson(new ArrayList<>(users.values())));
        } catch (Exception e) { logger.warning("[Dashboard/Users] save: " + e.getMessage()); }
    }

    private void load(String json) {
        try {
            List<StoredUser> list = GSON.fromJson(json, new TypeToken<List<StoredUser>>(){}.getType());
            if (list != null) list.forEach(u -> { if (u.username != null) users.put(u.username.toLowerCase(), u); });
        } catch (Exception e) { logger.warning("[Dashboard/Users] load: " + e.getMessage()); }
    }

    @SuppressWarnings("unchecked")
    private void migrateFromConfig(FileConfiguration config) {
        var list = config.getList("dashboard.users");
        if (list != null) {
            for (Object obj : list) {
                if (!(obj instanceof Map<?, ?> map)) continue;
                String username = (String) map.get("username");
                String hash = (String) map.get("password-hash");
                String roleStr = (String) map.get("role");
                if (username == null || username.isBlank()) continue;
                if (hash == null || hash.isBlank()) {
                    String pw = generatePassword(16);
                    hash = hash(pw);
                    logger.warning("[Dashboard] Mot de passe auto-généré pour '" + username + "' : " + pw);
                }
                DashboardRole role = parseRole(roleStr);
                StoredUser u = new StoredUser(username, hash, role.name(), System.currentTimeMillis());
                users.put(username.toLowerCase(), u);
            }
        }
        if (!users.isEmpty()) {
            logger.info("[Dashboard] " + users.size() + " compte(s) migré(s) depuis config.yml → dashboard/users.json");
            save();
        }
    }

    private void ensureDefaultAdmin() {
        if (adminCount() > 0) return;
        String pw = generatePassword(16);
        String hash = hash(pw);
        StoredUser u = new StoredUser("admin", hash, "ADMIN", System.currentTimeMillis());
        users.put("admin", u);
        save();
        logger.warning("[Dashboard] Aucun admin trouvé. Compte créé — username: admin / password: " + pw);
        logger.warning("[Dashboard] Changez ce mot de passe depuis le dashboard !");
    }

    private static String generatePassword(int length) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
        SecureRandom rng = new SecureRandom();
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) sb.append(chars.charAt(rng.nextInt(chars.length())));
        return sb.toString();
    }
}
