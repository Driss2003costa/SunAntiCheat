package sunanticheat.updater;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class UpdateChecker {

    private static final String RELEASES_API =
            "https://api.github.com/repos/driss2003costa/sunanticheat/releases/latest";

    private static final Pattern TAG_PATTERN =
            Pattern.compile("\"tag_name\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern URL_PATTERN =
            Pattern.compile("\"browser_download_url\"\\s*:\\s*\"([^\"]+\\.jar)\"");

    public record LatestRelease(String tag, String version, String jarUrl) {}

    public static LatestRelease fetchLatest() throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(RELEASES_API).openConnection();
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(15_000);
        conn.setRequestProperty("Accept", "application/vnd.github+json");
        conn.setRequestProperty("User-Agent", "SunAntiCheat-Updater/1.0");
        conn.setInstanceFollowRedirects(true);

        int code = conn.getResponseCode();
        if (code == 404) throw new RuntimeException("Aucune release GitHub trouvée (repo public requis).");
        if (code != 200) throw new RuntimeException("GitHub API a répondu " + code);

        String body;
        try (InputStream in = conn.getInputStream();
             Scanner sc = new Scanner(in, StandardCharsets.UTF_8)) {
            sc.useDelimiter("\\A");
            body = sc.hasNext() ? sc.next() : "";
        }

        Matcher tagMatcher = TAG_PATTERN.matcher(body);
        if (!tagMatcher.find()) throw new RuntimeException("tag_name introuvable dans la réponse GitHub.");
        String tag = tagMatcher.group(1);
        String version = tag.startsWith("v") ? tag.substring(1) : tag;

        Matcher urlMatcher = URL_PATTERN.matcher(body);
        if (!urlMatcher.find()) throw new RuntimeException("Aucun asset .jar trouvé dans la release.");
        String jarUrl = urlMatcher.group(1);

        return new LatestRelease(tag, version, jarUrl);
    }

    /** Retourne true si `latest` est une version plus récente que `current` (semver X.Y.Z). */
    public static boolean isNewer(String current, String latest) {
        try {
            int[] cur = parseSemver(current);
            int[] lat = parseSemver(latest);
            if (lat[0] != cur[0]) return lat[0] > cur[0];
            if (lat[1] != cur[1]) return lat[1] > cur[1];
            return lat[2] > cur[2];
        } catch (Exception e) {
            return !current.equals(latest);
        }
    }

    private static int[] parseSemver(String v) {
        String cleaned = v.replaceAll("-.*$", ""); // strip -SNAPSHOT, -BETA etc.
        String[] parts = cleaned.split("\\.");
        return new int[]{
            Integer.parseInt(parts[0]),
            parts.length > 1 ? Integer.parseInt(parts[1]) : 0,
            parts.length > 2 ? Integer.parseInt(parts[2]) : 0
        };
    }
}
