package sunanticheat.dashboard.economy;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import sunanticheat.dashboard.db.Database;

import java.io.File;
import java.io.FileReader;
import java.lang.reflect.Type;
import java.sql.*;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Store SQLite des transactions économie (BUY/SELL via EconomyShopGUI).
 *
 * Avant : tout en RAM + JSON réécrit à chaque transaction (problème O(N) à chaque insert).
 * Maintenant : insert SQL O(1), agrégations groupées en SQL côté DB.
 *
 * Rétention : 90 jours (DELETE périodique des entries plus anciennes au boot).
 */
public final class TransactionStore {

    private static final long RETENTION_MS = 90L * 86400 * 1000;
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("EEE dd/MM", Locale.FRENCH);

    private final Database db;
    private final Logger logger;

    public TransactionStore(Database db, Logger logger, File legacyDataFolder) {
        this.db = db;
        this.logger = logger;
        initSchema();
        purgeOld();
        importLegacyJson(legacyDataFolder);
    }

    private void initSchema() {
        db.migrate("transactions", 1, """
            CREATE TABLE IF NOT EXISTS transactions (
                id              TEXT PRIMARY KEY,
                ts              INTEGER NOT NULL,
                player_uuid     TEXT,
                player_name     TEXT,
                type            TEXT NOT NULL,
                item_material   TEXT,
                item_name       TEXT,
                quantity        INTEGER NOT NULL,
                price_per_unit  REAL NOT NULL,
                total_price     REAL NOT NULL,
                shop_name       TEXT,
                result          TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_tx_ts          ON transactions(ts DESC);
            CREATE INDEX IF NOT EXISTS idx_tx_player_lc   ON transactions(LOWER(player_name));
            CREATE INDEX IF NOT EXISTS idx_tx_type        ON transactions(type);
            """);
    }

