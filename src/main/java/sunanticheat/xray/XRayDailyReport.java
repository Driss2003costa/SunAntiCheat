package sunanticheat.xray;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import sunanticheat.discord.DiscordWebhook;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Génère et envoie le rapport X-Ray quotidien vers le webhook Discord.
 * Liste tous les joueurs avec stats et indicateur suspect / non suspect.
 */
public class XRayDailyReport {

    private final JavaPlugin plugin;
    private final XRayTracker tracker;
    private final DiscordWebhook webhook;

    public XRayDailyReport(JavaPlugin plugin, XRayTracker tracker, DiscordWebhook webhook) {
        this.plugin = plugin;
        this.tracker = tracker;
        this.webhook = webhook;
    }

    public void run() {
        if (webhook == null || !webhook.isEnabled()) return;

        FileConfiguration config = plugin.getConfig();
        int minBlocks = Math.max(1, config.getInt("xray.min-blocks-for-index", 150));
        double diamondThreshold = config.getDouble("xray.diamond-per-thousand-common-suspicious", 2.5);
        double vVeryHigh = config.getDouble("xray.valuable-percent-very-high", 65);
        double vHigh = config.getDouble("xray.valuable-percent-high", 45);
        double vMedium = config.getDouble("xray.valuable-percent-medium", 22);
        boolean useComposite = config.getBoolean("xray.use-composite-index", true);

        Map<UUID, BlockMiningStats> allStats = tracker.getAllStats();
        List<UUID> sorted = new ArrayList<>(allStats.keySet());
        sorted.sort(Comparator.comparingDouble((UUID uuid) -> {
            BlockMiningStats s = allStats.get(uuid);
            return computeCompositeScore(s, minBlocks, diamondThreshold, useComposite);
        }).reversed());

        StringBuilder sb = new StringBuilder();
        sb.append("Rapport du **").append(LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))).append("**\n\n");

        for (UUID uuid : sorted) {
            BlockMiningStats stats = allStats.get(uuid);
            if (stats == null) continue;

            OfflinePlayer off = Bukkit.getOfflinePlayer(uuid);
            String name = off.getName() != null ? off.getName() : uuid.toString().substring(0, 8);
            long total = stats.getTotal();
            double pctValuable = stats.getValuablePercentage();
            double diamondPer1k = stats.getDiamondPerThousandCommon();

            String niveau;
            boolean suspect;
            if (total < minBlocks) {
                niveau = "Données insuffisantes";
                suspect = false;
            } else {
                if (useComposite) {
                    boolean diamondSuspicious = diamondPer1k >= diamondThreshold;
                    if (pctValuable >= vVeryHigh || (diamondSuspicious && pctValuable >= vHigh) || diamondPer1k >= diamondThreshold * 2) {
                        niveau = "Très élevé";
                        suspect = true;
                    } else if (pctValuable >= vHigh || diamondSuspicious) {
                        niveau = "Élevé";
                        suspect = true;
                    } else if (pctValuable >= vMedium) {
                        niveau = "Moyen";
                        suspect = pctValuable >= vHigh || (diamondPer1k >= diamondThreshold && pctValuable >= vMedium);
                    } else if (pctValuable >= 10) {
                        niveau = "Faible";
                        suspect = false;
                    } else {
                        niveau = "Négligeable";
                        suspect = false;
                    }
                } else {
                    int indice = (int) Math.round(pctValuable);
                    niveau = indice >= 70 ? "Très élevé" : indice >= 50 ? "Élevé" : indice >= 25 ? "Moyen" : indice >= 10 ? "Faible" : "Négligeable";
                    suspect = indice >= 50;
                }
            }

            String statut = suspect ? "⚠️ **SUSPECT**" : "✅ OK";
            sb.append("**").append(escapeMarkdown(name)).append("** — Blocs: ").append(total)
                    .append(" | % précieux: ").append(String.format("%.1f", pctValuable))
                    .append("% | D/1000: ").append(String.format("%.2f", diamondPer1k))
                    .append(" | ").append(niveau).append(" | ").append(statut).append("\n");
        }

        if (sorted.isEmpty()) {
            sb.append("*Aucune donnée de minage enregistrée.*");
        }

        String title = "Rapport X-Ray quotidien — " + LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        webhook.sendEmbed(title, sb.toString());
    }

    private static double computeCompositeScore(BlockMiningStats s, int minBlocks, double diamondThreshold, boolean useComposite) {
        if (s == null || s.getTotal() < minBlocks) return 0;
        double pct = s.getValuablePercentage();
        double diamondPer1k = s.getDiamondPerThousandCommon();
        if (!useComposite) return pct;
        double bonus = diamondPer1k >= diamondThreshold ? Math.min(30, (diamondPer1k - diamondThreshold) * 5) : 0;
        return pct + bonus;
    }

    private static String escapeMarkdown(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("*", "\\*").replace("_", "\\_").replace("\n", " ");
    }
}
