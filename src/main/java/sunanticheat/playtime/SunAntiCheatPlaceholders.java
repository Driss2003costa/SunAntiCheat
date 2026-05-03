package sunanticheat.playtime;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.SunAntiCheat;
import sunanticheat.client.ClientInfo;
import sunanticheat.client.ClientInfoTracker;
import sunanticheat.connection.ConnectionLogStorage;
import sunanticheat.freecam.FreecamTracker;
import sunanticheat.killaura.KillAuraTracker;
import sunanticheat.report.ReportStorage;
import sunanticheat.xray.BlockMiningStats;
import sunanticheat.xray.XRayTracker;

import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import org.jetbrains.annotations.NotNull;

import java.text.SimpleDateFormat;
import java.util.*;

/**
 * Expansion PlaceholderAPI — placeholders SunAntiCheat.
 *
 * Playtime         : playtime, playtime_seconds, playtime_minutes, playtime_hours
 * Top playtime     : topplaytime_1..N, topplaytime_name_1, topplaytime_playtime_1, topplaytime_seconds_1
 * X-Ray            : xray_total, xray_diamond, xray_iron, xray_gold, xray_netherite, xray_common,
 *                    xray_netherrack, xray_valuable_percent, xray_diamond_percent, xray_ratio,
 *                    xray_level, xray_suspect, xray_suspect_oui_non
 * Top X-Ray        : topxray_1..N, topxray_name_1, topxray_level_1, topxray_percent_1, topxray_ratio_1
 * Freecam          : freecam_valid, freecam_suspicious, freecam_total, freecam_suspicion_percent
 * Client           : client_brand, client_premium, client_mods_count, client_packs_count
 * Kill Aura        : killaura_violations, killaura_cps, killaura_flagged
 * Sanctions        : sanctions_total, sanctions_bans, sanctions_mutes, sanctions_warns,
 *                    is_banned, is_muted
 * Reports          : reports_received, reports_filed
 * Connexion        : first_join, last_seen, session_count
 * Daily Reward     : daily_streak, daily_can_claim, daily_last_claim
 * Alertes          : alerts_total
 *
 * Suffixe _NomJoueur pour interroger un autre joueur (ex: xray_total_Steve).
 */
public class SunAntiCheatPlaceholders extends PlaceholderExpansion {

    private final JavaPlugin plugin;
    private final PlaytimeTracker playtimeTracker;
    private final XRayTracker xrayTracker;
    private final FreecamTracker freecamTracker;
    private final ClientInfoTracker clientInfoTracker;
    private final KillAuraTracker killAuraTracker;
    private final ReportStorage reportStorage;
    private final ConnectionLogStorage connectionLogStorage;

    private static final SimpleDateFormat DATE_FMT = new SimpleDateFormat("dd/MM/yyyy HH:mm");

    public SunAntiCheatPlaceholders(JavaPlugin plugin,
                                     PlaytimeTracker playtimeTracker,
                                     XRayTracker xrayTracker,
                                     FreecamTracker freecamTracker,
                                     ClientInfoTracker clientInfoTracker,
                                     KillAuraTracker killAuraTracker,
                                     ReportStorage reportStorage,
                                     ConnectionLogStorage connectionLogStorage) {
        this.plugin              = plugin;
        this.playtimeTracker     = playtimeTracker;
        this.xrayTracker         = xrayTracker;
        this.freecamTracker      = freecamTracker;
        this.clientInfoTracker   = clientInfoTracker;
        this.killAuraTracker     = killAuraTracker;
        this.reportStorage       = reportStorage;
        this.connectionLogStorage = connectionLogStorage;
    }

    @Override public @NotNull String getAuthor()     { return "Sun"; }
    @Override public @NotNull String getIdentifier() { return "sunanticheat"; }
    @Override public @NotNull String getVersion()    { return "1.0.0"; }
    @Override public boolean persist()               { return true; }

