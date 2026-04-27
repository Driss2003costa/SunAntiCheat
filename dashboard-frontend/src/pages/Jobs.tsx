import { useEffect, useState } from 'react'
import { api } from '../api/client'

/**
 * Page Jobs — analyse des emplois (Jobs Reborn).
 *
 * 4 onglets :
 *  - Overview : KPIs, top jobs, top joueurs, graph revenus dans le temps
 *  - Actifs   : joueurs actuellement online avec leurs jobs et niveaux
 *  - Historique : événements JOIN/LEAVE/LEVEL_UP
 *  - Catalogue : liste de tous les jobs (config Jobs Reborn) avec stats
 */

type Tab = 'overview' | 'active' | 'history' | 'catalog'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Vue générale', icon: '📊' },
  { id: 'active',   label: 'Joueurs actifs',  icon: '👥' },
  { id: 'history',  label: 'Historique',  icon: '📜' },
  { id: 'catalog',  label: 'Catalogue',   icon: '💼' },
]

const PERIOD_OPTIONS = [
  { days: 1,  label: '24h' },
  { days: 7,  label: '7j' },
  { days: 30, label: '30j' },
  { days: 90, label: '90j' },
]

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M $`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k $`
  return `${n.toFixed(2)} $`
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60)    return `${sec}s`
  if (sec < 3600)  return `${Math.floor(sec / 60)}min`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}j`
}

const EVENT_ICONS: Record<string, string> = {
  JOIN: '➕', LEAVE: '➖', LEVEL_UP: '⬆️',
}
const EVENT_COLORS: Record<string, string> = {
  JOIN: '#10b981', LEAVE: '#ef4444', LEVEL_UP: '#f59e0b',
}

export default function Jobs() {
  const [tab, setTab] = useState<Tab>('overview')
  const [days, setDays] = useState(7)
  const [overview, setOverview] = useState<any>(null)
  const [active, setActive] = useState<any>(null)
  const [history, setHistory] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      if (tab === 'overview' || tab === 'catalog') {
        setOverview(await api.jobsOverview(days))
      } else if (tab === 'active') {
        setActive(await api.jobsActive())
      } else if (tab === 'history') {
        setHistory(await api.jobsHistory(200, 0))
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [tab, days])

  // Auto-refresh joueurs actifs (10s) et overview (30s)
  useEffect(() => {
    const interval = tab === 'active' ? 10_000 : 30_000
    const t = setInterval(refresh, interval)
    return () => clearInterval(t)
  }, [tab, days])

  const installed = overview?.installed ?? active?.installed ?? null

  // Jobs Reborn absent → plein écran
  if (installed === false) {
    return (
      <div className="p-6">
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-6xl mb-4">💼</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Jobs Reborn non installé</h1>
          <p className="max-w-md mx-auto text-sm" style={{ color: 'var(--text-muted)' }}>
            Installe le plugin <b>Jobs Reborn</b> sur ton serveur pour activer le tracking
            des emplois, des gains et des statistiques de tes joueurs.
          </p>
          <a href="https://www.spigotmc.org/resources/jobs-reborn.4216/"
             target="_blank" rel="noreferrer"
             className="inline-block mt-6 px-5 py-2 rounded-lg text-white font-medium"
             style={{ background: 'var(--primary)' }}>
            📥 Télécharger Jobs Reborn
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>💼 Jobs</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Analyse de Jobs Reborn — joueurs actifs, gains, historique
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(tab === 'overview' || tab === 'catalog') && (
            <div className="flex gap-1 rounded p-1" style={{ background: 'var(--surface-2)' }}>
              {PERIOD_OPTIONS.map(p => (
                <button key={p.days}
                        onClick={() => setDays(p.days)}
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          background: days === p.days ? 'var(--primary)' : 'transparent',
                          color: days === p.days ? 'white' : 'var(--text-muted)',
                        }}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={refresh} disabled={loading}
                  className="px-3 py-2 rounded text-sm"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {loading ? '⏳' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className="px-4 py-2 text-sm font-medium border-b-2 transition"
                  style={{
                    color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                    borderColor: tab === t.id ? 'var(--primary)' : 'transparent',
                  }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab data={overview} days={days}/>}
      {tab === 'active'   && <ActiveTab data={active} />}
      {tab === 'history'  && <HistoryTab data={history} />}
      {tab === 'catalog'  && <CatalogTab data={overview} />}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({ data, days }: { data: any, days: number }) {
  if (!data) return <Loading/>
  const totalsByJob: any[] = data.totalsByJob || []
  const topPlayers: any[] = data.topPlayers || []
  const occupancy: any[]  = data.occupancy || []

  const totalMoney   = totalsByJob.reduce((sum, j) => sum + (j.totalMoney || 0), 0)
  const totalPays    = totalsByJob.reduce((sum, j) => sum + (j.payments || 0), 0)
  const totalUnique  = new Set(topPlayers.map(p => p.playerUuid)).size

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi icon="💰" label={`Argent gagné (${days}j)`} value={fmtMoney(totalMoney)} color="#10b981"/>
        <Kpi icon="📊" label="Paiements" value={String(totalPays)} color="#3b82f6"/>
        <Kpi icon="👥" label="Joueurs actifs" value={String(totalUnique)} color="#f59e0b"/>
        <Kpi icon="💼" label="Jobs occupés" value={String(occupancy.filter(o => o.onlineCount > 0).length)} color="#8b5cf6"/>
      </div>

      {/* Money over time */}
      <div className="rounded-xl p-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>📈 Revenus dans le temps ({days}j)</h3>
        <SimpleLineChart data={data.moneyOverTime}/>
      </div>

      {/* Top jobs + top players */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>🏆 Top jobs ({days}j)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="text-left pb-2">Job</th>
                <th className="text-right pb-2">Joueurs</th>
                <th className="text-right pb-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {totalsByJob.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                  Aucune activité
                </td></tr>
              )}
              {totalsByJob.slice(0, 10).map((j: any) => {
                const max = totalsByJob[0]?.totalMoney || 1
                const pct = (j.totalMoney / max) * 100
                return (
                  <tr key={j.jobName} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2">
                      <div className="font-medium" style={{ color: 'var(--text)' }}>{j.jobName}</div>
                      <div className="h-1 rounded mt-1" style={{ background: 'var(--surface-2)' }}>
                        <div className="h-full rounded" style={{ background: 'var(--primary)', width: `${pct}%` }}/>
                      </div>
                    </td>
                    <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>{j.uniquePlayers}</td>
                    <td className="py-2 text-right font-bold" style={{ color: '#10b981' }}>{fmtMoney(j.totalMoney)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl p-4"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>🥇 Top joueurs ({days}j)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="text-left pb-2 w-8">#</th>
                <th className="text-left pb-2">Joueur</th>
                <th className="text-right pb-2">Paiements</th>
                <th className="text-right pb-2">Gagné</th>
              </tr>
            </thead>
            <tbody>
              {topPlayers.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                  Aucune activité
                </td></tr>
              )}
              {topPlayers.slice(0, 10).map((p: any, i: number) => (
                <tr key={p.playerUuid || i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-2" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td className="py-2 font-medium" style={{ color: 'var(--text)' }}>{p.playerName}</td>
                  <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>{p.payments}</td>
                  <td className="py-2 text-right font-bold" style={{ color: '#10b981' }}>{fmtMoney(p.totalMoney)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Active ─────────────────────────────────────────────────────────────────────
function ActiveTab({ data }: { data: any }) {
  if (!data) return <Loading/>
  const players: any[] = data.players || []

  if (players.length === 0) {
    return <div className="rounded-xl p-12 text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
      <div className="text-4xl mb-2">😴</div>
      Aucun joueur en ligne ou aucun joueur n'a de job
    </div>
  }

  return (
    <div className="rounded-xl overflow-hidden"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="grid grid-cols-12 px-4 py-2 text-xs uppercase tracking-wider"
           style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
        <div className="col-span-3">Joueur</div>
        <div className="col-span-9">Jobs (niveau · exp)</div>
      </div>
      {players.map(p => (
        <div key={p.playerUuid}
             className="grid grid-cols-12 px-4 py-3 hover:bg-white/[0.02]"
             style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="col-span-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#10b981' }}/>
            <span className="font-medium" style={{ color: 'var(--text)' }}>{p.playerName}</span>
          </div>
          <div className="col-span-9 flex flex-wrap gap-2">
            {p.jobs.length === 0 && (
              <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>aucun job</span>
            )}
            {p.jobs.map((j: any) => (
              <div key={j.name}
                   className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"
                   style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="font-bold" style={{ color: 'var(--text)' }}>{j.name}</span>
                <span style={{ color: '#f59e0b' }}>Lv {j.level}{j.maxLevel ? `/${j.maxLevel}` : ''}</span>
                {j.nextLevelExp > 0 && (
                  <div className="w-16 h-1 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <div className="h-full rounded"
                         style={{ background: '#f59e0b', width: `${Math.min(100, (j.exp / j.nextLevelExp) * 100)}%` }}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── History ────────────────────────────────────────────────────────────────────
function HistoryTab({ data }: { data: any }) {
  if (!data) return <Loading/>
  const entries: any[] = data.entries || []

  if (entries.length === 0) {
    return <div className="rounded-xl p-12 text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
      <div className="text-4xl mb-2">📜</div>
      Aucun événement enregistré
    </div>
  }

  return (
    <div className="rounded-xl overflow-hidden"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {entries.map((e, i) => (
        <div key={i} className="px-4 py-2 flex items-center gap-3 hover:bg-white/[0.02]"
             style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-xl">{EVENT_ICONS[e.eventType] || '📋'}</div>
          <div className="flex-1">
            <div className="text-sm">
              <span className="font-bold" style={{ color: EVENT_COLORS[e.eventType] || 'var(--text)' }}>
                {e.eventType === 'JOIN' ? 'Pris' :
                 e.eventType === 'LEAVE' ? 'Quitté' :
                 e.eventType === 'LEVEL_UP' ? `Niv. ${e.level}` : e.eventType}
              </span>
              {' '}
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              {' '}
              <span style={{ color: 'var(--text)' }}>{e.playerName}</span>
              {' '}
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              {' '}
              <span className="font-medium" style={{ color: 'var(--text)' }}>{e.jobName}</span>
            </div>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(e.timestamp)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Catalog ────────────────────────────────────────────────────────────────────
function CatalogTab({ data }: { data: any }) {
  if (!data) return <Loading/>
  const jobs: any[] = data.jobs || []
  const occupancy: any[] = data.occupancy || []
  const totalsByJob: any[] = data.totalsByJob || []
  const occMap: Record<string, any> = {}; occupancy.forEach(o => occMap[o.name] = o)
  const totalMap: Record<string, any> = {}; totalsByJob.forEach(t => totalMap[t.jobName] = t)

  if (jobs.length === 0) {
    return <div className="rounded-xl p-12 text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
      <div className="text-4xl mb-2">💼</div>
      Aucun job configuré
    </div>
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {jobs.map(j => {
        const occ = occMap[j.name]
        const total = totalMap[j.name]
        return (
          <div key={j.name} className="rounded-xl p-4"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                {j.displayName || j.name}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                Niv max {j.maxLevel}
              </span>
            </div>
            {j.description && (
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{j.description}</p>
            )}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Stat label="Total inscrits" value={String(j.totalPlayers)} color="#3b82f6"/>
              <Stat label="Online" value={String(occ?.onlineCount ?? 0)} color="#10b981"/>
              <Stat label="Niv. moy. (online)" value={String(occ?.avgLevel ?? 0)} color="#f59e0b"/>
            </div>
            {total && (
              <div className="mt-3 pt-3 text-xs flex items-center justify-between"
                   style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <span>Gains période :</span>
                <span className="font-bold" style={{ color: '#10b981' }}>{fmtMoney(total.totalMoney)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Components ────────────────────────────────────────────────────────────────
function Loading() {
  return <div className="p-12 text-center" style={{ color: 'var(--text-muted)' }}>
    <div className="text-3xl animate-pulse">☀️</div>
    Chargement…
  </div>
}

function Kpi({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        {icon} {label}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="font-bold" style={{ color }}>{value}</div>
    </div>
  )
}

function SimpleLineChart({ data }: { data: { labels: string[]; data: number[] } }) {
  if (!data || !data.data?.length) {
    return <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Pas de données</div>
  }
  const max = Math.max(1, ...data.data)
  const points = data.data.map((v, i) => {
    const x = (i / (data.data.length - 1 || 1)) * 100
    const y = 100 - (v / max) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="space-y-2">
      <svg viewBox="0 0 100 100" className="w-full h-32" preserveAspectRatio="none">
        <polyline fill="none" stroke="var(--primary)" strokeWidth="0.5" points={points}/>
        <polyline fill="rgba(99,102,241,0.15)" stroke="none" points={`0,100 ${points} 100,100`}/>
      </svg>
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        {data.labels.map((l, i) => (
          <div key={i} className="flex flex-col items-center">
            <span>{l}</span>
            <span className="font-medium">{fmtMoney(data.data[i])}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
