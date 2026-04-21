package sunanticheat.dashboard.luckperms;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import net.luckperms.api.model.user.UserManager;
import net.luckperms.api.node.types.InheritanceNode;
import org.bukkit.Bukkit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Logger;

/**
 * Pont null-safe vers LuckPerms. Toutes les méthodes vérifient la disponibilité
 * du plugin et retournent des valeurs par défaut sans crash si absent.
 */
public final class LuckPermsBridge {

    private static final Logger LOG = Logger.getLogger("SunAntiCheat-LP");

    private LuckPermsBridge() {}

    /** Retourne true si LuckPerms est chargé et l'API disponible. */
    public static boolean isAvailable() {
        try {
            if (Bukkit.getPluginManager().getPlugin("LuckPerms") == null) return false;
            return getApi() != null;
        } catch (Throwable t) {
            return false;
        }
    }

    /** Version du plugin LuckPerms, ou null si absent. */
    public static String getVersion() {
        try {
            var pl = Bukkit.getPluginManager().getPlugin("LuckPerms");
            return pl != null ? pl.getPluginMeta().getVersion() : null;
        } catch (Throwable t) {
            try {
                var pl = Bukkit.getPluginManager().getPlugin("LuckPerms");
                return pl != null ? pl.getDescription().getVersion() : null;
            } catch (Throwable ignored) {
                return null;
            }
        }
    }

    private static LuckPerms getApi() {
        try { return LuckPermsProvider.get(); } catch (Throwable t) { return null; }
    }

