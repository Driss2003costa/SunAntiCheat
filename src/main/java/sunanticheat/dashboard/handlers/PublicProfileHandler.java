package sunanticheat.dashboard.handlers;

import com.sun.net.httpserver.HttpExchange;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import sunanticheat.SunAntiCheat;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.dailyreward.DailyRewardStore;
import sunanticheat.dashboard.portal.PlayerAccountStore;
import sunanticheat.dashboard.quests.Quest;
import sunanticheat.dashboard.quests.QuestStore;
import sunanticheat.dashboard.sanctions.SanctionEntry;
import sunanticheat.dashboard.vip.VipStore;
import sunanticheat.dashboard.vip.VipSubscription;

import java.io.IOException;
import java.util.*;

public final class PublicProfileHandler {

    private final PlayerAccountStore accountStore;
    private final Plugin plugin;

    private DailyRewardStore dailyRewardStore;
    private VipStore vipStore;
    private QuestStore questStore;

    public PublicProfileHandler(PlayerAccountStore accountStore, Plugin plugin) {
        this.accountStore = accountStore;
        this.plugin = plugin;
    }

    public void setDailyRewardStore(DailyRewardStore s) { this.dailyRewardStore = s; }
    public void setVipStore(VipStore s)                  { this.vipStore = s; }
    public void setQuestStore(QuestStore s)              { this.questStore = s; }

