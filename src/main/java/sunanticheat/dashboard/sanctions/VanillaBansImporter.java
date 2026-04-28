package sunanticheat.dashboard.sanctions;

import org.bukkit.BanEntry;
import org.bukkit.BanList;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;

import sunanticheat.dashboard.db.BlobStorage;

import java.util.Date;
import java.util.UUID;
import java.util.logging.Logger;

/**
 * Importe les bans Bukkit existants (banned-players.json + banned-ips.json)
 * dans la table `sanctions` au premier démarrage après installation du module.
 *
 * Idempotent : un flag est posé en kv_blobs (`vanilla_bans_imported`) après
 * import. Les imports suivants sont skippés.
 *
 * Stratégie : on ne SUPPRIME PAS les entrées Bukkit (elles continuent de
 * fonctionner en parallèle). On les copie juste pour avoir une vue unifiée
 * dans le dashboard.
 */
public final class VanillaBansImporter {

    private static final String FLAG_KEY = "vanilla_bans_imported";

    private final SanctionStore store;
    private final BlobStorage blobs;
    private final Logger logger;

    public VanillaBansImporter(SanctionStore store, BlobStorage blobs, Logger logger) {
        this.store = store;
        this.blobs = blobs;
        this.logger = logger;
    }

    /** Exécute l'import une seule fois (idempotent). */
    @SuppressWarnings("deprecation") // BanList.Type legacy mais marche partout
    public void importIfNeeded() {
        String done = blobs.read(FLAG_KEY);
        if (done != null && !done.isBlank()) return;

        int imported = 0;
        long now = System.currentTimeMillis();

        // ── BANS PAR NOM (banned-players.json) ────────────────────────────────
        try {
            for (BanEntry entry : Bukkit.getBanList(BanList.Type.NAME).getBanEntries()) {
                if (entry == null) continue;
                String name = entry.getTarget();
                if (name == null || name.isBlank()) continue;

                // Try to resolve UUID
                String uuid = null;
                try {
                    OfflinePlayer off = Bukkit.getOfflinePlayer(name);
                    if (off != null && off.getUniqueId() != null) uuid = off.getUniqueId().toString();
                } catch (Throwable ignored) {}

                Date created = entry.getCreated();
                Date expires = entry.getExpiration();
                long issuedAt = created != null ? created.getTime() : now;
                Long expiresAt = expires != null ? expires.getTime() : null;

                SanctionEntry s = new SanctionEntry();
                s.id = UUID.randomUUID().toString();
                s.type = SanctionType.BAN.name();
                s.severity = Severity.HIGH.name();
                s.category = SanctionCategory.OTHER.name();
                s.targetUuid = uuid;
                s.targetName = name;
                s.issuedBy = entry.getSource() != null ? entry.getSource() : "vanilla";
                s.issuedAt = issuedAt;
                s.expiresAt = expiresAt;
                s.reason = entry.getReason() != null ? entry.getReason() : "(import vanilla)";
                s.notes = "[Import depuis banned-players.json]";
                s.silent = true;   // pas de broadcast pour un import
                s.revoked = false;
                store.insert(s);
                imported++;
            }
        } catch (Throwable t) {
            logger.warning("[Sanctions] Import bans NAME : " + t.getMessage());
        }

        // ── BANS PAR IP (banned-ips.json) ─────────────────────────────────────
        try {
            for (BanEntry entry : Bukkit.getBanList(BanList.Type.IP).getBanEntries()) {
                if (entry == null) continue;
                String ip = entry.getTarget();
                if (ip == null || ip.isBlank()) continue;

                Date created = entry.getCreated();
                Date expires = entry.getExpiration();

                SanctionEntry s = new SanctionEntry();
                s.id = UUID.randomUUID().toString();
                s.type = SanctionType.IP_BAN.name();
                s.severity = Severity.HIGH.name();
                s.category = SanctionCategory.EVASION.name();
                s.targetIp = ip;
                s.targetName = ip;   // pas de nom dispo, on met l'IP
                s.issuedBy = entry.getSource() != null ? entry.getSource() : "vanilla";
                s.issuedAt = created != null ? created.getTime() : now;
                s.expiresAt = expires != null ? expires.getTime() : null;
                s.reason = entry.getReason() != null ? entry.getReason() : "(import IP)";
                s.notes = "[Import depuis banned-ips.json]";
                s.silent = true;
                s.revoked = false;
                store.insert(s);
                imported++;
            }
        } catch (Throwable t) {
            logger.warning("[Sanctions] Import bans IP : " + t.getMessage());
        }

        // Marque l'import comme terminé
        blobs.write(FLAG_KEY, String.valueOf(now));

        if (imported > 0) {
            logger.info("[Sanctions] Importé " + imported + " ban(s) vanilla → table sanctions");
        } else {
            logger.info("[Sanctions] Aucun ban vanilla à importer");
        }
    }
}
