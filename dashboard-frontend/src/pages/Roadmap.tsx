import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

type Column     = 'done' | 'hot' | 'long' | 'ideas' | 'tech'
type Tag        = 'J' | 'A' | 'B' | 'F' | 'D'
type Complexity = 'S' | 'M' | 'L' | 'XL'

interface Card {
  id: string; title: string; desc?: string
  tags: Tag[]; complexity?: Complexity; column: Column; category: string
}
interface CardMeta { notes?: string; dueDate?: string; assignee?: string }
interface Overrides {
  columnByCard: Record<string, Column>
  archived:     Record<string, true>
  meta:         Record<string, CardMeta>
}
interface FolderDef {
  id: string; icon: string; label: string; description: string; color: string; cards: Card[]
}

// ── Shared UI constants ───────────────────────────────────────────────────────

const COLUMNS: { id: Column; label: string; icon: string; color: string }[] = [
  { id: 'done',  label: 'Livré',            icon: '✅', color: '#10b981' },
  { id: 'hot',   label: 'Hot · prio haute', icon: '🔥', color: '#ef4444' },
  { id: 'long',  label: 'Long terme',       icon: '🟡', color: '#f59e0b' },
  { id: 'ideas', label: 'Idées',            icon: '💡', color: '#8b5cf6' },
  { id: 'tech',  label: 'Tech debt',        icon: '🛠️', color: '#64748b' },
]

