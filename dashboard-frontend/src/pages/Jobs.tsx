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

type Tab = 'overview' | 'active' | 'history' | 'catalog' | 'custom-jobs' | 'dynamics' | 'tickets' | 'regulator'

const TABS: { id: Tab; label: string; icon: string; section?: string }[] = [
  { id: 'overview',    label: 'Vue générale',   icon: '📊' },
  { id: 'active',      label: 'Joueurs actifs', icon: '👥' },
  { id: 'history',     label: 'Historique',     icon: '📜' },
  { id: 'catalog',     label: 'Catalogue',      icon: '💼' },
  { id: 'custom-jobs', label: 'Métiers Custom', icon: '⚒️',  section: 'Custom' },
  { id: 'dynamics',    label: 'Dynamiques',     icon: '🌍',  section: 'Custom' },
  { id: 'tickets',     label: 'Tickets',        icon: '🎫',  section: 'Custom' },
  { id: 'regulator',   label: 'Régulateur',     icon: '⚖️',  section: 'Custom' },
]

const REBORN_TABS: Tab[] = ['overview', 'active', 'history', 'catalog']
const REBORN_PANEL_KEY = 'jobs.reborn.panel.enabled'

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
  const [rebornEnabled, setRebornEnabled] = useState<boolean>(() => {
    const v = localStorage.getItem(REBORN_PANEL_KEY)
    return v === null ? true : v === '1'
  })
  const [tab, setTab] = useState<Tab>(rebornEnabled ? 'overview' : 'custom-jobs')
  const [days, setDays] = useState(7)
  const [overview, setOverview] = useState<any>(null)
  const [active, setActive] = useState<any>(null)
  const [history, setHistory] = useState<any>(null)
  const [historyFilter, setHistoryFilter] = useState({ player: '', job: '' })
  const [loading, setLoading] = useState(false)

  const toggleReborn = (next: boolean) => {
    setRebornEnabled(next)
    localStorage.setItem(REBORN_PANEL_KEY, next ? '1' : '0')
    if (!next && REBORN_TABS.includes(tab)) setTab('custom-jobs')
  }

  const refresh = async () => {
    if (!rebornEnabled && REBORN_TABS.includes(tab)) return
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
          <Link to="/roadmap"
                className="px-3 py-2 rounded text-xs font-medium hover:opacity-80 transition"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--primary)' }}>
            🗂️ Roadmap
          </Link>
          <RebornSwitch enabled={rebornEnabled} onToggle={toggleReborn} />
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

      {/* Bandeau si Jobs Reborn désactivé manuellement */}
      {!rebornEnabled && (
        <div className="rounded-xl p-4 flex items-center justify-between gap-3"
             style={{ background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.3)' }}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">🚫</div>
            <div>
              <div className="font-bold" style={{ color: 'var(--text)' }}>Panel Jobs Reborn désactivé</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Les onglets Vue générale, Joueurs actifs, Historique et Catalogue sont masqués. Les Métiers Custom restent disponibles.
              </div>
            </div>
          </div>
          <button onClick={() => toggleReborn(true)}
                  className="px-3 py-2 rounded text-sm font-medium"
                  style={{ background: 'var(--primary)', color: 'white' }}>
            Réactiver
          </button>
        </div>
      )}

      {/* Bandeau si Jobs Reborn pas installé */}
      {rebornEnabled && installed === false && (
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
      <div className="flex gap-1 border-b items-center" style={{ borderColor: 'var(--border)' }}>
        {TABS.filter(t => rebornEnabled || !REBORN_TABS.includes(t.id)).map((t, i, arr) => (
          <>
            {i > 0 && t.section && !arr[i-1].section && (
              <div key={`sep-${i}`} className="h-5 w-px mx-1" style={{ background: 'var(--border)' }} />
            )}
            <button key={t.id} onClick={() => setTab(t.id)}
                    className="px-4 py-2 text-sm font-medium border-b-2 transition"
                    style={{
                      color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                      borderColor: tab === t.id ? 'var(--primary)' : 'transparent',
                    }}>
              {t.icon} {t.label}
            </button>
          </>
        ))}
      </div>

      {rebornEnabled && tab === 'overview'    && <OverviewTab data={overview} days={days}/>}
      {rebornEnabled && tab === 'active'      && <ActiveTab data={active} />}
      {rebornEnabled && tab === 'history'     && <HistoryTab data={history} onRefresh={refresh}
                                            filter={historyFilter}
                                            onFilterChange={f => { setHistoryFilter(f); refreshHistory(f) }} />}
      {rebornEnabled && tab === 'catalog'     && <CatalogTab data={overview} days={days} />}
      {tab === 'custom-jobs' && <CustomJobsTab />}
      {tab === 'dynamics'    && <DynamicsTab />}
      {tab === 'tickets'     && <TicketsTab />}
      {tab === 'regulator'   && <RegulatorTab />}
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

function RebornSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: (next: boolean) => void }) {
  return (
    <button onClick={() => onToggle(!enabled)}
            title={enabled ? 'Cliquer pour désactiver le panel Jobs Reborn' : 'Cliquer pour réactiver le panel Jobs Reborn'}
            className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition"
            style={{
              background: enabled ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.15)',
              border: `1px solid ${enabled ? 'rgba(16,185,129,0.4)' : 'rgba(100,116,139,0.4)'}`,
              color: enabled ? '#10b981' : 'var(--text-muted)',
            }}>
      <span className="relative inline-block w-8 h-4 rounded-full transition"
            style={{ background: enabled ? '#10b981' : '#64748b' }}>
        <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
              style={{ left: enabled ? 'calc(100% - 14px)' : '2px' }}/>
      </span>
      Jobs Reborn {enabled ? 'ON' : 'OFF'}
    </button>
  )
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

// ── Custom Jobs Tab ───────────────────────────────────────────────────────────
function CustomJobsTab() {
  const [jobs, setJobs] = useState<any[]>([])
  const [slots, setSlots] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [openJob, setOpenJob] = useState<string | null>(null)
  const [busyJob, setBusyJob] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const [j, s] = await Promise.all([
        api.customJobsList(),
        api.customJobsAdminGetSlots().catch(() => ({})),
      ])
      setJobs(j)
      setSlots(s)
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const toggleJob = async (jobId: string, next: boolean) => {
    setBusyJob(jobId)
    try {
      await api.customJobsAdminToggleJob(jobId, next)
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, enabled: next } : j))
    } catch (e: any) {
      alert('Erreur : ' + (e?.message ?? 'inconnue'))
    } finally {
      setBusyJob(null)
    }
  }

  const toggleAntiFarm = async (jobId: string, next: boolean) => {
    setBusyJob(jobId + ':af')
    try {
      await api.customJobsAdminToggleAntiFarm(jobId, next)
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, anti_farm: next } : j))
    } catch (e: any) {
      alert('Erreur : ' + (e?.message ?? 'inconnue'))
    } finally {
      setBusyJob(null)
    }
  }

  if (loading) return <Loading/>

  return (
    <div className="space-y-4">
      <SlotsEditor slots={slots} onChange={setSlots}/>

      {jobs.length === 0 ? (
        <div className="rounded-xl p-12 text-center"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <div className="text-4xl mb-2">⚒️</div>
          Aucun métier custom configuré — vérifier <code>jobs.yml</code>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {jobs.map((j: any) => {
            const enabled = j.enabled !== false
            const antiFarm = j.anti_farm !== false
            return (
              <div key={j.id}
                   className="rounded-xl p-4 transition flex flex-col gap-2"
                   style={{
                     background: 'var(--surface)',
                     border: `1px solid ${enabled ? 'var(--border)' : 'rgba(239,68,68,0.4)'}`,
                     opacity: enabled ? 1 : 0.7,
                   }}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>{j.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    Niv max {j.max_level}
                  </span>
                </div>
                {j.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{j.description}</p>}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Joueurs" value={String(j.player_count ?? 0)} color="#3b82f6"/>
                  <Stat label="Niv. moy." value={(j.avg_level ?? 0).toFixed(1)} color="#f59e0b"/>
                  <Stat label="Total versé" value={fmtMoney(j.total_paid ?? 0)} color="#10b981"/>
                </div>
                {j.actions && Object.keys(j.actions).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(j.actions).map((type: string) => (
                      <span key={type} className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                            style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                        {type}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => toggleJob(j.id, !enabled)}
                          disabled={busyJob === j.id}
                          className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition"
                          style={{
                            background: enabled ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                            border: `1px solid ${enabled ? 'rgba(16,185,129,0.4)' : 'rgba(100,116,139,0.4)'}`,
                            color: enabled ? '#10b981' : 'var(--text-muted)',
                          }}>
                    {busyJob === j.id ? '⏳' : enabled ? '✓ Activé' : '✖ Désactivé'}
                  </button>
                  <button onClick={() => toggleAntiFarm(j.id, !antiFarm)}
                          disabled={busyJob === j.id + ':af'}
                          title={antiFarm ? 'Anti-farm actif — cliquer pour désactiver' : 'Anti-farm désactivé — cliquer pour activer'}
                          className="px-3 py-1.5 rounded text-xs font-medium transition"
                          style={{
                            background: antiFarm ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                            border: `1px solid ${antiFarm ? 'rgba(245,158,11,0.4)' : 'rgba(100,116,139,0.4)'}`,
                            color: antiFarm ? '#f59e0b' : 'var(--text-muted)',
                          }}>
                    {busyJob === j.id + ':af' ? '⏳' : antiFarm ? '🛡 AF' : '🛡 AF off'}
                  </button>
                  <button onClick={() => setOpenJob(j.id)}
                          className="px-3 py-1.5 rounded text-xs"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AdminForceJobPanel jobs={jobs} />

      {openJob && <CustomJobLeaderboardModal jobId={openJob} jobs={jobs} onClose={() => setOpenJob(null)} />}
    </div>
  )
}

function AdminForceJobPanel({ jobs }: { jobs: any[] }) {
  const [playerName, setPlayerName] = useState('')
  const [jobId,      setJobId]      = useState('')
  const [busy,       setBusy]       = useState(false)
  const [result,     setResult]     = useState<{ ok: boolean; msg: string } | null>(null)

  if (jobs.length === 0) return null

  const handleJoin = async () => {
    if (!playerName.trim() || !jobId) return
    setBusy(true); setResult(null)
    try {
      const r = await api.customJobsAdminForceJoin(playerName.trim(), jobId)
      setResult({ ok: r.ok, msg: r.ok ? `✓ ${playerName} a rejoint ${jobId}` : `✗ ${r.reason}` })
    } catch (e: any) {
      setResult({ ok: false, msg: '✗ ' + (e?.message ?? 'Erreur') })
    } finally { setBusy(false) }
  }

  const handleLeave = async () => {
    if (!playerName.trim() || !jobId) return
    setBusy(true); setResult(null)
    try {
      const r = await api.customJobsAdminForceLeave(playerName.trim(), jobId)
      setResult({ ok: r.ok, msg: r.ok ? `✓ ${playerName} a quitté ${jobId}` : `✗ ${r.reason}` })
    } catch (e: any) {
      setResult({ ok: false, msg: '✗ ' + (e?.message ?? 'Erreur') })
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl p-5 space-y-3"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🔧</span>
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Assigner / Retirer un métier (admin)</span>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-32">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Pseudo joueur</label>
          <input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Steve"
            className="px-3 py-2 rounded text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-40">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Métier</label>
          <select
            value={jobId}
            onChange={e => setJobId(e.target.value)}
            className="px-3 py-2 rounded text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="">— Choisir —</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={handleJoin} disabled={busy || !playerName.trim() || !jobId}
                  className="px-4 py-2 rounded text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981' }}>
            {busy ? '⏳' : '➕ Rejoindre'}
          </button>
          <button onClick={handleLeave} disabled={busy || !playerName.trim() || !jobId}
                  className="px-4 py-2 rounded text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}>
            {busy ? '⏳' : '✖ Retirer'}
          </button>
        </div>
      </div>
      {result && (
        <p className="text-xs font-medium"
           style={{ color: result.ok ? '#10b981' : '#f87171' }}>
          {result.msg}
        </p>
      )}
    </div>
  )
}

function SlotsEditor({ slots, onChange }: { slots: Record<string, number>; onChange: (s: Record<string, number>) => void }) {
  const [newRank, setNewRank] = useState('')
  const [newSlots, setNewSlots] = useState(2)
  const [busy, setBusy] = useState(false)
  const entries = Object.entries(slots).sort(([a], [b]) => a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b))

  const updateSlot = async (rank: string, n: number) => {
    setBusy(true)
    try { onChange(await api.customJobsAdminPutSlots(rank, n)) }
    finally { setBusy(false) }
  }
  const addRank = async () => {
    if (!newRank.trim()) return
    await updateSlot(newRank.trim().toLowerCase(), newSlots)
    setNewRank('')
    setNewSlots(2)
  }
  const removeRank = async (rank: string) => {
    if (rank === 'default') return
    if (!confirm(`Supprimer le rang "${rank}" ? Les joueurs reviendront au rang 'default'.`)) return
    await updateSlot(rank, -1)
  }

  return (
    <div className="rounded-xl p-4 space-y-3"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold" style={{ color: 'var(--text)' }}>🎟️ Slots métiers par rang</h3>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Nombre de métiers qu'un joueur peut rejoindre selon son groupe LuckPerms
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {entries.map(([rank, n]) => (
          <div key={rank} className="flex items-center gap-2 px-3 py-2 rounded"
               style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>
              {rank === 'default' ? '⭐ default' : rank}
            </span>
            <input type="number" min={0} max={50}
                   defaultValue={n}
                   disabled={busy}
                   onBlur={(e) => {
                     const v = parseInt(e.target.value, 10)
                     if (!isNaN(v) && v !== n) updateSlot(rank, Math.max(0, v))
                   }}
                   className="w-14 px-2 py-1 rounded text-sm text-center"
                   style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
            {rank !== 'default' && (
              <button onClick={() => removeRank(rank)}
                      title="Supprimer ce rang"
                      className="w-7 h-7 rounded text-xs"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>×</button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <input type="text" placeholder="Nom du rang LuckPerms (ex: vip)"
               value={newRank}
               onChange={(e) => setNewRank(e.target.value)}
               className="flex-1 px-3 py-1.5 rounded text-sm"
               style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
        <input type="number" min={0} max={50} value={newSlots}
               onChange={(e) => setNewSlots(Math.max(0, parseInt(e.target.value, 10) || 0))}
               className="w-16 px-2 py-1.5 rounded text-sm text-center"
               style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
        <button onClick={addRank}
                disabled={!newRank.trim() || busy}
                className="px-3 py-1.5 rounded text-sm font-medium"
                style={{ background: 'var(--primary)', color: 'white', opacity: !newRank.trim() ? 0.5 : 1 }}>
          + Ajouter
        </button>
      </div>
    </div>
  )
}

function CustomJobLeaderboardModal({ jobId, jobs, onClose }: { jobId: string; jobs: any[]; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const job = jobs.find(j => j.id === jobId)

  useEffect(() => {
    api.customJobsLeaderboard(jobId).then(setRows).catch(() => {}).finally(() => setLoading(false))
  }, [jobId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
         onClick={onClose}>
      <div className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl p-6 space-y-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            ⚒️ {job?.name ?? jobId} — Classement
          </h2>
          <button onClick={onClose} className="text-2xl" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>
        {loading ? <Loading/> : rows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Aucun joueur dans ce métier.</p>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {rows.map((r: any, i: number) => (
              <div key={r.uuid} className="px-4 py-2.5 flex items-center gap-3 text-sm"
                   style={{ borderBottom: '1px solid var(--border)', background: i === 0 ? 'rgba(245,158,11,0.07)' : undefined }}>
                <span className="w-6 text-right font-bold"
                      style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--text-muted)' }}>
                  {i + 1}
                </span>
                <span className="flex-1 font-medium" style={{ color: 'var(--text)' }}>{r.uuid}</span>
                <span style={{ color: '#f59e0b' }}>Niv. {r.level}</span>
                <span className="font-bold" style={{ color: '#10b981' }}>{fmtMoney(r.total_earned)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dynamics Tab ──────────────────────────────────────────────────────────────
const SUBSYSTEM_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  global:   { label: 'Global',          icon: '🌍', desc: 'Active/désactive tout le système de dynamiques' },
  seasons:  { label: 'Saisons',         icon: '🍂', desc: 'Multiplicateurs par saison (hiver, été…)' },
  weather:  { label: 'Météo',           icon: '🌧', desc: 'Bonus/malus selon la météo en jeu' },
  time:     { label: 'Cycle jour/nuit', icon: '🌙', desc: 'Bonus la nuit (Chasseur ×3, etc.)' },
  heatmap:  { label: 'Heatmap',         icon: '🔥', desc: 'Malus anti-surexploitation par chunk' },
  events:   { label: 'Évènements',      icon: '⚡', desc: 'Évènements aléatoires (Filon Doré, etc.)' },
  bulletin: { label: 'Bulletin',        icon: '📰', desc: 'Demande forte du jour (+20-80%)' },
}

function DynamicsTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.customJobsDynamics().then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const toggle = async (system: string, enabled: boolean) => {
    setBusy(system)
    try {
      const res = await api.customJobsAdminToggle(system, enabled)
      setData((prev: any) => prev ? { ...prev, enabled: res.states?.global ?? prev.enabled, subsystems: res.states ?? prev.subsystems } : prev)
    } catch (e: any) { alert('Erreur : ' + e.message) } finally { setBusy(null) }
  }

  const triggerEvent = async (id: string) => {
    if (!confirm(`Déclencher l'évènement "${id}" maintenant ?`)) return
    setBusy('event-' + id)
    try { await api.customJobsAdminTriggerEvent(id); load() }
    catch (e: any) { alert('Erreur : ' + e.message) } finally { setBusy(null) }
  }

  const refreshBulletin = async () => {
    if (!confirm('Forcer un nouveau bulletin du jour ? Le job en cours changera.')) return
    setBusy('bulletin')
    try { const res = await api.customJobsAdminRefreshBulletin(); setData((p: any) => p ? { ...p, bulletin: res } : p) }
    catch (e: any) { alert('Erreur : ' + e.message) } finally { setBusy(null) }
  }

  const clearHeatmap = async () => {
    if (!confirm('Vider TOUTE la heatmap ? Les malus de surexploitation seront réinitialisés.')) return
    setBusy('heatmap-clear')
    try { await api.customJobsAdminClearHeatmap(); alert('✓ Heatmap vidée.') }
    catch (e: any) { alert('Erreur : ' + e.message) } finally { setBusy(null) }
  }

  const reloadConfig = async () => {
    setBusy('reload')
    try { const res = await api.customJobsAdminReloadDynamics(); setData(res); alert('✓ dynamics.yml rechargé + overrides réinitialisés.') }
    catch (e: any) { alert('Erreur : ' + e.message) } finally { setBusy(null) }
  }

  if (loading) return <Loading/>
  if (!data) return (
    <div className="rounded-xl p-12 text-center"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
      <div className="text-4xl mb-2">🔧</div>
      Module Custom Jobs non disponible
    </div>
  )

  const subsystems: Record<string, boolean> = data.subsystems ?? {}

  return (
    <div className="space-y-5">

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <button onClick={reloadConfig} disabled={busy === 'reload'}
                className="px-3 py-2 rounded-lg text-sm font-medium transition"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
          {busy === 'reload' ? '⏳' : '↺ Recharger dynamics.yml'}
        </button>
        <button onClick={clearHeatmap} disabled={busy === 'heatmap-clear'}
                className="px-3 py-2 rounded-lg text-sm font-medium transition"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          {busy === 'heatmap-clear' ? '⏳' : '🗑 Vider heatmap'}
        </button>
        <button onClick={load} className="px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          ↻ Refresh
        </button>
      </div>

      {/* Subsystem toggles */}
      <div className="rounded-xl overflow-hidden"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3 font-semibold text-sm border-b"
             style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          ⚙️ Sous-systèmes — overrides en mémoire (réinitialisés au reload)
        </div>
        {Object.entries(SUBSYSTEM_LABELS).map(([key, meta]) => {
          const enabled = subsystems[key] ?? true
          const isBusy  = busy === key
          return (
            <div key={key} className="px-5 py-3 flex items-center gap-4"
                 style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xl w-6 text-center">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{meta.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{meta.desc}</p>
              </div>
              <button
                disabled={isBusy}
                onClick={() => toggle(key, !enabled)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                style={{
                  background: enabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                  color: enabled ? '#10b981' : '#ef4444',
                  border: `1px solid ${enabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
                  minWidth: 90,
                }}>
                {isBusy ? '⏳' : enabled ? '✓ Actif' : '✗ Inactif'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Current state : season + bulletin */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold mb-2 text-sm" style={{ color: 'var(--text)' }}>🍂 Saison courante</h3>
          {data.season ? (
            <div className="flex items-center gap-3">
              <span className="text-3xl">{data.season.icon}</span>
              <div>
                <p className="font-bold" style={{ color: 'var(--text)' }}>{data.season.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{data.season.key}</p>
              </div>
            </div>
          ) : <p style={{ color: 'var(--text-muted)' }}>—</p>}
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>📰 Bulletin du jour</h3>
            <button onClick={refreshBulletin} disabled={busy === 'bulletin'}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
              {busy === 'bulletin' ? '⏳' : '↺ Nouveau tirage'}
            </button>
          </div>
          {data.bulletin?.job_id ? (
            <div>
              <p className="font-bold" style={{ color: '#f59e0b' }}>
                {data.bulletin.job_id}
                <span className="font-mono ml-2" style={{ color: '#10b981' }}>×{(data.bulletin.multiplier ?? 1).toFixed(1)}</span>
              </p>
              {data.bulletin.refreshed_at > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Rafraîchi {timeAgo(data.bulletin.refreshed_at)}
                </p>
              )}
            </div>
          ) : <p style={{ color: 'var(--text-muted)' }}>—</p>}
        </div>
      </div>

      {/* Active events */}
      <div className="rounded-xl overflow-hidden"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3 font-semibold text-sm border-b flex items-center justify-between"
             style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <span>⚡ Évènements actifs ({(data.active_events ?? []).length})</span>
          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Force-trigger ci-dessous</span>
        </div>
        {(data.active_events ?? []).length === 0 ? (
          <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>Aucun évènement en cours.</p>
        ) : (data.active_events as any[]).map((ev: any) => (
          <div key={ev.id} className="px-5 py-3 flex items-center gap-4"
               style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: '#f59e0b' }}>{ev.id}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Job cible : {ev.target_job ?? 'global'} · Expire {timeAgo(ev.ends_at)}
              </p>
            </div>
            <div className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
              <div>+{ev.reward_xp} XP</div>
              <div style={{ color: '#10b981' }}>+{ev.reward_money} $</div>
            </div>
          </div>
        ))}
      </div>

      {/* Trigger buttons */}
      {data.event_templates !== undefined && (
        <div className="rounded-xl p-4 space-y-2"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>⚡ Force-trigger un évènement</h3>
          <div className="flex flex-wrap gap-2">
            {['golden_vein','forest_blessing','fishing_frenzy','monster_invasion','golden_harvest'].map(id => (
              <button key={id} onClick={() => triggerEvent(id)} disabled={busy === 'event-' + id}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                {busy === 'event-' + id ? '⏳' : id.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Si un évènement du même job est déjà actif, le trigger sera ignoré.
          </p>
        </div>
      )}
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

// ── Tickets tab ─────────────────────────────────────────────────────────────

const TICKET_TYPES = [
  { id: 'extra_slot',     label: '+1 slot métier',  icon: '🎟️', desc: 'Permet de rejoindre un métier de plus' },
  { id: 'xp_boost_25',    label: '+25% XP / argent', icon: '✨', desc: 'Bonus multiplicatif sur tous les gains' },
  { id: 'bypass_heatmap', label: 'Bypass heatmap',   icon: '🔥', desc: 'Ignore la pénalité de zone surexploitée' },
]

function TicketsTab() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ playerName: '', type: 'xp_boost_25', durationHours: 24 })

  const refresh = () => {
    setLoading(true)
    api.customJobsAdminListTickets().then(setList).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [])

  const grant = async () => {
    if (!form.playerName.trim()) return
    setBusy(true)
    try {
      await api.customJobsAdminGrantTicket(form.playerName.trim(), form.type, form.durationHours)
      setForm({ ...form, playerName: '' })
      refresh()
    } catch (e: any) { alert('Erreur : ' + (e?.message ?? 'inconnue')) }
    finally { setBusy(false) }
  }
  const revoke = async (id: number) => {
    if (!confirm('Révoquer ce ticket ?')) return
    await api.customJobsAdminRevokeTicket(id)
    refresh()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 space-y-3"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="font-bold" style={{ color: 'var(--text)' }}>🎫 Émettre un ticket</h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Distribue un bonus temporaire à un joueur (vote, crate, événement). Survit aux reboots.
        </p>
        <div className="grid grid-cols-12 gap-2">
          <input type="text" placeholder="Nom du joueur"
                 value={form.playerName}
                 onChange={e => setForm({ ...form, playerName: e.target.value })}
                 className="col-span-4 px-3 py-2 rounded text-sm"
                 style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
          <select value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="col-span-4 px-3 py-2 rounded text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {TICKET_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
          </select>
          <input type="number" min={1} max={720}
                 value={form.durationHours}
                 onChange={e => setForm({ ...form, durationHours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                 className="col-span-2 px-3 py-2 rounded text-sm text-center"
                 style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
          <button onClick={grant} disabled={busy || !form.playerName.trim()}
                  className="col-span-2 px-3 py-2 rounded text-sm font-medium"
                  style={{ background: 'var(--primary)', color: 'white', opacity: !form.playerName.trim() ? 0.5 : 1 }}>
            + Émettre
          </button>
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {TICKET_TYPES.find(t => t.id === form.type)?.desc} · durée en heures
        </p>
      </div>

      <div className="rounded-xl p-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold" style={{ color: 'var(--text)' }}>Tickets actifs ({list.length})</h3>
          <button onClick={refresh} className="text-xs" style={{ color: 'var(--text-muted)' }}>↻</button>
        </div>
        {loading ? <Loading/> : list.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Aucun ticket actif.</p>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--surface-2)' }}>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left px-3 py-2 text-xs">Joueur</th>
                  <th className="text-left px-3 py-2 text-xs">Type</th>
                  <th className="text-left px-3 py-2 text-xs">Expire</th>
                  <th className="text-left px-3 py-2 text-xs">Émis par</th>
                  <th className="px-3 py-2 text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {list.map(t => {
                  const meta = TICKET_TYPES.find(tt => tt.id === t.type)
                  const remH = Math.max(0, Math.round((t.expires_at - Date.now()) / 3_600_000))
                  return (
                    <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{t.uuid.slice(0, 8)}…</td>
                      <td className="px-3 py-2">{meta?.icon} {meta?.label ?? t.type}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: remH < 6 ? '#ef4444' : 'var(--text-muted)' }}>
                        dans {remH}h
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{t.granted_by}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => revoke(t.id)}
                                className="text-xs px-2 py-1 rounded"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                          Révoquer
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Regulator tab ───────────────────────────────────────────────────────────

function RegulatorTab() {
  const [state, setState] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const [s, h, j] = await Promise.all([
        api.customJobsAdminRegulator(),
        api.customJobsAdminRegulatorHistory(7),
        api.customJobsList(),
      ])
      setState(s); setHistory(h); setJobs(j)
    } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const patch = async (body: any) => {
    setBusy(true)
    try { await api.customJobsAdminRegulatorPatch(body); await refresh() }
    finally { setBusy(false) }
  }
  const freeze = async (jobId: string, mult: number) => {
    setBusy(true)
    try { await api.customJobsAdminRegulatorFreeze(jobId, mult); await refresh() }
    finally { setBusy(false) }
  }

  if (loading || !state) return <Loading/>

  const lastTickStr = state.last_tick_at
    ? new Date(state.last_tick_at).toLocaleTimeString('fr-FR')
    : 'jamais'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              ⚖️ Régulateur économique
              <span className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: state.enabled ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                      color: state.enabled ? '#10b981' : 'var(--text-muted)',
                    }}>
                {state.enabled ? 'ACTIF' : 'INACTIF'}
              </span>
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Auto-ajuste les payouts par métier selon la distribution de joueurs · dernier tick : {lastTickStr}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => patch({ enabled: !state.enabled })} disabled={busy}
                    className="px-3 py-2 rounded text-xs font-medium"
                    style={{
                      background: state.enabled ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                      color: state.enabled ? '#ef4444' : '#10b981',
                      border: `1px solid ${state.enabled ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
                    }}>
              {state.enabled ? '⏸ Désactiver' : '▶ Activer'}
            </button>
            <button onClick={() => patch({ tickNow: true })} disabled={busy}
                    className="px-3 py-2 rounded text-xs"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              ↻ Forcer tick
            </button>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <span>Agressivité</span>
            <span className="font-mono">{(state.aggressiveness * 100).toFixed(0)}%</span>
          </div>
          <input type="range" min={0} max={100} value={state.aggressiveness * 100}
                 onChange={e => setState({ ...state, aggressiveness: parseInt(e.target.value, 10) / 100 })}
                 onMouseUp={e => patch({ aggressiveness: parseInt((e.target as HTMLInputElement).value, 10) / 100 })}
                 className="w-full"/>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            0% = aucun effet · 100% = correction maximale (multiplier 0.7x à 1.4x selon distribution)
          </p>
        </div>
      </div>

      {/* Per-job state */}
      <div className="rounded-xl p-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>Multiplicateurs actuels</h3>
        {jobs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun métier.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((j: any) => {
              const mult  = state.multipliers[j.id] ?? 1.0
              const share = state.shares[j.id] ?? 0
              const frozen = state.frozen[j.id]
              const color = mult > 1.05 ? '#10b981' : mult < 0.95 ? '#ef4444' : 'var(--text-muted)'
              return (
                <div key={j.id} className="flex items-center gap-3 px-3 py-2 rounded"
                     style={{ background: 'var(--surface-2)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{j.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {(share * 100).toFixed(1)}% de la pop · {j.player_count ?? 0} joueurs
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold" style={{ color }}>
                      ×{mult.toFixed(2)}
                    </span>
                    {frozen != null && (
                      <span className="text-[10px] font-bold text-orange-400 bg-orange-500/15 px-1.5 py-0.5 rounded">
                        🔒 {frozen.toFixed(2)}
                      </span>
                    )}
                    <input type="number" step={0.05} min={0.7} max={1.4}
                           defaultValue={frozen ?? mult}
                           onBlur={e => {
                             const v = parseFloat(e.target.value)
                             if (!isNaN(v)) freeze(j.id, v)
                           }}
                           title="Freeze à cette valeur"
                           className="w-16 px-1 py-0.5 rounded text-xs text-center"
                           style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
                    {frozen != null && (
                      <button onClick={() => freeze(j.id, -1)}
                              title="Libérer"
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>×</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* History sparklines */}
      {history.length > 0 && (
        <div className="rounded-xl p-4"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>Historique 7j (par métier)</h3>
          <div className="grid grid-cols-2 gap-3">
            {jobs.map((j: any) => (
              <RegulatorSparkline key={j.id} jobName={j.name}
                                  data={history.filter(h => h.job_id === j.id)}/>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RegulatorSparkline({ jobName, data }: { jobName: string; data: { ts: number; multiplier: number }[] }) {
  if (data.length === 0) return (
    <div className="rounded p-2 text-xs"
         style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
      {jobName} — pas de données
    </div>
  )
  const min = 0.7, max = 1.4
  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * 100
    const y = 100 - ((d.multiplier - min) / (max - min)) * 100
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = data[data.length - 1].multiplier
  const color = last > 1.05 ? '#10b981' : last < 0.95 ? '#ef4444' : '#94a3b8'
  return (
    <div className="rounded p-2"
         style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{jobName}</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>×{last.toFixed(2)}</span>
      </div>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-8">
        <line x1={0} y1={(100 - ((1.0 - min) / (max - min)) * 100) * 0.3} x2={100} y2={(100 - ((1.0 - min) / (max - min)) * 100) * 0.3}
              stroke="var(--border)" strokeDasharray="2 2" strokeWidth="0.3"/>
        <polyline fill="none" stroke={color} strokeWidth="1" points={points}
                  vectorEffect="non-scaling-stroke" transform="scale(1, 0.3)"/>
      </svg>
    </div>
  )
}