    @Override
    public String onRequest(OfflinePlayer player, @NotNull String params) {
        if (params == null || params.isEmpty()) return null;

        String lower = params.toLowerCase();
        if (lower.startsWith("topplaytime_")) return handleTopPlaytime(params);
        if (lower.startsWith("topxray_"))     return handleTopXray(params);

        // Résolution joueur cible: param peut être "key" ou "key_PlayerName"
        String key = params;
        OfflinePlayer target = player;
        int lastUnderscore = params.lastIndexOf('_');
        if (lastUnderscore > 0) {
            String possibleName = params.substring(lastUnderscore + 1);
            if (!possibleName.isEmpty() && !isMetricKey(possibleName)) {
                OfflinePlayer other = Bukkit.getPlayer(possibleName);
                if (other == null) other = Bukkit.getOfflinePlayer(possibleName);
                if (other != null && other.getUniqueId() != null) {
                    target = other;
                    key = params.substring(0, lastUnderscore);
                }
            }
        }

        UUID uuid = target != null ? target.getUniqueId() : null;
        if (uuid == null) return "";
        String uuidStr = uuid.toString();
        String name    = target.getName();

        // ——— Playtime ———
        if (key.equalsIgnoreCase("playtime"))
            return PlaytimeTracker.formatPlaytime(playtimeTracker.getTotalPlaytimeSeconds(uuid));
        if (key.equalsIgnoreCase("playtime_seconds"))
            return String.valueOf(playtimeTracker.getTotalPlaytimeSeconds(uuid));
        if (key.equalsIgnoreCase("playtime_minutes"))
            return String.valueOf(playtimeTracker.getTotalPlaytimeSeconds(uuid) / 60);
        if (key.equalsIgnoreCase("playtime_hours"))
            return String.valueOf(playtimeTracker.getTotalPlaytimeSeconds(uuid) / 3600);

        // ——— X-Ray ———
        BlockMiningStats xray = xrayTracker.getStats(uuid);
        if (key.equalsIgnoreCase("xray_total"))           return xray != null ? String.valueOf(xray.getTotal()) : "0";
        if (key.equalsIgnoreCase("xray_diamond"))         return xray != null ? String.valueOf(xray.getDiamondCount()) : "0";
        if (key.equalsIgnoreCase("xray_iron"))            return xray != null ? String.valueOf(xray.getIronCount()) : "0";
        if (key.equalsIgnoreCase("xray_gold"))            return xray != null ? String.valueOf(xray.getGoldCount()) : "0";
        if (key.equalsIgnoreCase("xray_netherite"))       return xray != null ? String.valueOf(xray.getAncientDebrisCount()) : "0";
        if (key.equalsIgnoreCase("xray_common"))          return xray != null ? String.valueOf(xray.getCommonCount()) : "0";
        if (key.equalsIgnoreCase("xray_netherrack"))      return xray != null ? String.valueOf(xray.getNetherrackCount()) : "0";
        if (key.equalsIgnoreCase("xray_valuable_percent"))return xray != null ? String.format("%.1f", xray.getValuablePercentage()) : "0";
        if (key.equalsIgnoreCase("xray_diamond_percent")) return xray != null ? String.format("%.1f", xray.getDiamondPercentage()) : "0";
        if (key.equalsIgnoreCase("xray_ratio"))           return xray != null ? String.format("%.2f", xray.getDiamondPerThousandCommon()) : "0";
        if (key.equalsIgnoreCase("xray_level"))           return xrayLevel(xray);
        if (key.equalsIgnoreCase("xray_suspect"))         return xraySuspect(xray) ? "1" : "0";
        if (key.equalsIgnoreCase("xray_suspect_oui_non")) return xraySuspect(xray) ? "Oui" : "Non";

        // ——— Freecam ———
        var freecamStats = freecamTracker.getStats(uuid);
        if (key.equalsIgnoreCase("freecam_valid"))            return freecamStats != null ? String.valueOf(freecamStats.getValid()) : "0";
        if (key.equalsIgnoreCase("freecam_suspicious"))       return freecamStats != null ? String.valueOf(freecamStats.getSuspicious()) : "0";
        if (key.equalsIgnoreCase("freecam_total"))            return freecamStats != null ? String.valueOf(freecamStats.getTotal()) : "0";
        if (key.equalsIgnoreCase("freecam_suspicion_percent"))return freecamStats != null ? String.format("%.1f", freecamStats.getSuspicionPercentage()) : "0";

        // ——— Client ———
        ClientInfo client = clientInfoTracker.getInfo(uuid);
        if (key.equalsIgnoreCase("client_brand"))       return client != null && client.getClientBrand() != null ? client.getClientBrand() : "vanilla";
        if (key.equalsIgnoreCase("client_premium"))     { if (client == null || client.getPremium() == null) return "?"; return Boolean.TRUE.equals(client.getPremium()) ? "Oui" : "Non"; }
        if (key.equalsIgnoreCase("client_mods_count"))  return client != null ? String.valueOf(client.getMods().size()) : "0";
        if (key.equalsIgnoreCase("client_packs_count")) return client != null ? String.valueOf(client.getResourcePacks().size()) : "0";

        // ——— Kill Aura ———
        if (killAuraTracker != null) {
            if (key.equalsIgnoreCase("killaura_violations")) return String.valueOf(killAuraTracker.getViolationCount(uuid));
            if (key.equalsIgnoreCase("killaura_cps"))        return String.valueOf(killAuraTracker.getHitsInLastSecond(uuid));
            if (key.equalsIgnoreCase("killaura_flagged"))    return killAuraTracker.getViolationCount(uuid) > 0 ? "1" : "0";
        }

        // ——— Sanctions (via DashboardModule) ———
        var sanctionStore = dashboardSanctionStore();
        if (sanctionStore != null) {
            if (key.equalsIgnoreCase("sanctions_total")) {
                int total = sanctionStore.count(name, null, null, null)
                          + (name == null ? 0 : 0); // count by uuid if name null
                return String.valueOf(sanctionStore.count(null, null, null, null) < 0 ? 0
                        : countSanctionsByUuid(sanctionStore, uuidStr));
            }
            if (key.equalsIgnoreCase("sanctions_bans"))  return String.valueOf(countSanctionsByType(sanctionStore, uuidStr, "BAN", false));
            if (key.equalsIgnoreCase("sanctions_mutes")) return String.valueOf(countSanctionsByType(sanctionStore, uuidStr, "MUTE", false));
            if (key.equalsIgnoreCase("sanctions_warns")) return String.valueOf(countSanctionsByType(sanctionStore, uuidStr, "WARN", false));
            if (key.equalsIgnoreCase("is_banned"))       return countSanctionsByType(sanctionStore, uuidStr, "BAN", true) > 0 ? "1" : "0";
            if (key.equalsIgnoreCase("is_muted"))        return countSanctionsByType(sanctionStore, uuidStr, "MUTE", true) > 0 ? "1" : "0";
        }

        // ——— Reports ———
        if (reportStorage != null && name != null) {
            if (key.equalsIgnoreCase("reports_received")) {
                long count = reportStorage.getAll().stream()
                        .filter(r -> name.equalsIgnoreCase(r.getReportedName())).count();
                return String.valueOf(count);
            }
            if (key.equalsIgnoreCase("reports_filed")) {
                long count = reportStorage.getAll().stream()
                        .filter(r -> name.equalsIgnoreCase(r.getReporterName())).count();
                return String.valueOf(count);
            }
        }

        // ——— Connexion ———
        if (connectionLogStorage != null) {
            var sessions = connectionLogStorage.getSessions(uuid, 500);
            if (key.equalsIgnoreCase("session_count")) return String.valueOf(sessions.size());
            if (key.equalsIgnoreCase("first_join")) {
                if (sessions.isEmpty()) return target.getFirstPlayed() > 0 ? DATE_FMT.format(new Date(target.getFirstPlayed())) : "-";
                long first = sessions.stream().mapToLong(ConnectionLogStorage.ConnectionSession::getJoinTime).min().orElse(0);
                return first > 0 ? DATE_FMT.format(new Date(first)) : "-";
            }
            if (key.equalsIgnoreCase("last_seen")) {
                if (sessions.isEmpty()) return target.getLastPlayed() > 0 ? DATE_FMT.format(new Date(target.getLastPlayed())) : "-";
                long last = sessions.get(0).getJoinTime();
                return last > 0 ? DATE_FMT.format(new Date(last)) : "-";
            }
        }

        // ——— Daily Reward (via DashboardModule) ———
        var dailyStore = dashboardDailyStore();
        if (dailyStore != null) {
            if (key.equalsIgnoreCase("daily_streak"))     return String.valueOf(dailyStore.getStreak(uuidStr));
            if (key.equalsIgnoreCase("daily_can_claim"))  return dailyStore.canClaim(uuidStr) ? "1" : "0";
            if (key.equalsIgnoreCase("daily_last_claim")) {
                var state = dailyStore.getPlayerState(uuidStr);
                if (state == null || state.lastClaimAt == 0) return "-";
                return DATE_FMT.format(new Date(state.lastClaimAt));
            }
        }

        // ——— Alertes (via DashboardModule) ———
        var alertStore = dashboardAlertStore();
        if (alertStore != null) {
            if (key.equalsIgnoreCase("alerts_total")) {
                long count = alertStore.getRecent(10000).stream()
                        .filter(a -> name != null && name.equalsIgnoreCase(a.playerName())).count();
                return String.valueOf(count);
            }
        }

        return null;
    }