    /** Liste des groupes connus : { name, displayName, weight, color }. */
    public static List<Map<String, Object>> listGroups() {
        if (!isAvailable()) return List.of();
        try {
            LuckPerms api = getApi();
            if (api == null) return List.of();
            List<Map<String, Object>> out = new ArrayList<>();
            for (Group g : api.getGroupManager().getLoadedGroups()) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name", g.getName());
                String dn = g.getDisplayName();
                m.put("displayName", dn == null ? g.getName() : dn);
                int weight = g.getWeight().isPresent() ? g.getWeight().getAsInt() : 0;
                m.put("weight", weight);
                String color = null;
                try {
                    color = g.getCachedData().getMetaData().getMetaValue("color");
                } catch (Throwable ignored) {}
                m.put("color", color);
                out.add(m);
            }
            out.sort((a, b) -> Integer.compare((int) b.get("weight"), (int) a.get("weight")));
            return out;
        } catch (Throwable t) {
            LOG.warning("[LP] listGroups fail: " + t.getMessage());
            return List.of();
        }
    }

    /** Informations d'un joueur : uuid, username, primaryGroup, groups, permissions. */
    public static Map<String, Object> getPlayerInfo(String uuidStr) {
        if (!isAvailable()) return Map.of("error", "LuckPerms non installé");
        if (uuidStr == null) return Map.of("error", "uuid manquant");
        try {
            UUID uuid = UUID.fromString(uuidStr);
            LuckPerms api = getApi();
            if (api == null) return Map.of("error", "API indisponible");
            UserManager um = api.getUserManager();
            User u = um.loadUser(uuid).join();
            if (u == null) return Map.of("error", "utilisateur introuvable");
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("uuid", u.getUniqueId().toString());
            m.put("username", u.getUsername());
            m.put("primaryGroup", u.getPrimaryGroup());
            List<String> groups = new ArrayList<>();
            try {
                for (Group g : u.getInheritedGroups(u.getQueryOptions())) {
                    groups.add(g.getName());
                }
            } catch (Throwable ignored) {}
            m.put("groups", groups);
            int perms = 0;
            try { perms = u.getNodes().size(); } catch (Throwable ignored) {}
            m.put("permissions", perms);
            return m;
        } catch (Throwable t) {
            LOG.warning("[LP] getPlayerInfo fail: " + t.getMessage());
            return Map.of("error", t.getMessage() == null ? "erreur inconnue" : t.getMessage());
        }
    }

    /** Ajoute un groupe à un joueur (async). */
    public static CompletableFuture<Boolean> addGroup(String uuidStr, String group) {
        if (!isAvailable() || uuidStr == null || group == null) {
            return CompletableFuture.completedFuture(false);
        }
        try {
            UUID uuid = UUID.fromString(uuidStr);
            LuckPerms api = getApi();
            if (api == null) return CompletableFuture.completedFuture(false);
            UserManager um = api.getUserManager();
            return um.loadUser(uuid).thenApplyAsync(u -> {
                try {
                    if (u == null) return false;
                    u.data().add(InheritanceNode.builder(group).build());
                    um.saveUser(u).join();
                    return true;
                } catch (Throwable t) {
                    LOG.warning("[LP] addGroup fail: " + t.getMessage());
                    return false;
                }
            });
        } catch (Throwable t) {
            LOG.warning("[LP] addGroup fail: " + t.getMessage());
            return CompletableFuture.completedFuture(false);
        }
    }

    /** Retire un groupe d'un joueur (async). */
    public static CompletableFuture<Boolean> removeGroup(String uuidStr, String group) {
        if (!isAvailable() || uuidStr == null || group == null) {
            return CompletableFuture.completedFuture(false);
        }
        try {
            UUID uuid = UUID.fromString(uuidStr);
            LuckPerms api = getApi();
            if (api == null) return CompletableFuture.completedFuture(false);
            UserManager um = api.getUserManager();
            return um.loadUser(uuid).thenApplyAsync(u -> {
                try {
                    if (u == null) return false;
                    u.data().remove(InheritanceNode.builder(group).build());
                    um.saveUser(u).join();
                    return true;
                } catch (Throwable t) {
                    LOG.warning("[LP] removeGroup fail: " + t.getMessage());
                    return false;
                }
            });
        } catch (Throwable t) {
            LOG.warning("[LP] removeGroup fail: " + t.getMessage());
            return CompletableFuture.completedFuture(false);
        }
    }

    /**
     * Définit le groupe principal d'un joueur. LuckPerms n'autorise le changement
     * de primary group que si le joueur est déjà membre : on ajoute d'abord si nécessaire.
     */
    public static CompletableFuture<Boolean> setPrimaryGroup(String uuidStr, String group) {
        if (!isAvailable() || uuidStr == null || group == null) {
            return CompletableFuture.completedFuture(false);
        }
        try {
            UUID uuid = UUID.fromString(uuidStr);
            LuckPerms api = getApi();
            if (api == null) return CompletableFuture.completedFuture(false);
            UserManager um = api.getUserManager();
            return um.loadUser(uuid).thenApplyAsync(u -> {
                try {
                    if (u == null) return false;
                    // On ajoute le groupe si pas déjà membre
                    boolean has = false;
                    try {
                        for (Group g : u.getInheritedGroups(u.getQueryOptions())) {
                            if (g.getName().equalsIgnoreCase(group)) { has = true; break; }
                        }
                    } catch (Throwable ignored) {}
                    if (!has) {
                        u.data().add(InheritanceNode.builder(group).build());
                    }
                    u.setPrimaryGroup(group);
                    um.saveUser(u).join();
                    return true;
                } catch (Throwable t) {
                    LOG.warning("[LP] setPrimaryGroup fail: " + t.getMessage());
                    return false;
                }
            });
        } catch (Throwable t) {
            LOG.warning("[LP] setPrimaryGroup fail: " + t.getMessage());
            return CompletableFuture.completedFuture(false);
        }
    }

    /** Vérifie si un joueur est dans un groupe donné (InheritanceNode). */
    public static boolean isInGroup(String uuidStr, String group) {
        if (!isAvailable() || uuidStr == null || group == null) return false;
        try {
            UUID uuid = UUID.fromString(uuidStr);
            LuckPerms api = getApi();
            if (api == null) return false;
            User u = api.getUserManager().loadUser(uuid).join();
            if (u == null) return false;
            for (Group g : u.getInheritedGroups(u.getQueryOptions())) {
                if (g.getName().equalsIgnoreCase(group)) return true;
            }
            return false;
        } catch (Throwable t) {
            LOG.warning("[LP] isInGroup fail: " + t.getMessage());
            return false;
        }
    }

    /** Récupère le groupe principal d'un joueur, ou null. */
    public static String getPrimaryGroup(String uuidStr) {
        if (!isAvailable() || uuidStr == null) return null;
        try {
            UUID uuid = UUID.fromString(uuidStr);
            LuckPerms api = getApi();
            if (api == null) return null;
            User u = api.getUserManager().loadUser(uuid).join();
            return u != null ? u.getPrimaryGroup() : null;
        } catch (Throwable t) {
            return null;
        }
    }
}
