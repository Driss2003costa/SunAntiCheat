import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * Kanban roadmap pour le système de métiers.
 *
 * - 4 colonnes : Done / Hot / Long-term / Ideas
 * - Cartes embarquées dans le code (source de vérité = ce fichier)
 * - Drag & drop natif HTML5, pas de dépendance
 * - Surcharges utilisateur (déplacement, couleur, archivé) persistées en
 *   localStorage sous la clé "jobs.roadmap.v1"
 * - Filtres par label (Joueur/Admin/Backend/Frontend) + recherche
 */

type Column = 'done' | 'hot' | 'long' | 'ideas' | 'tech'
type Tag    = 'J' | 'A' | 'B' | 'F' | 'D'
type Complexity = 'S' | 'M' | 'L' | 'XL'

interface Card {
  id: string
  title: string
  desc?: string
  tags: Tag[]
  complexity?: Complexity
  column: Column
  category: string
}

const COLUMNS: { id: Column; label: string; icon: string; color: string }[] = [
  { id: 'done',  label: 'Livré',           icon: '✅', color: '#10b981' },
  { id: 'hot',   label: 'Hot · prio haute', icon: '🔥', color: '#ef4444' },
  { id: 'long',  label: 'Long terme',      icon: '🟡', color: '#f59e0b' },
  { id: 'ideas', label: 'Idées',           icon: '💡', color: '#8b5cf6' },
  { id: 'tech',  label: 'Tech debt',       icon: '🛠️', color: '#64748b' },
]

