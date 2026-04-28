package sunanticheat.dashboard.auth;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import sunanticheat.dashboard.DashboardRole;
import sunanticheat.dashboard.db.BlobStorage;
import sunanticheat.dashboard.db.Persistence;

import java.io.File;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Logger;

/**
 * Matrice des permissions éditable : pour chaque couple (Role × Permission),
 * détermine si l'action est autorisée.
 *
 * Persistance : plugins/SunAntiCheat/dashboard/permissions.json
 * Défauts : défauts sensés (ADMIN tout, MOD modération + prix shop, VIEWER rien).
 */
public final class PermissionStore {

    private final Persistence storage;
    private final Persistence customStorage;
    private final Logger logger;
    private final Gson gson = new GsonBuilder().setPrettyPrinting().serializeNulls().create();

    /** Map role enum → set de permissions autorisées. Thread-safe via synchronized. */
    private final EnumMap<DashboardRole, EnumSet<Permission>> matrix = new EnumMap<>(DashboardRole.class);

    /** Rôles custom créés par un admin (id → CustomRole). Thread-safe via synchronized. */
    private final java.util.LinkedHashMap<String, CustomRole> customRoles = new java.util.LinkedHashMap<>();

    public PermissionStore(File dataFolder, Logger logger, BlobStorage blobs) {
        this.logger = logger;
        File legacyFile = new File(new File(dataFolder, "dashboard"), "permissions.json");
        this.storage = new Persistence(blobs, "permissions", legacyFile);
        this.customStorage = new Persistence(blobs, "custom_roles", null);

        applyDefaults();
        load();
        loadCustomRoles();
    }

    /** Défauts : ADMIN tout, MOD modération + prix shop, VIEWER rien. */
    private synchronized void applyDefaults() {
        // ADMIN : tout
        matrix.put(DashboardRole.ADMIN, EnumSet.allOf(Permission.class));

        // MOD : modération + prix shop uniquement
        EnumSet<Permission> modPerms = EnumSet.of(
                Permission.MODERATE_PLAYERS,
                Permission.SERVER_COMMAND,
                Permission.WORLD_PVP,
                Permission.CHESTSCAN_RUN,
                Permission.SHOPS_EDIT_PRICES
        );
        matrix.put(DashboardRole.MOD, modPerms);

        // VIEWER : rien d'écriture (seules les routes GET sont accessibles par défaut)
        matrix.put(DashboardRole.VIEWER, EnumSet.noneOf(Permission.class));
    }

    private synchronized void load() {
        String json = storage.read();
        if (json == null || json.isBlank()) { save(); return; }
        try {
            Map<String, java.util.List<String>> raw = gson.fromJson(json,
                    new TypeToken<Map<String, java.util.List<String>>>() {}.getType());
            if (raw == null) return;
            // Applique uniquement les clés connues, ignore les erreurs
            for (Map.Entry<String, java.util.List<String>> e : raw.entrySet()) {
                DashboardRole role;
                try { role = DashboardRole.valueOf(e.getKey()); } catch (Exception ex) { continue; }
                EnumSet<Permission> perms = EnumSet.noneOf(Permission.class);
                if (e.getValue() != null) {
                    for (String p : e.getValue()) {
                        try { perms.add(Permission.valueOf(p)); } catch (Exception ex) {}
                    }
                }
                matrix.put(role, perms);
            }
        } catch (Exception e) {
            logger.warning("[Permissions] load erreur: " + e.getMessage());
        }
    }

    public synchronized void save() {
        try {
            Map<String, java.util.List<String>> out = new LinkedHashMap<>();
            for (DashboardRole r : DashboardRole.values()) {
                EnumSet<Permission> perms = matrix.getOrDefault(r, EnumSet.noneOf(Permission.class));
                java.util.List<String> names = new java.util.ArrayList<>();
                for (Permission p : perms) names.add(p.name());
                out.put(r.name(), names);
            }
            storage.write(gson.toJson(out));
        } catch (Exception e) {
            logger.warning("[Permissions] save erreur: " + e.getMessage());
        }
    }

    /** Vérifie si le rôle a la permission. Thread-safe. */
    public synchronized boolean has(DashboardRole role, Permission perm) {
        if (role == null || perm == null) return false;
        EnumSet<Permission> perms = matrix.get(role);
        return perms != null && perms.contains(perm);
    }

    /**
     * Vérifie permission via un id de rôle string. Si l'id matche un custom role,
     * on utilise ses permissions. Sinon on tente l'enum. Si ADMIN → toujours true.
     */
    public synchronized boolean has(String roleId, Permission perm) {
        if (roleId == null || perm == null) return false;
        // ADMIN built-in : tout
        if ("ADMIN".equalsIgnoreCase(roleId)) return true;
        // Custom role
        CustomRole c = customRoles.get(roleId);
        if (c != null) return c.permissions != null && c.permissions.contains(perm.name());
        // Built-in enum
        try { return has(DashboardRole.valueOf(roleId), perm); }
        catch (Exception e) { return false; }
    }

