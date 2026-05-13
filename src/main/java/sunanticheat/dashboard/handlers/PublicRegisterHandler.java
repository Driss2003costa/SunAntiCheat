package sunanticheat.dashboard.handlers;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.google.gson.reflect.TypeToken;
import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.auth.RateLimiter;
import sunanticheat.dashboard.portal.CaptchaService;
import sunanticheat.dashboard.portal.PlayerAccountStore;
import sunanticheat.dashboard.portal.PlayerJwtUtil;
import sunanticheat.dashboard.portal.PortalActivityStore;
import sunanticheat.dashboard.portal.PortalSection;
import sunanticheat.dashboard.portal.RegisterPinService;
import sunanticheat.dashboard.portal.RegisterPinService.VerifyResult;
import sunanticheat.dashboard.quests.Quest;
import sunanticheat.dashboard.quests.QuestStore;
import sunanticheat.dashboard.social.ReferralStore;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Logger;

public final class PublicRegisterHandler {

    private final PlayerAccountStore accountStore;
    private final RegisterPinService pinService;
    private final PlayerJwtUtil playerJwt;
    private final Plugin plugin;
    private final Logger logger;
    private final ReferralStore referralStore;
    private final QuestStore questStore;
    private final CaptchaService captchaService;
    private PortalActivityStore activityStore;

    /** Rate limit login portail : 20 essais / 15 min par IP (bloque le flood). */
    private static final RateLimiter LOGIN_IP_LIMIT   = new RateLimiter(20, 15 * 60_000L);
    /** Rate limit login portail : 10 essais / 15 min par pseudo (bloque le brute-force ciblé). */
    private static final RateLimiter LOGIN_USER_LIMIT = new RateLimiter(10, 15 * 60_000L);

    /** Seuil de tentatives ratées (persistantes ou par IP) qui déclenche le CAPTCHA. */
    private static final int CAPTCHA_THRESHOLD = 5;
    /** Seuil persistant qui déclenche une notification au joueur en jeu. */
    private static final int NOTIFY_THRESHOLD  = 3;

    public PublicRegisterHandler(PlayerAccountStore accountStore, RegisterPinService pinService,
                                  PlayerJwtUtil playerJwt, Plugin plugin, Logger logger,
                                  ReferralStore referralStore, QuestStore questStore,
                                  CaptchaService captchaService) {
        this.accountStore   = accountStore;
        this.pinService     = pinService;
        this.playerJwt      = playerJwt;
        this.plugin         = plugin;
        this.logger         = logger;
        this.referralStore  = referralStore;
        this.questStore     = questStore;
        this.captchaService = captchaService;
    }

    public void setActivityStore(PortalActivityStore store) { this.activityStore = store; }

    /** POST /api/public/register/request */
    public void request(HttpExchange ex) throws IOException {
        String ip = ip(ex);
        if (!pinService.tryRequest(ip)) {
            HttpHelper.error(ex, 429, "Trop de tentatives. Réessaie dans 10 minutes.");
            return;
        }

        Map<String, String> body = parseBody(ex);
        String username = body == null ? null : body.get("username");

        if (username == null || !username.matches("[a-zA-Z0-9_]{3,16}")) {
            HttpHelper.error(ex, 400, "Pseudo invalide (3-16 caractères, lettres/chiffres/_)");
            return;
        }

        // Chercher le joueur connecté (case-insensitive)
        Player player = null;
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (p.getName().equalsIgnoreCase(username)) { player = p; break; }
        }

        if (player == null) {
            HttpHelper.json(ex, 400, Map.of("error", "player_offline",
                    "message", "Tu dois être connecté sur le serveur pour t'inscrire."));
            return;
        }

        String uuid = player.getUniqueId().toString();

        if (accountStore.isRegistered(uuid)) {
            HttpHelper.json(ex, 409, Map.of("error", "already_registered",
                    "message", "Ce compte Minecraft est déjà inscrit. Connecte-toi à la place."));
            return;
        }

        final Player fp = player;
        final String exactName = player.getName();
        final String pin = pinService.generatePin(uuid, exactName);

        // Envoyer le PIN sur le thread principal Bukkit
        Bukkit.getScheduler().runTask(plugin, () ->
            fp.sendMessage(net.kyori.adventure.text.Component.text(
                "§8[§6SunAntiCheat§8] §7Portail : ton code d'inscription est §e§l" + pin
                + " §7(valable 5 minutes)")));

        logger.info("[Portal] PIN envoyé à " + exactName + " (" + uuid + ") — IP " + ip);

