import { useEffect, useState } from 'react'
import { api } from '../api/client'

/**
 * Page Games — répertorie TOUTES les arènes des mini-jeux installés.
 *
 * Données : `/api/games/arenas` qui scanne les configs de :
 *   - CTF (kitbattle-ctf)
 *   - Skywars
 *   - Thimble
 *   - TNT Run
 *
 * Statut par arène :
 *   - PLAYING : ≥1 joueur dans le monde de l'arène (avec liste des joueurs)
 *   - WAITING : aucun joueur (mais arène configurée et plugin chargé)
 *
 * Auto-refresh toutes les 5 secondes pour suivre les parties en live.
 */
export default function Games() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all') // 'all' | 'playing' | 'waiting' | gameId

  const refresh = async () => {
    setLoading(true)
    try { setData(await api.gamesArenas()) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [])

  if (!data) return <Loading/>

  const games: any[] = data.games || []
  const arenas: any[] = data.arenas || []

  const filtered = arenas.filter(a => {
    if (filter === 'all') return true
    if (filter === 'playing') return a.status === 'PLAYING'
    if (filter === 'waiting') return a.status === 'WAITING'
    return a.game === filter
  })

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            🎮 Mini-jeux
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Toutes les arènes de tous les mini-jeux installés — statut en temps réel
          </p>
        </div>
        <button onClick={refresh} disabled={loading}
                className="px-3 py-2 rounded text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          {loading ? '⏳' : '↻ Refresh'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi icon="🎯" label="Arènes total" value={data.totalArenas} color="#3b82f6"/>
        <Kpi icon="🟢" label="Parties en cours" value={data.playing} color="#10b981"/>
        <Kpi icon="🟡" label="En attente" value={data.waiting} color="#f59e0b"/>
        <Kpi icon="🎮" label="Jeux installés" value={games.filter(g => g.installed).length + ' / ' + games.length} color="#8b5cf6"/>
      </div>

      {/* Cartes par jeu */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {games.map(g => (
          <button key={g.id} onClick={() => setFilter(filter === g.id ? 'all' : g.id)}
                  className="text-left rounded-xl p-4 transition hover:scale-[1.02] cursor-pointer"
                  style={{
                    background: 'var(--surface)',
                    border: filter === g.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                    opacity: g.installed ? 1 : 0.4,
                  }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-3xl">{g.icon}</div>
              <span className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: g.installed && g.enabled ? 'rgba(16,185,129,0.15)' :
                                  g.installed ? 'rgba(251,191,36,0.15)' : 'rgba(148,163,184,0.15)',
                      color: g.installed && g.enabled ? '#10b981' :
                             g.installed ? '#f59e0b' : '#94a3b8',
                    }}>
                {g.installed ? (g.enabled ? 'ACTIF' : 'CHARGÉ') : 'ABSENT'}
              </span>
            </div>
            <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{g.label}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {g.installed ? `v${g.version}` : `Plugin ${g.pluginName} non installé`}
            </div>
            {g.installed && (
              <div className="flex gap-3 mt-2 text-xs">
                <span style={{ color: 'var(--text-muted)' }}>
                  📍 <b style={{ color: 'var(--text)' }}>{g.totalArenas ?? 0}</b> arène{(g.totalArenas ?? 0) > 1 ? 's' : ''}
                </span>
                {(g.playingArenas ?? 0) > 0 && (
                  <span style={{ color: '#10b981' }}>🟢 {g.playingArenas} live</span>
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Filtres :</span>
        {[
          { id: 'all',     label: `Toutes (${arenas.length})` },
          { id: 'playing', label: `🟢 En cours (${data.playing})` },
          { id: 'waiting', label: `🟡 Attente (${data.waiting})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
                  className="px-3 py-1 rounded text-xs font-medium transition"
                  style={{
                    background: filter === f.id ? 'var(--primary)' : 'var(--surface-2)',
                    color: filter === f.id ? 'white' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste arènes */}
      {filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <div className="text-5xl mb-2">🏟️</div>
          <div>Aucune arène trouvée pour ce filtre</div>
          {arenas.length === 0 && (
            <div className="text-xs mt-2">
              Les configs des plugins de jeu n'ont pas pu être lues. Vérifie qu'ils ont bien des arènes configurées.
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((a, i) => <ArenaCard key={i} arena={a}/>)}
        </div>
      )}
    </div>
  )
}

function ArenaCard({ arena }: { arena: any }) {
  const playing = arena.status === 'PLAYING'
  const ratio = arena.maxPlayers > 0 ? arena.currentPlayers / arena.maxPlayers : 0

  return (
    <div className="rounded-xl p-4 transition"
         style={{
           background: 'var(--surface)',
           border: `1px solid ${playing ? '#10b98180' : 'var(--border)'}`,
           boxShadow: playing ? '0 0 0 1px rgba(16,185,129,0.2)' : undefined,
         }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-2xl shrink-0">{arena.icon}</div>
          <div className="min-w-0">
            <div className="font-bold truncate" style={{ color: 'var(--text)' }}>{arena.name}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{arena.gameLabel}</div>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap"
              style={{
                background: playing ? 'rgba(16,185,129,0.2)' : 'rgba(251,191,36,0.15)',
                color: playing ? '#10b981' : '#f59e0b',
              }}>
          {playing ? '🟢 EN COURS' : '🟡 ATTENTE'}
        </span>
      </div>

      {/* Joueurs */}
      <div className="flex items-center gap-2 text-sm mb-2">
        <span style={{ color: 'var(--text-muted)' }}>👥</span>
        <span className="font-bold" style={{ color: playing ? '#10b981' : 'var(--text)' }}>
          {arena.currentPlayers}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>/ {arena.maxPlayers}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          (min {arena.minPlayers})
        </span>
        <div className="flex-1 h-1.5 rounded ml-2" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded transition-all"
               style={{
                 background: playing ? '#10b981' : 'var(--primary)',
                 width: `${Math.min(100, ratio * 100)}%`,
               }}/>
        </div>
      </div>

      {/* Joueurs nominatifs */}
      {arena.players && (
        <div className="text-xs mt-1.5 p-2 rounded"
             style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <span style={{ color: 'var(--text-muted)' }}>En jeu : </span>
          {arena.players}
        </div>
      )}

      {/* Footer infos */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        {arena.world && (
          <span>🌍 <b style={{ color: 'var(--text)' }}>{arena.world}</b></span>
        )}
        {arena.extra && <span>{arena.extra}</span>}
      </div>
    </div>
  )
}

function Loading() {
  return <div className="p-12 text-center" style={{ color: 'var(--text-muted)' }}>
    <div className="text-3xl animate-pulse">🎮</div>
    Scan des arènes…
  </div>
}

function Kpi({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        {icon} {label}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}