    // ── Custom roles CRUD ────────────────────────────────────────────────────

    public synchronized java.util.List<CustomRole> listCustomRoles() {
        return new java.util.ArrayList<>(customRoles.values());
    }

    public synchronized CustomRole getCustomRole(String id) {
        return id == null ? null : customRoles.get(id);
    }

    /** Ajoute ou remplace un rôle custom. Retourne null si succès, sinon message d'erreur. */
    public synchronized String upsertCustomRole(CustomRole r) {
        if (r == null || r.id == null || r.id.isBlank()) return "id requis";
        // Empêche les collisions avec les enums built-ins
        for (DashboardRole e : DashboardRole.values()) {
            if (e.name().equalsIgnoreCase(r.id)) return "L'id collisionne avec un rôle built-in";
        }
        if (!r.id.matches("[a-zA-Z0-9_-]+"))
            return "L'id doit contenir uniquement [a-zA-Z0-9_-]";
        if (r.label == null || r.label.isBlank()) r.label = r.id;
        if (r.permissions == null) r.permissions = new java.util.ArrayList<>();
        // Validate base role
        try { DashboardRole.valueOf(r.baseRole); }
        catch (Exception e) { r.baseRole = DashboardRole.VIEWER.name(); }
        // Validate each permission name
        java.util.List<String> validPerms = new java.util.ArrayList<>();
        for (String p : r.permissions) {
            try { Permission.valueOf(p); validPerms.add(p); }
            catch (Exception ignored) {}
        }
        r.permissions = validPerms;
        customRoles.put(r.id, r);
        saveCustomRoles();
        return null;
    }

    public synchronized boolean removeCustomRole(String id) {
        if (customRoles.remove(id) != null) {
            saveCustomRoles();
            return true;
        }
        return false;
    }

    private synchronized void loadCustomRoles() {
        try {
            String json = customStorage.read();
            if (json == null || json.isBlank()) return;
            java.util.List<CustomRole> list = gson.fromJson(json, new TypeToken<java.util.List<CustomRole>>(){}.getType());
            if (list != null) for (CustomRole r : list) {
                if (r != null && r.id != null) customRoles.put(r.id, r);
            }
        } catch (Exception e) {
            logger.warning("[Permissions] loadCustomRoles erreur: " + e.getMessage());
        }
    }

    private synchronized void saveCustomRoles() {
        try { customStorage.write(gson.toJson(new java.util.ArrayList<>(customRoles.values()))); }
        catch (Exception e) { logger.warning("[Permissions] saveCustomRoles erreur: " + e.getMessage()); }
    }

    /** Modifie la matrice (ADMIN ne peut pas perdre AUCUNE permission). */
    public synchronized void set(DashboardRole role, Permission perm, boolean allowed) {
        if (role == null || perm == null) return;
        // Sécurité : ADMIN garde toujours toutes les permissions
        if (role == DashboardRole.ADMIN) return;
        EnumSet<Permission> perms = matrix.computeIfAbsent(role, r -> EnumSet.noneOf(Permission.class));
        if (allowed) perms.add(perm);
        else perms.remove(perm);
        save();
    }

    /** Remplace toute la matrice d'un rôle. ADMIN reste intouchable. */
    public synchronized void replace(DashboardRole role, java.util.Set<Permission> perms) {
        if (role == null || role == DashboardRole.ADMIN) return;
        matrix.put(role, EnumSet.copyOf(perms));
        save();
    }

    /** Reset vers les défauts. */
    public synchronized void resetToDefaults() {
        matrix.clear();
        applyDefaults();
        save();
    }

    /** Snapshot lisible pour l'API frontend. */
    public synchronized Map<String, Object> snapshot() {
        Map<String, Object> out = new LinkedHashMap<>();

        // Roles built-in → liste des permissions actives
        Map<String, java.util.List<String>> rolesMap = new LinkedHashMap<>();
        for (DashboardRole r : DashboardRole.values()) {
            java.util.List<String> list = new java.util.ArrayList<>();
            EnumSet<Permission> perms = matrix.getOrDefault(r, EnumSet.noneOf(Permission.class));
            for (Permission p : perms) list.add(p.name());
            rolesMap.put(r.name(), list);
        }
        out.put("roles", rolesMap);

        // Rôles custom (avec leur metadata + permissions)
        out.put("customRoles", new java.util.ArrayList<>(customRoles.values()));

        // Catalogue des permissions disponibles
        java.util.List<Map<String, Object>> catalog = new java.util.ArrayList<>();
        for (Permission p : Permission.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.name());
            m.put("label", p.label);
            m.put("description", p.description);
            m.put("category", p.category);
            catalog.add(m);
        }
        out.put("catalog", catalog);

        return out;
    }
}
