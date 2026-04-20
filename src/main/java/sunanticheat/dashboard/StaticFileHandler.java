package sunanticheat.dashboard;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.util.Map;

/**
 * Sert les fichiers statiques du build React depuis plugins/SunAntiCheat/dashboard/.
 * Toute URL non trouvée retourne index.html (React Router côté client).
 */
public final class StaticFileHandler implements HttpHandler {

    private static final Map<String, String> MIME = Map.of(
            "html", "text/html; charset=utf-8",
            "js",   "application/javascript; charset=utf-8",
            "css",  "text/css; charset=utf-8",
            "json", "application/json",
            "png",  "image/png",
            "svg",  "image/svg+xml",
            "ico",  "image/x-icon",
            "woff2","font/woff2"
    );

    private final File dashboardDir;

    public StaticFileHandler(File dashboardDir) {
        this.dashboardDir = dashboardDir;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(405, -1);
            return;
        }

        String path = exchange.getRequestURI().getPath();
        if (path.startsWith("/")) path = path.substring(1);
        if (path.isEmpty() || path.equals("/")) path = "index.html";

        File file = new File(dashboardDir, path);

        // Si le fichier n'existe pas, on sert index.html (React Router)
        if (!file.exists() || !file.isFile() || !isInsideDir(file, dashboardDir)) {
            file = new File(dashboardDir, "index.html");
        }

        if (!file.exists()) {
            byte[] body = "<h2>Dashboard non installé</h2><p>Placez les fichiers du build React dans plugins/SunAntiCheat/dashboard/</p>"
                    .getBytes();
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(body); }
            return;
        }

        byte[] data = Files.readAllBytes(file.toPath());
        String ext = extension(file.getName());
        String mime = MIME.getOrDefault(ext, "application/octet-stream");

        exchange.getResponseHeaders().set("Content-Type", mime);
        exchange.getResponseHeaders().set("Cache-Control", ext.equals("html") ? "no-cache" : "max-age=31536000");
        exchange.sendResponseHeaders(200, data.length);
        try (OutputStream os = exchange.getResponseBody()) { os.write(data); }
    }

    private static String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";
    }

    private static boolean isInsideDir(File file, File dir) {
        try {
            return file.getCanonicalPath().startsWith(dir.getCanonicalPath());
        } catch (IOException e) {
            return false;
        }
    }
}
