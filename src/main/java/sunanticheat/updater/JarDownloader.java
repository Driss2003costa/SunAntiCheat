package sunanticheat.updater;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Scanner;

public final class JarDownloader {

    public static File download(String jarUrl, File destFile) throws Exception {
        File tmp = new File(destFile.getParentFile(), destFile.getName() + ".tmp");
        try {
            HttpURLConnection conn = openConnection(jarUrl, 30_000, 60_000);
            int code = conn.getResponseCode();
            // Follow manual redirects (GitHub releases redirect to CDN)
            if (code == 301 || code == 302 || code == 307 || code == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                conn = openConnection(location, 30_000, 60_000);
                code = conn.getResponseCode();
            }
            if (code != 200) throw new RuntimeException("Téléchargement échoué HTTP " + code);

            try (InputStream in = conn.getInputStream()) {
                Files.copy(in, tmp.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
            Files.move(tmp.toPath(), destFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            return destFile;
        } finally {
            if (tmp.exists()) tmp.delete();
        }
    }

    public static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) digest.update(buf, 0, n);
        }
        byte[] hash = digest.digest();
        StringBuilder sb = new StringBuilder(64);
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    /** Récupère le SHA-256 attendu depuis l'URL .sha256 (optionnel — retourne null si absent). */
    public static String fetchExpectedSha256(String sha256Url) {
        try {
            HttpURLConnection conn = openConnection(sha256Url, 10_000, 10_000);
            if (conn.getResponseCode() != 200) return null;
            try (InputStream in = conn.getInputStream();
                 Scanner sc = new Scanner(in, StandardCharsets.UTF_8)) {
                sc.useDelimiter("\\A");
                String content = sc.hasNext() ? sc.next().trim() : "";
                return content.isEmpty() ? null : content.split("\\s+")[0];
            }
        } catch (Exception e) {
            return null;
        }
    }

    private static HttpURLConnection openConnection(String url, int connect, int read) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(connect);
        c.setReadTimeout(read);
        c.setRequestProperty("User-Agent", "SunAntiCheat-Updater/1.0");
        c.setInstanceFollowRedirects(true);
        return c;
    }
}
