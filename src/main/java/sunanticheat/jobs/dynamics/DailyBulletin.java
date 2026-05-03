package sunanticheat.jobs.dynamics;

import org.bukkit.Bukkit;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import sunanticheat.jobs.CustomJob;
import sunanticheat.jobs.CustomJobConfig;

import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Bulletin quotidien : chaque jour à {@code refresh-hour}, un métier
 * est tiré au sort comme « demande forte du jour » et reçoit un bonus
 * sur tous ses gains (XP + money) jusqu'au lendemain.
 *
 * Effets connexes :
 *  - Annonce serveur au refresh
 *  - Affiché dans {@code /job} et sur le portail web
 *  - Multiplicateur retourné via {@link #multiplierFor(String)}
 */
public final class DailyBulletin {

    private final JobDynamicsConfig cfg;
    private final CustomJobConfig jobs;

    private LocalDate currentDay = LocalDate.MIN;
    private String  currentJobId = null;
    private double  currentMult  = 1.0;
    private long    refreshedAt  = 0;

    public DailyBulletin(JobDynamicsConfig cfg, CustomJobConfig jobs) {
        this.cfg = cfg; this.jobs = jobs;
    }

    /** Vérifie / refresh la sélection si on a passé l'heure de refresh ou changé de jour. */
    public synchronized void tickRefresh(boolean broadcastIfChanged) {
        if (!cfg.bulletinEnabled()) return;
        LocalDate today = LocalDate.now();
        int hourNow = java.time.LocalTime.now().getHour();
        boolean shouldRefresh = !today.equals(currentDay) && hourNow >= cfg.bulletinRefreshHour();
        if (currentDay == LocalDate.MIN) shouldRefresh = true;
        if (!shouldRefresh) return;

        Collection<CustomJob> all = jobs.getJobs().values();
        if (all.isEmpty()) return;
        List<CustomJob> list = new ArrayList<>(all);
        CustomJob picked = list.get(ThreadLocalRandom.current().nextInt(list.size()));
        double mult = cfg.bulletinMin() +
                ThreadLocalRandom.current().nextDouble() * (cfg.bulletinMax() - cfg.bulletinMin());
        mult = Math.round(mult * 10.0) / 10.0;

        currentDay = today;
        currentJobId = picked.id();
        currentMult  = mult;
        refreshedAt  = System.currentTimeMillis();

        if (broadcastIfChanged) {
            String msg = cfg.bulletinMessage()
                    .replace("{job}",  picked.name())
                    .replace("{mult}", String.format("%.1f", mult));
            Bukkit.getServer().broadcast(LegacyComponentSerializer.legacyAmpersand().deserialize(msg));
        }
    }

    /** Multiplicateur si ce job est celui du bulletin du jour, 1.0 sinon. */
    public double multiplierFor(String jobId) {
        if (!cfg.bulletinEnabled() || currentJobId == null) return 1.0;
        return currentJobId.equalsIgnoreCase(jobId) ? currentMult : 1.0;
    }

    /** Force le tirage d'un nouveau bulletin immédiatement. */
    public synchronized void forceRefresh(boolean broadcast) {
        currentDay = LocalDate.MIN;
        tickRefresh(broadcast);
    }

    public String  currentJobId()  { return currentJobId; }
    public double  currentMult()   { return currentMult; }
    public long    refreshedAt()   { return refreshedAt; }

    public Component announceComponent() {
        if (currentJobId == null) return Component.text("Aucun bulletin disponible", NamedTextColor.GRAY);
        CustomJob j = jobs.getJob(currentJobId);
        String name = j != null ? j.name() : currentJobId;
        return LegacyComponentSerializer.legacyAmpersand().deserialize(
                cfg.bulletinMessage()
                    .replace("{job}",  name)
                    .replace("{mult}", String.format("%.1f", currentMult)));
    }
}