    // ── Accès lazy aux stores du DashboardModule ─────────────────────────────

    private sunanticheat.dashboard.sanctions.SanctionStore dashboardSanctionStore() {
        try {
            if (plugin instanceof SunAntiCheat sac && sac.getDashboardModule() != null)
                return sac.getDashboardModule().getSanctionStore();
        } catch (Throwable ignored) {}
        return null;
    }

    private sunanticheat.dashboard.dailyreward.DailyRewardStore dashboardDailyStore() {
        try {
            if (plugin instanceof SunAntiCheat sac && sac.getDashboardModule() != null)
                return sac.getDashboardModule().getDailyRewardStore();
        } catch (Throwable ignored) {}
        return null;
    }

    private sunanticheat.dashboard.alerts.AlertStore dashboardAlertStore() {
        try {
            if (plugin instanceof SunAntiCheat sac && sac.getDashboardModule() != null)
                return sac.getDashboardModule().getAlertStore();
        } catch (Throwable ignored) {}
        return null;
    }

    private int countSanctionsByUuid(sunanticheat.dashboard.sanctions.SanctionStore store, String uuid) {
        try {
            return (int) store.list(null, null, null, null, 1000, 0).stream()
                    .filter(s -> uuid.equals(s.targetUuid)).count();
        } catch (Throwable ignored) { return 0; }
    }