const TAG_META: Record<Tag, { label: string; bg: string; color: string }> = {
  J: { label: 'Joueur',   bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  A: { label: 'Admin',    bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  B: { label: 'Backend',  bg: 'rgba(100,116,139,0.18)', color: '#94a3b8' },
  F: { label: 'Frontend', bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa' },
  D: { label: 'Data',     bg: 'rgba(16,185,129,0.15)',  color: '#34d399' },
}

const COMPLEX_META: Record<Complexity, { label: string; color: string }> = {
  S:  { label: 'S · 1 jour',    color: '#10b981' },
  M:  { label: 'M · 1 semaine', color: '#3b82f6' },
  L:  { label: 'L · sprint',    color: '#f59e0b' },
  XL: { label: 'XL · 1 mois+',  color: '#ef4444' },
}

// ── Source de vérité : toutes les cartes ────────────────────────────────────

const CARDS: Card[] = [
  // ─── DONE ────────────────────────────────────────────────────────────────
  // Fondations
  { id: 'd-foundation',  column: 'done', category: 'Fondations',  title: 'Métiers custom multi-actions',
    desc: 'break/kill/fish/craft avec XP, niveau, argent, multiplicateurs',
    tags: ['B','D'] },
  { id: 'd-antifarm',    column: 'done', category: 'Fondations',  title: 'Anti-farm cooldown par cible',
    tags: ['B'] },
  { id: 'd-db',          column: 'done', category: 'Fondations',  title: 'Persistance SQLite/MariaDB + migrations versionnées (v1→v3)',
    tags: ['B','D'] },
  { id: 'd-lp',          column: 'done', category: 'Fondations',  title: 'Intégration LuckPerms + Vault economy',
    tags: ['B'] },

  // Polish
  { id: 'd-bossbar',     column: 'done', category: 'Polish',      title: 'BossBar XP temps réel',  tags: ['J','F'] },
  { id: 'd-actionbar',   column: 'done', category: 'Polish',      title: 'Action bar (gain XP/$, multiplier mondial, combo)', tags: ['J','F'] },
  { id: 'd-combo',       column: 'done', category: 'Polish',      title: 'Combos × jusqu\'à 3.0 si actions <2.5s', tags: ['J','B'] },
  { id: 'd-fx',          column: 'done', category: 'Polish',      title: 'Particles + sons par métier', tags: ['J'] },
  { id: 'd-titles',      column: 'done', category: 'Polish',      title: 'Titres + taglines (Initié/Expert/Légende/MAÎTRE)', tags: ['J'] },
  { id: 'd-fireworks',   column: 'done', category: 'Polish',      title: 'Firework + ENDER_DRAGON_GROWL aux paliers', tags: ['J'] },

  // Dynamiques
  { id: 'd-seasons',     column: 'done', category: 'Dynamiques',  title: '4 Saisons avec multipliers par métier', tags: ['J','B'] },
  { id: 'd-weather',     column: 'done', category: 'Dynamiques',  title: 'Météo (clear/rain/storm) + multipliers', tags: ['J','B'] },
  { id: 'd-time',        column: 'done', category: 'Dynamiques',  title: 'Cycle jour/nuit + multipliers', tags: ['J','B'] },
  { id: 'd-heatmap',     column: 'done', category: 'Dynamiques',  title: 'Heatmap par chunk + pénalité anti-surexploitation', tags: ['J','B'] },
  { id: 'd-bulletin',    column: 'done', category: 'Dynamiques',  title: 'Bulletin quotidien (1 métier en demande × 1.5-2.0)', tags: ['J','B'] },
  { id: 'd-events',      column: 'done', category: 'Dynamiques',  title: '5 World Events premier-servi',
    desc: 'golden_vein, forest_blessing, fishing_frenzy, monster_invasion, golden_harvest', tags: ['J','B'] },

  // Portail
  { id: 'd-career',      column: 'done', category: 'Portail',     title: 'Page Carrière mobile-first (KPIs)', tags: ['J','F'] },
  { id: 'd-dynamicscard',column: 'done', category: 'Portail',     title: 'Card "Monde dynamique" (saison + bulletin + events)', tags: ['J','F'] },
  { id: 'd-slots',       column: 'done', category: 'Portail',     title: 'Slots banner X/N · rang LuckPerms', tags: ['J','F'] },
  { id: 'd-joinbtn',     column: 'done', category: 'Portail',     title: 'Boutons Rejoindre/Quitter + toast feedback', tags: ['J','F'] },
  { id: 'd-jobdetail',   column: 'done', category: 'Portail',     title: 'Fiche métier détaillée (timeline 14j, top 6 ressources, forecast)', tags: ['J','F'] },
  { id: 'd-personalheat',column: 'done', category: 'Portail',     title: 'Heatmap perso (actions/semaine par métier)', tags: ['J','F'] },

  // Admin
  { id: 'd-rebornswitch',column: 'done', category: 'Admin',       title: 'Switch ON/OFF panel Jobs Reborn', tags: ['A','F'] },
  { id: 'd-customjobstab',column:'done', category: 'Admin',       title: 'Onglet Métiers Custom (cartes + leaderboard)', tags: ['A','F'] },
  { id: 'd-jobtoggle',   column: 'done', category: 'Admin',       title: 'Toggle enable/disable PAR métier', tags: ['A','F'] },
  { id: 'd-slotseditor', column: 'done', category: 'Admin',       title: 'Éditeur Slots par rang LuckPerms (CRUD inline)', tags: ['A','F'] },
  { id: 'd-dynamicsTab', column: 'done', category: 'Admin',       title: 'Onglet Dynamiques (7 toggles sous-systèmes)', tags: ['A','F'] },
  { id: 'd-eventsTrig',  column: 'done', category: 'Admin',       title: 'Force-trigger events + refresh bulletin + clear heatmap + reload', tags: ['A','F'] },

  // Endgame
  { id: 'd-prestige',    column: 'done', category: 'Endgame',     title: '#7 Prestige (Renaissance)',
    desc: 'Reset niveau 100 → +1 étoile permanente, +3% XP/$ par étoile (max 5)', tags: ['J','B','D','F'], complexity: 'S' },
  { id: 'd-tickets',     column: 'done', category: 'Endgame',     title: '#11 Job Tickets (3 types)',
    desc: 'extra_slot, xp_boost_25, bypass_heatmap · cache 30s · onglet admin avec grant + révoquer', tags: ['J','A','B','D','F'], complexity: 'S' },
  { id: 'd-regulator',   column: 'done', category: 'Endgame',     title: '#4 Régulateur économique adaptatif',
    desc: 'Scheduler horaire · multiplier 0.7-1.4× lissé · slider d\'agressivité · freeze par métier · sparklines 7j', tags: ['A','B','D','F'], complexity: 'M' },

  // ─── HOT BACKLOG ─────────────────────────────────────────────────────────
  { id: 'h-mentor', column: 'hot', category: 'Social', title: '#1 Mentor / Apprenti',
    desc: 'Vétéran lvl 50+ parraine débutant <15. Apprenti +25% XP, mentor 10% du XP en Tokens de Maîtrise. 1 apprenti, lien 14j. Risque: alt-farming → garde-fous IP/playtime.',
    tags: ['J','B','D'], complexity: 'M' },
  { id: 'h-spec',   column: 'hot', category: 'Build',  title: '#2 Spécialisations (Soul Stones)',
    desc: 'Au lvl 50, choix d\'une branche exclusive (Mineur → Prospecteur/Foreur/Géologue). Reset payant 7j. Différenciation max vs Jobs Reborn.',
    tags: ['J','B','F'], complexity: 'M' },
  { id: 'h-licence',column: 'hot', category: 'Économie', title: '#5 Licences d\'outils',
    desc: 'Sink monétaire : tous les 5000 actions, License expire. Renouvellement = 2-5% revenu mensuel. -50% gains pendant rupture. Toggle admin obligatoire.',
    tags: ['J','A','B'], complexity: 'S' },

  // ─── LONG TERME ──────────────────────────────────────────────────────────
  { id: 'l-contracts', column: 'long', category: 'Social', title: '#3 Contrats de Guilde coopératifs',
    desc: '3×/sem, contrats serveur 5-20 participants. Récompense pro-rata + bonus 100%. Créateur gagne 10% commission. Webhook Discord en bonus.',
    tags: ['J','B','D','F'], complexity: 'L' },
  { id: 'l-codex',     column: 'long', category: 'Progression', title: '#6 Codex de Découvertes',
    desc: '6 paliers par ressource (1/10/100/1k/10k/100k). Chaque palier = perk micro-permanent (recette, +1% drop, mini-titre). 100% = cape unique. Coût contenu: 50+ entrées de lore.',
    tags: ['J','B','D','F'], complexity: 'L' },
  { id: 'l-market',    column: 'long', category: 'Économie', title: '#9 Marché offre/demande dynamique',
    desc: 'NPC Trader, prix endogène (moyenne mobile 24h). Stack ↑ → prix ↓ -40% max, recovery passif. Risque exploit reset MMs → cap quotidien + smoothing.',
    tags: ['J','A','B','D','F'], complexity: 'L' },
  { id: 'l-scenarios', column: 'long', category: 'Admin',   title: '#12 Météo économique (scénarios)',
    desc: 'Editor admin de scénarios 1-7j (ex: "Crise du blé": prix +200%, récolte -30%). Multipliers par job/ressource, schedule. Cap 3x/0.3x.',
    tags: ['A','B','F'], complexity: 'L' },
  { id: 'l-predict',   column: 'long', category: 'Admin',   title: '#8 Heatmap prédictive admin',
    desc: 'Réutilise heatmap + simulateur What-if "si je nerf X, où va le farm ?". Modèle: seconds-best spots. Export CSV.',
    tags: ['A','B','F'], complexity: 'M' },
  { id: 'l-works',     column: 'long', category: 'Économie', title: '#10 Œuvres de Maîtrise',
    desc: 'Lvl 75/90/100 = recettes signées NBT crafted_by:player. Tracking public top crafters + items en circulation. Casse = stat décrémentée publiquement (RP drama).',
    tags: ['J','B','D'], complexity: 'M' },

  // ─── IDEAS ───────────────────────────────────────────────────────────────
  { id: 'i-synergies', column: 'ideas', category: 'Joueur',  title: 'Synergies multi-métiers',
    desc: 'Mineur+Forgeron = +20% sur fer fondu. Encourage le multi-job.', tags: ['J','B'], complexity: 'M' },
  { id: 'i-tools',     column: 'ideas', category: 'Joueur',  title: 'Outils craftables de métier',
    desc: 'Pioche du Mineur Niv 25 — bonus XP/$. Recipe unlocked at lvl X.', tags: ['J','B'], complexity: 'M' },
  { id: 'i-reputation',column: 'ideas', category: 'Joueur',  title: 'Réputation décroissante',
    desc: 'Bonus drops si actif récent. Combat l\'AFK, récompense la régularité.', tags: ['J','B','D'], complexity: 'M' },
  { id: 'i-mastery',   column: 'ideas', category: 'Joueur',  title: 'Maîtrise par cible',
    desc: 'Diamond Mining 87/100 ≠ niveau global. Encourage diversité.', tags: ['J','B','D'], complexity: 'L' },
  { id: 'i-pets',      column: 'ideas', category: 'Joueur',  title: 'Job Compagnons / pets',
    desc: 'Au lvl X, pet par job (Foreuse mécanique pour mineur).', tags: ['J','B'], complexity: 'L' },
  { id: 'i-quests',    column: 'ideas', category: 'Joueur',  title: 'Quêtes journalières solo par métier',
    desc: 'Mine 64 stones today for 500 XP + 300$.', tags: ['J','B','D','F'], complexity: 'M' },

  { id: 'i-yamleditor', column: 'ideas', category: 'Admin',  title: 'Live editor de jobs.yml',
    desc: 'CRUD complet métier/action/reward depuis dashboard. Plus jamais de SSH.', tags: ['A','F','B'], complexity: 'L' },
  { id: 'i-audit',     column: 'ideas', category: 'Admin',   title: 'Audit log par métier',
    desc: 'Qui join/leave/gain niveau, quand, par qui. Modération + debug.', tags: ['A','D'], complexity: 'S' },
  { id: 'i-canary',    column: 'ideas', category: 'Admin',   title: 'Soft launch / canary',
    desc: 'Nouveau métier visible à un % de joueurs / un rang. Test avant rollout.', tags: ['A','B','F'], complexity: 'M' },
  { id: 'i-rewardstier',column: 'ideas', category: 'Admin',  title: 'Récompenses par palier de niveau',
    desc: 'Commande/item custom configurables à chaque milestone, avec preview.', tags: ['A','F'], complexity: 'M' },
  { id: 'i-discord',   column: 'ideas', category: 'Admin',   title: 'Notifications push Discord',
    desc: 'Webhooks sur level milestones, événements, max-level.', tags: ['A','B'], complexity: 'S' },

  // ─── TECH DEBT ───────────────────────────────────────────────────────────
  { id: 't-fragmentkey',column: 'tech', category: 'Polish',   title: 'React Fragment <> sans key',
    desc: 'Warning console dans la map des tabs (Jobs.tsx).', tags: ['F'], complexity: 'S' },
  { id: 't-jdbcthread', column: 'tech', category: 'Backend',  title: 'JDBC thread-safety en async scheduler',
    desc: 'runTaskTimerAsynchronously touche Database.conn() — vérifier sous charge.', tags: ['B'], complexity: 'S' },
  { id: 't-cacheinval', column: 'tech', category: 'Backend',  title: 'JobTicketService cache.clear() global au revoke',
    desc: 'Grossier mais OK; refiner pour invalider que l\'uuid concerné.', tags: ['B'], complexity: 'S' },
  { id: 't-regulator-mean',column:'tech',category: 'Backend', title: 'Régulateur: mean = 1/N uniforme',
    desc: 'Pourrait être pondéré par "métier de demande" (bulletin) pour cohérence.', tags: ['B'], complexity: 'M' },
  { id: 't-historyidx', column: 'tech', category: 'Data',     title: 'Index sur custom_job_history(timestamp)',
    desc: 'Queries timeline 30j peuvent ralentir sur grosse base.', tags: ['B','D'], complexity: 'S' },
]

interface CardMeta { notes?: string; dueDate?: string; assignee?: string }
interface Overrides {
  columnByCard: Record<string, Column>
  archived:     Record<string, true>
  meta:         Record<string, CardMeta>
}
const STORAGE_KEY = 'jobs.roadmap.v1'
const EMPTY_OVERRIDES: Overrides = { columnByCard: {}, archived: {}, meta: {} }

function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_OVERRIDES
    const p = JSON.parse(raw)
    return {
      columnByCard: p.columnByCard ?? {},
      archived:     p.archived     ?? {},
      meta:         p.meta         ?? {},
    }
  } catch { return EMPTY_OVERRIDES }
}
function saveOverrides(o: Overrides) { localStorage.setItem(STORAGE_KEY, JSON.stringify(o)) }

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
function pickJSONFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
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
function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '?'
}
function dueChip(dueDate?: string): { label: string; color: string } | null {
  if (!dueDate) return null
  const due = new Date(dueDate).getTime()
  if (isNaN(due)) return null
  const days = Math.ceil((due - Date.now()) / 86_400_000)
  if (days < 0)  return { label: `J+${-days}`,  color: '#ef4444' }
  if (days === 0) return { label: 'Aujourd\'hui', color: '#f59e0b' }
  if (days <= 7) return { label: `J-${days}`,   color: '#f59e0b' }
  return { label: `J-${days}`, color: '#10b981' }
}

