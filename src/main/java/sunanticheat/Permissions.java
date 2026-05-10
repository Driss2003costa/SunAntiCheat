package sunanticheat;

/**
 * Constantes des permissions du plugin (alignées avec plugin.yml).
 */
public final class Permissions {

    private Permissions() {}

    public static final String RELOAD = "sunguard.reload";
    /** Gérer l'auto-update (/sunguard update check|status|apply). */
    public static final String UPDATE = "sunguard.update";
    /** Analyse manuelle Multiverse-Inventories monde spawn (/sunguard mvinvscan). */
    public static final String MVINV_SCAN = "sunguard.mvinv.scan";
    /** Analyse des conteneurs chargés de mondes ciblés (/sunguard chestscan). */
    public static final String CHEST_SCAN = "sunguard.chestscan";
    public static final String MENU = "sunguard.menu";
    public static final String XRAY_GUI = "sunguard.xray.gui";
    public static final String XRAY_RESET = "sunguard.xray.reset";
    public static final String INVENTORY_GUI = "sunguard.inventory.gui";
    public static final String FREECAM_GUI = "sunguard.freecam.gui";
    public static final String CLIENT_GUI = "sunguard.client.gui";
    public static final String SANCTION_GUI = "sunguard.sanction.gui";
    public static final String PLAYERDATA_GUI = "sunguard.playerdata.gui";
    public static final String BLOCKLOG_CHECK = "sunguard.blocklog.check";
    public static final String BLOCKLOG_ROLLBACK = "sunguard.blocklog.rollback";
    public static final String ALERTS = "sunguard.alerts";
    public static final String REPORT = "sunguard.report";
    public static final String REPORT_VIEW = "sunguard.report.view";
    public static final String DEBUG = "sunguard.debug";
    public static final String PLAYTIME = "sunguard.playtime";
    public static final String PLAYTIME_OTHERS = "sunguard.playtime.others";
    /** Bypass : autorise l'usage des commandes sensibles surveillées. */
    public static final String BYPASS_RISKY_COMMAND_BLOCK = "sunguard.bypass.risky-command-block";

    /** Bypass : exclu des contrôles X-Ray (minage). */
    public static final String BYPASS_XRAY = "sunguard.bypass.xray";
    /** Bypass : exclu des contrôles Freecam (cassage/interaction hors vision). */
    public static final String BYPASS_FREECAM = "sunguard.bypass.freecam";
    /** Bypass : exclu des contrôles Kill Aura (portée, angle, CPS). */
    public static final String BYPASS_KILLAURA = "sunguard.bypass.killaura";
    /** Bypass : détection arme WeaponMechanics dans le monde principal (config weapon-mechanics-main-world). */
    public static final String BYPASS_WM_MAIN_WORLD = "sunguard.bypass.wm-main-world";
    /** Bypass : strip inventaire/potions sur spawn (config spawn-world-weapon-strip). */
    public static final String BYPASS_SPAWN_WEAPON_STRIP = "sunguard.bypass.spawn-weapon-strip";
    /** Bypass : scan / nettoyage MV-Inv spawn + armes WM (config multiverse-inventories-spawn-wm-scan). */
    public static final String BYPASS_MV_INV_SPAWN_WM_SCAN = "sunguard.bypass.mv-inv-spawn-wm-scan";
}