    private int countSanctionsByType(sunanticheat.dashboard.sanctions.SanctionStore store,
                                      String uuid, String type, boolean activeOnly) {
        try {
            Boolean active = activeOnly ? Boolean.TRUE : null;
            return (int) store.list(null, type, null, active, 1000, 0).stream()
                    .filter(s -> uuid.equals(s.targetUuid)).count();
        } catch (Throwable ignored) { return 0; }
    }

    // ── Top Playtime ────────────────────────────────────────────────────────

    private String handleTopPlaytime(String params) {
        try {
            if (playtimeTracker == null) return "-";
            String[] parts = params.split("_", 3);
            String kind;
            int index;
            if (parts.length == 2) {
                kind = "name";
                try { index = Integer.parseInt(parts[1]); } catch (NumberFormatException e) { return "-"; }
            } else if (parts.length >= 3) {
                kind = parts[1].toLowerCase();
                try { index = Integer.parseInt(parts[2]); } catch (NumberFormatException e) { return "-"; }
            } else { return "-"; }
            if (index <= 0) return "-";

            List<Map.Entry<UUID, Long>> top = playtimeTracker.getTopPlaytimes(index);
            if (top == null || top.size() < index) return "-";
            Map.Entry<UUID, Long> entry = top.get(index - 1);
            UUID uuid = entry.getKey();
            long seconds = entry.getValue();
            OfflinePlayer off = Bukkit.getOfflinePlayer(uuid);
            String name = off.getName() != null && !off.getName().isEmpty() ? off.getName() : uuid.toString().substring(0, 8);

            return switch (kind) {
                case "name"     -> name;
                case "playtime" -> PlaytimeTracker.formatPlaytime(seconds);
                case "seconds"  -> String.valueOf(seconds);
                default         -> parts.length == 2 ? name : "-";
            };
        } catch (Exception e) {
            plugin.getLogger().warning("Erreur placeholder topplaytime: " + e.getMessage());
            return "-";
        }
    }