        HttpHelper.json(ex, 200, Map.of(
            "uuid",       uuid,
            "username",   exactName,
            "expires_in", 300
        ));
    }

    /** POST /api/public/register/verify */
    public void verify(HttpExchange ex) throws IOException {
        Map<String, String> body = parseBody(ex);
        if (body == null) { HttpHelper.error(ex, 400, "Corps JSON requis"); return; }

        String uuid     = body.get("uuid");
        String pin      = body.get("pin");
        String password = body.get("password");

        if (uuid == null || pin == null || password == null) {
            HttpHelper.error(ex, 400, "uuid, pin et password sont requis");
            return;
        }

        if (password.length() < 6) {
            HttpHelper.error(ex, 400, "Le code PIN doit faire au moins 6 chiffres");
            return;
        }

        VerifyResult result = pinService.verifyPin(uuid, pin);
        switch (result) {
            case VerifyResult.Expired()     -> { HttpHelper.json(ex, 400, Map.of("error", "pin_expired",     "message", "Code expiré. Redemande un nouveau code.")); return; }
            case VerifyResult.MaxAttempts() -> { HttpHelper.json(ex, 400, Map.of("error", "max_attempts",    "message", "Trop de tentatives incorrectes.")); return; }
            case VerifyResult.Invalid(int left) -> {
                HttpHelper.json(ex, 401, Map.of("error", "invalid_pin", "attempts_left", left,
                        "message", "Code incorrect. " + left + " tentative(s) restante(s).")); return;
            }
            case VerifyResult.Ok(String username) -> {
                if (accountStore.isRegistered(uuid)) {
                    HttpHelper.json(ex, 409, Map.of("error", "already_registered")); return;
                }
                String hash = BCrypt.withDefaults().hashToString(12, password.toCharArray());
                accountStore.createAccount(uuid, username, hash);

                // Parrainage : enregistre l'usage si un code valide est présent
                String refCode = body.get("ref_code");
                if (refCode != null && !refCode.isBlank()) {
                    boolean recorded = referralStore.recordUse(refCode.toUpperCase().trim(), uuid, ip(ex));
                    if (recorded) logger.info("[Portal] Parrainage enregistré : " + username + " via " + refCode);
                }

                // Génère le code de parrainage du nouveau compte
                referralStore.getOrCreateCode(uuid);

                String token = playerJwt.generate(uuid, username, "PLAYER");
                logger.info("[Portal] Compte créé : " + username + " (" + uuid + ")");
                HttpHelper.json(ex, 200, Map.of(
                    "token",    token,
                    "uuid",     uuid,
                    "username", username,
                    "role",     "PLAYER"
                ));
            }
        }
    }

    /** GET /api/public/captcha — émet un challenge captcha (utilisé après plusieurs échecs). */
    public void captcha(HttpExchange ex) throws IOException {
        CaptchaService.Challenge ch = captchaService.generate();
        HttpHelper.json(ex, 200, Map.of(
            "id",         ch.id(),
            "question",   ch.question(),
            "expires_in", ch.expiresIn()
        ));
    }

    /** POST /api/public/register/login */
    public void login(HttpExchange ex) throws IOException {
        String ip = ip(ex);

        // 1) Garde-fou anti-flood : rate-limit IP en premier (avant parsing).
        if (!LOGIN_IP_LIMIT.tryAcquire(ip)) {
            long retrySec = LOGIN_IP_LIMIT.retryAfterMs(ip) / 1000;
            ex.getResponseHeaders().add("Retry-After", String.valueOf(retrySec));
            HttpHelper.error(ex, 429,
                    "Trop de tentatives. Réessaie dans " + (retrySec / 60 + 1) + " min.");
            logger.warning("[Portal] Login rate-limit IP atteint pour " + ip);
            return;
        }

        Map<String, String> body = parseBody(ex);
        if (body == null) { HttpHelper.error(ex, 400, "Corps JSON requis"); return; }

        String username      = body.get("username");
        String password      = body.get("password");
        String captchaId     = body.get("captcha_id");
        String captchaAnswer = body.get("captcha_answer");

        if (username == null || password == null) {
            HttpHelper.error(ex, 400, "username et password sont requis");
            return;
        }

        // 2) Rate-limit par pseudo (résiste à la rotation d'IP).
        String userKey = username.toLowerCase();
        if (!LOGIN_USER_LIMIT.tryAcquire(userKey)) {
            long retrySec = LOGIN_USER_LIMIT.retryAfterMs(userKey) / 1000;
            ex.getResponseHeaders().add("Retry-After", String.valueOf(retrySec));
            HttpHelper.error(ex, 429,
                    "Trop de tentatives pour ce compte. Réessaie dans " + (retrySec / 60 + 1) + " min.");
            logger.warning("[Portal] Login rate-limit pseudo atteint pour " + username + " (IP " + ip + ")");
            return;
        }

        // 3) Lookup compte + détermine si un CAPTCHA est requis pour cet essai.
        Map<String, Object> account = accountStore.getByUsername(username);
        int accountFails = account == null ? 0 : ((Number) account.get("failed_login_count")).intValue();
        boolean captchaNeeded =
                accountFails >= CAPTCHA_THRESHOLD ||
                LOGIN_IP_LIMIT.currentAttempts(ip) > CAPTCHA_THRESHOLD;

        if (captchaNeeded && !captchaService.verifyAndConsume(captchaId, captchaAnswer)) {
            CaptchaService.Challenge ch = captchaService.generate();
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("error",   "captcha_required");
            resp.put("message", "Résous le défi de sécurité pour continuer.");
            resp.put("captcha", Map.of("id", ch.id(), "question", ch.question(), "expires_in", ch.expiresIn()));
            HttpHelper.json(ex, 401, resp);
            return;
        }

        // 4) Compte inexistant : on log et on renvoie un message générique.
        if (account == null) {
            if (activityStore != null) activityStore.logLogin(null, username, ip, false);
            failureResponse(ex, ip, accountFails, false);
            return;
        }

        String uuid = (String) account.get("uuid");
        String role = (String) account.get("role");

        // 5) Ban portail.
        if (accountStore.isBanned(account)) {
            Object bannedUntil = account.get("banned_until");
            String reason = (String) account.get("ban_reason");
            if (activityStore != null) activityStore.logLogin(uuid, username, ip, false);
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("error",   "banned");
            resp.put("message", "Accès au portail révoqué.");
            resp.put("reason",  reason != null ? reason : "");
            resp.put("banned_until", bannedUntil);
            HttpHelper.json(ex, 403, resp);
            return;
        }

        // 6) Vérification du mot de passe.
        BCrypt.Result bcResult = BCrypt.verifyer()
                .verify(password.toCharArray(), (String) account.get("password_hash"));
        if (!bcResult.verified) {
            int newCount = accountStore.incrementFailedLogin(uuid);
            if (activityStore != null) activityStore.logLogin(uuid, username, ip, false);
            if (newCount >= NOTIFY_THRESHOLD) notifyInGame(uuid, ip, newCount);
            failureResponse(ex, ip, newCount, true);
            return;
        }

        // 7) Connexion valide.
        LOGIN_IP_LIMIT.reset(ip);
        LOGIN_USER_LIMIT.reset(userKey);
        accountStore.resetFailedLogin(uuid);
        accountStore.updateLastLogin(uuid);
        if (activityStore != null) activityStore.logLogin(uuid, username, ip, true);
        String token = playerJwt.generate(uuid, username, role);

        // Validation du parrainage si le compte a plus de 24h.
        String referrerUuid = referralStore.validateIfReady(uuid);
        if (referrerUuid != null) {
            int count = referralStore.getValidatedCount(referrerUuid);
            questStore.checkSocialQuest(referrerUuid, Quest.Type.REFERRAL_COUNT, count);
            logger.info("[Portal] Parrainage validé : " + username + " → parrain " + referrerUuid + " (" + count + " filleul(s))");
        }

        int restrictions = ((Number) account.get("section_restrictions")).intValue();
        boolean mustReset = Boolean.TRUE.equals(account.get("must_reset_password"));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("token",    token);
        resp.put("uuid",     uuid);
        resp.put("username", account.get("username"));
        resp.put("role",     role);
        resp.put("restrictions",        PortalSection.keysFromMask(restrictions));
        resp.put("must_reset_password", mustReset);
        HttpHelper.json(ex, 200, resp);
    }

    /** Réponse d'échec mot-de-passe (avec, le cas échéant, un captcha pour le prochain essai). */
    private void failureResponse(HttpExchange ex, String ip, int failCount, boolean accountExists)
            throws IOException {
        boolean nextNeedsCaptcha =
                (accountExists && failCount >= CAPTCHA_THRESHOLD) ||
                LOGIN_IP_LIMIT.currentAttempts(ip) >= CAPTCHA_THRESHOLD;
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("error",   "invalid_credentials");
        resp.put("message", "Pseudo ou mot de passe incorrect");
        if (nextNeedsCaptcha) {
            CaptchaService.Challenge ch = captchaService.generate();
            resp.put("captcha_required", true);
            resp.put("captcha", Map.of("id", ch.id(), "question", ch.question(), "expires_in", ch.expiresIn()));
        }
        HttpHelper.json(ex, 401, resp);
    }

    /** Avertit le joueur en jeu (s'il est connecté) qu'on tente de forcer son compte portail. */
    private void notifyInGame(String uuid, String ip, int failCount) {
        Bukkit.getScheduler().runTask(plugin, () -> {
            try {
                Player p = Bukkit.getPlayer(UUID.fromString(uuid));
                if (p == null || !p.isOnline()) return;
                p.sendMessage(net.kyori.adventure.text.Component.text(
                    "§8[§6SunAntiCheat§8] §c⚠ Portail : §f" + failCount +
                    " §ctentatives de connexion ratées sur ton compte §7(dernière IP §f" + ip +
                    "§7). §cSi ce n'est pas toi, change ton mot de passe via §e/forgot§c sur le portail."));
            } catch (IllegalArgumentException ignored) { /* UUID invalide */ }
        });
    }

    /** POST /api/public/register/forgot */
    public void forgot(HttpExchange ex) throws IOException {
        String ip = ip(ex);
        if (!pinService.tryRequest(ip)) {
            HttpHelper.error(ex, 429, "Trop de tentatives. Réessaie dans 10 minutes.");
            return;
        }

        Map<String, String> body = parseBody(ex);
        String username = body == null ? null : body.get("username");

        if (username == null || username.isBlank()) {
            HttpHelper.error(ex, 400, "username requis");
            return;
        }

        Map<String, Object> account = accountStore.getByUsername(username);
        if (account == null) {
            // Do not reveal whether the account exists
            HttpHelper.json(ex, 200, Map.of("message", "Si un compte existe, un code a été envoyé en jeu."));
            return;
        }

        String uuid = (String) account.get("uuid");
        String exactName = (String) account.get("username");

        Player player = null;
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (p.getUniqueId().toString().equals(uuid)) { player = p; break; }
        }

        if (player == null) {
            HttpHelper.json(ex, 400, Map.of("error", "player_offline",
                    "message", "Tu dois être connecté sur le serveur pour réinitialiser ton mot de passe."));
            return;
        }

        final Player fp = player;
        final String pin = pinService.generatePin(uuid, exactName);

        Bukkit.getScheduler().runTask(plugin, () ->
            fp.sendMessage(net.kyori.adventure.text.Component.text(
                "§8[§6SunAntiCheat§8] §7Portail : ton code de récupération est §e§l" + pin
                + " §7(valable 5 minutes)")));

        logger.info("[Portal] PIN récupération envoyé à " + exactName + " — IP " + ip);

        HttpHelper.json(ex, 200, Map.of(
            "uuid",       uuid,
            "expires_in", 300,
            "message",    "Code envoyé en jeu."
        ));
    }

    /** POST /api/public/register/reset */
    public void reset(HttpExchange ex) throws IOException {
        Map<String, String> body = parseBody(ex);
        if (body == null) { HttpHelper.error(ex, 400, "Corps JSON requis"); return; }

        String uuid     = body.get("uuid");
        String pin      = body.get("pin");
        String password = body.get("password");

        if (uuid == null || pin == null || password == null) {
            HttpHelper.error(ex, 400, "uuid, pin et password sont requis");
            return;
        }

        if (password.length() < 6) {
            HttpHelper.error(ex, 400, "Le code PIN doit faire au moins 6 chiffres");
            return;
        }

        if (!accountStore.isRegistered(uuid)) {
            HttpHelper.json(ex, 404, Map.of("error", "not_found", "message", "Compte introuvable."));
            return;
        }

        VerifyResult result = pinService.verifyPin(uuid, pin);
        switch (result) {
            case VerifyResult.Expired()     -> { HttpHelper.json(ex, 400, Map.of("error", "pin_expired",  "message", "Code expiré. Redemande un nouveau code.")); return; }
            case VerifyResult.MaxAttempts() -> { HttpHelper.json(ex, 400, Map.of("error", "max_attempts", "message", "Trop de tentatives incorrectes.")); return; }
            case VerifyResult.Invalid(int left) -> {
                HttpHelper.json(ex, 401, Map.of("error", "invalid_pin", "attempts_left", left,
                        "message", "Code incorrect. " + left + " tentative(s) restante(s).")); return;
            }
            case VerifyResult.Ok(String username) -> {
                String hash = BCrypt.withDefaults().hashToString(12, password.toCharArray());
                accountStore.updatePassword(uuid, hash);
                accountStore.setMustResetPassword(uuid, false);
                accountStore.resetFailedLogin(uuid);
                String token = playerJwt.generate(uuid, username, "PLAYER");
                logger.info("[Portal] Mot de passe réinitialisé : " + username + " (" + uuid + ")");
                HttpHelper.json(ex, 200, Map.of(
                    "token",    token,
                    "uuid",     uuid,
                    "username", username,
                    "role",     "PLAYER",
                    "message",  "Mot de passe réinitialisé avec succès."
                ));
            }
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, String> parseBody(HttpExchange ex) throws IOException {
        try {
            String raw = HttpHelper.body(ex);
            if (raw == null || raw.isBlank()) return null;
            return HttpHelper.GSON.fromJson(raw, new TypeToken<Map<String, String>>(){}.getType());
        } catch (Exception e) { return null; }
    }

    private static String ip(HttpExchange ex) {
        var addr = ex.getRemoteAddress();
        return addr != null ? addr.getAddress().getHostAddress() : "unknown";
    }
}
