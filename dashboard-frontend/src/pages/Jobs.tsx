import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

/**
 * Nettoie un nom de job des codes couleur Minecraft (§a, &c) et des
 * glyphes Unicode de la PUA (Private Use Area) utilisés par ItemsAdder
 * pour rendre des icônes custom — invisibles côté web.
 */
function cleanJobName(s: string | undefined | null): string {
  if (!s) return '?'
  // Strip color codes
  let r = s.replace(/[§&][0-9a-fk-orxA-FK-ORX]/g, '')
  // Strip PUA chars (BMP + supplementary)
  r = r.replace(/[\uE000-\uF8FF]/g, '')
       .replace(/[\u{F0000}-\u{FFFFD}]/gu, '')
       .replace(/[\u{100000}-\u{10FFFD}]/gu, '')
  r = r.replace(/\s{2,}/g, ' ').trim()
  return r || '?'
}

/** Nom à afficher : displayName s'il est fourni et lisible, sinon name. */
function jobDisplay(j: any, fallbackKey = 'name'): string {
  const dn = cleanJobName(j?.displayName)
  if (dn && dn !== '?') return dn
  return cleanJobName(j?.[fallbackKey])
}

function fmtDatetime(ts: number): string {
  const d = new Date(ts)
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${date} ${time}`
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
  const [historyFilter, setHistoryFilter] = useState({ player: '', job: '' })
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

  const refreshHistory = async (filter: { player: string; job: string }) => {
    setLoading(true)
    try {
      setHistory(await api.jobsHistory(200, 0, filter.player, filter.job))
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

      {/* Bandeau si Jobs Reborn pas installé */}
      {installed === false && (
        <div className="rounded-xl p-4 flex items-center gap-3"
             style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
          <div className="text-2xl">⚠️</div>
          <div>
            <div className="font-bold" style={{ color: '#f59e0b' }}>Jobs Reborn non installé</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Le tracking des jobs est inactif. Les données historiques restent visibles.
            </div>
          </div>
        </div>
      )}

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
      {tab === 'history'  && <HistoryTab data={history} onRefresh={refresh}
                                          filter={historyFilter}
                                          onFilterChange={f => { setHistoryFilter(f); refreshHistory(f) }} />}
      {tab === 'catalog'  && <CatalogTab data={overview} days={days} />}
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
                      <div className="font-medium" style={{ color: 'var(--text)' }}>{cleanJobName(j.jobName)}</div>
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
                  <td className="py-2 font-medium">
                    <Link to={`/players/${encodeURIComponent(p.playerName)}`}
                          className="hover:underline" style={{ color: 'var(--text)' }}>
                      {p.playerName}
                    </Link>
                  </td>
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
                <span className="font-bold" style={{ color: 'var(--text)' }}>{jobDisplay(j)}</span>
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
type HistorySubTab = 'events' | 'payments'

function HistoryTab({ data, onRefresh, filter, onFilterChange }: {
  data: any
  onRefresh: () => void
  filter: { player: string; job: string }
  onFilterChange: (f: { player: string; job: string }) => void
}) {
  const [subTab, setSubTab] = useState<HistorySubTab>('events')
  const [payments, setPayments] = useState<any>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadPayments = async (f = filter) => {
    setPayLoading(true)
    try { setPayments(await api.jobsPayments(200, 0, f.player, f.job)) }
    catch {} finally { setPayLoading(false) }
  }

  useEffect(() => { if (subTab === 'payments' && !payments) loadPayments() }, [subTab])

  const applyFilter = (f: { player: string; job: string }) => {
    onFilterChange(f)
    if (subTab === 'payments') loadPayments(f)
  }

  const clearAll = async () => {
    if (!confirm('Vider TOUT l\'historique des events Jobs ?\nCette action est irréversible.')) return
    setBusy(true)
    try { const r = await api.jobsClearHistory('all'); alert(`✓ ${r.deleted} entrée(s) supprimée(s)`); onRefresh(); setPayments(null) }
    catch (e: any) { alert('Erreur : ' + e.message) } finally { setBusy(false) }
  }
  const dedup = async () => {
    if (!confirm('Supprimer les doublons ?')) return
    setBusy(true)
    try { const r = await api.jobsClearHistory('duplicates'); alert(`✓ ${r.deleted} doublon(s) supprimé(s)`); onRefresh() }
    catch (e: any) { alert('Erreur : ' + e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text" placeholder="Filtrer par joueur..." value={filter.player}
          onChange={e => applyFilter({ ...filter, player: e.target.value })}
          className="px-3 py-1.5 rounded-lg text-sm flex-1 min-w-36"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        <input
          type="text" placeholder="Filtrer par job..." value={filter.job}
          onChange={e => applyFilter({ ...filter, job: e.target.value })}
          className="px-3 py-1.5 rounded-lg text-sm flex-1 min-w-36"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        {(filter.player || filter.job) && (
          <button onClick={() => applyFilter({ player: '', job: '' })}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            ✕ Effacer
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={dedup} disabled={busy} className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
            {busy ? '⏳' : '🧹 Doublons'}
          </button>
          <button onClick={clearAll} disabled={busy} className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            {busy ? '⏳' : '🗑 Tout vider'}
          </button>
        </div>
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {([['events', '📜 Événements', data?.entries?.length ?? 0],
           ['payments', '💰 Paiements', payments?.total ?? '...']] as const).map(([id, label, count]) => (
          <button key={id} onClick={() => setSubTab(id as HistorySubTab)}
                  className="px-4 py-2 text-sm font-medium border-b-2 transition flex items-center gap-1.5"
                  style={{ color: subTab === id ? 'var(--primary)' : 'var(--text-muted)', borderColor: subTab === id ? 'var(--primary)' : 'transparent' }}>
            {label}
            <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Événements */}
      {subTab === 'events' && (() => {
        if (!data) return <Loading/>
        const entries: any[] = data.entries || []
        if (entries.length === 0) return (
          <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <div className="text-4xl mb-2">📜</div>Aucun événement
          </div>
        )
        return (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {entries.map((e, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02]"
                   style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-lg w-6 text-center flex-shrink-0">{EVENT_ICONS[e.eventType] || '📋'}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                      style={{ background: (EVENT_COLORS[e.eventType] || '#888') + '22', color: EVENT_COLORS[e.eventType] || 'var(--text)', minWidth: 64, textAlign: 'center' }}>
                  {e.eventType === 'JOIN' ? 'Rejoint' : e.eventType === 'LEAVE' ? 'Quitté' : e.eventType === 'LEVEL_UP' ? `Niv. ${e.level}` : e.eventType}
                </span>
                <div className="flex-1 text-sm">
                  <span className="font-medium" style={{ color: 'var(--text)' }}>{e.playerName}</span>
                  <span className="mx-1.5" style={{ color: 'var(--text-muted)' }}>→</span>
                  <span style={{ color: 'var(--text-muted)' }}>{cleanJobName(e.jobName)}</span>
                </div>
                <div className="text-xs text-right flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  <div>{fmtDatetime(e.timestamp)}</div>
                  <div style={{ opacity: 0.6 }}>{timeAgo(e.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Paiements */}
      {subTab === 'payments' && (() => {
        if (payLoading || !payments) return <Loading/>
        const entries: any[] = payments.entries || []
        if (entries.length === 0) return (
          <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <div className="text-4xl mb-2">💰</div>Aucun paiement enregistré
          </div>
        )
        return (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {/* Header */}
            <div className="px-4 py-2 grid text-xs font-semibold uppercase"
                 style={{ gridTemplateColumns: '1fr 120px 120px 90px 90px 160px', background: 'var(--surface-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              <span>Joueur → Job</span><span>Action</span><span className="text-right">Argent</span><span className="text-right">Exp</span><span></span><span className="text-right">Date</span>
            </div>
            {entries.map((e, i) => (
              <div key={i} className="px-4 py-2.5 grid items-center gap-2 hover:bg-white/[0.02]"
                   style={{ gridTemplateColumns: '1fr 120px 120px 90px 90px 160px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text)' }}>{e.playerName}</span>
                  <span className="mx-1" style={{ color: 'var(--text-muted)' }}>→</span>
                  <span style={{ color: 'var(--text-muted)' }}>{cleanJobName(e.jobName)}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-medium truncate"
                      style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                  {e.actionType || '—'}
                </span>
                <span className="text-right font-mono font-bold" style={{ color: '#10b981' }}>
                  +{e.amount > 0 ? e.amount.toFixed(2) : '0.00'} $
                </span>
                <span className="text-right font-mono text-xs" style={{ color: '#f59e0b' }}>
                  +{e.exp > 0 ? e.exp.toFixed(1) : '0'} xp
                </span>
                <span></span>
                <div className="text-right" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  <div>{fmtDatetime(e.timestamp)}</div>
                  <div style={{ opacity: 0.6 }}>{timeAgo(e.timestamp)}</div>
                </div>
              </div>
            ))}
            {payments.total > entries.length && (
              <div className="px-4 py-3 text-xs text-center" style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}>
                Affichage des {entries.length} derniers sur {payments.total} paiements — utilisez le filtre joueur/job pour affiner
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ── Catalog ────────────────────────────────────────────────────────────────────
function CatalogTab({ data, days }: { data: any; days?: number }) {
  const [openJob, setOpenJob] = useState<string | null>(null)
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
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {jobs.map(j => {
          const occ = occMap[j.name]
          const total = totalMap[j.name]
          return (
            <button key={j.name}
                 onClick={() => setOpenJob(j.name)}
                 className="text-left rounded-xl p-4 transition hover:scale-[1.02] cursor-pointer"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                  {jobDisplay(j)}
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
              <div className="mt-2 text-xs text-center" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                Cliquer pour les détails →
              </div>
            </button>
          )
        })}
      </div>
      {openJob && <JobDetailModal jobName={openJob} days={days || 7} onClose={() => setOpenJob(null)}/>}
    </>
  )
}

// ── Job detail modal ───────────────────────────────────────────────────────────
function JobDetailModal({ jobName, days, onClose }: { jobName: string; days: number; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.jobsJobDetail(jobName, days).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [jobName, days])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
         onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            💼 {cleanJobName(jobName)} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>({days}j)</span>
          </h2>
          <button onClick={onClose} className="text-2xl" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        {loading || !data ? <Loading/> : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3">
              <Kpi icon="💰" label="Gains total" value={fmtMoney(data.totalMoney || 0)} color="#10b981"/>
              <Kpi icon="📊" label="Paiements" value={String(data.totalPayments || 0)} color="#3b82f6"/>
              <Kpi icon="👥" label="Joueurs uniques" value={String(data.uniquePlayers || 0)} color="#f59e0b"/>
              <Kpi icon="⭐" label="EXP totale" value={fmtMoney(data.totalExp || 0).replace(' $', '')} color="#8b5cf6"/>
            </div>

            {/* Top players */}
            <div className="rounded-xl p-4"
                 style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <h3 className="font-bold mb-2" style={{ color: 'var(--text)' }}>🥇 Top joueurs</h3>
              {!data.topPlayers || data.topPlayers.length === 0 ? (
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun joueur actif sur ce job</div>
              ) : (
                <div className="space-y-1">
                  {data.topPlayers.slice(0, 10).map((p: any, i: number) => (
                    <div key={p.playerUuid || i}
                         className="flex items-center gap-3 px-2 py-1.5 rounded text-sm"
                         style={{ background: 'var(--surface)' }}>
                      <span className="w-6 text-right" style={{ color: 'var(--text-muted)' }}>{i + 1}.</span>
                      <Link to={`/players/${encodeURIComponent(p.playerName)}`}
                            className="flex-1 font-medium hover:underline" style={{ color: 'var(--text)' }}>
                        {p.playerName}
                      </Link>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.payments} paiements</span>
                      <span className="font-bold" style={{ color: '#10b981' }}>{fmtMoney(p.totalMoney)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action type breakdown */}
            <div className="rounded-xl p-4"
                 style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <h3 className="font-bold mb-2" style={{ color: 'var(--text)' }}>⚙️ Breakdown par action</h3>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                Quelles actions rapportent le plus pour ce job
              </p>
              {!data.byActionType || data.byActionType.length === 0 ? (
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune donnée d'action_type</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th className="text-left pb-1">Action</th>
                      <th className="text-right pb-1">Nb</th>
                      <th className="text-right pb-1">Moyen</th>
                      <th className="text-right pb-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byActionType.slice(0, 15).map((a: any, i: number) => {
                      const max = data.byActionType[0]?.totalMoney || 1
                      const pct = (a.totalMoney / max) * 100
                      return (
                        <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="py-1.5">
                            <div className="font-mono text-xs" style={{ color: 'var(--text)' }}>{a.actionType}</div>
                            <div className="h-0.5 rounded mt-0.5" style={{ background: 'var(--bg)' }}>
                              <div className="h-full rounded" style={{ background: '#10b981', width: `${pct}%` }}/>
                            </div>
                          </td>
                          <td className="text-right" style={{ color: 'var(--text-muted)' }}>{a.count}</td>
                          <td className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>{fmtMoney(a.avgMoney)}</td>
                          <td className="text-right font-bold" style={{ color: '#10b981' }}>{fmtMoney(a.totalMoney)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
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
