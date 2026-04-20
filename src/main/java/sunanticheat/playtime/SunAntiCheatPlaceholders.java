package sunanticheat.playtime;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.client.ClientInfo;
import sunanticheat.client.ClientInfoTracker;
import sunanticheat.freecam.FreecamTracker;
import sunanticheat.xray.BlockMiningStats;
import sunanticheat.xray.XRayTracker;

import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import org.jetbrains.annotations.NotNull;

import java.util.UUID;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Expansion PlaceholderAPI — nombreux placeholders SunAntiCheat.
 *
 * Temps de jeu: playtime, playtime_seconds, playtime_minutes, playtime_hours
 * Top playtime: topplaytime_1, topplaytime_2, ... (nom) | topplaytime_name_1, topplaytime_playtime_1, topplaytime_seconds_1
 * X-Ray: xray_total, xray_diamond, xray_iron, xray_gold, xray_netherite, xray_common, xray_netherrack,
 *        xray_valuable_percent, xray_diamond_percent, xray_ratio, xray_level, xray_suspect
 * Freecam: freecam_valid, freecam_suspicious, freecam_total, freecam_suspicion_percent
 * Client: client_brand, client_premium, client_mods_count, client_packs_count
 *
 * Pour un autre joueur: suffixer par _NomDuJoueur (ex: xray_total_Steve)
 */
public class SunAntiCheatPlaceholders extends PlaceholderExpansion {

    private final JavaPlugin plugin;
    private final PlaytimeTracker playtimeTracker;
    private final XRayTracker xrayTracker;
    private final FreecamTracker freecamTracker;
    private final ClientInfoTracker clientInfoTracker;

    public SunAntiCheatPlaceholders(JavaPlugin plugin, PlaytimeTracker playtimeTracker,
                                    XRayTracker xrayTracker, FreecamTracker freecamTracker,
                                    ClientInfoTracker clientInfoTracker) {
        this.plugin = plugin;
        this.playtimeTracker = playtimeTracker;
        this.xrayTracker = xrayTracker;
        this.freecamTracker = freecamTracker;
        this.clientInfoTracker = clientInfoTracker;
    }

    @Override
    public @NotNull String getAuthor() {
        return "Sun";
    }

    @Override
    public @NotNull String getIdentifier() {
        return "sunanticheat";
    }

    @Override
    public @NotNull String getVersion() {
        return "1.0.0";
    }

    @Override
    public boolean persist() {
        return true;
    }

