package sunanticheat.dashboard.auth;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import sunanticheat.dashboard.DashboardRole;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
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

    private final File file;
    private final Logger logger;
    private final Gson gson = new GsonBuilder().setPrettyPrinting().serializeNulls().create();

    /** Map role → set de permissions autorisées. Thread-safe via synchronized. */
    private final EnumMap<DashboardRole, EnumSet<Permission>> matrix = new EnumMap<>(DashboardRole.class);

    public PermissionStore(File dataFolder, Logger logger) {
        this.logger = logger;
        File dir = new File(dataFolder, "dashboard");
        if (!dir.exists()) dir.mkdirs();
        this.file = new File(dir, "permissions.json");

        // Initialise par défauts
        applyDefaults();
        // Charge les overrides (fusionne)
        load();
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
        if (!file.exists()) { save(); return; }
        try {
            String json = Files.readString(file.toPath(), StandardCharsets.UTF_8);
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
        } catch (IOException e) {
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
            Files.writeString(file.toPath(), gson.toJson(out), StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.warning("[Permissions] save erreur: " + e.getMessage());
        }
    }

    /** Vérifie si le rôle a la permission. Thread-safe. */
    public synchronized boolean has(DashboardRole role, Permission perm) {
        if (role == null || perm == null) return false;
        EnumSet<Permission> perms = matrix.get(role);
        return perms != null && perms.contains(perm);
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

        // Roles → liste des permissions actives
        Map<String, java.util.List<String>> rolesMap = new LinkedHashMap<>();
        for (DashboardRole r : DashboardRole.values()) {
            java.util.List<String> list = new java.util.ArrayList<>();
            EnumSet<Permission> perms = matrix.getOrDefault(r, EnumSet.noneOf(Permission.class));
            for (Permission p : perms) list.add(p.name());
            rolesMap.put(r.name(), list);
        }
        out.put("roles", rolesMap);

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
