package sunanticheat.dashboard.handlers;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.google.gson.reflect.TypeToken;
import com.sun.net.httpserver.HttpExchange;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import sunanticheat.dashboard.HttpHelper;
import sunanticheat.dashboard.portal.PlayerAccountStore;
import sunanticheat.dashboard.portal.PlayerJwtUtil;
import sunanticheat.dashboard.portal.RegisterPinService;
import sunanticheat.dashboard.portal.RegisterPinService.VerifyResult;
import sunanticheat.dashboard.quests.Quest;
import sunanticheat.dashboard.quests.QuestStore;
import sunanticheat.dashboard.social.ReferralStore;

import java.io.IOException;
import java.util.Map;
import java.util.logging.Logger;

public final class PublicRegisterHandler {

    private final PlayerAccountStore accountStore;
    private final RegisterPinService pinService;
    private final PlayerJwtUtil playerJwt;
    private final Plugin plugin;
    private final Logger logger;
    private final ReferralStore referralStore;
    private final QuestStore questStore;

    public PublicRegisterHandler(PlayerAccountStore accountStore, RegisterPinService pinService,
                                  PlayerJwtUtil playerJwt, Plugin plugin, Logger logger,
                                  ReferralStore referralStore, QuestStore questStore) {
        this.accountStore  = accountStore;
        this.pinService    = pinService;
        this.playerJwt     = playerJwt;
        this.plugin        = plugin;
        this.logger        = logger;
        this.referralStore = referralStore;
        this.questStore    = questStore;
    }

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

    /** POST /api/public/register/login */
    public void login(HttpExchange ex) throws IOException {
        Map<String, String> body = parseBody(ex);
        if (body == null) { HttpHelper.error(ex, 400, "Corps JSON requis"); return; }

        String username = body.get("username");
        String password = body.get("password");

        if (username == null || password == null) {
            HttpHelper.error(ex, 400, "username et password sont requis");
            return;
        }

        Map<String, Object> account = accountStore.getByUsername(username);
        if (account == null) {
            HttpHelper.error(ex, 401, "Pseudo ou mot de passe incorrect");
            return;
        }

        BCrypt.Result bcResult = BCrypt.verifyer()
                .verify(password.toCharArray(), (String) account.get("password_hash"));
        if (!bcResult.verified) {
            HttpHelper.error(ex, 401, "Pseudo ou mot de passe incorrect");
            return;
        }

        String uuid = (String) account.get("uuid");
        String role = (String) account.get("role");
        accountStore.updateLastLogin(uuid);
        String token = playerJwt.generate(uuid, username, role);

        // Validation du parrainage si le compte a plus de 24h
        String referrerUuid = referralStore.validateIfReady(uuid);
        if (referrerUuid != null) {
            int count = referralStore.getValidatedCount(referrerUuid);
            questStore.checkSocialQuest(referrerUuid, Quest.Type.REFERRAL_COUNT, count);
            logger.info("[Portal] Parrainage validé : " + username + " → parrain " + referrerUuid + " (" + count + " filleul(s))");
        }

        HttpHelper.json(ex, 200, Map.of(
            "token",    token,
            "uuid",     uuid,
            "username", account.get("username"),
            "role",     role
        ));
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