    // ── Top X-Ray ────────────────────────────────────────────────────────────

    private String handleTopXray(String params) {
        String[] parts = params.split("_");
        String kind;
        int index;
        if (parts.length == 2) {
            kind = "name";
            try { index = Integer.parseInt(parts[1]); } catch (NumberFormatException e) { return ""; }
        } else if (parts.length >= 3) {
            kind = parts[1].toLowerCase();
            try { index = Integer.parseInt(parts[2]); } catch (NumberFormatException e) { return ""; }
        } else { return ""; }
        if (index <= 0) return "";

        List<Map.Entry<UUID, BlockMiningStats>> top = getTopXRayEntries(index);
        if (top.size() < index) return "";
        Map.Entry<UUID, BlockMiningStats> entry = top.get(index - 1);
        UUID uuid = entry.getKey();
        BlockMiningStats stats = entry.getValue();
        if (stats == null) return "";

        OfflinePlayer off = Bukkit.getOfflinePlayer(uuid);
        String name = off.getName() != null ? off.getName() : uuid.toString().substring(0, 8);

        return switch (kind) {
            case "name"    -> name;
            case "level"   -> xrayLevel(stats);
            case "percent" -> String.format("%.1f", stats.getValuablePercentage());
            case "ratio"   -> String.format("%.2f", stats.getDiamondPerThousandCommon());
            default        -> parts.length == 2 ? name : "";
        };
    }

