package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import sunanticheat.SunAntiCheat;
import sunanticheat.dashboard.DashboardUser;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.JwtUtil;
import sunanticheat.dashboard.alerts.AlertStore;
import sunanticheat.dashboard.crates.CrateOpen;
import sunanticheat.dashboard.crates.CrateStore;
import sunanticheat.dashboard.dailyreward.DailyRewardClaim;
import sunanticheat.dashboard.dailyreward.DailyRewardStore;
import sunanticheat.dashboard.economy.TransactionStore;
import sunanticheat.dashboard.luckperms.LuckPermsBridge;
import sunanticheat.dashboard.shop.ShopStore;
import sunanticheat.dashboard.shop.ShopTransaction;
import sunanticheat.dashboard.vip.VipStore;
import sunanticheat.dashboard.vip.VipSubscription;
import sunanticheat.dashboard.alts.AltAccountStore;
import sunanticheat.dashboard.sanctions.SanctionStore;
import sunanticheat.dashboard.sanctions.SanctionType;
import sunanticheat.report.ReportEntry;
import sunanticheat.report.ReportStorage;
import sunanticheat.sanction.SanctionHistoryEntry;
import sunanticheat.sanction.SanctionHistoryStorage;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;

/**
 * Endpoint /api/players/{name}/profile — agrège TOUT ce qu'on sait d'un joueur.
 *
 * Permission : MODERATE_PLAYERS (MOD+ par défaut).
 * Retourne :
 *  - identity      : nom, uuid, online, world, ping, gamemode, position
 *  - sanctions     : historique des kicks/bans/mutes/warns
 *  - reports       : reports envoyés contre lui (et par lui)
 *  - alerts        : alertes anticheat le concernant
 *  - economy       : balance Vault + transactions shop récentes
 *  - crates        : ouvertures récentes
 *  - vip           : subscriptions actuelles + historique
 *  - dailyRewards  : claims récents + streak
 *  - luckperms     : groupe primaire + groupes secondaires
 *  - notes         : notes staff (lecture seule ici, écriture via PUT)
 */
public final class PlayerProfileHandler {

    private final SunAntiCheat plugin;
    private final SanctionHistoryStorage sanctionHistory;
    private final ReportStorage reportStorage;
    private final AlertStore alertStore;
    private final TransactionStore transactionStore;
    private final ShopStore shopStore;
    private final CrateStore crateStore;
    private final VipStore vipStore;
    private final DailyRewardStore dailyStore;
    private final sunanticheat.dashboard.db.Persistence notesStorage;
    private final com.google.gson.Gson gson = new com.google.gson.GsonBuilder().setPrettyPrinting().create();
    private Map<String, List<Map<String, Object>>> notesCache;
    private AltAccountStore altAccountStore;
    private SanctionStore sanctionStoreForAlts;

    public PlayerProfileHandler(SunAntiCheat plugin,
                                 SanctionHistoryStorage sanctionHistory,
                                 ReportStorage reportStorage,
                                 AlertStore alertStore,
                                 TransactionStore transactionStore,
                                 ShopStore shopStore,
                                 CrateStore crateStore,
                                 VipStore vipStore,
                                 DailyRewardStore dailyStore,
                                 sunanticheat.dashboard.db.BlobStorage blobs) {
        this.plugin = plugin;
        this.sanctionHistory = sanctionHistory;
        this.reportStorage = reportStorage;
        this.alertStore = alertStore;
        this.transactionStore = transactionStore;
        this.shopStore = shopStore;
        this.crateStore = crateStore;
        this.vipStore = vipStore;
        this.dailyStore = dailyStore;
        File legacy = new File(new File(plugin.getDataFolder(), "dashboard"), "player_notes.json");
        this.notesStorage = new sunanticheat.dashboard.db.Persistence(blobs, "player_notes", legacy);
        loadNotes();
    }

    public void setAltAccountStore(AltAccountStore store, SanctionStore sanctionStore) {
        this.altAccountStore    = store;
        this.sanctionStoreForAlts = sanctionStore;
    }