    /** GET /api/public/profile/:username */
    public void profile(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        String username = path.substring(path.lastIndexOf('/') + 1);

        if (username.isBlank() || !username.matches("[a-zA-Z0-9_]{3,16}")) {
            HttpHelper.error(ex, 400, "Pseudo invalide"); return;
        }

        Map<String, Object> account = accountStore.getByUsername(username);
        if (account == null) {
            HttpHelper.json(ex, 404, Map.of("error", "not_found",
                    "message", "Aucun portail joueur pour ce pseudo.")); return;
        }

        String uuid      = (String) account.get("uuid");
        String exactName = (String) account.get("username");

        boolean online = Bukkit.getOnlinePlayers().stream()
                .anyMatch(p -> p.getUniqueId().toString().equals(uuid));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("uuid",       uuid);
        result.put("username",   exactName);
        result.put("role",       account.get("role"));
        result.put("online",     online);
        result.put("created_at", account.get("created_at"));
        result.put("bio",        account.getOrDefault("bio", ""));

        // ── Dernière connexion Minecraft (plus pertinent que last_login portail) ──
        try {
            org.bukkit.OfflinePlayer op = Bukkit.getOfflinePlayer(UUID.fromString(uuid));
            long lastPlayed = op.getLastPlayed();
            result.put("last_seen", lastPlayed > 0 ? lastPlayed : null);
        } catch (Throwable ignored) {}

        // ── Playtime + rang ────────────────────────────────────────────────────
        try {
            if (plugin instanceof SunAntiCheat sac && sac.getPlaytimeTracker() != null) {
                UUID uid = UUID.fromString(uuid);
                long seconds = sac.getPlaytimeTracker().getTotalPlaytimeSeconds(uid);
                result.put("playtime_seconds",   seconds);
                result.put("playtime_formatted", sunanticheat.playtime.PlaytimeTracker.formatPlaytime(seconds));

                // Rang (1-based) parmi tous les joueurs
                List<Map.Entry<UUID, Long>> top = sac.getPlaytimeTracker().getTopPlaytimes(Integer.MAX_VALUE);
                int rank = 1;
                int total = top.size();
                for (Map.Entry<UUID, Long> e : top) {
                    if (e.getKey().equals(uid)) break;
                    rank++;
                }
                result.put("playtime_rank",       rank <= total ? rank : null);
                result.put("playtime_rank_total",  total);
            }
        } catch (Throwable ignored) {}

        // ── Groupe LuckPerms ───────────────────────────────────────────────────
        try {
            if (Bukkit.getPluginManager().getPlugin("LuckPerms") != null) {
                var api = LuckPermsProvider.get();
                UUID uid = UUID.fromString(uuid);
                User u = api.getUserManager().loadUser(uid).join();
                if (u != null) {
                    String groupName = u.getPrimaryGroup();
                    String displayName = groupName;
                    String color = null;
                    try {
                        Group g = api.getGroupManager().getGroup(groupName);
                        if (g != null) {
                            String dn = g.getDisplayName();
                            if (dn != null && !dn.isBlank()) displayName = dn;
                            color = g.getCachedData().getMetaData().getMetaValue("color");
                        }
                    } catch (Throwable ignored) {}
                    Map<String, Object> lp = new LinkedHashMap<>();
                    lp.put("name",    groupName);
                    lp.put("display", displayName);
                    lp.put("color",   color);
                    result.put("lp_group", lp);
                }
            }
        } catch (Throwable ignored) {}

        // ── VIP actif ──────────────────────────────────────────────────────────
        try {
            if (vipStore != null) {
                List<VipSubscription> active = vipStore.listSubscriptions("ACTIVE", exactName, 1);
                if (!active.isEmpty()) {
                    VipSubscription s = active.get(0);
                    Map<String, Object> vip = new LinkedHashMap<>();
                    vip.put("active",     true);
                    vip.put("plan",       s.planName);
                    vip.put("expires_at", s.expiresAt);
                    result.put("vip", vip);
                } else {
                    result.put("vip", Map.of("active", false));
                }
            }
        } catch (Throwable ignored) {}

        // ── Streak récompenses quotidiennes ────────────────────────────────────
        try {
            if (dailyRewardStore != null) {
                int streak = dailyRewardStore.getStreak(uuid);
                result.put("daily_streak", streak);
            }
        } catch (Throwable ignored) {}

        // ── Quêtes ─────────────────────────────────────────────────────────────
        try {
            if (questStore != null) {
                Map<String, Object> progress = questStore.playerProgress(uuid);
                int completedCount = 0;
                List<Map<String, Object>> activeQuests = new ArrayList<>();

                for (Object v : progress.values()) {
                    if (!(v instanceof Map<?, ?> qm)) continue;
                    boolean done = Boolean.TRUE.equals(qm.get("completed"));
                    if (done) {
                        completedCount++;
                        continue;
                    }
                    int cur  = qm.get("progress") instanceof Number n ? n.intValue() : 0;
                    int goal = qm.get("goal")     instanceof Number n ? n.intValue() : 1;
                    if (cur <= 0) continue;

                    String questId = (String) qm.get("questId");
                    Quest q = questStore.get(questId);
                    if (q == null || !q.isEnabled()) continue;

                    Map<String, Object> qout = new LinkedHashMap<>();
                    qout.put("questId",  questId);
                    qout.put("title",    q.getTitle());
                    qout.put("icon",     q.getIcon());
                    qout.put("color",    q.getColor());
                    qout.put("progress", cur);
                    qout.put("goal",     goal);
                    activeQuests.add(qout);
                }

                // Trier par progression décroissante, max 4
                activeQuests.sort((a, b) -> {
                    double pA = ((Number) a.get("progress")).doubleValue() / Math.max(1, ((Number) a.get("goal")).doubleValue());
                    double pB = ((Number) b.get("progress")).doubleValue() / Math.max(1, ((Number) b.get("goal")).doubleValue());
                    return Double.compare(pB, pA);
                });
                if (activeQuests.size() > 4) activeQuests = activeQuests.subList(0, 4);

                Map<String, Object> questsMap = new LinkedHashMap<>();
                questsMap.put("completed_count", completedCount);
                questsMap.put("active",          activeQuests);
                result.put("quests", questsMap);
            }
        } catch (Throwable ignored) {}

        // ── Sanctions actives (ban/mute uniquement) ────────────────────────────
        try {
            if (plugin instanceof SunAntiCheat sac
                    && sac.getDashboardModule() != null
                    && sac.getDashboardModule().getSanctionStore() != null) {

                result.put("active_sanctions",
                    sac.getDashboardModule().getSanctionStore()
                        .list(null, null, null, Boolean.TRUE, 100, 0)
                        .stream()
                        .filter(s -> uuid.equals(s.targetUuid))
                        .filter(s -> "BAN".equals(s.type) || "MUTE".equals(s.type))
                        .map(s -> {
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("type",       s.type);
                            m.put("reason",     s.reason);
                            m.put("expires_at", s.expiresAt);
                            return m;
                        }).toList());
            }
        } catch (Throwable ignored) {}

        // ── Trophées ───────────────────────────────────────────────────────────
        result.put("trophies", buildTrophies(result, account, uuid));

        HttpHelper.json(ex, 200, result);
    }