    @Override
    public String onRequest(OfflinePlayer player, @NotNull String params) {
        if (params == null || params.isEmpty()) return null;

        String lower = params.toLowerCase();
        if (lower.startsWith("topplaytime_")) {
            return handleTopPlaytime(params);
        }
        if (lower.startsWith("topxray_")) {
            return handleTopXray(params);
        }

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

        // ——— Playtime ———
        if (key.equalsIgnoreCase("playtime")) {
            long sec = playtimeTracker.getTotalPlaytimeSeconds(uuid);
            return PlaytimeTracker.formatPlaytime(sec);
        }
        if (key.equalsIgnoreCase("playtime_seconds")) {
            return String.valueOf(playtimeTracker.getTotalPlaytimeSeconds(uuid));
        }
        if (key.equalsIgnoreCase("playtime_minutes")) {
            return String.valueOf(playtimeTracker.getTotalPlaytimeSeconds(uuid) / 60);
        }
        if (key.equalsIgnoreCase("playtime_hours")) {
            return String.valueOf(playtimeTracker.getTotalPlaytimeSeconds(uuid) / 3600);
        }

        // ——— X-Ray ———
        BlockMiningStats xray = xrayTracker.getStats(uuid);
        if (key.equalsIgnoreCase("xray_total")) {
            return xray != null ? String.valueOf(xray.getTotal()) : "0";
        }
        if (key.equalsIgnoreCase("xray_diamond")) {
            return xray != null ? String.valueOf(xray.getDiamondCount()) : "0";
        }
        if (key.equalsIgnoreCase("xray_iron")) {
            return xray != null ? String.valueOf(xray.getIronCount()) : "0";
        }
        if (key.equalsIgnoreCase("xray_gold")) {
            return xray != null ? String.valueOf(xray.getGoldCount()) : "0";
        }
        if (key.equalsIgnoreCase("xray_netherite")) {
            return xray != null ? String.valueOf(xray.getAncientDebrisCount()) : "0";
        }
        if (key.equalsIgnoreCase("xray_common")) {
            return xray != null ? String.valueOf(xray.getCommonCount()) : "0";
        }
        if (key.equalsIgnoreCase("xray_netherrack")) {
            return xray != null ? String.valueOf(xray.getNetherrackCount()) : "0";
        }
        if (key.equalsIgnoreCase("xray_valuable_percent")) {
            return xray != null ? String.format("%.1f", xray.getValuablePercentage()) : "0";
        }
        if (key.equalsIgnoreCase("xray_diamond_percent")) {
            return xray != null ? String.format("%.1f", xray.getDiamondPercentage()) : "0";
        }
        if (key.equalsIgnoreCase("xray_ratio")) {
            return xray != null ? String.format("%.2f", xray.getDiamondPerThousandCommon()) : "0";
        }
        if (key.equalsIgnoreCase("xray_level")) {
            return xrayLevel(xray);
        }
        if (key.equalsIgnoreCase("xray_suspect")) {
            return xraySuspect(xray) ? "1" : "0";
        }
        if (key.equalsIgnoreCase("xray_suspect_oui_non")) {
            return xraySuspect(xray) ? "Oui" : "Non";
        }

        // ——— Freecam ———
        var freecamStats = freecamTracker.getStats(uuid);
        if (key.equalsIgnoreCase("freecam_valid")) {
            return freecamStats != null ? String.valueOf(freecamStats.getValid()) : "0";
        }
        if (key.equalsIgnoreCase("freecam_suspicious")) {
            return freecamStats != null ? String.valueOf(freecamStats.getSuspicious()) : "0";
        }
        if (key.equalsIgnoreCase("freecam_total")) {
            return freecamStats != null ? String.valueOf(freecamStats.getTotal()) : "0";
        }
        if (key.equalsIgnoreCase("freecam_suspicion_percent")) {
            return freecamStats != null ? String.format("%.1f", freecamStats.getSuspicionPercentage()) : "0";
        }

        // ——— Client ———
        ClientInfo client = clientInfoTracker.getInfo(uuid);
        if (key.equalsIgnoreCase("client_brand")) {
            return client != null && client.getClientBrand() != null ? client.getClientBrand() : "vanilla";
        }
        if (key.equalsIgnoreCase("client_premium")) {
            if (client == null || client.getPremium() == null) return "?";
            return Boolean.TRUE.equals(client.getPremium()) ? "Oui" : "Non";
        }
        if (key.equalsIgnoreCase("client_mods_count")) {
            return client != null ? String.valueOf(client.getMods().size()) : "0";
        }
        if (key.equalsIgnoreCase("client_packs_count")) {
            return client != null ? String.valueOf(client.getResourcePacks().size()) : "0";
        }

        return null;
    }

    /**
     * Placeholders top Playtime (podium) :
     * - topplaytime_1, topplaytime_2, ... : nom du joueur
     * - topplaytime_name_1, ... : nom du joueur
     * - topplaytime_playtime_1, ... : temps formaté (2j 5h 30m)
     * - topplaytime_seconds_1, ... : temps en secondes
     */
    private String handleTopPlaytime(String params) {
        try {
            if (playtimeTracker == null) return "-";
            String[] parts = params.split("_", 3);
            String kind;
            int index;
            if (parts.length == 2) {
                kind = "name";
                try {
                    index = Integer.parseInt(parts[1]);
                } catch (NumberFormatException e) {
                    return "-";
                }
            } else if (parts.length >= 3) {
                kind = parts[1].toLowerCase();
                try {
                    index = Integer.parseInt(parts[2]);
                } catch (NumberFormatException e) {
                    return "-";
                }
            } else {
                return "-";
            }
            if (index <= 0) return "-";

            List<Map.Entry<UUID, Long>> top = playtimeTracker.getTopPlaytimes(index);
            if (top == null || top.size() < index) return "-";
            Map.Entry<UUID, Long> entry = top.get(index - 1);
            UUID uuid = entry.getKey();
            long seconds = entry.getValue();

            OfflinePlayer off = Bukkit.getOfflinePlayer(uuid);
            String name = off.getName() != null && !off.getName().isEmpty() ? off.getName() : uuid.toString().substring(0, 8);

            switch (kind) {
                case "name":
                    return name;
                case "playtime":
                    return PlaytimeTracker.formatPlaytime(seconds);
                case "seconds":
                    return String.valueOf(seconds);
                default:
                    return parts.length == 2 ? name : "-";
            }
        } catch (Exception e) {
            plugin.getLogger().warning("Erreur placeholder topplaytime: " + e.getMessage());
            return "-";
        }
    }