const TAG_META: Record<Tag, { label: string; bg: string; color: string }> = {
  J: { label: 'Joueur',   bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  A: { label: 'Admin',    bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  B: { label: 'Backend',  bg: 'rgba(100,116,139,0.18)', color: '#94a3b8' },
  F: { label: 'Frontend', bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa' },
  D: { label: 'Data',     bg: 'rgba(16,185,129,0.15)',  color: '#34d399' },
}

const COMPLEX_META: Record<Complexity, { label: string; color: string }> = {
  S:  { label: 'S · 1 jour',   color: '#10b981' },
  M:  { label: 'M · 1 semaine',color: '#3b82f6' },
  L:  { label: 'L · sprint',   color: '#f59e0b' },
  XL: { label: 'XL · 1 mois+', color: '#ef4444' },
}

// ── Cards par dossier ─────────────────────────────────────────────────────────

const JOBS_CARDS: Card[] = [
  // DONE – Fondations
  { id: 'j-d-foundation', column: 'done', category: 'Fondations', title: 'Métiers custom multi-actions',
    desc: 'break/kill/fish/craft avec XP, niveau, argent, multiplicateurs', tags: ['B','D'] },
  { id: 'j-d-antifarm',   column: 'done', category: 'Fondations', title: 'Anti-farm cooldown par cible', tags: ['B'] },
  { id: 'j-d-db',         column: 'done', category: 'Fondations', title: 'Persistance SQLite/MariaDB + migrations versionnées (v1→v3)', tags: ['B','D'] },
  { id: 'j-d-lp',         column: 'done', category: 'Fondations', title: 'Intégration LuckPerms + Vault economy', tags: ['B'] },
  // DONE – Polish
  { id: 'j-d-bossbar',    column: 'done', category: 'Polish', title: 'BossBar XP temps réel', tags: ['J','F'] },
  { id: 'j-d-actionbar',  column: 'done', category: 'Polish', title: 'Action bar (gain XP/$, multiplier mondial, combo)', tags: ['J','F'] },
  { id: 'j-d-combo',      column: 'done', category: 'Polish', title: "Combos × jusqu'à 3.0 si actions <2.5s", tags: ['J','B'] },
  { id: 'j-d-fx',         column: 'done', category: 'Polish', title: 'Particles + sons par métier', tags: ['J'] },
  { id: 'j-d-titles',     column: 'done', category: 'Polish', title: 'Titres + taglines (Initié/Expert/Légende/MAÎTRE)', tags: ['J'] },
  { id: 'j-d-fireworks',  column: 'done', category: 'Polish', title: 'Firework + ENDER_DRAGON_GROWL aux paliers', tags: ['J'] },
  // DONE – Dynamiques
  { id: 'j-d-seasons',    column: 'done', category: 'Dynamiques', title: '4 Saisons avec multipliers par métier', tags: ['J','B'] },
  { id: 'j-d-weather',    column: 'done', category: 'Dynamiques', title: 'Météo (clear/rain/storm) + multipliers', tags: ['J','B'] },
  { id: 'j-d-time',       column: 'done', category: 'Dynamiques', title: 'Cycle jour/nuit + multipliers', tags: ['J','B'] },
  { id: 'j-d-heatmap',    column: 'done', category: 'Dynamiques', title: 'Heatmap par chunk + pénalité anti-surexploitation', tags: ['J','B'] },
  { id: 'j-d-bulletin',   column: 'done', category: 'Dynamiques', title: 'Bulletin quotidien (1 métier en demande × 1.5-2.0)', tags: ['J','B'] },
  { id: 'j-d-events',     column: 'done', category: 'Dynamiques', title: '5 World Events premier-servi',
    desc: 'golden_vein, forest_blessing, fishing_frenzy, monster_invasion, golden_harvest', tags: ['J','B'] },
  // DONE – Portail
  { id: 'j-d-career',       column: 'done', category: 'Portail', title: 'Page Carrière mobile-first (KPIs)', tags: ['J','F'] },
  { id: 'j-d-dynamicscard', column: 'done', category: 'Portail', title: 'Card "Monde dynamique" (saison + bulletin + events)', tags: ['J','F'] },
  { id: 'j-d-slots',        column: 'done', category: 'Portail', title: 'Slots banner X/N · rang LuckPerms', tags: ['J','F'] },
  { id: 'j-d-joinbtn',      column: 'done', category: 'Portail', title: 'Boutons Rejoindre/Quitter + toast feedback', tags: ['J','F'] },
  { id: 'j-d-jobdetail',    column: 'done', category: 'Portail', title: 'Fiche métier (timeline 14j, top 6 ressources, forecast)', tags: ['J','F'] },
  { id: 'j-d-personalheat', column: 'done', category: 'Portail', title: 'Heatmap perso (actions/semaine par métier)', tags: ['J','F'] },
  // DONE – Admin
  { id: 'j-d-rebornswitch',  column: 'done', category: 'Admin', title: 'Switch ON/OFF panel Jobs Reborn', tags: ['A','F'] },
  { id: 'j-d-customjobstab', column: 'done', category: 'Admin', title: 'Onglet Métiers Custom (cartes + leaderboard)', tags: ['A','F'] },
  { id: 'j-d-jobtoggle',     column: 'done', category: 'Admin', title: 'Toggle enable/disable PAR métier', tags: ['A','F'] },
  { id: 'j-d-slotseditor',   column: 'done', category: 'Admin', title: 'Éditeur Slots par rang LuckPerms (CRUD inline)', tags: ['A','F'] },
  { id: 'j-d-dynamicsTab',   column: 'done', category: 'Admin', title: 'Onglet Dynamiques (7 toggles sous-systèmes)', tags: ['A','F'] },
  { id: 'j-d-eventsTrig',    column: 'done', category: 'Admin', title: 'Force-trigger events + refresh bulletin + clear heatmap', tags: ['A','F'] },
  // DONE – Endgame
  { id: 'j-d-prestige',  column: 'done', category: 'Endgame', title: 'Prestige / Renaissance',
    desc: 'Reset niveau 100 → +1 étoile permanente, +3% XP/$ par étoile (max 5)', tags: ['J','B','D','F'], complexity: 'S' },
  { id: 'j-d-tickets',   column: 'done', category: 'Endgame', title: 'Job Tickets (3 types)',
    desc: 'extra_slot, xp_boost_25, bypass_heatmap · cache 30s · admin grant + révoquer', tags: ['J','A','B','D','F'], complexity: 'S' },
  { id: 'j-d-regulator', column: 'done', category: 'Endgame', title: 'Régulateur économique adaptatif',
    desc: "Scheduler horaire · multiplier 0.7-1.4× lissé · slider d'agressivité · freeze · sparklines 7j", tags: ['A','B','D','F'], complexity: 'M' },
  // HOT
  { id: 'j-h-mentor',  column: 'hot', category: 'Social', title: 'Mentor / Apprenti',
    desc: 'Vétéran lvl 50+ parraine débutant <15. +25% XP apprenti, mentor 10% XP en Tokens. 1 apprenti, lien 14j.', tags: ['J','B','D'], complexity: 'M' },
  { id: 'j-h-spec',    column: 'hot', category: 'Build', title: 'Spécialisations (Soul Stones)',
    desc: "Au lvl 50, branche exclusive (Mineur → Prospecteur/Foreur/Géologue). Reset payant 7j.", tags: ['J','B','F'], complexity: 'M' },
  { id: 'j-h-licence', column: 'hot', category: 'Économie', title: "Licences d'outils",
    desc: "Sink monétaire : expire tous les 5 000 actions. Renouvellement = 2-5% revenu mensuel.", tags: ['J','A','B'], complexity: 'S' },
  { id: 'j-h-gains',   column: 'hot', category: 'Admin', title: 'Listing gains par bloc/activité + multiplicateur global',
    desc: 'Table par action (XP base, $ base, $ effectif). Slider multiplicateur global 0.1×→5× par métier, persisté.', tags: ['A','F','B'], complexity: 'S' },
  // LONG TERME
  { id: 'j-l-contracts', column: 'long', category: 'Social', title: 'Contrats de Guilde coopératifs',
    desc: '3×/sem, 5-20 participants. Récompense pro-rata + bonus 100%. Webhook Discord optionnel.', tags: ['J','B','D','F'], complexity: 'L' },
  { id: 'j-l-codex',    column: 'long', category: 'Progression', title: 'Codex de Découvertes',
    desc: '6 paliers par ressource (1/10/100/1k/10k/100k). Chaque palier = perk micro-permanent.', tags: ['J','B','D','F'], complexity: 'L' },
  { id: 'j-l-market',   column: 'long', category: 'Économie', title: 'Marché offre/demande dynamique',
    desc: 'NPC Trader, prix endogène (moyenne mobile 24h). Stack ↑ → prix ↓ -40% max.', tags: ['J','A','B','D','F'], complexity: 'L' },
  { id: 'j-l-scenarios',column: 'long', category: 'Admin', title: 'Météo économique (scénarios)',
    desc: 'Editor admin scénarios 1-7j (ex: "Crise du blé": prix +200%, récolte -30%).', tags: ['A','B','F'], complexity: 'L' },
  { id: 'j-l-predict',  column: 'long', category: 'Admin', title: 'Heatmap prédictive admin',
    desc: 'Simulateur What-if "si je nerf X, où va le farm ?". Export CSV.', tags: ['A','B','F'], complexity: 'M' },
  { id: 'j-l-works',    column: 'long', category: 'Économie', title: 'Œuvres de Maîtrise',
    desc: 'Lvl 75/90/100 = recettes signées NBT crafted_by:player. Tracking public.', tags: ['J','B','D'], complexity: 'M' },
  // IDEAS
  { id: 'j-i-synergies',    column: 'ideas', category: 'Joueur', title: 'Synergies multi-métiers',
    desc: 'Mineur+Forgeron = +20% sur fer fondu. Encourage le multi-job.', tags: ['J','B'], complexity: 'M' },
  { id: 'j-i-tools',        column: 'ideas', category: 'Joueur', title: 'Outils craftables de métier',
    desc: 'Pioche du Mineur Niv 25 — bonus XP/$. Recipe unlocked at lvl X.', tags: ['J','B'], complexity: 'M' },
  { id: 'j-i-reputation',   column: 'ideas', category: 'Joueur', title: 'Réputation décroissante',
    desc: "Bonus drops si actif récent. Combat l'AFK, récompense la régularité.", tags: ['J','B','D'], complexity: 'M' },
  { id: 'j-i-mastery',      column: 'ideas', category: 'Joueur', title: 'Maîtrise par cible',
    desc: 'Diamond Mining 87/100 ≠ niveau global. Encourage diversité.', tags: ['J','B','D'], complexity: 'L' },
  { id: 'j-i-pets',         column: 'ideas', category: 'Joueur', title: 'Job Compagnons / pets',
    desc: 'Au lvl X, pet par job (Foreuse mécanique pour mineur).', tags: ['J','B'], complexity: 'L' },
  { id: 'j-i-quests',       column: 'ideas', category: 'Joueur', title: 'Quêtes journalières solo par métier',
    desc: 'Mine 64 stones today for 500 XP + 300$.', tags: ['J','B','D','F'], complexity: 'M' },
  { id: 'j-i-yamleditor',   column: 'ideas', category: 'Admin', title: 'Live editor de jobs.yml',
    desc: 'CRUD complet métier/action/reward depuis dashboard. Plus jamais de SSH.', tags: ['A','F','B'], complexity: 'L' },
  { id: 'j-i-audit',        column: 'ideas', category: 'Admin', title: 'Audit log par métier',
    desc: 'Qui join/leave/gain niveau, quand, par qui. Modération + debug.', tags: ['A','D'], complexity: 'S' },
  { id: 'j-i-canary',       column: 'ideas', category: 'Admin', title: 'Soft launch / canary',
    desc: 'Nouveau métier visible à un % de joueurs / un rang. Test avant rollout.', tags: ['A','B','F'], complexity: 'M' },
  { id: 'j-i-rewardstier',  column: 'ideas', category: 'Admin', title: 'Récompenses par palier de niveau',
    desc: 'Commande/item custom configurables à chaque milestone, avec preview.', tags: ['A','F'], complexity: 'M' },
  { id: 'j-i-discord',      column: 'ideas', category: 'Admin', title: 'Notifications push Discord',
    desc: 'Webhooks sur level milestones, événements, max-level.', tags: ['A','B'], complexity: 'S' },
  // TECH DEBT
  { id: 'j-t-fragmentkey',   column: 'tech', category: 'Frontend', title: 'React Fragment <> sans key',
    desc: 'Warning console dans la map des tabs (Jobs.tsx).', tags: ['F'], complexity: 'S' },
  { id: 'j-t-jdbcthread',    column: 'tech', category: 'Backend', title: 'JDBC thread-safety en async scheduler',
    desc: 'runTaskTimerAsynchronously touche Database.conn() — vérifier sous charge.', tags: ['B'], complexity: 'S' },
  { id: 'j-t-cacheinval',    column: 'tech', category: 'Backend', title: 'JobTicketService cache.clear() global au revoke',
    desc: "Grossier mais OK; affiner pour invalider que l'uuid concerné.", tags: ['B'], complexity: 'S' },
  { id: 'j-t-regulatormean', column: 'tech', category: 'Backend', title: 'Régulateur: mean = 1/N uniforme',
    desc: 'Pourrait être pondéré par "métier de demande" (bulletin) pour cohérence.', tags: ['B'], complexity: 'M' },
  { id: 'j-t-historyidx',    column: 'tech', category: 'Data', title: 'Index sur custom_job_history(timestamp)',
    desc: 'Queries timeline 30j peuvent ralentir sur grosse base.', tags: ['B','D'], complexity: 'S' },
]

const ECONOMY_CARDS: Card[] = [
  // DONE
  { id: 'eco-d-vault',      column: 'done', category: 'Core',       title: 'Vault economy integration', tags: ['B'] },
  { id: 'eco-d-shoptrack',  column: 'done', category: 'Admin',      title: 'Shop Tracking dashboard (graphiques + historique)', tags: ['A','F'] },
  { id: 'eco-d-shopseditor',column: 'done', category: 'Admin',      title: 'Shops editor CRUD (items, prix, permissions)', tags: ['A','F'] },
  { id: 'eco-d-vip',        column: 'done', category: 'Monétisation',title: 'VIP & Subscriptions panel', tags: ['A','F'] },
  // HOT
  { id: 'eco-h-market',     column: 'hot', category: 'Feature', title: 'Marché NPC offre/demande dynamique',
    desc: 'Prix endogène (moyenne mobile 24h). Stack ↑ → prix ↓ -40% max, recovery passif.', tags: ['J','A','B','D','F'], complexity: 'L' },
  { id: 'eco-h-scenarios',  column: 'hot', category: 'Admin', title: 'Scénarios météo économique',
    desc: 'Editor admin : scénario 1-7j (ex: "Crise du blé"). Multipliers par ressource, cap 3×/0.3×.', tags: ['A','B','F'], complexity: 'L' },
  // LONG
  { id: 'eco-l-auction',    column: 'long', category: 'Feature', title: 'Hôtel des ventes joueur-à-joueur',
    desc: "Listing d'items avec offre/achat immédiat. Commission 2-5%.", tags: ['J','B','F'], complexity: 'L' },
  // IDEAS
  { id: 'eco-i-tax',        column: 'ideas', category: 'Admin', title: 'Système de taxes configurable',
    desc: 'Taxe sur transactions, sink monétaire. Taux par rang ou type d\'échange.', tags: ['A','B'], complexity: 'M' },
  { id: 'eco-i-trading',    column: 'ideas', category: 'Feature', title: 'Contrats commerciaux joueur-à-joueur',
    desc: 'Offre signée : je donne X, tu donnes Y. Sécurisé + log.', tags: ['J','B'], complexity: 'M' },
  { id: 'eco-i-inflation',  column: 'ideas', category: 'Analytics', title: 'Graphique d\'inflation monétaire',
    desc: 'M2 serveur, vélocité, Gini coefficient. Dashboard lecture seule.', tags: ['A','D','F'], complexity: 'M' },
  // TECH
  { id: 'eco-t-retention',  column: 'tech', category: 'Data', title: 'Politique de rétention données économiques',
    desc: 'Archiver / purger transactions > 6 mois pour éviter la croissance infinie.', tags: ['B','D'], complexity: 'S' },
  { id: 'eco-t-race',       column: 'tech', category: 'Backend', title: 'Race condition sur solde Vault',
    desc: 'Double-dépense possible si deux threads retirent en parallèle sans SELECT FOR UPDATE.', tags: ['B'], complexity: 'M' },
]

const MODERATION_CARDS: Card[] = [
  // DONE
  { id: 'mod-d-sanctions', column: 'done', category: 'Core',       title: 'Sanctions legacy (ban/mute/kick/warn)', tags: ['A','F'] },
  { id: 'mod-d-modern',    column: 'done', category: 'Core',       title: 'Modération moderne (SanctionsModern)', tags: ['A','F'] },
  { id: 'mod-d-reports',   column: 'done', category: 'Core',       title: 'Système de reports joueurs', tags: ['A','F'] },
  { id: 'mod-d-toxic',     column: 'done', category: 'IA',         title: 'ToxicChat — détection IA temps réel', tags: ['A','B','F'] },
  { id: 'mod-d-honeypot',  column: 'done', category: 'Anti-cheat', title: 'Honeypot anti-cheat (blocs piège)', tags: ['A','B'] },
  { id: 'mod-d-panic',     column: 'done', category: 'Urgence',    title: 'Panic mode (lockdown serveur)', tags: ['A','F'] },
  // HOT
  { id: 'mod-h-appeal',    column: 'hot', category: 'Feature', title: 'Système de contestation (appeal)',
    desc: 'Joueur conteste une sanction via portail. Admin approuve/rejette avec motif.', tags: ['J','A','F','B'], complexity: 'M' },
  { id: 'mod-h-discord',   column: 'hot', category: 'Intégration', title: 'Webhook Discord sur sanctions',
    desc: 'Notification auto ban/unban/mute dans un channel modération Discord.', tags: ['A','B'], complexity: 'S' },
  // IDEAS
  { id: 'mod-i-banlist',   column: 'ideas', category: 'Multi-serveur', title: 'Shared ban list (multi-serveur)',
    desc: 'Base de données partagée des bans. Import/export compatible LiteBans.', tags: ['A','B'], complexity: 'L' },
  { id: 'mod-i-repScore',  column: 'ideas', category: 'Feature', title: 'Score de réputation automatique',
    desc: 'Historique sanctions + reports + ancienneté. Alerte si score bas.', tags: ['A','B','D'], complexity: 'L' },
  { id: 'mod-i-screenshot',column: 'ideas', category: 'Anti-cheat', title: 'Screenshot-on-flag',
    desc: 'Déclencher capture (ScreenMe plugin) sur détection suspecte. Stocké dans dashboard.', tags: ['A','B'], complexity: 'M' },
  { id: 'mod-i-watchlist', column: 'ideas', category: 'Admin', title: 'Watchlist & alertes temps réel',
    desc: 'Marquer un joueur en surveillance. Alerte panel dès connexion.', tags: ['A','F'], complexity: 'S' },
  // TECH
  { id: 'mod-t-migration', column: 'tech', category: 'Data', title: 'Migration sanctions legacy → moderne',
    desc: "Script de migration one-shot pour importer l'historique ancien.", tags: ['B','D'], complexity: 'M' },
  { id: 'mod-t-aimodel',   column: 'tech', category: 'IA', title: 'Cadence de mise à jour modèle ToxicChat',
    desc: 'Définir processus de ré-entraînement quand faux positifs augmentent.', tags: ['B'], complexity: 'S' },
]

const GAMEPLAY_CARDS: Card[] = [
  // DONE
  { id: 'gp-d-events',    column: 'done', category: 'Core',    title: 'Events system (admin triggers + calendrier)', tags: ['A','J','F'] },
  { id: 'gp-d-quests',    column: 'done', category: 'Core',    title: 'Engine de quêtes (objectifs, récompenses)', tags: ['A','J','F'] },
  { id: 'gp-d-games',     column: 'done', category: 'Core',    title: 'Framework mini-jeux', tags: ['A','J','F'] },
  { id: 'gp-d-crates',    column: 'done', category: 'Feature', title: 'Crates / Lootboxes editor + preview', tags: ['A','F'] },
  { id: 'gp-d-daily',     column: 'done', category: 'Feature', title: 'Daily Rewards (calendrier mensuel)', tags: ['J','F'] },
  { id: 'gp-d-announce',  column: 'done', category: 'Admin',   title: 'Annonces scheduler (rotation auto)', tags: ['A','F'] },
  // HOT
  { id: 'gp-h-season',    column: 'hot', category: 'Feature', title: 'Saison thématique synchronisée',
    desc: 'Events + quêtes + jobs coordonnés sur un même thème. Planning admin + page portail dédiée.', tags: ['J','A','B','F'], complexity: 'L' },
  { id: 'gp-h-battlepass',column: 'hot', category: 'Feature', title: 'Battle pass / Pass de progression',
    desc: 'Pass mensuel gratuit + premium. Paliers 1-50, récompenses cosmétiques + ingame.', tags: ['J','A','B','D','F'], complexity: 'L' },
  // IDEAS
  { id: 'gp-i-worldboss', column: 'ideas', category: 'Feature', title: 'World Boss event serveur-wide',
    desc: 'Boss custom invoqué par admin. Tous les joueurs contribuent. Récompense pro-rata des dégâts.', tags: ['J','B'], complexity: 'L' },
  { id: 'gp-i-pquests',   column: 'ideas', category: 'Feature', title: 'Quêtes créées par joueurs',
    desc: 'Poster une quête sur le tableau + récompense. Autre joueur complète et réclame.', tags: ['J','A','B'], complexity: 'XL' },
  { id: 'gp-i-leaderbd',  column: 'ideas', category: 'Feature', title: 'Classements publics (in-game + portail)',
    desc: 'Top joueurs par métier, kills, quêtes complétées. Hologrammes + page portail.', tags: ['J','F'], complexity: 'M' },
  { id: 'gp-i-achievements',column: 'ideas', category: 'Feature', title: 'Succès (Achievements)',
    desc: 'Système de succès persistants. Visible sur profil portail. Récompense unique.', tags: ['J','B','D','F'], complexity: 'M' },
  // TECH
  { id: 'gp-t-asyncrewards',column: 'tech', category: 'Backend', title: 'Quest engine: remise de récompenses async',
    desc: 'Les commandes de récompenses doivent tourner sur le thread principal Bukkit.', tags: ['B'], complexity: 'S' },
  { id: 'gp-t-recurrence', column: 'tech', category: 'Feature', title: 'Events: règles de récurrence avancées',
    desc: 'Actuellement: one-shot ou toutes-les-X-heures. Ajouter: RRULE (quotidien/hebdo/mensuel).', tags: ['B','F'], complexity: 'M' },
]

const TECH_CARDS: Card[] = [
  // DONE
  { id: 'tech-d-cicd',      column: 'done', category: 'DevOps',    title: 'GitHub Actions CI/CD — auto-release sémantique', tags: ['B'] },
  { id: 'tech-d-dashboard', column: 'done', category: 'Frontend',  title: 'Dashboard React (Vite + TailwindCSS + lazy loading)', tags: ['F'] },
  { id: 'tech-d-portal',    column: 'done', category: 'Frontend',  title: 'Portail joueur mobile-first (React)', tags: ['F'] },
  { id: 'tech-d-plugin',    column: 'done', category: 'Backend',   title: 'Plugin Paper 1.21.1 (Java 21, shadow JAR)', tags: ['B'] },
  { id: 'tech-d-db',        column: 'done', category: 'Backend',   title: 'Dual DB : SQLite (dev) + MariaDB (prod)', tags: ['B','D'] },
  { id: 'tech-d-jwt',       column: 'done', category: 'Sécurité',  title: 'JWT auth admin + JWT player (portail)', tags: ['B'] },
  { id: 'tech-d-2fa',       column: 'done', category: 'Sécurité',  title: '2FA TOTP admin (QR code + validation)', tags: ['A','B'] },
  { id: 'tech-d-audit',     column: 'done', category: 'Sécurité',  title: 'Audit log global (actions admin tracées)', tags: ['A','D'] },
  { id: 'tech-d-rbac',      column: 'done', category: 'Sécurité',  title: 'Système de permissions VIEWER/ADMIN (RBAC)', tags: ['A','B'] },
  // HOT
  { id: 'tech-h-multiserver',column: 'hot', category: 'Architecture', title: 'Support multi-serveur (BungeeCord / Velocity)',
    desc: 'Un seul dashboard pour un réseau. API centralisée, plugin bridge sur chaque serveur fils.', tags: ['B','D'], complexity: 'XL' },
  { id: 'tech-h-docker',    column: 'hot', category: 'DevOps', title: 'Docker image officielle (plugin + dashboard + portail)',
    desc: 'docker-compose avec Paper, dashboard, portail, MariaDB, nginx. One-liner pour démarrer.', tags: ['B'], complexity: 'M' },
  // IDEAS
  { id: 'tech-i-restapi',   column: 'ideas', category: 'Backend', title: 'API REST publique + documentation Swagger',
    desc: 'Exposer un subset d\'endpoints pour intégrations tierces (bots Discord, sites perso).', tags: ['B','F'], complexity: 'L' },
  { id: 'tech-i-monitoring',column: 'ideas', category: 'DevOps', title: 'Stack monitoring (Prometheus + Grafana)',
    desc: 'Métriques plugin : TPS, joueurs, erreurs, latence DB. Alertes sur seuils critiques.', tags: ['B'], complexity: 'M' },
  { id: 'tech-i-loadtest',  column: 'ideas', category: 'DevOps', title: 'Pipeline de load testing (Gatling)',
    desc: 'Tests charge sur l\'API dashboard avant chaque release. Intégré dans CI.', tags: ['B'], complexity: 'M' },
  { id: 'tech-i-e2e',       column: 'ideas', category: 'Frontend', title: 'Tests E2E frontend (Playwright)',
    desc: 'Smoke tests sur pages critiques (login, overview, jobs, sanctions) à chaque PR.', tags: ['F'], complexity: 'M' },
  // TECH DEBT
  { id: 'tech-t-paperapi',  column: 'tech', category: 'Backend',  title: 'Upgrade Paper API 1.22',
    desc: 'Quand 1.22 sort : vérifier breaking changes, migrer les event handlers dépréciés.', tags: ['B'], complexity: 'M' },
  { id: 'tech-t-bundle',    column: 'tech', category: 'Frontend', title: 'Audit taille bundle dashboard',
    desc: 'Analyser avec vite-bundle-analyzer. Objectif: <300KB gzip. Lazy loading déjà en place.', tags: ['F'], complexity: 'S' },
  { id: 'tech-t-jwtrotate', column: 'tech', category: 'Sécurité', title: 'Rotation automatique des clés JWT',
    desc: 'Clé JWT actuellement statique en config. Ajouter rotation planifiée + revocation list.', tags: ['B'], complexity: 'M' },
  { id: 'tech-t-dbpool',    column: 'tech', category: 'Backend',  title: 'Connection pool (HikariCP) pour MariaDB',
    desc: 'Actuellement une connexion globale. En prod multi-users, bottleneck probable.', tags: ['B'], complexity: 'M' },
]

const FOLDERS: FolderDef[] = [
  { id: 'jobs',       icon: '💼', color: '#3b82f6', label: 'Jobs',       cards: JOBS_CARDS,
    description: 'Métiers custom : XP, niveaux, dynamiques, portail, endgame, régulateur' },
  { id: 'economy',    icon: '💰', color: '#10b981', label: 'Économie',   cards: ECONOMY_CARDS,
    description: 'Vault, shops, marché dynamique, VIP, taxes, audit' },
  { id: 'moderation', icon: '🛡️', color: '#ef4444', label: 'Modération', cards: MODERATION_CARDS,
    description: 'Sanctions, anti-cheat, ToxicChat, Honeypot, Panic mode, appeals' },
  { id: 'gameplay',   icon: '🎮', color: '#f59e0b', label: 'Gameplay',   cards: GAMEPLAY_CARDS,
    description: 'Events, quêtes, mini-jeux, crates, daily rewards, battle pass' },
  { id: 'tech',       icon: '🔧', color: '#8b5cf6', label: 'Technique',  cards: TECH_CARDS,
    description: 'CI/CD, architecture, sécurité, monitoring, multi-serveur' },
]

// ── localStorage ──────────────────────────────────────────────────────────────

const EMPTY_OV: Overrides = { columnByCard: {}, archived: {}, meta: {} }

function loadOv(folderId: string): Overrides {
  try {
    const raw = localStorage.getItem(`roadmap.${folderId}.v1`)
    if (!raw) return EMPTY_OV
    const p = JSON.parse(raw)
    return { columnByCard: p.columnByCard ?? {}, archived: p.archived ?? {}, meta: p.meta ?? {} }
  } catch { return EMPTY_OV }
}
function saveOv(folderId: string, o: Overrides) {
  localStorage.setItem(`roadmap.${folderId}.v1`, JSON.stringify(o))
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
function pickJSONFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return reject('no_file')
      const reader = new FileReader()
      reader.onload  = () => { try { resolve(JSON.parse(String(reader.result))) } catch (e) { reject(e) } }
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    }
    input.click()
  })
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '?'
}
function dueChip(dueDate?: string): { label: string; color: string } | null {
  if (!dueDate) return null
  const due  = new Date(dueDate).getTime()
  if (isNaN(due)) return null
  const days = Math.ceil((due - Date.now()) / 86_400_000)
  if (days < 0)   return { label: `J+${-days}`,      color: '#ef4444' }
  if (days === 0) return { label: "Aujourd'hui",      color: '#f59e0b' }
  if (days <= 7)  return { label: `J-${days}`,        color: '#f59e0b' }
  return                  { label: `J-${days}`,        color: '#10b981' }
}