    private List<Map<String, Object>> buildTrophies(Map<String, Object> data,
                                                    Map<String, Object> account,
                                                    String uuid) {
        List<Map<String, Object>> out = new ArrayList<>();
        long now = System.currentTimeMillis();
        long createdAt = account.get("created_at") instanceof Number n ? n.longValue() : 0L;
        long ageMs = now - createdAt;

        // ── Ancienneté ──────────────────────────────────────────────────────────
        long day = 86_400_000L;
        if (ageMs >= 365 * day)
            out.add(trophy("member_1y",  "Vétéran 1 an",     "🎂", "legendary"));
        else if (ageMs >= 180 * day)
            out.add(trophy("member_6m",  "Membre 6 mois",    "🎖️", "epic"));
        else if (ageMs >= 30 * day)
            out.add(trophy("member_1m",  "Membre 1 mois",    "📅", "common"));

        // ── Playtime ────────────────────────────────────────────────────────────
        long seconds = data.get("playtime_seconds") instanceof Number n ? n.longValue() : 0L;
        if (seconds >= 1_000 * 3600)
            out.add(trophy("playtime_1000h", "1000h de jeu",  "👑", "legendary"));
        else if (seconds >= 500 * 3600)
            out.add(trophy("playtime_500h",  "500h de jeu",   "💎", "epic"));
        else if (seconds >= 100 * 3600)
            out.add(trophy("playtime_100h",  "100h de jeu",   "⏱️", "rare"));
        else if (seconds >= 10 * 3600)
            out.add(trophy("playtime_10h",   "10h de jeu",    "🎮", "common"));

        // ── Top playtime ────────────────────────────────────────────────────────
        Object rankObj = data.get("playtime_rank");
        if (rankObj instanceof Number n) {
            int rank = n.intValue();
            if (rank == 1)  out.add(trophy("rank_1",   "#1 du serveur",  "🥇", "legendary"));
            else if (rank <= 3)  out.add(trophy("rank_3",   "Top 3",     "🥈", "epic"));
            else if (rank <= 10) out.add(trophy("rank_10",  "Top 10",    "🥉", "rare"));
        }

        // ── Streak ──────────────────────────────────────────────────────────────
        int streak = data.get("daily_streak") instanceof Number n ? n.intValue() : 0;
        if (streak >= 100)
            out.add(trophy("streak_100", "Streak 100 jours", "🌟", "legendary"));
        else if (streak >= 30)
            out.add(trophy("streak_30",  "Streak 30 jours",  "🔥", "epic"));
        else if (streak >= 7)
            out.add(trophy("streak_7",   "Streak 7 jours",   "✨", "rare"));

        // ── VIP ────────────────────────────────────────────────────────────────
        if (data.get("vip") instanceof Map<?, ?> vipMap && Boolean.TRUE.equals(vipMap.get("active")))
            out.add(trophy("vip", "Supporter VIP", "💛", "epic"));

        // ── Quêtes ─────────────────────────────────────────────────────────────
        if (data.get("quests") instanceof Map<?, ?> qm) {
            int done = qm.get("completed_count") instanceof Number n ? n.intValue() : 0;
            if (done >= 50)
                out.add(trophy("quests_50",  "50 quêtes",  "🏆", "legendary"));
            else if (done >= 20)
                out.add(trophy("quests_20",  "20 quêtes",  "⚔️", "epic"));
            else if (done >= 5)
                out.add(trophy("quests_5",   "5 quêtes",   "🗡️", "rare"));
            else if (done >= 1)
                out.add(trophy("quests_1",   "1ère quête", "🌱", "common"));
        }

        return out;
    }

    private static Map<String, Object> trophy(String id, String name, String icon, String rarity) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",     id);
        m.put("name",   name);
        m.put("icon",   icon);
        m.put("rarity", rarity);
        return m;
    }
}