    private List<Map.Entry<UUID, BlockMiningStats>> getTopXRayEntries(int limit) {
        Map<UUID, BlockMiningStats> all = xrayTracker.getAllStats();
        if (all.isEmpty()) return new ArrayList<>();
        FileConfiguration config = plugin.getConfig();
        int minBlocks = Math.max(1, config.getInt("xray.min-blocks-for-index", 150));
        double diamondThreshold = config.getDouble("xray.diamond-per-thousand-common-suspicious", 2.5);
        boolean useComposite = config.getBoolean("xray.use-composite-index", true);

        List<Map.Entry<UUID, BlockMiningStats>> list = new ArrayList<>(all.entrySet());
        list.removeIf(e -> e.getValue() == null || e.getValue().getTotal() < minBlocks);
        list.sort(Comparator.comparingDouble(
                (Map.Entry<UUID, BlockMiningStats> e) -> xrayCompositeScore(e.getValue(), minBlocks, diamondThreshold, useComposite)
        ).reversed());
        return list.size() > limit ? new ArrayList<>(list.subList(0, limit)) : list;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static boolean isMetricKey(String s) {
        return s.equalsIgnoreCase("percent") || s.equalsIgnoreCase("total") || s.equalsIgnoreCase("valid")
                || s.equalsIgnoreCase("suspicious") || s.equalsIgnoreCase("brand") || s.equalsIgnoreCase("premium")
                || s.equalsIgnoreCase("count") || s.equalsIgnoreCase("level") || s.equalsIgnoreCase("suspect")
                || s.equalsIgnoreCase("ratio") || s.equalsIgnoreCase("common") || s.equalsIgnoreCase("netherrack")
                || s.equalsIgnoreCase("violations") || s.equalsIgnoreCase("cps") || s.equalsIgnoreCase("flagged")
                || s.equalsIgnoreCase("received") || s.equalsIgnoreCase("filed") || s.equalsIgnoreCase("streak")
                || s.equalsIgnoreCase("claim") || s.equalsIgnoreCase("banned") || s.equalsIgnoreCase("muted")
                || s.equalsIgnoreCase("bans") || s.equalsIgnoreCase("mutes") || s.equalsIgnoreCase("warns");
    }

    private String xrayLevel(BlockMiningStats stats) {
        if (stats == null) return "-";
        FileConfiguration config = plugin.getConfig();
        int minBlocks = Math.max(1, config.getInt("xray.min-blocks-for-index", 150));
        double diamondThreshold = config.getDouble("xray.diamond-per-thousand-common-suspicious", 2.5);
        double vVeryHigh = config.getDouble("xray.valuable-percent-very-high", 65);
        double vHigh = config.getDouble("xray.valuable-percent-high", 45);
        double vMedium = config.getDouble("xray.valuable-percent-medium", 22);
        boolean useComposite = config.getBoolean("xray.use-composite-index", true);

        long total = stats.getTotal();
        double pctValuable = stats.getValuablePercentage();
        double diamondPer1k = stats.getDiamondPerThousandCommon();

        if (total < minBlocks) return "Données insuffisantes";
        if (useComposite) {
            boolean diamondSuspicious = diamondPer1k >= diamondThreshold;
            if (pctValuable >= vVeryHigh || (diamondSuspicious && pctValuable >= vHigh) || diamondPer1k >= diamondThreshold * 2) return "Très élevé";
            if (pctValuable >= vHigh || diamondSuspicious) return "Élevé";
            if (pctValuable >= vMedium) return "Moyen";
            if (pctValuable >= 10) return "Faible";
            return "Négligeable";
        }
        int indice = (int) Math.round(pctValuable);
        return indice >= 70 ? "Très élevé" : indice >= 50 ? "Élevé" : indice >= 25 ? "Moyen" : indice >= 10 ? "Faible" : "Négligeable";
    }

    private boolean xraySuspect(BlockMiningStats stats) {
        if (stats == null) return false;
        FileConfiguration config = plugin.getConfig();
        int minBlocks = Math.max(1, config.getInt("xray.min-blocks-for-index", 150));
        double diamondThreshold = config.getDouble("xray.diamond-per-thousand-common-suspicious", 2.5);
        double vVeryHigh = config.getDouble("xray.valuable-percent-very-high", 65);
        double vHigh = config.getDouble("xray.valuable-percent-high", 45);
        double vMedium = config.getDouble("xray.valuable-percent-medium", 22);
        boolean useComposite = config.getBoolean("xray.use-composite-index", true);

        if (stats.getTotal() < minBlocks) return false;
        double pctValuable = stats.getValuablePercentage();
        double diamondPer1k = stats.getDiamondPerThousandCommon();

        if (useComposite) {
            boolean diamondSuspicious = diamondPer1k >= diamondThreshold;
            return pctValuable >= vVeryHigh
                    || (diamondSuspicious && pctValuable >= vHigh)
                    || diamondPer1k >= diamondThreshold * 2
                    || pctValuable >= vHigh;
        }
        return pctValuable >= 50;
    }

    private double xrayCompositeScore(BlockMiningStats stats, int minBlocks, double diamondThreshold, boolean useComposite) {
        if (stats == null || stats.getTotal() < minBlocks) return 0;
        double pct = stats.getValuablePercentage();
        if (!useComposite) return pct;
        double diamondPer1k = stats.getDiamondPerThousandCommon();
        double bonus = diamondPer1k >= diamondThreshold ? Math.min(30, (diamondPer1k - diamondThreshold) * 5) : 0;
        return pct + bonus;
    }
}