export default function JobsRoadmap() {
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides)
  const [filterTag, setFilterTag] = useState<Tag | null>(null)
  const [search, setSearch]       = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => { saveOverrides(overrides) }, [overrides])

  const visibleCards = useMemo(() => {
    const q = search.trim().toLowerCase()
    return CARDS
      .map(c => ({ ...c, column: overrides.columnByCard[c.id] ?? c.column }))
      .filter(c => showArchived ? overrides.archived[c.id] : !overrides.archived[c.id])
      .filter(c => !filterTag || c.tags.includes(filterTag))
      .filter(c => !q || c.title.toLowerCase().includes(q) || (c.desc?.toLowerCase().includes(q)) || c.category.toLowerCase().includes(q))
  }, [overrides, filterTag, search, showArchived])

  const totalDone = CARDS.filter(c => (overrides.columnByCard[c.id] ?? c.column) === 'done' && !overrides.archived[c.id]).length
  const totalCards = CARDS.filter(c => !overrides.archived[c.id]).length
  const completion = totalCards > 0 ? Math.round((totalDone / totalCards) * 100) : 0

  const moveCard = (cardId: string, targetCol: Column) => {
    setOverrides(o => ({ ...o, columnByCard: { ...o.columnByCard, [cardId]: targetCol } }))
  }
  const archiveCard = (cardId: string) => {
    setOverrides(o => ({ ...o, archived: { ...o.archived, [cardId]: true } }))
  }
  const restoreCard = (cardId: string) => {
    const next = { ...overrides.archived }; delete next[cardId]
    setOverrides({ ...overrides, archived: next })
  }
  const updateMeta = (cardId: string, patch: Partial<CardMeta>) => {
    setOverrides(o => {
      const current = o.meta[cardId] ?? {}
      const merged: CardMeta = { ...current, ...patch }
      // Strip empty fields so the override stays clean
      const clean: CardMeta = {}
      if (merged.notes?.trim())    clean.notes    = merged.notes.trim()
      if (merged.dueDate)          clean.dueDate  = merged.dueDate
      if (merged.assignee?.trim()) clean.assignee = merged.assignee.trim()
      const nextMeta = { ...o.meta }
      if (Object.keys(clean).length === 0) delete nextMeta[cardId]
      else                                  nextMeta[cardId] = clean
      return { ...o, meta: nextMeta }
    })
  }
  const resetAll = () => {
    if (!confirm('Réinitialiser TOUT (déplacements, archives, notes, dates, assignations) ?')) return
    setOverrides(EMPTY_OVERRIDES)
  }
  const exportJSON = () => {
    downloadJSON(`roadmap-jobs-${new Date().toISOString().slice(0, 10)}.json`, {
      version: 1,
      exported_at: Date.now(),
      overrides,
    })
  }
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
    } catch (e) {
      alert('Erreur d\'import : ' + e)
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-[1800px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/jobs" className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>
              ← Jobs
            </Link>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🗂️ Roadmap des Métiers</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Toutes les features par catégorie · drag & drop pour réorganiser · persisté localement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-2 rounded text-sm"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <span className="font-bold" style={{ color: '#10b981' }}>{totalDone}</span>
            <span style={{ color: 'var(--text-muted)' }}> / {totalCards}</span>
            <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>({completion}%)</span>
          </div>
          <button onClick={() => setShowArchived(!showArchived)}
                  className="px-3 py-2 rounded text-xs"
                  style={{ background: showArchived ? 'var(--primary)' : 'var(--surface)',
                           color: showArchived ? 'white' : 'var(--text-muted)',
                           border: '1px solid var(--border)' }}>
            {showArchived ? '👁 Archivées' : 'Voir archivées'}
          </button>
          <button onClick={exportJSON}
                  title="Sauvegarder un fichier JSON (notes, dates, assignations…)"
                  className="px-3 py-2 rounded text-xs"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            ⬇ Export
          </button>
          <button onClick={importJSON}
                  title="Restaurer depuis un fichier JSON"
                  className="px-3 py-2 rounded text-xs"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            ⬆ Import
          </button>
          <button onClick={resetAll}
                  className="px-3 py-2 rounded text-xs"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input type="text" placeholder="🔍 Rechercher..." value={search}
               onChange={e => setSearch(e.target.value)}
               className="px-3 py-2 rounded text-sm flex-1 min-w-[200px] max-w-[300px]"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
        <div className="flex gap-1">
          <FilterChip active={filterTag === null} onClick={() => setFilterTag(null)} bg="rgba(99,102,241,0.15)" color="var(--primary)">
            Tous
          </FilterChip>
          {(Object.keys(TAG_META) as Tag[]).map(t => (
            <FilterChip key={t}
                        active={filterTag === t}
                        onClick={() => setFilterTag(filterTag === t ? null : t)}
                        bg={TAG_META[t].bg} color={TAG_META[t].color}>
              {TAG_META[t].label}
            </FilterChip>
          ))}
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {visibleCards.length} carte{visibleCards.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-5 gap-3">
        {COLUMNS.map(col => {
          const colCards = visibleCards.filter(c => c.column === col.id)
          return (
            <div key={col.id}
                 onDragOver={e => { e.preventDefault() }}
                 onDrop={() => { if (draggedId) { moveCard(draggedId, col.id); setDraggedId(null) } }}
                 className="rounded-xl flex flex-col"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 'calc(100vh - 250px)' }}>
              <div className="px-3 py-2.5 flex items-center justify-between border-b sticky top-0 z-10"
                   style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: col.color }}>
                  {col.icon} {col.label}
                </h3>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {colCards.length}
                </span>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {colCards.length === 0 ? (
                  <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                    {showArchived ? 'Aucune archive' : 'Vide'}
                  </div>
                ) : colCards.map(c => (
                  <CardView key={c.id} card={c}
                            meta={overrides.meta[c.id]}
                            archived={!!overrides.archived[c.id]}
                            onDragStart={() => setDraggedId(c.id)}
                            onDragEnd={() => setDraggedId(null)}
                            onArchive={() => showArchived ? restoreCard(c.id) : archiveCard(c.id)}
                            onUpdateMeta={(p) => updateMeta(c.id, p)}/>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FilterChip({ children, active, onClick, bg, color }: {
  children: React.ReactNode; active: boolean; onClick: () => void; bg: string; color: string
}) {
  return (
    <button onClick={onClick}
            className="px-2.5 py-1.5 rounded text-xs font-medium transition"
            style={{
              background: active ? bg : 'var(--surface)',
              color: active ? color : 'var(--text-muted)',
              border: `1px solid ${active ? color : 'var(--border)'}`,
              opacity: active ? 1 : 0.7,
            }}>
      {children}
    </button>
  )
}

function CardView({ card, meta, archived, onDragStart, onDragEnd, onArchive, onUpdateMeta }: {
  card: Card; meta?: CardMeta; archived: boolean
  onDragStart: () => void; onDragEnd: () => void; onArchive: () => void
  onUpdateMeta: (patch: Partial<CardMeta>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const due = dueChip(meta?.dueDate)
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
          <button onClick={(e) => { e.stopPropagation(); setEditing(!editing); setExpanded(true) }}
                  title="Notes / date / assignation"
                  className="text-[10px] leading-none p-0.5"
                  style={{ color: editing ? 'var(--primary)' : (hasMeta ? '#f59e0b' : 'var(--text-muted)') }}>
            {hasMeta ? '✎●' : '✎'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onArchive() }}
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

      {/* Meta chips (read-only when not editing) */}
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

      {/* Editor */}
      {editing && (
        <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <textarea placeholder="Notes…"
                    defaultValue={meta?.notes ?? ''}
                    onBlur={(e) => onUpdateMeta({ notes: e.target.value })}
                    rows={2}
                    className="w-full text-[10px] px-2 py-1 rounded resize-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
          <div className="grid grid-cols-2 gap-1">
            <input type="date"
                   defaultValue={meta?.dueDate ?? ''}
                   onBlur={(e) => onUpdateMeta({ dueDate: e.target.value || undefined })}
                   className="text-[10px] px-2 py-1 rounded"
                   style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
            <input type="text" placeholder="Assigné à…"
                   defaultValue={meta?.assignee ?? ''}
                   onBlur={(e) => onUpdateMeta({ assignee: e.target.value })}
                   className="text-[10px] px-2 py-1 rounded"
                   style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
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
