package sunanticheat.updater;

import org.bukkit.configuration.file.YamlConfiguration;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.logging.Logger;

/**
 * Migre les fichiers de configuration YAML lors d'une mise à jour de version.
 * - Nouveaux fichiers : extraits tels quels depuis le JAR.
 * - Fichiers existants : fusion intelligente — les nouvelles clés sont ajoutées,
 *   les valeurs existantes ne sont JAMAIS écrasées.
 */
public final class ConfigMigrator {

    public static void migrate(File jarFile, File pluginDataFolder, Logger logger) {
        try (JarFile jar = new JarFile(jarFile)) {
            var entries = jar.entries();
            while (entries.hasMoreElements()) {
                JarEntry entry = entries.nextElement();
                String name = entry.getName();
                if (entry.isDirectory()) continue;
                // Seuls les YAML à la racine du JAR (config.yml, etc.)
                if (!name.endsWith(".yml") || name.contains("/")) continue;

                try (InputStream in = jar.getInputStream(entry)) {
                    processYaml(in, new File(pluginDataFolder, name), name, logger);
                }
            }
        } catch (Exception e) {
            logger.warning("[AutoUpdate] Erreur ConfigMigrator : " + e.getMessage());
        }
    }

    private static void processYaml(InputStream jarStream, File diskFile,
                                     String fileName, Logger logger) {
        try {
            // Lire le template depuis le JAR
            String templateContent;
            try (InputStreamReader r = new InputStreamReader(jarStream, StandardCharsets.UTF_8)) {
                StringBuilder sb = new StringBuilder();
                char[] buf = new char[4096];
                int n;
                while ((n = r.read(buf)) >= 0) sb.append(buf, 0, n);
                templateContent = sb.toString();
            }
            YamlConfiguration template = new YamlConfiguration();
            template.loadFromString(templateContent);

            if (!diskFile.exists()) {
                // Nouveau fichier : extraction directe
                Files.writeString(diskFile.toPath(), templateContent, StandardCharsets.UTF_8);
                logger.info("[AutoUpdate] Nouveau fichier de config extrait : " + fileName);
                return;
            }

            // Lire la config existante sur disque
            YamlConfiguration existing = YamlConfiguration.loadConfiguration(diskFile);

            // Comparaison de config-version
            int templateVersion = template.getInt("config-version", 0);
            int existingVersion = existing.getInt("config-version", 0);
            if (templateVersion > 0 && existingVersion >= templateVersion) {
                return; // Déjà à jour
            }

            // Backup de l'ancienne config avant modification
            File backup = new File(diskFile.getParentFile(), fileName + ".bak");
            Files.copy(diskFile.toPath(), backup.toPath(), StandardCopyOption.REPLACE_EXISTING);

            // Fusion : ajouter les clés manquantes sans toucher les valeurs existantes
            int added = 0;
            for (String key : template.getKeys(true)) {
                if (!existing.isSet(key) && template.get(key) != null
                        && !(template.get(key) instanceof org.bukkit.configuration.ConfigurationSection)) {
                    existing.set(key, template.get(key));
                    added++;
                }
            }

            if (added > 0) {
                if (templateVersion > 0) existing.set("config-version", templateVersion);
                existing.save(diskFile);
                logger.info("[AutoUpdate] " + fileName + " mis à jour : +" + added + " clé(s).");
            }
        } catch (Exception e) {
            logger.warning("[AutoUpdate] Erreur migration " + fileName + " : " + e.getMessage());
        }
    }
}