    private void purgeOld() {
        long cutoff = System.currentTimeMillis() - RETENTION_MS;
        try (PreparedStatement ps = db.conn().prepareStatement("DELETE FROM transactions WHERE ts < ?")) {
            ps.setLong(1, cutoff);
            int n = ps.executeUpdate();
            if (n > 0) logger.info("[Economy] Purge: " + n + " transactions > 90j supprimées");
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Economy] purge erreur", e);
        }
    }

    private void importLegacyJson(File dataFolder) {
        File legacy = new File(dataFolder, "economy/transactions.json");
        if (!legacy.exists()) return;
        try (PreparedStatement ck = db.conn().prepareStatement("SELECT COUNT(*) FROM transactions");
             ResultSet rs = ck.executeQuery()) {
            if (rs.next() && rs.getInt(1) > 0) {
                File bak = new File(legacy.getAbsolutePath() + ".bak");
                if (!bak.exists()) legacy.renameTo(bak);
                return;
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Economy] check import erreur", e);
            return;
        }
        try (FileReader r = new FileReader(legacy)) {
            Gson gson = new GsonBuilder().create();
            Type type = new TypeToken<List<TransactionEntry>>() {}.getType();
            List<TransactionEntry> list = gson.fromJson(r, type);
            if (list == null || list.isEmpty()) {
                legacy.renameTo(new File(legacy.getAbsolutePath() + ".bak"));
                return;
            }
            long cutoff = System.currentTimeMillis() - RETENTION_MS;
            db.conn().setAutoCommit(false);
            int n = 0;
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "INSERT OR IGNORE INTO transactions(id, ts, player_uuid, player_name, type, item_material, "
                  + "item_name, quantity, price_per_unit, total_price, shop_name, result) "
                  + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")) {
                for (TransactionEntry e : list) {
                    if (e == null || e.timestamp() < cutoff) continue;
                    bindEntry(ps, e);
                    ps.addBatch();
                    n++;
                    if (n % 1000 == 0) ps.executeBatch();
                }
                ps.executeBatch();
                db.conn().commit();
            } catch (SQLException e) {
                db.conn().rollback();
                throw e;
            } finally {
                db.conn().setAutoCommit(true);
            }
            logger.info("[Economy] Importé " + n + " transactions depuis " + legacy.getName());
            legacy.renameTo(new File(legacy.getAbsolutePath() + ".bak"));
        } catch (Exception e) {
            logger.log(Level.WARNING, "[Economy] Échec import legacy JSON", e);
        }
    }

    private void bindEntry(PreparedStatement ps, TransactionEntry e) throws SQLException {
        ps.setString(1, e.id() != null ? e.id() : UUID.randomUUID().toString());
        ps.setLong  (2, e.timestamp());
        ps.setString(3, e.playerUuid());
        ps.setString(4, e.playerName());
        ps.setString(5, e.type() != null ? e.type() : "BUY");
        ps.setString(6, e.itemMaterial());
        ps.setString(7, e.itemDisplayName());
        ps.setInt   (8, e.quantity());
        ps.setDouble(9, e.pricePerUnit());
        ps.setDouble(10, e.totalPrice());
        ps.setString(11, e.shopName());
        ps.setString(12, e.result());
    }

    public void add(TransactionEntry e) {
        if (e == null) return;
        try (PreparedStatement ps = db.conn().prepareStatement(
                "INSERT OR REPLACE INTO transactions(id, ts, player_uuid, player_name, type, item_material, "
              + "item_name, quantity, price_per_unit, total_price, shop_name, result) "
              + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")) {
            bindEntry(ps, e);
            ps.executeUpdate();
        } catch (SQLException ex) {
            logger.log(Level.WARNING, "[Economy] insert erreur", ex);
        }
    }

    public List<TransactionEntry> since(long epochMs) {
        return query("SELECT * FROM transactions WHERE ts >= ? ORDER BY ts DESC", epochMs);
    }

    public List<TransactionEntry> filter(long since, String type, String player) {
        StringBuilder sql = new StringBuilder("SELECT * FROM transactions WHERE ts >= ? ");
        List<Object> args = new ArrayList<>();
        args.add(since);
        if (type != null && !type.isEmpty()) {
            sql.append("AND type = ? COLLATE NOCASE ");
            args.add(type);
        }
        if (player != null && !player.isEmpty()) {
            sql.append("AND LOWER(player_name) = ? ");
            args.add(player.toLowerCase());
        }
        sql.append("ORDER BY ts DESC");
        return query(sql.toString(), args.toArray());
    }

    private List<TransactionEntry> query(String sql, Object... args) {
        List<TransactionEntry> out = new ArrayList<>();
        try (PreparedStatement ps = db.conn().prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(readRow(rs));
            }
        } catch (SQLException e) {
            logger.log(Level.WARNING, "[Economy] query erreur", e);
        }
        return out;
    }

    private TransactionEntry readRow(ResultSet rs) throws SQLException {
        return new TransactionEntry(
                rs.getString("id"),
                rs.getLong("ts"),
                rs.getString("player_uuid"),
                rs.getString("player_name"),
                rs.getString("type"),
                rs.getString("item_material"),
                rs.getString("item_name"),
                rs.getInt("quantity"),
                rs.getDouble("price_per_unit"),
                rs.getDouble("total_price"),
                rs.getString("shop_name"),
                rs.getString("result")
        );
    }

    /** Argent total échangé (BUY volume) par jour sur N jours — agrégation SQL. */
    public Map<String, Object> moneyOverTime(int days) {
        List<String> labels = new ArrayList<>();
        List<Double> data = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long start = day.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
            long end   = start + 86400_000L;
            double vol = 0;
            try (PreparedStatement ps = db.conn().prepareStatement(
                    "SELECT COALESCE(SUM(total_price), 0) FROM transactions "
                  + "WHERE ts >= ? AND ts < ? AND type = 'BUY'")) {
                ps.setLong(1, start);
                ps.setLong(2, end);
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) vol = rs.getDouble(1); }
            } catch (SQLException e) {
                logger.log(Level.WARNING, "[Economy] moneyOverTime erreur", e);
            }
            labels.add(day.format(DAY_FMT));
            data.add(round(vol));
        }
        return Map.of("labels", labels, "data", data);
    }

    /** No-op : SQLite commit immédiat. Conservé pour compatibilité. */
    public void save() { /* SQLite WAL flush at commit */ }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
