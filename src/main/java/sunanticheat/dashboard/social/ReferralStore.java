package sunanticheat.dashboard.social;

import sunanticheat.dashboard.db.Database;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;
import java.util.logging.Logger;

public final class ReferralStore {

    private final Database db;
    private final Logger logger;
    // Salt interne — pas exposé en config (le code est dérivé du uuid donc déjà unique)
    private static final String HMAC_SALT = "sun-ac-ref-2024";

    public ReferralStore(Database db, Logger logger) {
        this.db = db;
        this.logger = logger;
        migrate();
    }

    private void migrate() {
        db.migrate("social_referral", 1, """
            CREATE TABLE IF NOT EXISTS referral_codes (
                owner_uuid  TEXT NOT NULL PRIMARY KEY,
                code        TEXT NOT NULL UNIQUE,
                created_at  INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS referral_uses (
                id            TEXT NOT NULL PRIMARY KEY,
                referrer_uuid TEXT NOT NULL,
                referred_uuid TEXT NOT NULL UNIQUE,
                code_used     TEXT NOT NULL,
                ip_address    TEXT NOT NULL,
                validated     INTEGER NOT NULL DEFAULT 0,
                validated_at  INTEGER,
                created_at    INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_ref_referrer ON referral_uses(referrer_uuid);
            CREATE INDEX IF NOT EXISTS idx_ref_code     ON referral_codes(code)""");
    }

    // ── Code management ───────────────────────────────────────────────────────

    /** Returns existing code or creates one. Idempotent. */
    public String getOrCreateCode(String ownerUuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT code FROM referral_codes WHERE owner_uuid=?")) {
            ps.setString(1, ownerUuid);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getString("code");
            }
        } catch (SQLException e) {
            logger.warning("[ReferralStore] getCode: " + e.getMessage());
        }

        String code = deriveCode(ownerUuid);
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT INTO referral_codes(owner_uuid,code,created_at) VALUES(?,?,?)")) {
            ps.setString(1, ownerUuid); ps.setString(2, code); ps.setLong(3, System.currentTimeMillis());
            ps.executeUpdate();
            return code;
        } catch (SQLException e) {
            // Race condition ou collision — récupère le code existant
            try (PreparedStatement ps2 = db.conn().prepareStatement(
                    "SELECT code FROM referral_codes WHERE owner_uuid=?")) {
                ps2.setString(1, ownerUuid);
                try (ResultSet rs = ps2.executeQuery()) { if (rs.next()) return rs.getString("code"); }
            } catch (SQLException ignored) {}
            logger.warning("[ReferralStore] createCode: " + e.getMessage());
            return null;
        }
    }

    public String getOwnerByCode(String code) {
        if (code == null || code.isBlank()) return null;
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT owner_uuid FROM referral_codes WHERE code=?")) {
            ps.setString(1, code.toUpperCase().trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getString("owner_uuid");
            }
        } catch (SQLException e) {
            logger.warning("[ReferralStore] getOwnerByCode: " + e.getMessage());
        }
        return null;
    }

    // ── Use recording ─────────────────────────────────────────────────────────

    /**
     * Enregistre l'usage d'un code lors d'une inscription.
     * Règles anti-triche :
     *  - Code doit exister
     *  - Pas d'auto-parrainage
     *  - Un seul parrain par nouveau compte (UNIQUE sur referred_uuid)
     *  - Max 3 inscriptions depuis la même IP pour le même parrain
     */
    public boolean recordUse(String code, String referredUuid, String ipAddress) {
        String referrerUuid = getOwnerByCode(code);
        if (referrerUuid == null || referrerUuid.equals(referredUuid)) return false;

        // Limite IP : max 3 parrainages depuis la même IP pour ce parrain
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT COUNT(*) FROM referral_uses WHERE referrer_uuid=? AND ip_address=?")) {
            ps.setString(1, referrerUuid); ps.setString(2, ipAddress);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next() && rs.getInt(1) >= 3) return false;
            }
        } catch (SQLException e) {
            return false;
        }

        String id = UUID.randomUUID().toString();
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT INTO referral_uses(id,referrer_uuid,referred_uuid,code_used,ip_address,created_at) VALUES(?,?,?,?,?,?)")) {
            ps.setString(1, id); ps.setString(2, referrerUuid); ps.setString(3, referredUuid);
            ps.setString(4, code.toUpperCase().trim()); ps.setString(5, ipAddress);
            ps.setLong(6, System.currentTimeMillis());
            ps.executeUpdate();
            return true;
        } catch (SQLException e) {
            // UNIQUE violation sur referred_uuid = déjà parrainé
            return false;
        }
    }

    // ── Validation ────────────────────────────────────────────────────────────

    /**
     * Valide le parrainage si le compte referred a plus de 24h.
     * Appelé à chaque login du referred.
     * @return uuid du parrain si nouvellement validé, null sinon
     */
    public String validateIfReady(String referredUuid) {
        long threshold = System.currentTimeMillis() - 24L * 3600 * 1000;
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT id, referrer_uuid FROM referral_uses WHERE referred_uuid=? AND validated=0 AND created_at<=?")) {
            ps.setString(1, referredUuid); ps.setLong(2, threshold);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                String useId       = rs.getString("id");
                String referrerUuid = rs.getString("referrer_uuid");
                try (PreparedStatement up = db.conn().prepareStatement(
                        "UPDATE referral_uses SET validated=1, validated_at=? WHERE id=?")) {
                    up.setLong(1, System.currentTimeMillis()); up.setString(2, useId);
                    up.executeUpdate();
                }
                return referrerUuid;
            }
        } catch (SQLException e) {
            logger.warning("[ReferralStore] validateIfReady: " + e.getMessage());
            return null;
        }
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    public int getValidatedCount(String referrerUuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT COUNT(*) FROM referral_uses WHERE referrer_uuid=? AND validated=1")) {
            ps.setString(1, referrerUuid);
            try (ResultSet rs = ps.executeQuery()) { if (rs.next()) return rs.getInt(1); }
        } catch (SQLException e) {
            logger.warning("[ReferralStore] getValidatedCount: " + e.getMessage());
        }
        return 0;
    }

    public int getTotalCount(String referrerUuid) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT COUNT(*) FROM referral_uses WHERE referrer_uuid=?")) {
            ps.setString(1, referrerUuid);
            try (ResultSet rs = ps.executeQuery()) { if (rs.next()) return rs.getInt(1); }
        } catch (SQLException e) {
            logger.warning("[ReferralStore] getTotalCount: " + e.getMessage());
        }
        return 0;
    }

    // ── Code generation ───────────────────────────────────────────────────────

    /**
     * Génère un code HMAC-SHA256 déterministe depuis le uuid (préfixé SUN-).
     * Format : SUN-XXXXXXXX (8 chars alphanumériques uppercase).
     */
    private static String deriveCode(String ownerUuid) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec((HMAC_SALT + ownerUuid).getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] bytes = mac.doFinal(ownerUuid.getBytes(StandardCharsets.UTF_8));
            // 8 caractères en base-36 (chiffres + majuscules)
            String chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            StringBuilder sb = new StringBuilder("SUN-");
            for (int i = 0; i < 8; i++) {
                sb.append(chars.charAt((bytes[i] & 0xFF) % chars.length()));
            }
            return sb.toString();
        } catch (Exception e) {
            // Fallback aléatoire si JCE indisponible
            String chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            Random rand = new Random();
            StringBuilder sb = new StringBuilder("SUN-");
            for (int i = 0; i < 8; i++) sb.append(chars.charAt(rand.nextInt(chars.length())));
            return sb.toString();
        }
    }
}
