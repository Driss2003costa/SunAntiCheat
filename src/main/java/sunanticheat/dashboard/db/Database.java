package sunanticheat.dashboard.db;

import java.io.File;
import java.sql.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Wrapper SQLite simple (single-file DB, fichier `sunanticheat.db` dans le data folder).
 *
 * Pourquoi pas un pool ? SQLite supporte 1 writer concurrent ; on utilise une connexion
 * unique avec WAL mode + busy_timeout pour gérer la concurrence sur les lectures, et tous
 * les writes passent via les méthodes synchronisées des stores. Pour 99 % des plugins
 * Minecraft (1 serveur, ≤ qqs centaines de joueurs concurrents), c'est largement suffisant.
 *
 * Schema migrations : chaque store appelle `Database.migrate(...)` avec un nom + script SQL.
 * On stocke la version dans la table `_schema_versions` ; le script ne tourne qu'une fois.
 */
public final class Database {

    private final Connection conn;
    private final Logger logger;
    private final File dbFile;

    private Database(Connection conn, Logger logger, File dbFile) {
        this.conn = conn;
        this.logger = logger;
        this.dbFile = dbFile;
    }

    public static Database open(File dataFolder, Logger logger) {
        try {
            // Force le chargement du driver (au cas où le ServiceLoader ne le voit pas)
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException e) {
            throw new RuntimeException("[SunAntiCheat] Driver sqlite-jdbc absent du classpath", e);
        }
        if (!dataFolder.exists() && !dataFolder.mkdirs()) {
            logger.warning("[Database] Impossible de créer " + dataFolder);
        }
        File dbFile = new File(dataFolder, "sunanticheat.db");
        try {
            String url = "jdbc:sqlite:" + dbFile.getAbsolutePath();
            Connection c = DriverManager.getConnection(url);
            try (Statement st = c.createStatement()) {
                // WAL = writes ne bloquent pas les reads → meilleur throughput
                st.execute("PRAGMA journal_mode=WAL");
                // Évite les "database is locked" sur contention courte
                st.execute("PRAGMA busy_timeout=5000");
                // Synchronous NORMAL : OK avec WAL, ~3x plus rapide que FULL
                st.execute("PRAGMA synchronous=NORMAL");
                // Foreign keys
                st.execute("PRAGMA foreign_keys=ON");
                // Table de versionning des migrations
                st.execute("""
                    CREATE TABLE IF NOT EXISTS _schema_versions (
                        name    TEXT PRIMARY KEY,
                        version INTEGER NOT NULL,
                        applied_at INTEGER NOT NULL
                    )""");
            }
            logger.info("[Database] SQLite ouverte : " + dbFile.getName()
                + " (" + (dbFile.length() / 1024) + " KB)");
            return new Database(c, logger, dbFile);
        } catch (SQLException e) {
            throw new RuntimeException("[SunAntiCheat] Échec ouverture SQLite", e);
        }
    }

    public Connection conn() { return conn; }

    public File file() { return dbFile; }

    /**
     * Applique un script SQL si la version stockée pour `name` est < `version`.
     * Idempotent : exécution garantie une seule fois par version.
     */
    public synchronized void migrate(String name, int version, String sqlScript) {
        try {
            int current = 0;
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT version FROM _schema_versions WHERE name = ?")) {
                ps.setString(1, name);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) current = rs.getInt(1);
                }
            }
            if (current >= version) return;
            try (Statement st = conn.createStatement()) {
                conn.setAutoCommit(false);
                try {
                    for (String stmt : sqlScript.split(";")) {
                        String trimmed = stmt.trim();
                        if (!trimmed.isEmpty()) st.execute(trimmed);
                    }
                    try (PreparedStatement up = conn.prepareStatement(
                            "INSERT OR REPLACE INTO _schema_versions(name, version, applied_at) VALUES(?,?,?)")) {
                        up.setString(1, name);
                        up.setInt(2, version);
                        up.setLong(3, System.currentTimeMillis());
                        up.executeUpdate();
                    }
                    conn.commit();
                    logger.info("[Database] Migration " + name + " → v" + version + " appliquée");
                } catch (SQLException e) {
                    conn.rollback();
                    throw e;
                } finally {
                    conn.setAutoCommit(true);
                }
            }
        } catch (SQLException e) {
            logger.log(Level.SEVERE, "[Database] Migration " + name + " v" + version + " échouée", e);
            throw new RuntimeException(e);
        }
    }

    public void close() {
        try {
            if (conn != null && !conn.isClosed()) conn.close();
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Database] Erreur close()", e);
        }
    }
}
