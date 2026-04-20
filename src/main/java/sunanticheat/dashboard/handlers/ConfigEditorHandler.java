package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.Plugin;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;

/**
 * Édition de fichiers YAML (et autres configs texte) des plugins.
 * Sécurité : chemin toujours relatif au dossier plugins/, lecture seule hors de plugins/.
 * Historique : chaque save = snapshot dans plugins/SunAntiCheat/dashboard/config-history/<plugin>/<file>.<ts>.bak
 */
public final class ConfigEditorHandler {

    private static final Set<String> ALLOWED_EXT = Set.of("yml", "yaml", "json", "properties", "txt", "conf", "toml");
    private static final long MAX_SIZE = 2_000_000; // 2 Mo

    private final File pluginsDir;
    private final File historyDir;

    public ConfigEditorHandler(File pluginsDir, File dataFolder) {
        this.pluginsDir = pluginsDir;
        this.historyDir = new File(dataFolder, "dashboard/config-history");
        historyDir.mkdirs();
    }

    // GET /api/configs/tree — liste tous les plugins + leurs fichiers éditables
    public void tree(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        List<Map<String, Object>> plugins = new ArrayList<>();

        for (Plugin p : Bukkit.getPluginManager().getPlugins()) {
            File df = p.getDataFolder();
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("name", p.getName());
            node.put("version", p.getDescription().getVersion());
            node.put("enabled", p.isEnabled());
            List<Map<String, Object>> files = new ArrayList<>();
            if (df != null && df.isDirectory()) {
                walk(df, df, files);
            }
            node.put("files", files);
            plugins.add(node);
        }
        plugins.sort(Comparator.comparing(a -> String.valueOf(a.get("name")).toLowerCase()));
        HttpHelper.json(ex, 200, plugins);
    }

    private void walk(File root, File current, List<Map<String, Object>> out) {
        File[] entries = current.listFiles();
        if (entries == null) return;
        for (File f : entries) {
            if (f.isDirectory()) { walk(root, f, out); continue; }
            String ext = ext(f.getName());
            if (!ALLOWED_EXT.contains(ext)) continue;
            if (f.length() > MAX_SIZE) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", f.getName());
            m.put("path", root.toPath().relativize(f.toPath()).toString().replace('\\', '/'));
            m.put("size", f.length());
            m.put("modified", f.lastModified());
            out.add(m);
        }
    }

    // GET /api/configs/read?plugin=X&path=Y
    public void read(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        String pluginName = HttpHelper.queryParam(ex, "plugin");
        String relPath = HttpHelper.queryParam(ex, "path");
        File file = safeFile(pluginName, relPath);
        if (file == null) { HttpHelper.error(ex, 400, "Chemin invalide"); return; }
        if (!file.isFile()) { HttpHelper.error(ex, 404, "Fichier introuvable"); return; }
        if (file.length() > MAX_SIZE) { HttpHelper.error(ex, 413, "Fichier trop gros"); return; }
        String content = Files.readString(file.toPath(), StandardCharsets.UTF_8);
        HttpHelper.json(ex, 200, Map.of(
                "plugin", pluginName, "path", relPath, "size", file.length(),
                "modified", file.lastModified(), "content", content));
    }

    // POST /api/configs/write  { plugin, path, content }
    @SuppressWarnings("unchecked")
    public void write(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requireAdmin(ex, u)) return;

        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        if (body == null) { HttpHelper.error(ex, 400, "Body invalide"); return; }

        String pluginName = (String) body.get("plugin");
        String relPath = (String) body.get("path");
        String content = (String) body.get("content");
        if (content == null) { HttpHelper.error(ex, 400, "content manquant"); return; }

        File file = safeFile(pluginName, relPath);
        if (file == null) { HttpHelper.error(ex, 400, "Chemin invalide"); return; }

        // Validation YAML si extension yml/yaml
        String ext = ext(file.getName());
        if (ext.equals("yml") || ext.equals("yaml")) {
            try {
                YamlConfiguration y = new YamlConfiguration();
                y.loadFromString(content);
            } catch (InvalidConfigurationException e) {
                HttpHelper.error(ex, 400, "YAML invalide : " + e.getMessage());
                return;
            }
        }

