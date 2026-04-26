package sunanticheat.dashboard.db;

import org.bukkit.configuration.file.FileConfiguration;

import java.io.File;
import java.sql.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Wrapper DB supportant SQLite (par défaut) et MariaDB / MySQL.
 *
 * Configuration dans `config.yml` :
 * <pre>
 * dashboard:
 *   database:
 *     type: sqlite              # "sqlite" (par défaut) ou "mysql" / "mariadb"
 *     # Champs ci-dessous lus uniquement si type ≠ sqlite :
 *     host: localhost
 *     port: 3306
 *     name: sunanticheat
 *     user: root
 *     password: ""
 * </pre>
 *
 * Implémentation :
 * - SQLite : connexion unique avec WAL mode, fichier `sunanticheat.db`.
 * - MariaDB/MySQL : connexion unique aussi (pas de pool — adapté à 1 serveur Minecraft).
 *   Auto-reconnect activé, charset utf8mb4.
 *
 * Pour rester portable, le SQL utilisé par les stores évite :
 *   - INSERT OR REPLACE / INSERT OR IGNORE (SQLite-only) → on utilise REPLACE INTO
 *   - COLLATE NOCASE (SQLite-only) → on utilise LOWER(col) = LOWER(?)
 *   - Types : TEXT (compatible MySQL via TEXT/LONGTEXT), INTEGER (BIGINT), REAL (DOUBLE)
 */
public final class Database {

    public enum Dialect { SQLITE, MYSQL }

    private final Connection conn;
    private final Logger logger;
    private final Dialect dialect;
    private final String description;

    private Database(Connection conn, Logger logger, Dialect dialect, String description) {
        this.conn = conn;
        this.logger = logger;
        this.dialect = dialect;
        this.description = description;
    }

    public static Database open(File dataFolder, Logger logger, FileConfiguration cfg) {
        String type = cfg != null
                ? cfg.getString("dashboard.database.type", "sqlite")
                : "sqlite";
        if (type == null) type = "sqlite";
        type = type.trim().toLowerCase();
        return switch (type) {
            case "mysql", "mariadb" -> openMysql(dataFolder, logger, cfg);
            default                  -> openSqlite(dataFolder, logger);
        };
    }

    /** Ouvre la base SQLite (mode WAL, fichier dans le dataFolder). */
    public static Database openSqlite(File dataFolder, Logger logger) {
        try { Class.forName("org.sqlite.JDBC"); }
        catch (ClassNotFoundException e) { throw new RuntimeException("Driver sqlite-jdbc absent", e); }

        if (!dataFolder.exists() && !dataFolder.mkdirs())
            logger.warning("[Database] Impossible de créer " + dataFolder);

        File dbFile = new File(dataFolder, "sunanticheat.db");
        try {
            String url = "jdbc:sqlite:" + dbFile.getAbsolutePath();
            Connection c = DriverManager.getConnection(url);
            try (Statement st = c.createStatement()) {
                st.execute("PRAGMA journal_mode=WAL");
                st.execute("PRAGMA busy_timeout=5000");
                st.execute("PRAGMA synchronous=NORMAL");
                st.execute("PRAGMA foreign_keys=ON");
            }
            Database db = new Database(c, logger, Dialect.SQLITE, "SQLite " + dbFile.getName());
            db.ensureSchemaTable();
            logger.info("[Database] Ouverte : " + db.description
                + " (" + (dbFile.length() / 1024) + " KB)");
            return db;
        } catch (SQLException e) {
            throw new RuntimeException("Échec ouverture SQLite", e);
        }
    }

    /** Ouvre la base MySQL/MariaDB d'après la config. */
    public static Database openMysql(File dataFolder, Logger logger, FileConfiguration cfg) {
        try { Class.forName("org.mariadb.jdbc.Driver"); }
        catch (ClassNotFoundException e) { throw new RuntimeException("Driver mariadb absent", e); }

        String host = cfg.getString("dashboard.database.host", "localhost");
        int    port = cfg.getInt   ("dashboard.database.port", 3306);
        String name = cfg.getString("dashboard.database.name", "sunanticheat");
        String user = cfg.getString("dashboard.database.user", "root");
        String pass = cfg.getString("dashboard.database.password", "");

        String url = "jdbc:mariadb://" + host + ":" + port + "/" + name
                   + "?useUnicode=true&characterEncoding=utf8mb4"
                   + "&useServerPrepStmts=true&autoReconnect=true";
        try {
            Connection c = DriverManager.getConnection(url, user, pass);
            try (Statement st = c.createStatement()) {
                st.execute("SET NAMES utf8mb4");
                st.execute("SET sql_mode='NO_ENGINE_SUBSTITUTION'"); // évite des erreurs CREATE TABLE strictes
            }
            String desc = "MariaDB/MySQL " + host + ":" + port + "/" + name;
            Database db = new Database(c, logger, Dialect.MYSQL, desc);
            db.ensureSchemaTable();
            logger.info("[Database] Ouverte : " + desc + " (utf8mb4, autoReconnect)");
            return db;
        } catch (SQLException e) {
            throw new RuntimeException("Échec connexion MariaDB/MySQL : "
                + e.getMessage() + " (vérifie host/port/credentials dans config.yml)", e);
        }
    }

    private void ensureSchemaTable() throws SQLException {
        try (Statement st = conn.createStatement()) {
            // Note : la même DDL marche dans SQLite et MySQL/MariaDB
            st.execute("""
                CREATE TABLE IF NOT EXISTS _schema_versions (
                    name        VARCHAR(64)  NOT NULL PRIMARY KEY,
                    version     INTEGER      NOT NULL,
                    applied_at  BIGINT       NOT NULL
                )""");
        }
    }

    public Connection conn()        { return conn; }
    public Dialect dialect()        { return dialect; }
    public boolean isSqlite()       { return dialect == Dialect.SQLITE; }
    public boolean isMysql()        { return dialect == Dialect.MYSQL; }
    public String  description()    { return description; }

    /**
     * Applique un script SQL si la version stockée pour `name` est < `version`.
     * Idempotent : exécution garantie une seule fois par version.
     *
     * Le script peut contenir plusieurs statements séparés par `;`. Chaque
     * statement est exécuté séparément (compatible MySQL qui ne supporte pas
     * les multi-statements via JDBC par défaut).
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
                            "REPLACE INTO _schema_versions(name, version, applied_at) VALUES(?,?,?)")) {
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
        try { if (conn != null && !conn.isClosed()) conn.close(); }
        catch (SQLException e) { logger.log(Level.WARNING, "[Database] Erreur close()", e); }
    }
}