    /**
     * Placeholders top X-Ray (cheaters potentiels) :
     * - topxray_1, topxray_2, topxray_3 : nom du joueur
     * - topxray_name_1, topxray_name_2, ... : nom du joueur
     * - topxray_level_1, ... : niveau texte (Négligeable → Très élevé)
     * - topxray_percent_1, ... : % précieux
     * - topxray_ratio_1, ... : ratio diamant / 1000 blocs communs
     */
    private String handleTopXray(String params) {
        String[] parts = params.split("_");
        String kind;
        int index;
        if (parts.length == 2) {
            // topxray_1 => nom du joueur
            kind = "name";
            try {
                index = Integer.parseInt(parts[1]);
            } catch (NumberFormatException e) {
                return "";
            }
        } else if (parts.length >= 3) {
            kind = parts[1].toLowerCase();
            try {
                index = Integer.parseInt(parts[2]);
            } catch (NumberFormatException e) {
                return "";
            }
        } else {
            return "";
        }
        if (index <= 0) return "";

        List<Map.Entry<UUID, BlockMiningStats>> top = getTopXRayEntries(index);
        if (top.size() < index) return "";
        Map.Entry<UUID, BlockMiningStats> entry = top.get(index - 1);
        UUID uuid = entry.getKey();
        BlockMiningStats stats = entry.getValue();
        if (stats == null) return "";

        OfflinePlayer off = Bukkit.getOfflinePlayer(uuid);
        String name = off.getName() != null ? off.getName() : uuid.toString().substring(0, 8);

        switch (kind) {
            case "name":
                return name;
            case "level":
                return xrayLevel(stats);
            case "percent":
                return String.format("%.1f", stats.getValuablePercentage());
            case "ratio":
                return String.format("%.2f", stats.getDiamondPerThousandCommon());
            default:
                // topxray_1 (kind inconnu) => nom
                if (parts.length == 2) return name;
                return "";
        }
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
        if (list.size() > limit) {
            return new ArrayList<>(list.subList(0, limit));
        }
        return list;
    }

    private double xrayCompositeScore(BlockMiningStats stats, int minBlocks, double diamondThreshold, boolean useComposite) {
        if (stats == null || stats.getTotal() < minBlocks) return 0;
        double pct = stats.getValuablePercentage();
        if (!useComposite) return pct;
        double diamondPer1k = stats.getDiamondPerThousandCommon();
        double bonus = diamondPer1k >= diamondThreshold ? Math.min(30, (diamondPer1k - diamondThreshold) * 5) : 0;
        return pct + bonus;
    }

    private static boolean isMetricKey(String s) {
        return s.equalsIgnoreCase("percent") || s.equalsIgnoreCase("total") || s.equalsIgnoreCase("valid")
                || s.equalsIgnoreCase("suspicious") || s.equalsIgnoreCase("brand") || s.equalsIgnoreCase("premium")
                || s.equalsIgnoreCase("count") || s.equalsIgnoreCase("level") || s.equalsIgnoreCase("suspect")
                || s.equalsIgnoreCase("ratio") || s.equalsIgnoreCase("common") || s.equalsIgnoreCase("netherrack");
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

        long total = stats.getTotal();
        double pctValuable = stats.getValuablePercentage();
        double diamondPer1k = stats.getDiamondPerThousandCommon();

        if (total < minBlocks) return false;
        if (useComposite) {
            boolean diamondSuspicious = diamondPer1k >= diamondThreshold;
            if (pctValuable >= vVeryHigh || (diamondSuspicious && pctValuable >= vHigh) || diamondPer1k >= diamondThreshold * 2) return true;
            if (pctValuable >= vHigh || diamondSuspicious) return true;
            if (pctValuable >= vMedium) return pctValuable >= vHigh || (diamondPer1k >= diamondThreshold && pctValuable >= vMedium);
            return false;
        }
        return pctValuable >= 50;
    }
}
