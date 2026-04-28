import { useEffect, useState } from 'react'
import { api } from '../api/client'

/**
 * Composant onglet "Activité" de la page joueur.
 *
 * Vue principale = grille de catégories cliquables (LOGIN, DEATH, CHAT, ...)
 * Clic sur une catégorie = timeline filtrée à cette catégorie uniquement.
 */

const CATEGORIES: Record<string, { label: string; icon: string; color: string; description: string }> = {
  LOGIN:      { label: 'Connexions', icon: '🔌', color: '#10b981', description: 'Join / quit / kick' },
  DEATH:      { label: 'Morts',      icon: '💀', color: '#ef4444', description: 'PvP, mob, suicide' },
  CHAT:       { label: 'Chat',       icon: '💬', color: '#3b82f6', description: 'Messages + commandes' },
  CONTAINER:  { label: 'Conteneurs', icon: '📦', color: '#f97316', description: 'Coffres, fours, barrels' },
  TELEPORT:   { label: 'Téléports',  icon: '🌍', color: '#8b5cf6', description: 'tp / warp / home / spawn' },
  ECONOMY:    { label: 'Économie',   icon: '💰', color: '#eab308', description: 'Buy / sell / gain / perte' },
  GAMEPLAY:   { label: 'Gameplay',   icon: '🎮', color: '#ec4899', description: 'Jobs / arènes / quêtes' },
  MODERATION: { label: 'Modération', icon: '⚖️', color: '#dc2626', description: 'Sanctions reçues / levées' },
}

const ACTION_ICONS: Record<string, string> = {
  JOIN: '🟢', QUIT: '⚫', KICK: '👢',
  DEATH: '💀',
  CHAT_MESSAGE: '💬', COMMAND: '⌨️',
  OPEN: '📦', CLOSE: '📕',
  TP: '🌍',
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}min`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}j`
}

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function PlayerActivityLog({ playerName, isAdmin }: { playerName: string; isAdmin?: boolean }) {
  const [view, setView] = useState<'categories' | 'timeline'>('categories')
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const [data, setData] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      if (view === 'categories') {
        setData(await api.playerLogCategories(playerName, days))
      } else if (selectedCat) {
        const res = await api.playerLogList(playerName, { category: selectedCat, days, limit: 200 })
        setEntries(res.entries || [])
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [view, selectedCat, days, playerName])

  const openCategory = (cat: string) => {
    setSelectedCat(cat)
    setView('timeline')
  }

  const back = () => {
    setView('categories')
    setSelectedCat(null)
  }

  const clearAll = async () => {
    if (!confirm(`Vider l'historique d'activité de ${playerName} ?\n\nCette action est irréversible.`)) return
    try {
      const res = await api.playerLogClear(playerName)
      alert(`✓ ${res.deleted} entrée(s) supprimée(s)`)
      refresh()
    } catch (e: any) { alert('Erreur : ' + e.message) }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {view === 'categories' ? (
            <>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>📜 Activité</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {data?.totalEntries ?? 0} entrée(s) sur {days} dernier(s) jour(s) — clique une catégorie pour voir le détail
              </p>
            </>
          ) : (
            <button onClick={back} className="text-sm hover:underline" style={{ color: 'var(--primary)' }}>
              ← Retour aux catégories
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded p-1" style={{ background: 'var(--surface-2)' }}>
            {[1, 7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        background: days === d ? 'var(--primary)' : 'transparent',
                        color: days === d ? 'white' : 'var(--text-muted)',
                      }}>
                {d === 1 ? '24h' : d + 'j'}
              </button>
            ))}
          </div>
          <button onClick={refresh} disabled={loading}
                  className="px-3 py-1.5 rounded text-sm"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {loading ? '⏳' : '↻'}
          </button>
          {isAdmin && view === 'categories' && (
            <button onClick={clearAll}
                    className="px-3 py-1.5 rounded text-xs"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              🗑 Vider
            </button>
          )}
        </div>
      </div>

      {view === 'categories' ? <CategoriesGrid data={data} onOpen={openCategory}/> : <TimelineList entries={entries} category={selectedCat}/>}
    </div>
  )
}