// ── Folder stats helper ───────────────────────────────────────────────────────

function folderStats(f: FolderDef) {
  const ov    = loadOv(f.id)
  const cards = f.cards
    .map(c => ({ ...c, column: ov.columnByCard[c.id] ?? c.column }))
    .filter(c => !ov.archived[c.id])
  const done  = cards.filter(c => c.column === 'done').length
  const hot   = cards.filter(c => c.column === 'hot').length
  const ideas = cards.filter(c => c.column === 'ideas').length
  const tech  = cards.filter(c => c.column === 'tech').length
  const total = cards.length
  return { done, hot, ideas, tech, total, pct: total > 0 ? Math.round(done / total * 100) : 0 }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Roadmap() {
  const [params, setParams] = useSearchParams()
  const folderId = params.get('folder')
  const folder   = FOLDERS.find(f => f.id === folderId) ?? null

  if (folder) {
    return <KanbanView folder={folder} onBack={() => setParams({})} />
  }
  return <FolderList onOpen={id => setParams({ folder: id })} />
}

// ── FolderList ────────────────────────────────────────────────────────────────

function FolderList({ onOpen }: { onOpen: (id: string) => void }) {
  const stats = FOLDERS.map(f => ({ folder: f, ...folderStats(f) }))
  const globalDone  = stats.reduce((s, x) => s + x.done,  0)
  const globalTotal = stats.reduce((s, x) => s + x.total, 0)
  const globalPct   = globalTotal > 0 ? Math.round(globalDone / globalTotal * 100) : 0

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>📍 Roadmap</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Suivi des features par domaine · cliquez un dossier pour ouvrir le Kanban
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black" style={{ color: 'var(--primary)' }}>{globalPct}%</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{globalDone} / {globalTotal} cartes livrées</div>
        </div>
      </div>

      {/* Global progress bar */}
      <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${globalPct}%`, background: 'var(--primary)' }} />
      </div>

      {/* Folder grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(({ folder, done, hot, ideas, tech, total, pct }) => (
          <button key={folder.id}
                  onClick={() => onOpen(folder.id)}
                  className="text-left rounded-xl p-5 transition hover:shadow-xl active:scale-[0.98]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${folder.color}` }}>

            <div className="flex items-start gap-3 mb-4">
              <span className="text-3xl leading-none mt-0.5">{folder.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base" style={{ color: 'var(--text)' }}>{folder.label}</div>
                <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {folder.description}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full mb-3" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: folder.color }} />
            </div>

            {/* Stat chips */}
            <div className="flex items-center gap-3 text-xs">
              <span style={{ color: '#10b981' }}>✅ {done}</span>
              {hot > 0   && <span style={{ color: '#ef4444' }}>🔥 {hot}</span>}
              {ideas > 0 && <span style={{ color: '#8b5cf6' }}>💡 {ideas}</span>}
              {tech > 0  && <span style={{ color: '#64748b' }}>🛠 {tech}</span>}
              <span className="ml-auto font-semibold" style={{ color: 'var(--text-muted)' }}>
                {pct}% · {total} cartes
              </span>
            </div>

            <div className="mt-3 text-xs font-medium" style={{ color: folder.color }}>
              Ouvrir →
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── KanbanView ────────────────────────────────────────────────────────────────

function KanbanView({ folder, onBack }: { folder: FolderDef; onBack: () => void }) {
  const [overrides, setOverrides] = useState<Overrides>(() => loadOv(folder.id))
  const [filterTag, setFilterTag] = useState<Tag | null>(null)
  const [search, setSearch]       = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => { saveOv(folder.id, overrides) }, [folder.id, overrides])

  const visibleCards = useMemo(() => {
    const q = search.trim().toLowerCase()
    return folder.cards
      .map(c => ({ ...c, column: overrides.columnByCard[c.id] ?? c.column }))
      .filter(c => showArchived ? overrides.archived[c.id] : !overrides.archived[c.id])
      .filter(c => !filterTag || c.tags.includes(filterTag))
      .filter(c => !q || c.title.toLowerCase().includes(q) || (c.desc?.toLowerCase().includes(q)) || c.category.toLowerCase().includes(q))
  }, [folder.cards, overrides, filterTag, search, showArchived])

  const totalDone  = folder.cards.filter(c => (overrides.columnByCard[c.id] ?? c.column) === 'done' && !overrides.archived[c.id]).length
  const totalCards = folder.cards.filter(c => !overrides.archived[c.id]).length
  const completion = totalCards > 0 ? Math.round(totalDone / totalCards * 100) : 0

  const moveCard = (id: string, col: Column) =>
    setOverrides(o => ({ ...o, columnByCard: { ...o.columnByCard, [id]: col } }))

  const archiveCard = (id: string) =>
    setOverrides(o => ({ ...o, archived: { ...o.archived, [id]: true } }))

  const restoreCard = (id: string) => {
    const next = { ...overrides.archived }; delete next[id]
    setOverrides({ ...overrides, archived: next })
  }

  const updateMeta = (id: string, patch: Partial<CardMeta>) => {
    setOverrides(o => {
      const merged: CardMeta = { ...(o.meta[id] ?? {}), ...patch }
      const clean: CardMeta  = {}
      if (merged.notes?.trim())    clean.notes    = merged.notes.trim()
      if (merged.dueDate)          clean.dueDate  = merged.dueDate
      if (merged.assignee?.trim()) clean.assignee = merged.assignee.trim()
      const nextMeta = { ...o.meta }
      if (Object.keys(clean).length === 0) delete nextMeta[id]
      else nextMeta[id] = clean
      return { ...o, meta: nextMeta }
    })
  }

  const resetAll = () => {
    if (!confirm(`Réinitialiser tout le dossier "${folder.label}" ?`)) return
    setOverrides(EMPTY_OV)
  }

  const exportJSON = () =>
    downloadJSON(`roadmap-${folder.id}-${new Date().toISOString().slice(0, 10)}.json`, {
      version: 1, folder: folder.id, exported_at: Date.now(), overrides,
    })

  const importJSON = async () => {
    try {
      const data = await pickJSONFile() as any
      if (!data?.overrides) { alert('Fichier invalide : champ "overrides" manquant'); return }
      if (!confirm('Importer ce fichier ? Tes overrides actuels seront remplacés.')) return
      setOverrides({
        columnByCard: data.overrides.columnByCard ?? {},
        archived:     data.overrides.archived     ?? {},
        meta:         data.overrides.meta         ?? {},
      })
    } catch (e) { alert('Erreur import : ' + e) }
  }

  return (
    <div className="p-6 space-y-4 max-w-[1800px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <button onClick={onBack} className="hover:underline">← Roadmap</button>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ color: folder.color }}>{folder.icon} {folder.label}</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {folder.icon} {folder.label}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {folder.description} · drag & drop · persisté localement
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-2 rounded text-sm"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <span className="font-bold" style={{ color: '#10b981' }}>{totalDone}</span>
            <span style={{ color: 'var(--text-muted)' }}> / {totalCards}</span>
            <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>({completion}%)</span>
          </div>
          {(['archived', 'export', 'import', 'reset'] as const).map(action => (
            <button key={action}
                    onClick={action === 'archived' ? () => setShowArchived(!showArchived)
                           : action === 'export'   ? exportJSON
                           : action === 'import'   ? importJSON
                           : resetAll}
                    className="px-3 py-2 rounded text-xs"
                    style={{
                      background: (action === 'archived' && showArchived) ? 'var(--primary)' : 'var(--surface)',
                      color:      (action === 'archived' && showArchived) ? 'white' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}>
              {action === 'archived' ? (showArchived ? '👁 Archivées' : 'Voir archivées')
             : action === 'export'   ? '⬇ Export'
             : action === 'import'   ? '⬆ Import'
             : '↺ Reset'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input type="text" placeholder="🔍 Rechercher…" value={search}
               onChange={e => setSearch(e.target.value)}
               className="px-3 py-2 rounded text-sm flex-1 min-w-[200px] max-w-[300px]"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <div className="flex gap-1 flex-wrap">
          <FilterChip active={filterTag === null} onClick={() => setFilterTag(null)}
                      bg="rgba(99,102,241,0.15)" color="var(--primary)">Tous</FilterChip>
          {(Object.keys(TAG_META) as Tag[]).map(t => (
            <FilterChip key={t} active={filterTag === t}
                        onClick={() => setFilterTag(filterTag === t ? null : t)}
                        bg={TAG_META[t].bg} color={TAG_META[t].color}>
              {TAG_META[t].label}
            </FilterChip>
          ))}
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {visibleCards.length} carte{visibleCards.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-5 gap-3">
        {COLUMNS.map(col => {
          const colCards = visibleCards.filter(c => c.column === col.id)
          return (
            <div key={col.id}
                 onDragOver={e => e.preventDefault()}
                 onDrop={() => { if (draggedId) { moveCard(draggedId, col.id); setDraggedId(null) } }}
                 className="rounded-xl flex flex-col"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 'calc(100vh - 280px)' }}>
              <div className="px-3 py-2.5 flex items-center justify-between border-b sticky top-0 z-10"
                   style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <h3 className="font-bold text-sm flex items-center gap-1.5" style={{ color: col.color }}>
                  {col.icon} {col.label}
                </h3>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {colCards.length}
                </span>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {colCards.length === 0
                  ? <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>
                      {showArchived ? 'Aucune archive' : 'Vide'}
                    </div>
                  : colCards.map(c => (
                      <CardView key={c.id} card={c}
                                meta={overrides.meta[c.id]}
                                archived={!!overrides.archived[c.id]}
                                onDragStart={() => setDraggedId(c.id)}
                                onDragEnd={() => setDraggedId(null)}
                                onArchive={() => showArchived ? restoreCard(c.id) : archiveCard(c.id)}
                                onUpdateMeta={p => updateMeta(c.id, p)} />
                    ))
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── FilterChip ────────────────────────────────────────────────────────────────

function FilterChip({ children, active, onClick, bg, color }: {
  children: React.ReactNode; active: boolean; onClick: () => void; bg: string; color: string
}) {
  return (
    <button onClick={onClick}
            className="px-2.5 py-1.5 rounded text-xs font-medium transition"
            style={{
              background: active ? bg : 'var(--surface)',
              color:      active ? color : 'var(--text-muted)',
              border:    `1px solid ${active ? color : 'var(--border)'}`,
              opacity:    active ? 1 : 0.7,
            }}>
      {children}
    </button>
  )
}

// ── CardView ──────────────────────────────────────────────────────────────────

function CardView({ card, meta, archived, onDragStart, onDragEnd, onArchive, onUpdateMeta }: {
  card: Card; meta?: CardMeta; archived: boolean
  onDragStart: () => void; onDragEnd: () => void; onArchive: () => void
  onUpdateMeta: (patch: Partial<CardMeta>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const due    = dueChip(meta?.dueDate)
  const hasMeta = !!(meta?.notes || meta?.dueDate || meta?.assignee)

  return (
    <div draggable={!editing}
         onDragStart={onDragStart}
         onDragEnd={onDragEnd}
         className="rounded-lg p-2.5 transition hover:shadow-lg"
         style={{
           background: 'var(--surface-2)',
           border: `1px solid ${editing ? 'var(--primary)' : 'var(--border)'}`,
           opacity: archived ? 0.6 : 1,
           cursor: editing ? 'auto' : 'grab',
         }}>

      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold leading-snug flex-1 cursor-pointer"
           style={{ color: 'var(--text)' }}
           onClick={() => card.desc && setExpanded(!expanded)}>
          {card.title}
          {card.desc && (
            <span className="ml-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </p>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={e => { e.stopPropagation(); setEditing(!editing); setExpanded(true) }}
                  title="Notes / date / assignation"
                  className="text-[10px] leading-none p-0.5"
                  style={{ color: editing ? 'var(--primary)' : hasMeta ? '#f59e0b' : 'var(--text-muted)' }}>
            {hasMeta ? '✎●' : '✎'}
          </button>
          <button onClick={e => { e.stopPropagation(); onArchive() }}
                  title={archived ? 'Restaurer' : 'Archiver'}
                  className="text-xs leading-none p-0.5"
                  style={{ color: 'var(--text-muted)' }}>
            {archived ? '↩' : '✕'}
          </button>
        </div>
      </div>

      {expanded && card.desc && (
        <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {card.desc}
        </p>
      )}

      {!editing && hasMeta && (
        <div className="mt-2 space-y-1">
          {meta?.notes && (
            <p className="text-[10px] leading-snug px-2 py-1 rounded"
               style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', borderLeft: '2px solid #f59e0b' }}>
              📝 {meta.notes}
            </p>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            {due && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                    style={{ background: `${due.color}20`, color: due.color, border: `1px solid ${due.color}40` }}>
                ⏱ {due.label}
              </span>
            )}
            {meta?.assignee && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1"
                    style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary)' }}>
                <span className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[8px] font-black"
                      style={{ background: 'var(--primary)', color: 'white' }}>
                  {initials(meta.assignee)}
                </span>
                {meta.assignee}
              </span>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-2 space-y-1.5" onClick={e => e.stopPropagation()}>
          <textarea placeholder="Notes…" defaultValue={meta?.notes ?? ''}
                    onBlur={e => onUpdateMeta({ notes: e.target.value })}
                    rows={2}
                    className="w-full text-[10px] px-2 py-1 rounded resize-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <div className="grid grid-cols-2 gap-1">
            <input type="date" defaultValue={meta?.dueDate ?? ''}
                   onBlur={e => onUpdateMeta({ dueDate: e.target.value || undefined })}
                   className="text-[10px] px-2 py-1 rounded"
                   style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <input type="text" placeholder="Assigné à…" defaultValue={meta?.assignee ?? ''}
                   onBlur={e => onUpdateMeta({ assignee: e.target.value })}
                   className="text-[10px] px-2 py-1 rounded"
                   style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
          <button onClick={() => setEditing(false)}
                  className="w-full text-[10px] py-1 rounded"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            Fermer
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-muted)' }}>
          {card.category}
        </span>
        {card.tags.map(t => (
          <span key={t} title={TAG_META[t].label}
                className="text-[9px] w-4 h-4 rounded inline-flex items-center justify-center font-bold"
                style={{ background: TAG_META[t].bg, color: TAG_META[t].color }}>
            {t}
          </span>
        ))}
        {card.complexity && (
          <span title={COMPLEX_META[card.complexity].label}
                className="text-[9px] px-1.5 py-0.5 rounded font-bold ml-auto"
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  color: COMPLEX_META[card.complexity].color,
                  border: `1px solid ${COMPLEX_META[card.complexity].color}40`,
                }}>
            {card.complexity}
          </span>
        )}
      </div>
    </div>
  )
}
