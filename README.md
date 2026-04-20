# SunAntiCheat (SunGuard)

Plugin anticheat pour serveurs Minecraft 1.21+ (Paper recommandé).

## Fonctionnalités

- **Anti X-Ray** — Détection par statistiques de minage (% précieux, ratio diamant/pierre), logs journaliers, rapport Discord quotidien.
- **Anti Freecam** — Détection des actions (cassage/interaction) hors champ de vision ou portée.
- **Anti Kill Aura** — Portée, angle, ligne de visée, CPS (coups par seconde).
- **Infos client** — Marque client (vanilla/forge/fabric), premium/crack, mods et packs (si envoyés par un mod client).
- **Alertes staff** — Messages en jeu [TP] [Sanctions] + Discord + log fichier + commande optionnelle après alerte.
- **Sanctions** — Menu kick, ban, mute, freeze, etc. et historique.
- **Block log** — Historique des blocs cassés/placés, mode inspection, rollback.
- **Temps de jeu** — Commande et placeholders PlaceholderAPI.
- **Bypass** — Permissions pour exclure staff/joueurs de confiance des contrôles.

## Commandes

| Commande | Description |
|----------|-------------|
| `/sunguard` | Menu principal |
| `/sunguard reload` | Recharger la config |
| `/sunguard blocklog` | Mode inspection blocs (clic droit = log du bloc) |
| `/sunguard sanction [joueur]` | Menu sanctions |
| `/sunguard reports` | Liste des signalements |
| `/sunguard rollback <joueur> [rayon] [min]` | Rollback des blocs |
| `/xray` | Menu anti X-Ray |
| `/xray reset <joueur...>` | Réinitialiser les scores X-Ray |
| `/sunplaytime [joueur]` | Temps de jeu |
| `/report <joueur> <raison>` | Signaler un joueur |

## Permissions principales

- `sunguard.menu` — Ouvrir le menu
- `sunguard.reload` — Recharger la config
- `sunguard.alerts` — Recevoir les alertes [TP] [Sanctions]
- `sunguard.bypass.xray` — Exclu des contrôles X-Ray
- `sunguard.bypass.freecam` — Exclu des contrôles Freecam
- `sunguard.bypass.killaura` — Exclu des contrôles Kill Aura
- `sunguard.xray.gui`, `sunguard.xray.reset`, `sunguard.freecam.gui`, `sunguard.client.gui`, `sunguard.sanction.gui`, `sunguard.playerdata.gui`, `sunguard.blocklog.check`, `sunguard.blocklog.rollback`, `sunguard.report`, `sunguard.report.view`, `sunguard.debug`, `sunguard.playtime`, `sunguard.playtime.others`

(Voir `plugin.yml` pour la liste complète et les valeurs par défaut.)

## Configuration

Fichier `plugins/SunAntiCheat/config.yml` après premier lancement.

- **xray** — Seuils minage, indice composite
- **xray-log** — Sauvegarde et rétention des logs
- **killaura** — Portée max, angle, CPS max, annuler les coups suspects
- **freecam** — Portée, cône de vision, annuler les actions
- **alerts** — Activer/désactiver par type, cooldown, `run-command` (ex: `kick %player%`)
- **violation-log** — Fichier d’audit des alertes (`violations.log`)
- **discord** — Webhook, rapport X-Ray quotidien

## PlaceholderAPI

Préfixe `%sunanticheat_...%`. Exemples : `playtime`, `playtime_seconds`, `xray_total`, `xray_suspect`, `freecam_suspicion_percent`, `client_brand`. Pour un autre joueur : `%sunanticheat_xray_total_Steve%`.

**Podium playtime** : `topplaytime_1`, `topplaytime_2`, … (nom) | `topplaytime_name_1`, `topplaytime_playtime_1`, `topplaytime_seconds_1`.

## Build

```bash
./gradlew jar
```

JAR généré : `build/libs/SunAntiCheat-1.0.0.jar`
