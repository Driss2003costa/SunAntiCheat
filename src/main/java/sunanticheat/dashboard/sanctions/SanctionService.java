package sunanticheat.dashboard.sanctions;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import sunanticheat.dashboard.audit.Audit;
import sunanticheat.dashboard.audit.AuditEntry;

import java.net.InetSocketAddress;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Orchestrateur de sanctions :
 *  - Crée la sanction en DB
 *  - Applique l'effet en jeu (kick / mark muted / etc.)
 *  - Log l'audit + déclenche le webhook Discord
 *  - Cache les mutes pour évaluation O(1) sur chaque PlayerChatEvent
 */
public final class SanctionService {

    private final JavaPlugin plugin;
    private final SanctionStore store;
    private final KickScreenFormatter formatter;
    private final Logger logger;

    /** Cache des UUIDs muets (re-build au boot + maintenu via issue/revoke). */
    private final Map<UUID, SanctionEntry> muteCache = new ConcurrentHashMap<>();

    public SanctionService(JavaPlugin plugin, SanctionStore store, KickScreenFormatter formatter) {
        this.plugin = plugin;
        this.store = store;
        this.formatter = formatter;
        this.logger = plugin.getLogger();
        rebuildMuteCache();
    }

    public SanctionStore store() { return store; }
    public KickScreenFormatter formatter() { return formatter; }

    /** Re-charge le cache des mutes actifs depuis la DB (au boot + après revoke). */
    public void rebuildMuteCache() {
        muteCache.clear();
        for (SanctionEntry s : store.list(null, "MUTE", null, true, 1000, 0)) {
            if (s.targetUuid != null) {
                try { muteCache.put(UUID.fromString(s.targetUuid), s); }
                catch (Exception ignored) {}
            }
        }
        logger.info("[Sanctions] " + muteCache.size() + " mute(s) actif(s) en cache");
    }

    public SanctionEntry activeMute(UUID uuid) {
        SanctionEntry s = muteCache.get(uuid);
        if (s == null) return null;
        // re-vérifie l'expiration
        if (!s.isActive()) {
            muteCache.remove(uuid);
            return null;
        }
        return s;
    }

    // ── Issue ────────────────────────────────────────────────────────────────

    /**
     * Émet une sanction et l'applique en jeu. Doit être appelée sur n'importe
     * quel thread — l'application en jeu est délocalisée vers le main thread.
     *
     * @return l'entrée sanctioin créée (avec id généré).
     */
    public SanctionEntry issue(SanctionType type, Severity sev, String category,
                               String targetUuid, String targetName, String targetIp,
                               String issuedBy, long durationMs,
                               String reason, String evidenceUrl, String notes,
                               boolean silent, String templateId) {
        SanctionEntry entry = SanctionEntry.create(type, sev, category, targetUuid, targetName, targetIp,
                issuedBy, durationMs, reason, evidenceUrl, notes, silent, templateId);
        store.insert(entry);

        // ── Application en jeu ──────────────────────────────────────────────
        Bukkit.getScheduler().runTask(plugin, () -> applyInGame(entry));

        // ── Audit ───────────────────────────────────────────────────────────
        Map<String, Object> meta = new HashMap<>();
        meta.put("type", type.name());
        meta.put("severity", sev.name());
        meta.put("durationMs", durationMs);
        meta.put("permanent", entry.isPermanent());
        meta.put("sanctionId", entry.id);
        if (templateId != null) meta.put("templateId", templateId);

        try {
            Audit.store().append(new AuditEntry(issuedBy, "ADMIN",
                    "SANCTION_" + type.name(),
                    targetName,
                    type.name() + " — " + reason
                        + (durationMs > 0 ? " (" + KickScreenFormatter.formatDuration(durationMs) + ")" : " (perma)"),
                    "dashboard",
                    meta));
        } catch (Throwable ignored) {}

        return entry;
    }