    @SuppressWarnings("unchecked")
    private synchronized void loadNotes() {
        notesCache = new HashMap<>();
        String json = notesStorage.read();
        if (json == null || json.isBlank()) return;
        try {
            Map<String, List<Map<String, Object>>> raw = gson.fromJson(json,
                    new com.google.gson.reflect.TypeToken<Map<String, List<Map<String, Object>>>>() {}.getType());
            if (raw != null) notesCache.putAll(raw);
        } catch (Throwable t) { plugin.getLogger().warning("[PlayerProfile] notes load: " + t.getMessage()); }
    }

    private synchronized void saveNotes() {
        try {
            notesStorage.write(gson.toJson(notesCache));
        } catch (Throwable t) { plugin.getLogger().warning("[PlayerProfile] notes save: " + t.getMessage()); }
    }

    public void profile(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                         String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u,
                sunanticheat.dashboard.auth.Permission.MODERATE_PLAYERS)) return;

        Map<String, Object> result = new LinkedHashMap<>();

        // Identity (online + offline data)
        result.put("identity", buildIdentity(playerName));
        // Sanctions
        result.put("sanctions", buildSanctions(playerName));
        // Reports
        result.put("reports", buildReports(playerName));
        // Alerts anticheat
        result.put("alerts", buildAlerts(playerName));
        // Economy / shop
        result.put("economy", buildEconomy(playerName));
        // Crates
        result.put("crates", buildCrates(playerName));
        // VIP
        result.put("vip", buildVip(playerName));
        // Daily rewards
        result.put("dailyRewards", buildDaily(playerName));
        // LuckPerms
        result.put("luckperms", buildLuckPerms(playerName));
        // Notes
        result.put("notes", getNotes(playerName));
        // Alts (comptes liés par IP)
        result.put("alts", buildAlts(playerName));

        HttpHelper.json(ex, 200, result);
    }

    // ── Builders ─────────────────────────────────────────────────────────

    private Map<String, Object> buildIdentity(String name) {
        Map<String, Object> m = new LinkedHashMap<>();
        Player online = Bukkit.getPlayerExact(name);
        if (online != null) {
            m.put("name", online.getName());
            m.put("uuid", online.getUniqueId().toString());
            m.put("online", true);
            m.put("world", online.getWorld().getName());
            m.put("ping", online.getPing());
            m.put("gameMode", online.getGameMode().name());
            m.put("health", online.getHealth());
            m.put("food", online.getFoodLevel());
            m.put("level", online.getLevel());
            m.put("x", (int) online.getLocation().getX());
            m.put("y", (int) online.getLocation().getY());
            m.put("z", (int) online.getLocation().getZ());
            m.put("displayName", online.getDisplayName());
        } else {
            OfflinePlayer off = Bukkit.getOfflinePlayer(name);
            m.put("name", off.getName() != null ? off.getName() : name);
            m.put("uuid", off.getUniqueId() != null ? off.getUniqueId().toString() : null);
            m.put("online", false);
            m.put("lastPlayed", off.getLastPlayed());
            m.put("firstPlayed", off.getFirstPlayed());
            m.put("banned", off.isBanned());
        }
        return m;
    }

    private List<Map<String, Object>> buildSanctions(String name) {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            for (SanctionHistoryEntry e : sanctionHistory.getAll()) {
                if (e == null || e.getTargetName() == null) continue;
                if (!name.equalsIgnoreCase(e.getTargetName())) continue;
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("id", String.valueOf(e.getTimestamp()));
                r.put("type", e.getType());
                r.put("reason", e.getReason());
                r.put("staff", e.getStaffName());
                r.put("timestamp", e.getTimestamp());
                r.put("durationMs", e.getDurationMillis());
                out.add(r);
            }
        } catch (Throwable t) { plugin.getLogger().warning("[Profile] sanctions: " + t.getMessage()); }
        return out;
    }

    private Map<String, Object> buildReports(String name) {
        Map<String, Object> ret = new LinkedHashMap<>();
        List<Map<String, Object>> against = new ArrayList<>();
        List<Map<String, Object>> sent = new ArrayList<>();
        try {
            for (ReportEntry e : reportStorage.getAll()) {
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("id", e.getId());
                r.put("reporter", e.getReporterName());
                r.put("target", e.getReportedName());
                r.put("reason", e.getReason());
                r.put("timestamp", e.getTimestamp());
                r.put("resolved", e.isResolved());
                if (name.equalsIgnoreCase(e.getReportedName())) against.add(r);
                if (name.equalsIgnoreCase(e.getReporterName())) sent.add(r);
            }
        } catch (Throwable t) { plugin.getLogger().warning("[Profile] reports: " + t.getMessage()); }
        ret.put("against", against);
        ret.put("sent", sent);
        return ret;
    }

    private List<Map<String, Object>> buildAlerts(String name) {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            // alertStore.getRecent() retourne List<Map<String, Object>>
            for (Object o : alertStore.getRecent(500)) {
                if (!(o instanceof Map)) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> m = (Map<String, Object>) o;
                Object pl = m.get("player");
                if (pl != null && name.equalsIgnoreCase(pl.toString())) {
                    out.add(m);
                }
            }
        } catch (Throwable t) { plugin.getLogger().warning("[Profile] alerts: " + t.getMessage()); }
        return out;
    }

    private Map<String, Object> buildEconomy(String name) {
        Map<String, Object> m = new LinkedHashMap<>();
        // Balance Vault si dispo
        try {
            net.milkbowl.vault.economy.Economy eco = plugin.getEconomy();
            if (eco != null) {
                OfflinePlayer off = Bukkit.getOfflinePlayer(name);
                m.put("balance", eco.getBalance(off));
            }
        } catch (Throwable t) { /* Vault absent */ }

        // Shop transactions récentes (50 dernières)
        List<Map<String, Object>> shopTx = new ArrayList<>();
        try {
            if (shopStore != null) {
                for (ShopTransaction t : shopStore.listTransactions(null, name, 30, 50)) {
                    Map<String, Object> tx = new LinkedHashMap<>();
                    tx.put("shopName", t.shopName);
                    tx.put("itemName", t.itemDisplayName);
                    tx.put("type", t.type);
                    tx.put("amount", t.amount);
                    tx.put("totalPrice", t.totalPrice);
                    tx.put("pricePer", t.pricePer);
                    tx.put("timestamp", t.timestamp);
                    shopTx.add(tx);
                }
            }
        } catch (Throwable t) {}
        m.put("shopTransactions", shopTx);

        return m;
    }

    private List<Map<String, Object>> buildCrates(String name) {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            if (crateStore != null) {
                for (CrateOpen o : crateStore.listOpens(null, 100)) {
                    if (!name.equalsIgnoreCase(o.playerName)) continue;
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("crateName", o.crateName);
                    m.put("itemName", o.itemName);
                    m.put("rarity", o.rarity != null ? o.rarity.name() : null);
                    m.put("openedAt", o.openedAt);
                    out.add(m);
                }
            }
        } catch (Throwable t) {}
        return out;
    }

    private Map<String, Object> buildVip(String name) {
        Map<String, Object> ret = new LinkedHashMap<>();
        List<Map<String, Object>> active = new ArrayList<>();
        List<Map<String, Object>> history = new ArrayList<>();
        try {
            if (vipStore != null) {
                for (VipSubscription s : vipStore.listSubscriptions(null, name, 50)) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("planName", s.planName);
                    m.put("status", s.status);
                    m.put("startedAt", s.startedAt);
                    m.put("expiresAt", s.expiresAt);
                    m.put("amountPaid", s.amountPaid);
                    m.put("currency", s.currency);
                    m.put("gateway", s.gateway);
                    if ("ACTIVE".equals(s.status)) active.add(m);
                    else history.add(m);
                }
            }
        } catch (Throwable t) {}
        ret.put("active", active);
        ret.put("history", history);
        return ret;
    }

    private Map<String, Object> buildDaily(String name) {
        Map<String, Object> ret = new LinkedHashMap<>();
        try {
            if (dailyStore != null) {
                List<Map<String, Object>> claims = new ArrayList<>();
                for (DailyRewardClaim c : dailyStore.listClaims(name, 30, 30)) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("day", c.day);
                    m.put("claimedAt", c.claimedAt);
                    m.put("itemsGiven", c.itemsGiven);
                    claims.add(m);
                }
                ret.put("claims", claims);
                // Streak via uuid
                OfflinePlayer off = Bukkit.getOfflinePlayer(name);
                if (off != null && off.getUniqueId() != null) {
                    ret.put("currentStreak", dailyStore.getStreak(off.getUniqueId().toString()));
                    ret.put("canClaim", dailyStore.canClaim(off.getUniqueId().toString()));
                }
            }
        } catch (Throwable t) {}
        return ret;
    }

    private Map<String, Object> buildLuckPerms(String name) {
        try {
            OfflinePlayer off = Bukkit.getOfflinePlayer(name);
            if (off != null && off.getUniqueId() != null) {
                return LuckPermsBridge.getPlayerInfo(off.getUniqueId().toString());
            }
        } catch (Throwable t) {}
        return Map.of("available", false);
    }

    private List<Map<String, Object>> buildAlts(String name) {
        if (altAccountStore == null) return List.of();
        try {
            OfflinePlayer off = Bukkit.getOfflinePlayer(name);
            if (off.getUniqueId() == null) return List.of();
            String uuid = off.getUniqueId().toString();
            List<Map<String, Object>> out = new ArrayList<>();
            for (AltAccountStore.AltEntry e : altAccountStore.getAltsForPlayer(uuid)) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("name",      e.name());
                m.put("uuid",      e.uuid());
                m.put("ip",        e.ip());
                m.put("firstSeen", e.firstSeen());
                m.put("lastSeen",  e.lastSeen());
                if (sanctionStoreForAlts != null) {
                    m.put("banned", sanctionStoreForAlts.activeSanction(
                            e.uuid(), e.name(), null, SanctionType.BAN) != null);
                }
                out.add(m);
            }
            return out;
        } catch (Throwable t) {
            plugin.getLogger().warning("[Profile] alts: " + t.getMessage());
            return List.of();
        }
    }

    private List<Map<String, Object>> getNotes(String name) {
        List<Map<String, Object>> notes = notesCache.getOrDefault(name.toLowerCase(), List.of());
        return new ArrayList<>(notes);
    }

    /** POST /api/players/{name}/notes — ajoute une note staff. */
    @SuppressWarnings("unchecked")
    public void addNote(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                         String playerName) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u,
                sunanticheat.dashboard.auth.Permission.MODERATE_PLAYERS)) return;

        Map<String, Object> body;
        try { body = HttpHelper.GSON.fromJson(HttpHelper.body(ex), Map.class); }
        catch (Exception e) { HttpHelper.error(ex, 400, "JSON invalide"); return; }
        if (body == null || body.get("text") == null) {
            HttpHelper.error(ex, 400, "text requis"); return;
        }
        String text = body.get("text").toString().trim();
        if (text.isEmpty()) { HttpHelper.error(ex, 400, "text vide"); return; }

        Map<String, Object> note = new LinkedHashMap<>();
        note.put("id", java.util.UUID.randomUUID().toString());
        note.put("text", text);
        note.put("author", u.username());
        note.put("timestamp", System.currentTimeMillis());

        synchronized (this) {
            List<Map<String, Object>> list = notesCache.computeIfAbsent(
                    playerName.toLowerCase(), k -> new ArrayList<>());
            list.add(note);
            saveNotes();
        }
        sunanticheat.dashboard.audit.Audit.log(u, ex, "PLAYER_NOTE_ADDED", playerName,
                "Note ajoutée : " + (text.length() > 50 ? text.substring(0, 50) + "..." : text));
        HttpHelper.json(ex, 200, note);
    }

    /** DELETE /api/players/{name}/notes/{noteId}. */
    public void deleteNote(HttpExchange ex, JwtUtil jwt, Map<String, DashboardUser> users,
                            String playerName, String noteId) throws IOException {
        DashboardUser u = HttpHelper.authenticate(ex, jwt, users);
        if (u == null) return;
        if (!HttpHelper.requirePermission(ex, u,
                sunanticheat.dashboard.auth.Permission.MODERATE_PLAYERS)) return;

        synchronized (this) {
            List<Map<String, Object>> list = notesCache.get(playerName.toLowerCase());
            if (list != null) {
                list.removeIf(n -> noteId.equals(n.get("id")));
                saveNotes();
            }
        }
        sunanticheat.dashboard.audit.Audit.log(u, ex, "PLAYER_NOTE_DELETED", playerName,
                "Note " + noteId + " supprimée");
        HttpHelper.json(ex, 200, Map.of("ok", true));
    }
}
