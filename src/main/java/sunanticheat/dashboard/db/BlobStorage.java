package sunanticheat.dashboard.db;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Stockage clé/valeur générique adossé à la DB (table `kv_blobs`).
 *
 * Chaque "scope" est une chaîne (ex: "shops", "users", "vip_plans") qui
 * identifie une donnée persistée. La valeur est une string (typiquement JSON).
 *
 * Ce pattern permet aux stores existants (qui sérialisent déjà tout via Gson
 * dans des fichiers .json) de migrer en DB avec un changement minimal :
 * remplacer `Files.writeString(file, json)` par `blobs.write("shops", json)`.
 *
 * Pour la migration depuis un ancien fichier .json :
 *   String json = blobs.loadOrMigrate("shops", legacyFile);
 *   if (json != null) ... // le fichier .json a été lu et copié en DB,
 *                         // puis renommé en .json.bak
 */
public final class BlobStorage {

    private static final int CURRENT_VERSION = 1;
    private static final String SCHEMA_NAME = "kv_blobs";

    private final Database db;
    private final Logger logger;

    public BlobStorage(Database db, Logger logger) {
        this.db = db;
        this.logger = logger;
        initSchema();
    }

    private void initSchema() {
        // LONGTEXT = 4 GB max (MySQL) ; SQLite ignore la taille (TEXT illimité)
        // VARCHAR(128) = identifiant scope (ex: "shops", "vip_subscriptions")
        db.migrate(SCHEMA_NAME, CURRENT_VERSION, """
            CREATE TABLE IF NOT EXISTS kv_blobs (
                scope       VARCHAR(128) NOT NULL PRIMARY KEY,
                payload     LONGTEXT     NOT NULL,
                updated_at  BIGINT       NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_kv_blobs_updated ON kv_blobs(updated_at);
            """);
    }

    /** Lit la valeur d'un scope, ou null si absent. */
    public synchronized String read(String scope) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT payload FROM kv_blobs WHERE scope = ?")) {
            ps.setString(1, scope);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getString(1);
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[BlobStorage] read(" + scope + ") erreur", e);
        }
        return null;
    }

    /** Écrit la valeur d'un scope (REPLACE = upsert portable SQLite + MySQL). */
    public synchronized void write(String scope, String payload) {
        if (payload == null) payload = "";
        try (PreparedStatement ps = db.conn().prepareStatement(
                "REPLACE INTO kv_blobs(scope, payload, updated_at) VALUES(?,?,?)")) {
            ps.setString(1, scope);
            ps.setString(2, payload);
            ps.setLong  (3, System.currentTimeMillis());
            ps.executeUpdate();
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[BlobStorage] write(" + scope + ") erreur", e);
        }
    }

    public synchronized boolean exists(String scope) {
        try (PreparedStatement ps = db.conn().prepareStatement(
                "SELECT 1 FROM kv_blobs WHERE scope = ?")) {
            ps.setString(1, scope);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        } catch (SQLException e) { return false; }
    }

    /**
     * Charge le contenu d'un scope. Si vide MAIS qu'un fichier legacy existe,
     * importe son contenu en DB et renomme le fichier en `.bak`.
     *
     * Retourne null si rien ni en DB ni sur disque.
     */
    public synchronized String loadOrMigrate(String scope, File legacyFile) {
        // 1. Si déjà en DB, on retourne directement
        String existing = read(scope);
        if (existing != null && !existing.isEmpty()) {
            // S'il reste un fichier legacy, on le renomme pour éviter confusion
            if (legacyFile != null && legacyFile.exists()) {
                File bak = new File(legacyFile.getAbsolutePath() + ".bak");
                if (!bak.exists()) legacyFile.renameTo(bak);
            }
            return existing;
        }
        // 2. Sinon, migration depuis le fichier legacy si présent
        if (legacyFile == null || !legacyFile.exists()) return null;
        try {
            String content = Files.readString(legacyFile.toPath(), StandardCharsets.UTF_8);
            if (content != null && !content.isBlank()) {
                write(scope, content);
                logger.info("[BlobStorage] Migration " + scope + " depuis " + legacyFile.getName()
                    + " (" + (content.length() / 1024) + " KB) → DB");
            }
            File bak = new File(legacyFile.getAbsolutePath() + ".bak");
            if (!bak.exists()) legacyFile.renameTo(bak);
            return content;
        } catch (IOException e) {
            logger.log(Level.WARNING, "[BlobStorage] migration " + scope + " échouée", e);
            return null;
        }
    }
}
