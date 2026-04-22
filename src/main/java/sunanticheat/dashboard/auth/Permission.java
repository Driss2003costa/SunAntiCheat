package sunanticheat.dashboard.auth;

/**
 * Énumération des permissions granulaires du dashboard.
 *
 * Chaque handler vérifie une permission spécifique via
 * HttpHelper.requirePermission(ex, user, Permission.X).
 *
 * Le mapping rôle → permissions est géré par PermissionStore et
 * peut être modifié à chaud depuis le dashboard par un ADMIN.
 *
 * La catégorie et le libellé lisible servent à afficher la matrice
 * des permissions dans l'UI.
 */
public enum Permission {

    // ── Modération joueurs ──────────────────────────────────────────────
    MODERATE_PLAYERS("Modération",      "Modérer les joueurs",       "Kick / Ban / Mute / Warn / résoudre reports / reset scores"),
    SERVER_COMMAND  ("Modération",      "Exécuter commandes",        "Lancer les commandes de la whitelist serveur"),
    WORLD_PVP       ("Modération",      "Toggle PvP par monde",      "Activer/désactiver le PvP d'un monde"),
    CHESTSCAN_RUN   ("Modération",      "Démarrer un chest scan",    "Lancer un scan anti-X-Ray sur les conteneurs"),

    // ── Shop & Économie ─────────────────────────────────────────────────
    SHOPS_EDIT_PRICES("Shop",           "Modifier prix shop",        "Changer prix/limites des items d'un shop existant"),
    SHOPS_MANAGE     ("Shop",           "Gérer les shops",           "Créer/supprimer shops, add/remove items, sync ESG"),

    // ── Contenu gameplay ────────────────────────────────────────────────
    CONTENT_MANAGE  ("Contenu",         "Gérer le contenu",          "Events / Quêtes / Lootboxes / Annonces / Daily rewards / A/B tests / Honeypot"),

    // ── Admin serveur ───────────────────────────────────────────────────
    PLUGIN_MANAGE   ("Admin serveur",   "Gérer les plugins",         "Activer/désactiver/reload un plugin"),
    CONFIG_EDIT     ("Admin serveur",   "Éditer les configs",        "Écrire dans les YAML des plugins (Config Editor)"),
    REBOOT          ("Admin serveur",   "Redémarrer le serveur",     "Schedule / cancel / now"),
    BACKUP_MANAGE   ("Admin serveur",   "Gérer les backups",         "Créer et supprimer des sauvegardes de monde"),
    PANIC           ("Admin serveur",   "Panic Mode",                "Activer/désactiver le panic mode (whitelist + kick)"),
    TASKS_MANAGE    ("Admin serveur",   "Tâches planifiées",         "Créer / éditer / supprimer / lancer des tâches planifiées"),
    SECURITY_CONFIG ("Admin serveur",   "Config anticheat",          "Modifier la configuration anti-triche"),

    // ── Comptes & rôles ─────────────────────────────────────────────────
    USERS_MANAGE    ("Comptes",         "Gérer les comptes",         "Créer / supprimer / changer rôle / reset mdp des utilisateurs dashboard"),
    LUCKPERMS_EDIT  ("Comptes",         "Rangs LuckPerms",           "Ajouter/retirer un rang, changer le rang primaire d'un joueur"),

    // ── Paiements VIP ───────────────────────────────────────────────────
    VIP_MANAGE      ("VIP",             "Gérer le VIP",              "Plans VIP (create/delete), gift, extend, revoke subscriptions"),

    // ── IA ──────────────────────────────────────────────────────────────
    AI_CONFIG       ("IA",              "Config IA",                 "Changer provider / modèle / clé API Gemini ou OpenAI"),
    AI_APPLY_PATCH  ("IA",              "Appliquer patches IA",      "Appliquer les patches YAML/properties suggérés par l'IA");

    public final String category;
    public final String label;
    public final String description;

    Permission(String category, String label, String description) {
        this.category = category;
        this.label = label;
        this.description = description;
    }
}
