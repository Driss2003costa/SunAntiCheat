package sunanticheat.dashboard.announcements;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;
import sunanticheat.dashboard.crates.WeightedRandom;
import sunanticheat.dashboard.luckperms.LuckPermsBridge;

import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Random;
import java.util.logging.Logger;

/**
 * Service central de planification et d'envoi des annonces.
 * Un tick toutes les 30 secondes vérifie quelles annonces doivent partir.
 * Toutes les opérations serveur (envoi aux joueurs) sont sur le main thread
 * (garanti par runTaskTimer).
 */
public final class AnnouncementService {

    private final JavaPlugin plugin;
    private final AnnouncementStore store;
    private final Logger logger;
    private final Random rng = new Random();
    private BukkitTask task;

    private static final LegacyComponentSerializer LEGACY =
            LegacyComponentSerializer.legacyAmpersand();

    public AnnouncementService(JavaPlugin plugin, AnnouncementStore store, Logger logger) {
        this.plugin = plugin;
        this.store = store;
        this.logger = logger;
    }

    /** Démarre le scheduler (tick toutes les 30 secondes après 10 secondes initiales). */
    public void start() {
        if (task != null) return;
        task = Bukkit.getScheduler().runTaskTimer(plugin, this::tick, 20L * 10, 20L * 30);
    }

    /** Arrête le scheduler. */
    public void stop() {
        if (task != null) {
            try { task.cancel(); } catch (Throwable ignored) {}
            task = null;
        }
    }

    /** Itération périodique : vérifie chaque annonce et l'envoie si nécessaire. */
    private void tick() {
        long now = System.currentTimeMillis();
        for (Announcement a : store.list()) {
            try {
                if (!a.enabled) continue;
                if (a.endAt > 0 && now > a.endAt) {
                    store.disable(a.id);
                    continue;
                }
                if (shouldSend(a, now)) {
                    sendNow(a);
                }
            } catch (Throwable t) {
                logger.warning("[Announcements] tick fail " + a.id + ": " + t.getMessage());
            }
        }
    }

    /** Détermine si une annonce doit être envoyée à l'instant donné. */
    private boolean shouldSend(Announcement a, long now) {
        if (a.scheduleType == null) return false;
        long last = store.getLastSent(a.id);
        switch (a.scheduleType) {
            case "ONCE":
                return last == 0L && now >= a.startAt;
            case "INTERVAL":
                if (a.intervalMinutes <= 0) return false;
                if (now < a.startAt) return false;
                return (now - last) >= (long) a.intervalMinutes * 60_000L;
            case "TIMES":
                if (a.times == null || a.times.isEmpty()) return false;
                // évite les doublons dans une courte fenêtre (2 minutes)
                if (now - last < 2L * 60_000L) return false;
                LocalTime nowLt = LocalTime.now(ZoneId.systemDefault());
                int nowSec = nowLt.getHour() * 3600 + nowLt.getMinute() * 60 + nowLt.getSecond();
                for (String t : a.times) {
                    if (t == null) continue;
                    String[] parts = t.trim().split(":");
                    if (parts.length < 2) continue;
                    try {
                        int h = Integer.parseInt(parts[0]);
                        int m = Integer.parseInt(parts[1]);
                        int target = h * 3600 + m * 60;
                        if (Math.abs(nowSec - target) <= 30) return true;
                    } catch (NumberFormatException ignored) {}
                }
                return false;
            default:
                return false;
        }
    }

    /** Envoi immédiat d'une annonce (utilisé aussi pour les previews / testSend). */
    public void sendNow(Announcement a) {
        if (a == null || a.variants == null || a.variants.isEmpty()) return;

        final AnnouncementVariant variant =
                WeightedRandom.pick(a.variants, v -> Math.max(0, v.weight), rng);
        if (variant == null || variant.content == null) return;

        // Collecte des joueurs sur main thread, puis envoi
        Runnable run = () -> {
            try {
                List<Player> receivers = collectReceivers(a);
                if (receivers.isEmpty()) {
                    store.recordSend(a.id, variant.id, 0);
                    return;
                }
                Component msg = buildMessage(a, variant);
                for (Player p : receivers) {
                    try { p.sendMessage(msg); } catch (Throwable ignored) {}
                }
                store.recordSend(a.id, variant.id, receivers.size());
            } catch (Throwable t) {
                logger.warning("[Announcements] sendNow fail: " + t.getMessage());
            }
        };

        if (Bukkit.isPrimaryThread()) run.run();
        else Bukkit.getScheduler().runTask(plugin, run);
    }

    /** Sélection des destinataires en fonction du ciblage. */
    private List<Player> collectReceivers(Announcement a) {
        List<Player> out = new ArrayList<>();
        boolean lpReady = LuckPermsBridge.isAvailable();
        for (Player p : Bukkit.getOnlinePlayers()) {
            // Exclusion : prioritaire
            if (a.excludeRanks != null && !a.excludeRanks.isEmpty() && lpReady) {
                String pg = LuckPermsBridge.getPrimaryGroup(p.getUniqueId().toString());
                if (pg != null && containsIgnoreCase(a.excludeRanks, pg)) continue;
            }
            if (a.targetAll) { out.add(p); continue; }

            boolean worldMatch = a.targetWorlds != null && !a.targetWorlds.isEmpty()
                    && a.targetWorlds.contains(p.getWorld().getName());
            boolean rankMatch = false;
            if (a.targetRanks != null && !a.targetRanks.isEmpty() && lpReady) {
                String pg = LuckPermsBridge.getPrimaryGroup(p.getUniqueId().toString());
                rankMatch = pg != null && containsIgnoreCase(a.targetRanks, pg);
            }
            if (worldMatch || rankMatch) out.add(p);
        }
        return out;
    }

    private static boolean containsIgnoreCase(List<String> list, String v) {
        if (list == null || v == null) return false;
        for (String s : list) if (s != null && s.equalsIgnoreCase(v)) return true;
        return false;
    }

    /** Construit le composant Adventure complet (texte + hover + click). */
    private Component buildMessage(Announcement a, AnnouncementVariant variant) {
        String content = variant.content == null ? "" : variant.content.replace("\\n", "\n");
        Component msg = LEGACY.deserialize(content);
        if (variant.hoverText != null && !variant.hoverText.isEmpty()) {
            Component hover = LEGACY.deserialize(variant.hoverText.replace("\\n", "\n"));
            msg = msg.hoverEvent(HoverEvent.showText(hover));
        }
        if (variant.clickCommand != null && !variant.clickCommand.isEmpty()) {
            // On route via /sunann click {annId} {variantId} pour tracker les clics,
            // puis la commande réelle est dispatchée par SunAnnCommand.
            msg = msg.clickEvent(ClickEvent.runCommand(
                    "/sunann click " + a.id + " " + variant.id));
        } else if (variant.clickUrl != null && !variant.clickUrl.isEmpty()) {
            try {
                msg = msg.clickEvent(ClickEvent.openUrl(variant.clickUrl));
            } catch (Throwable ignored) {}
        }
        return msg;
    }

    // ── Getters utilitaires ─────────────────────────────────────────────────
    public AnnouncementStore getStore() { return store; }

    /** Getter public pour déclenchement manuel (testSend depuis le handler). */
    public void triggerTestSend(Announcement a) { sendNow(a); }

    // Helpers inutilisés actuellement mais fournis pour debug
    @SuppressWarnings("unused")
    private static long nowStartOfDay() {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }
}