        // Snapshot historique
        if (file.exists()) snapshot(pluginName, relPath, file);

        file.getParentFile().mkdirs();
        Files.writeString(file.toPath(), content, StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        HttpHelper.json(ex, 200, Map.of("ok", true, "size", file.length(), "modified", file.lastModified()));
    }

    // POST /api/configs/validate  { content }
    @SuppressWarnings("unchecked")
    public void validate(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        Map<String, Object> body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class);
        String content = body != null ? (String) body.get("content") : null;
        if (content == null) { HttpHelper.error(ex, 400, "content manquant"); return; }
        try {
            YamlConfiguration y = new YamlConfiguration();
            y.loadFromString(content);
            HttpHelper.json(ex, 200, Map.of("ok", true));
        } catch (InvalidConfigurationException e) {
            HttpHelper.json(ex, 200, Map.of("ok", false, "error", e.getMessage()));
        }
    }

    // GET /api/configs/history?plugin=X&path=Y
    public void history(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        String pluginName = HttpHelper.queryParam(ex, "plugin");
        String relPath = HttpHelper.queryParam(ex, "path");
        File dir = historyDirFor(pluginName, relPath);
        List<Map<String, Object>> out = new ArrayList<>();
        if (dir.isDirectory()) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("timestamp", Long.parseLong(f.getName().replace(".bak", "").replaceAll(".*\\.", "")));
                    m.put("size", f.length());
                    m.put("filename", f.getName());
                    out.add(m);
                }
                out.sort((a, b) -> Long.compare((long) b.get("timestamp"), (long) a.get("timestamp")));
            }
        }
        HttpHelper.json(ex, 200, out);
    }

    // GET /api/configs/version?plugin=X&path=Y&ts=Z
    public void version(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users) throws IOException {
        if (HttpHelper.authenticate(ex, jwt, users) == null) return;
        String pluginName = HttpHelper.queryParam(ex, "plugin");
        String relPath = HttpHelper.queryParam(ex, "path");
        String ts = HttpHelper.queryParam(ex, "ts");
        File dir = historyDirFor(pluginName, relPath);
        String baseName = new File(relPath).getName();
        File version = new File(dir, baseName + "." + ts + ".bak");
        if (!version.isFile()) { HttpHelper.error(ex, 404, "Version introuvable"); return; }
        String content = Files.readString(version.toPath(), StandardCharsets.UTF_8);
        HttpHelper.json(ex, 200, Map.of("content", content, "timestamp", Long.parseLong(ts)));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private File safeFile(String pluginName, String relPath) {
        if (pluginName == null || relPath == null) return null;
        if (pluginName.contains("..") || pluginName.contains("/") || pluginName.contains("\\")) return null;
        if (relPath.contains("..")) return null;
        File pluginDir = new File(pluginsDir, pluginName);
        File file = new File(pluginDir, relPath);
        try {
            // Canonical containment check
            String fc = file.getCanonicalPath();
            String dc = pluginDir.getCanonicalPath();
            if (!fc.startsWith(dc)) return null;
        } catch (IOException e) { return null; }
        String ext = ext(file.getName());
        if (!ALLOWED_EXT.contains(ext)) return null;
        return file;
    }

    private File historyDirFor(String pluginName, String relPath) {
        return new File(historyDir, pluginName + "/" + relPath).getParentFile();
    }

    private void snapshot(String pluginName, String relPath, File source) {
        try {
            File dir = historyDirFor(pluginName, relPath);
            dir.mkdirs();
            String baseName = new File(relPath).getName();
            File dest = new File(dir, baseName + "." + System.currentTimeMillis() + ".bak");
            Files.copy(source.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
            // rotation : garder max 20 versions
            File[] versions = dir.listFiles((f, n) -> n.startsWith(baseName + ".") && n.endsWith(".bak"));
            if (versions != null && versions.length > 20) {
                Arrays.sort(versions, Comparator.comparingLong(File::lastModified));
                for (int i = 0; i < versions.length - 20; i++) versions[i].delete();
            }
        } catch (IOException ignored) {}
    }

    private static String ext(String name) {
        int i = name.lastIndexOf('.');
        return i < 0 ? "" : name.substring(i + 1).toLowerCase();
    }
}