    private void applyInGame(SanctionEntry s) {
        SanctionType t = s.typeEnum();
        Player target = null;
        if (s.targetUuid != null) {
            try { target = Bukkit.getPlayer(UUID.fromString(s.targetUuid)); } catch (Exception ignored) {}
        }
        if (target == null && s.targetName != null) target = Bukkit.getPlayerExact(s.targetName);

        switch (t) {
            case KICK -> {
                if (target != null) target.kickPlayer(formatter.formatKick(s));
            }
            case BAN, IP_BAN -> {
                String screen = formatter.formatBan(s);
                if (target != null) {
                    // capture l'IP avant le kick si pas déjà connue + IP_BAN
                    if (t == SanctionType.IP_BAN && s.targetIp == null) {
                        try {
                            InetSocketAddress addr = target.getAddress();
                            if (addr != null && addr.getAddress() != null) {
                                s.targetIp = addr.getAddress().getHostAddress();
                                store.insert(s); // update
                            }
                        } catch (Throwable ignored) {}
                    }
                    target.kickPlayer(screen);
                }
                if (!s.silent) broadcastSanction(s);
            }
            case MUTE -> {
                if (s.targetUuid != null) {
                    try { muteCache.put(UUID.fromString(s.targetUuid), s); }
                    catch (Exception ignored) {}
                }
                if (target != null) {
                    target.sendMessage(formatter.formatMutedMessage(s));
                }
                if (!s.silent) broadcastSanction(s);
            }
            case WARN -> {
                if (target != null) {
                    target.sendMessage("§e§l⚠ Avertissement §8» §f" + s.reason);
                }
            }
        }
    }

    private void broadcastSanction(SanctionEntry s) {
        String msg = "§c§l[Modération] §7" + s.targetName + " §c"
                + verbForType(s.typeEnum())
                + (s.isPermanent() ? " §c§lpermanente" : " §7pour §f" + KickScreenFormatter.formatDuration(s.expiresAt - s.issuedAt))
                + " §8— §f" + s.reason;
        Bukkit.broadcastMessage(msg);
    }

    private static String verbForType(SanctionType t) {
        return switch (t) {
            case KICK   -> "kické";
            case BAN    -> "banni";
            case IP_BAN -> "banni IP";
            case MUTE   -> "muet";
            case WARN   -> "averti";
        };
    }

    // ── Revoke ───────────────────────────────────────────────────────────────

    /**
     * Lève une sanction (unban / unmute / etc.).
     * @return true si la sanction existait et a été révoquée.
     */
    public boolean revoke(String sanctionId, String revokedBy, String reason) {
        SanctionEntry s = store.get(sanctionId);
        if (s == null || s.revoked) return false;
        boolean ok = store.revoke(sanctionId, revokedBy, reason);
        if (!ok) return false;

        // Update cache mute
        if (s.typeEnum() == SanctionType.MUTE && s.targetUuid != null) {
            try { muteCache.remove(UUID.fromString(s.targetUuid)); }
            catch (Exception ignored) {}
        }

        // Audit
        Map<String, Object> meta = new HashMap<>();
        meta.put("sanctionId", s.id);
        meta.put("targetName", s.targetName);
        meta.put("originalType", s.type);
        try {
            Audit.store().append(new AuditEntry(revokedBy, "ADMIN",
                    "SANCTION_REVOKED",
                    s.targetName,
                    "Levée " + s.type + " — " + (reason != null ? reason : ""),
                    "dashboard",
                    meta));
        } catch (Throwable ignored) {}

        return true;
    }

    // ── Player getters ───────────────────────────────────────────────────────

    public SanctionEntry findActiveBan(UUID uuid, String name, String ip) {
        SanctionEntry s = store.activeSanction(uuid != null ? uuid.toString() : null, name, ip, SanctionType.BAN);
        if (s != null) return s;
        return store.activeSanction(uuid != null ? uuid.toString() : null, name, ip, SanctionType.IP_BAN);
    }

    public OfflinePlayer offlinePlayer(String name) {
        return Bukkit.getOfflinePlayer(name);
    }
}
