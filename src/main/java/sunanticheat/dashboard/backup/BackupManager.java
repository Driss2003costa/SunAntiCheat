package sunanticheat.dashboard.backup;

import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Logger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Gestion des backups : zip d'un monde vers plugins/SunAntiCheat/dashboard/backups/<world>/<ts>.zip.
 * Asynchrone pour ne pas bloquer le main thread.
 */
public final class BackupManager {

    private final JavaPlugin plugin;
    private final Logger logger;
    private final File backupsDir;

    public BackupManager(JavaPlugin plugin, Logger logger) {
        this.plugin = plugin;
        this.logger = logger;
        this.backupsDir = new File(plugin.getDataFolder(), "dashboard/backups");
        this.backupsDir.mkdirs();
    }

    public List<Map<String, Object>> listByWorld() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (World w : Bukkit.getWorlds()) {
            Map<String, Object> wm = new LinkedHashMap<>();
            wm.put("world", w.getName());
            wm.put("sizeMb", folderSizeMb(w.getWorldFolder()));
            wm.put("backups", listBackups(w.getName()));
            out.add(wm);
        }
        return out;
    }

    private List<Map<String, Object>> listBackups(String worldName) {
        File dir = new File(backupsDir, worldName);
        if (!dir.isDirectory()) return List.of();
        File[] files = dir.listFiles((f, n) -> n.endsWith(".zip"));
        if (files == null) return List.of();
        Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
        List<Map<String, Object>> res = new ArrayList<>();
        for (File f : files) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("filename", f.getName());
            m.put("size", f.length());
            m.put("created", f.lastModified());
            res.add(m);
        }
        return res;
    }

    public CompletableFuture<Map<String, Object>> createBackup(String worldName) {
        World world = Bukkit.getWorld(worldName);
        if (world == null) return CompletableFuture.failedFuture(new IllegalArgumentException("Monde introuvable : " + worldName));

        return CompletableFuture.supplyAsync(() -> {
            // save-all sur main thread
            try {
                Bukkit.getScheduler().callSyncMethod(plugin, () -> {
                    world.save();
                    return null;
                }).get();
            } catch (Exception e) {
                throw new RuntimeException("save-all a échoué: " + e.getMessage(), e);
            }

            File worldDir = world.getWorldFolder();
            File outDir = new File(backupsDir, worldName);
            outDir.mkdirs();
            String ts = new SimpleDateFormat("yyyy-MM-dd_HH-mm-ss").format(new Date());
            File zip = new File(outDir, ts + ".zip");

            try (ZipOutputStream zos = new ZipOutputStream(new BufferedOutputStream(new FileOutputStream(zip)))) {
                zipFolder(worldDir.toPath(), worldDir.getName(), zos);
            } catch (IOException e) {
                zip.delete();
                throw new RuntimeException("Zip failed: " + e.getMessage(), e);
            }

            logger.info("[Dashboard/Backup] ✓ " + worldName + " → " + zip.getName() + " (" + mb(zip.length()) + " MB)");
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("world", worldName);
            m.put("filename", zip.getName());
            m.put("size", zip.length());
            m.put("created", zip.lastModified());
            return m;
        });
    }

    public boolean deleteBackup(String worldName, String filename) {
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) return false;
        File f = new File(new File(backupsDir, worldName), filename);
        return f.isFile() && f.delete();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static void zipFolder(Path root, String baseName, ZipOutputStream zos) throws IOException {
        Files.walkFileTree(root, new SimpleFileVisitor<>() {
            @Override public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                // Skip session.lock (locked file on Windows)
                String fn = file.getFileName().toString();
                if (fn.equals("session.lock") || fn.endsWith(".lock")) return FileVisitResult.CONTINUE;
                String entry = baseName + "/" + root.relativize(file).toString().replace('\\', '/');
                try {
                    zos.putNextEntry(new ZipEntry(entry));
                    Files.copy(file, zos);
                    zos.closeEntry();
                } catch (IOException ignored) {}
                return FileVisitResult.CONTINUE;
            }
            @Override public FileVisitResult visitFileFailed(Path file, IOException exc) { return FileVisitResult.CONTINUE; }
        });
    }

    private static double folderSizeMb(File dir) {
        if (dir == null || !dir.isDirectory()) return 0;
        long[] size = { 0L };
        try {
            Files.walkFileTree(dir.toPath(), new SimpleFileVisitor<>() {
                @Override public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    size[0] += attrs.size(); return FileVisitResult.CONTINUE;
                }
                @Override public FileVisitResult visitFileFailed(Path f, IOException e) { return FileVisitResult.CONTINUE; }
            });
        } catch (IOException ignored) {}
        return Math.round((size[0] / 1024.0 / 1024.0) * 10.0) / 10.0;
    }

    private static double mb(long bytes) {
        return Math.round((bytes / 1024.0 / 1024.0) * 10.0) / 10.0;
    }
}
