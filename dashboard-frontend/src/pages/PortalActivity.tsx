import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

type Tab = 'stats' | 'logins' | 'pageviews' | 'referrals'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDateShort(ts: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{msg}</div>
  )
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <tr>
      {cols.map(c => (
        <th key={c} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          {c}
        </th>
      ))}
    </tr>
  )
}

// ── Stats tab ─────────────────────────────────────────────────────────────────

function StatsTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.portalActivityStats().then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <EmptyState msg="Chargement…" />
  if (!data)   return <EmptyState msg="Aucune donnée" />

  const kpis = [
    { label: 'Connexions aujourd\'hui', value: data.logins_today,    icon: '🔑' },
    { label: 'Connexions 30j',          value: data.logins_30d,      icon: '📅' },
    { label: 'Échecs aujourd\'hui',     value: data.failed_today,    icon: '❌' },
    { label: 'Pages vues auj.',         value: data.pageviews_today, icon: '👁' },
    { label: 'Pages vues 30j',          value: data.pageviews_30d,   icon: '📊' },
    { label: 'DAU (utilisateurs/jour)', value: data.dau,             icon: '👤' },
    { label: 'MAU (utilisateurs/mois)', value: data.mau,             icon: '👥' },
  ]

  // Bar chart DAU 30j
  const dauHistory: { ts: number; dau: number }[] = data.dau_history ?? []
  const maxDau = Math.max(1, ...dauHistory.map((d: any) => d.dau))

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl p-4 text-center"
               style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="text-2xl mb-1">{k.icon}</div>
            <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{k.value ?? 0}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DAU chart */}
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Utilisateurs actifs / jour (30j)</p>
          {dauHistory.length === 0 ? <EmptyState msg="Pas encore de données" /> : (
            <div className="flex items-end gap-1 h-24">
              {dauHistory.map((pt: any) => (
                <div key={pt.ts} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-sm transition-all"
                       style={{ height: `${Math.round((pt.dau / maxDau) * 80)}px`, background: 'var(--accent)', opacity: 0.7 }} />
                  <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>{fmtDateShort(pt.ts)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top routes */}
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Top routes (30j)</p>
          {(data.top_routes ?? []).length === 0 ? <EmptyState msg="Aucune donnée" /> : (
            <div className="space-y-1.5">
              {(data.top_routes as any[]).map((r: any) => (
                <div key={r.route} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono truncate" style={{ color: 'var(--text)' }}>{r.route}</span>
                  <span className="shrink-0 font-bold" style={{ color: 'var(--accent)' }}>{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top users */}
        <div className="rounded-xl p-4 md:col-span-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Joueurs les plus actifs (30j)</p>
          {(data.top_users ?? []).length === 0 ? <EmptyState msg="Aucune donnée" /> : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(data.top_users as any[]).map((u: any, i: number) => (
                <div key={u.username} className="rounded-lg p-2.5 text-center"
                     style={{ background: 'var(--card-hover)', border: '1px solid var(--border)' }}>
                  <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>#{i + 1}</div>
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{u.username}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{u.count} vues</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Logins tab ────────────────────────────────────────────────────────────────

function LoginsTab() {
  const [rows, setRows]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage]     = useState(0)
  const LIMIT = 100

  const load = useCallback(async (search: string, pg: number) => {
    setLoading(true)
    try {
      const d = await api.portalActivityLogins({ uuid: search || undefined, limit: LIMIT, offset: pg * LIMIT })
      setRows(d.logins)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(filter, page) }, [filter, page, load])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }}
          placeholder="Filtrer par UUID ou pseudo…"
          className="px-3 py-2 rounded-lg text-sm w-full max-w-sm outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{rows.length} résultats</span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--card)' }}>
              <TableHeader cols={['Date', 'Pseudo', 'UUID', 'IP', 'Statut']} />
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Chargement…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Aucun résultat</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--card)' : 'transparent' }}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{fmtDate(r.ts)}</td>
                  <td className="px-3 py-2 font-medium" style={{ color: 'var(--text)' }}>{r.username}</td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{r.uuid ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{r.ip ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={r.success
                            ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                            : { background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                      {r.success ? 'Succès' : 'Échec'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          ← Préc.
        </button>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page + 1}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={rows.length < LIMIT}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          Suiv. →
        </button>
      </div>
    </div>
  )
}

// ── Page views tab ────────────────────────────────────────────────────────────

function PageViewsTab() {
  const [rows, setRows]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage]     = useState(0)
  const LIMIT = 200

  const load = useCallback(async (search: string, pg: number) => {
    setLoading(true)
    try {
      const d = await api.portalActivityPageViews({ uuid: search || undefined, limit: LIMIT, offset: pg * LIMIT })
      setRows(d.pageviews)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(filter, page) }, [filter, page, load])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }}
          placeholder="Filtrer par UUID, pseudo ou route…"
          className="px-3 py-2 rounded-lg text-sm w-full max-w-sm outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{rows.length} résultats</span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--card)' }}>
              <TableHeader cols={['Date', 'Pseudo', 'Route', 'Méthode']} />
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Chargement…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Aucun résultat</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--card)' : 'transparent' }}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{fmtDate(r.ts)}</td>
                  <td className="px-3 py-2 font-medium" style={{ color: 'var(--text)' }}>{r.username ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text)' }}>{r.route}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono"
                          style={{ background: 'var(--card-hover)', color: 'var(--accent)' }}>
                      {r.method}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          ← Préc.
        </button>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page + 1}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={rows.length < LIMIT}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          Suiv. →
        </button>
      </div>
    </div>
  )
}

// ── Referrals tab ─────────────────────────────────────────────────────────────

function ReferralsTab() {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage]     = useState(0)
  const LIMIT = 100

  const load = useCallback(async (pg: number) => {
    setLoading(true)
    try { setData(await api.portalActivityReferrals({ limit: LIMIT, offset: pg * LIMIT })) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(page) }, [page, load])

  const rows: any[]       = data?.referrals     ?? []
  const top:  any[]       = data?.top_referrers ?? []

  return (
    <div className="space-y-5">
      {/* Top parrains */}
      {top.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>🏆 Top parrains</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {top.map((u: any, i: number) => (
              <div key={u.username} className="rounded-lg p-2.5 text-center"
                   style={{ background: 'var(--card-hover)', border: '1px solid var(--border)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>#{i + 1}</div>
                <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{u.username}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{u.count} filleul{u.count > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--card)' }}>
              <TableHeader cols={['Date', 'Nouveau joueur', 'Parrain', 'Code', 'Validé']} />
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Chargement…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Aucun parrainage enregistré</td></tr>
              )}
              {rows.map((r: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--card)' : 'transparent' }}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{fmtDate(r.ts)}</td>
                  <td className="px-3 py-2 font-medium" style={{ color: 'var(--text)' }}>{r.referred_name ?? r.referred_uuid?.slice(0, 8) ?? '—'}</td>
                  <td className="px-3 py-2 font-medium" style={{ color: 'var(--text)' }}>{r.referrer_name ?? r.referrer_uuid?.slice(0, 8) ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--accent)' }}>{r.code}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={r.validated
                            ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                            : { background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                      {r.validated ? '✓ Validé' : '⏳ En attente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          ← Préc.
        </button>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {page + 1}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={rows.length < LIMIT}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          Suiv. →
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'stats',     label: 'Vue d\'ensemble', icon: '📊' },
  { id: 'logins',    label: 'Connexions',      icon: '🔑' },
  { id: 'pageviews', label: 'Pages vues',      icon: '👁' },
  { id: 'referrals', label: 'Parrainages',     icon: '🤝' },
]

export default function PortalActivity() {
  const [tab, setTab] = useState<Tab>('stats')

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
          🌐 Activité du portail joueur
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Connexions, navigation, et parrainages des joueurs sur le portail web.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
           style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                  style={tab === t.id
                    ? { background: 'var(--accent)', color: '#080d19' }
                    : { color: 'var(--text-muted)' }}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'stats'     && <StatsTab />}
      {tab === 'logins'    && <LoginsTab />}
      {tab === 'pageviews' && <PageViewsTab />}
      {tab === 'referrals' && <ReferralsTab />}
    </div>
  )
}
