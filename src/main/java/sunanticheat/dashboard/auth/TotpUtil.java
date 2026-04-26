package sunanticheat.dashboard.auth;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;

/**
 * TOTP (Time-based One Time Password) — RFC 6238.
 *
 * Implementation pure Java sans dépendance externe.
 * Compatible Google Authenticator, Authy, 1Password, etc.
 *
 * Algo : HMAC-SHA1(secret, floor(unixtime / 30)) → 6 digits
 */
public final class TotpUtil {

    private static final int CODE_DIGITS = 6;
    private static final long TIME_STEP_SECONDS = 30;
    private static final SecureRandom RNG = new SecureRandom();

    private TotpUtil() {}

    /**
     * Génère un secret base32 (160 bits = 32 caractères base32).
     * Format compatible avec Google Authenticator.
     */
    public static String generateSecret() {
        byte[] bytes = new byte[20];
        RNG.nextBytes(bytes);
        return base32Encode(bytes);
    }

    /**
     * Vérifie si le code fourni correspond au secret pour le timestamp courant.
     * Tolérance ±1 step (= ±30s) pour gérer les décalages d'horloge.
     */
    public static boolean verify(String secret, String code) {
        if (secret == null || code == null) return false;
        String trimmed = code.trim().replace(" ", "");
        if (trimmed.length() != CODE_DIGITS) return false;
        try {
            int userCode = Integer.parseInt(trimmed);
            long currentStep = System.currentTimeMillis() / 1000 / TIME_STEP_SECONDS;
            // ±1 step de tolérance
            for (int delta = -1; delta <= 1; delta++) {
                int expected = generateCode(secret, currentStep + delta);
                if (constantTimeEquals(userCode, expected)) return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Construit l'URI otpauth:// pour générer le QR code.
     * Exemple : otpauth://totp/SunGuard:admin?secret=XXXXXXX&issuer=SunGuard&algorithm=SHA1&digits=6&period=30
     */
    public static String buildOtpAuthUri(String issuer, String accountName, String secret) {
        String label = issuer + ":" + accountName;
        return "otpauth://totp/" + urlEncode(label) +
                "?secret=" + secret +
                "&issuer=" + urlEncode(issuer) +
                "&algorithm=SHA1&digits=6&period=30";
    }

    private static int generateCode(String base32Secret, long timeStep) {
        try {
            byte[] key = base32Decode(base32Secret);
            byte[] data = ByteBuffer.allocate(8).putLong(timeStep).array();

            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] hash = mac.doFinal(data);

            // Dynamic truncation (RFC 4226)
            int offset = hash[hash.length - 1] & 0xf;
            int binary = ((hash[offset]     & 0x7f) << 24)
                       | ((hash[offset + 1] & 0xff) << 16)
                       | ((hash[offset + 2] & 0xff) << 8)
                       | ( hash[offset + 3] & 0xff);

            int otp = binary % (int) Math.pow(10, CODE_DIGITS);
            return otp;
        } catch (Exception e) {
            return -1;
        }
    }

    private static boolean constantTimeEquals(int a, int b) {
        // Comparaison constant-time (anti timing attack)
        int xor = a ^ b;
        return xor == 0;
    }

    // ── Base32 (RFC 4648) ─────────────────────────────────────────────────
    private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    public static String base32Encode(byte[] data) {
        if (data == null || data.length == 0) return "";
        StringBuilder sb = new StringBuilder();
        int buffer = 0, bitsLeft = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                int idx = (buffer >> (bitsLeft - 5)) & 0x1F;
                sb.append(BASE32_ALPHABET.charAt(idx));
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            int idx = (buffer << (5 - bitsLeft)) & 0x1F;
            sb.append(BASE32_ALPHABET.charAt(idx));
        }
        return sb.toString();
    }

    public static byte[] base32Decode(String s) {
        s = s.toUpperCase().replace(" ", "").replace("=", "");
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        int buffer = 0, bitsLeft = 0;
        for (char c : s.toCharArray()) {
            int val = BASE32_ALPHABET.indexOf(c);
            if (val < 0) throw new IllegalArgumentException("Char base32 invalide: " + c);
            buffer = (buffer << 5) | val;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                out.write((buffer >> (bitsLeft - 8)) & 0xFF);
                bitsLeft -= 8;
            }
        }
        return out.toByteArray();
    }

    private static String urlEncode(String s) {
        return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8);
    }
}