// ── Categories grid ────────────────────────────────────────────────────────
function CategoriesGrid({ data, onOpen }: { data: any; onOpen: (cat: string) => void }) {
  if (!data) return <Loading/>
  const counts: Record<string, { count: number; lastAt: number }> = {}
  for (const c of data.categories || []) {
    counts[c.category] = { count: c.count, lastAt: c.lastAt }
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Object.entries(CATEGORIES).map(([id, meta]) => {
        const c = counts[id] || { count: 0, lastAt: 0 }
        const empty = c.count === 0
        return (
          <button key={id} onClick={() => !empty && onOpen(id)}
                  disabled={empty}
                  className="text-left rounded-xl p-4 transition disabled:opacity-50"
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${empty ? 'var(--border)' : meta.color + '60'}`,
                    boxShadow: empty ? undefined : `0 0 0 1px ${meta.color}20`,
                    cursor: empty ? 'default' : 'pointer',
                  }}
                  onMouseOver={e => !empty && (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl" style={{ color: meta.color }}>{meta.icon}</div>
              <div className="text-2xl font-bold" style={{ color: empty ? 'var(--text-muted)' : meta.color }}>
                {c.count}
              </div>
            </div>
            <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{meta.label}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{meta.description}</div>
            {!empty && (
              <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Dernière : il y a {timeAgo(c.lastAt)}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Timeline ───────────────────────────────────────────────────────────────
function TimelineList({ entries, category }: { entries: any[]; category: string | null }) {
  if (!entries || entries.length === 0) {
    return <div className="rounded-xl p-12 text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
      <div className="text-4xl mb-2">📭</div>
      Aucune activité dans cette catégorie
    </div>
  }

  // Group by day
  const byDay: Record<string, any[]> = {}
  for (const e of entries) {
    const d = new Date(e.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(e)
  }
  const meta = category ? CATEGORIES[category] : null

  return (
    <div className="space-y-4">
      {meta && (
        <div className="flex items-center gap-2 text-sm" style={{ color: meta.color }}>
          <span className="text-2xl">{meta.icon}</span>
          <span className="font-bold">{meta.label}</span>
          <span style={{ color: 'var(--text-muted)' }}>· {entries.length} événement(s)</span>
        </div>
      )}
      {Object.entries(byDay).map(([day, dayEntries]) => (
        <div key={day}>
          <div className="text-xs uppercase tracking-wider mb-2 sticky top-0 py-1"
               style={{ color: 'var(--text-muted)', background: 'var(--bg)' }}>
            ━━━ {day} ━━━
          </div>
          <div className="rounded-xl overflow-hidden"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {dayEntries.map((e, i) => <ActivityRow key={e.id || i} entry={e}/>)}
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityRow({ entry }: { entry: any }) {
  const [expanded, setExpanded] = useState(false)
  const meta = CATEGORIES[entry.category] || CATEGORIES.LOGIN
  const icon = ACTION_ICONS[entry.action] || meta.icon
  const time = new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}
         style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="px-4 py-2 flex items-center gap-3 hover:bg-white/[0.02]">
        <div className="text-xs font-mono shrink-0 w-16" style={{ color: 'var(--text-muted)' }}>{time}</div>
        <div className="text-lg shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm">
            <span className="font-bold" style={{ color: meta.color }}>{humanAction(entry)}</span>
            {entry.target && (
              <span style={{ color: 'var(--text-muted)' }}> · </span>
            )}
            {entry.target && (
              <span className="font-medium" style={{ color: 'var(--text)' }}>{truncate(entry.target, 60)}</span>
            )}
          </div>
          {entry.world && (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              🌍 {entry.world}
              {entry.x !== null && entry.x !== undefined && (
                <span className="font-mono ml-2">({entry.x}, {entry.y}, {entry.z})</span>
              )}
            </div>
          )}
        </div>
      </div>
      {expanded && entry.payload && Object.keys(entry.payload).length > 0 && (
        <div className="px-4 py-2 ml-20 text-xs font-mono"
             style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-muted)' }}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(entry.payload, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

function humanAction(entry: any): string {
  const a = entry.action
  switch (a) {
    case 'JOIN':         return 'Connecté'
    case 'QUIT':         return 'Déconnecté'
    case 'KICK':         return 'Kicked'
    case 'DEATH':        return entry.target ? `Tué par ${entry.target}` : 'Mort'
    case 'CHAT_MESSAGE': return '"' + truncate(entry.target || '', 80) + '"'
    case 'COMMAND':      return entry.target || 'Commande'
    case 'OPEN':         return 'A ouvert ' + (entry.target || 'un conteneur')
    case 'TP':           return 'Téléporté ' + (entry.target ? '→ ' + entry.target : '')
    default:             return a
  }
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length > n ? s.substring(0, n) + '…' : s
}

function Loading() {
  return <div className="p-12 text-center" style={{ color: 'var(--text-muted)' }}>
    <div className="text-3xl animate-pulse">📜</div>
    Chargement…
  </div>
}
