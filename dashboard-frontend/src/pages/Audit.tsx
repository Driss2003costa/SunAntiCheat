import { useEffect, useState, useMemo } from 'react'
import { api } from '../api/client'

/**
 * Page Audit log — visualise toutes les actions effectuées dans le dashboard.
 * Filtres : user / action / target / depuis quelle date.
 * Pagination : 100 entries par page.
 */

const ACTION_ICONS: Record<string, string> = {
  LOGIN_SUCCESS: '🔐', LOGIN_FAILED: '❌', LOGIN_RATE_LIMITED: '🚫',
  LOGIN_FAILED_2FA: '🔒', TOTP_ENABLED: '✓', TOTP_DISABLED: '⚠',
  PLAYER_BANNED: '🔨', PLAYER_KICKED: '👢', PLAYER_NOTE_ADDED: '📝',
  USER_CREATED: '👤', USER_DELETED: '🗑',
  PERMISSION_CHANGED: '🔐',
  AI_PATCH_APPLIED: '🤖',
  PANIC_ACTIVATED: '🚨', PANIC_DEACTIVATED: '✅',
  DASHBOARD_STARTED: '🚀',
}

function actionIcon(action: string): string {
  if (ACTION_ICONS[action]) return ACTION_ICONS[action]
  if (action.includes('FAIL') || action.includes('ERROR')) return '❌'
  if (action.includes('SUCCESS')) return '✓'
  if (action.includes('LOGIN')) return '🔐'
  if (action.includes('PLAYER')) return '👤'
  if (action.includes('USER')) return '👥'
  if (action.includes('SHOP')) return '🛒'
  if (action.includes('VIP')) return '👑'
  if (action.includes('CRATE')) return '📦'
  return '📋'
}

function actionColor(action: string): string {
  if (action.includes('FAIL') || action.includes('RATE_LIMITED')) return '#ef4444'
  if (action.includes('SUCCESS') || action.includes('ENABLED')) return '#10b981'
  if (action.includes('PLAYER_BANNED') || action.includes('PANIC')) return '#f97316'
  if (action.includes('CHANGED') || action.includes('UPDATED')) return '#3b82f6'
  return '#94a3b8'
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}min`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}j`
}

export default function Audit() {
  const [data, setData] = useState<{ entries: any[]; total: number; hasMore: boolean } | null>(null)
  const [actions, setActions] = useState<string[]>([])
  const [filters, setFilters] = useState({ user: '', action: '', target: '', since: 0 })
  const [offset, setOffset] = useState(0)
  const limit = 100
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const refresh = async (resetOffset = false) => {
    setLoading(true)
    try {
      const o = resetOffset ? 0 : offset
      const params: Record<string, any> = { limit, offset: o }
      if (filters.user) params.user = filters.user
      if (filters.action) params.action = filters.action
      if (filters.target) params.target = filters.target
      if (filters.since) params.since = filters.since
      const res = await api.auditList(params)
      setData(res)
      if (resetOffset) setOffset(0)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => {
    refresh(true)
    api.auditActions().then(setActions).catch(() => {})
    const t = setInterval(() => refresh(false), 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { refresh(false) }, [offset])

  const applyFilters = () => { setOffset(0); refresh(true) }
  const clearFilters = () => {
    setFilters({ user: '', action: '', target: '', since: 0 })
    setOffset(0)
    setTimeout(() => refresh(true), 0)
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>📋 Audit Log</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Toutes les actions effectuées dans le dashboard. {data && `${data.total} entries au total.`}
          </p>
        </div>
        <button onClick={() => refresh(false)} disabled={loading}
                className="px-3 py-2 rounded text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          {loading ? '⏳' : '↻ Refresh'}
        </button>
      </div>

      {/* Filtres */}
      <div className="rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div>
          <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>User</label>
          <input value={filters.user} onChange={e => setFilters({ ...filters, user: e.target.value })}
                 placeholder="admin"
                 onKeyDown={e => e.key === 'Enter' && applyFilters()}
                 style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Action</label>
          <select value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })}
                  style={inputStyle} className="w-full px-3 py-2 rounded text-sm">
            <option value="">Toutes</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Target</label>
          <input value={filters.target} onChange={e => setFilters({ ...filters, target: e.target.value })}
                 placeholder="Steve"
                 onKeyDown={e => e.key === 'Enter' && applyFilters()}
                 style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
        </div>
        <div className="flex gap-2 items-end">
          <button onClick={applyFilters}
                  className="flex-1 px-4 py-2 rounded text-white text-sm"
                  style={{ background: 'var(--primary)' }}>
            Filtrer
          </button>
          <button onClick={clearFilters}
                  className="px-3 py-2 rounded text-sm"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            ×
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="rounded-xl overflow-hidden"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {!data || data.entries.length === 0 ? (
          <div className="p-12 text-center" style={{ color: 'var(--text-muted)' }}>
            <div className="text-4xl mb-2">📋</div>
            Aucune entry d'audit
          </div>
        ) : data.entries.map((e: any) => (
          <div key={e.id}
               style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
               onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
            <div className="px-4 py-3 flex items-start gap-3 hover:bg-white/[0.02]">
              <div className="text-xl shrink-0">{actionIcon(e.action)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: actionColor(e.action) }}>{e.action}</span>
                  {e.target && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→ <b style={{ color: 'var(--text)' }}>{e.target}</b></span>}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{e.details}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                  {e.user} <span className="opacity-60">({e.role})</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {timeAgo(e.timestamp)} · {e.ip}
                </div>
              </div>
            </div>
            {expandedId === e.id && (
              <div className="px-4 pb-3 ml-9 text-xs font-mono"
                   style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-muted)' }}>
                <div>ID : {e.id}</div>
                <div>Timestamp : {new Date(e.timestamp).toLocaleString('fr-FR')}</div>
                {e.meta && Object.keys(e.meta).length > 0 && (
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(e.meta, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="flex items-center justify-between text-sm"
             style={{ color: 'var(--text-muted)' }}>
          <div>Page {currentPage} / {totalPages} · {data.total} entries</div>
          <div className="flex gap-2">
            <button onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    className="px-3 py-1 rounded disabled:opacity-30"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              ← Préc.
            </button>
            <button onClick={() => setOffset(offset + limit)}
                    disabled={!data.hasMore}
                    className="px-3 py-1 rounded disabled:opacity-30"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              Suiv. →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
} as const
