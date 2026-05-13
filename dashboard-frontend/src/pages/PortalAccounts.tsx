import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

type Account = {
  uuid: string
  username: string
  email: string | null
  created_at: number
  last_login: number | null
  role: string
  bio: string
  banned_until: number | null
  ban_reason: string | null
  section_restrictions: number
  must_reset_password: boolean
  failed_login_count: number
  last_failed_login: number | null
  restrictions: string[]
  is_banned: boolean
}

type SectionDef = { key: string; bit: number; name: string }

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ account }: { account: Account }) {
  if (account.is_banned) {
    return (
      <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
        Banni{account.banned_until && account.banned_until > 0 ? ` · ${fmtDate(account.banned_until)}` : ''}
      </span>
    )
  }
  if (account.must_reset_password) {
    return (
      <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider"
            style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
        Reset MDP forcé
      </span>
    )
  }
  if (account.restrictions.length > 0) {
    return (
      <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider"
            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
        {account.restrictions.length} section(s) bloquée(s)
      </span>
    )
  }
  if (account.failed_login_count >= 3) {
    return (
      <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
        {account.failed_login_count} échec(s) login
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
      OK
    </span>
  )
}

// ── Detail modal ─────────────────────────────────────────────────────────────

function DetailDrawer({ uuid, sections, onClose, onChanged }: {
  uuid: string; sections: SectionDef[]; onClose: () => void; onChanged: () => void
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [banHours, setBanHours] = useState<string>('') // vide = permanent
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const isAdmin = useAuthStore(s => s.isAdmin())

  const reload = useCallback(() => {
    setLoading(true)
    api.portalAccountDetail(uuid)
      .then(d => {
        setData(d); setLoading(false)
        setSelected(new Set(d.restrictions || []))
        setBanReason(d.ban_reason || '')
      })
      .catch(() => setLoading(false))
  }, [uuid])

  useEffect(() => { reload() }, [reload])

  async function withBusy(fn: () => Promise<any>) {
    setBusy(true)
    try { await fn(); reload(); onChanged() }
    catch (e: any) { alert(e.message || 'Erreur') }
    setBusy(false)
  }

  function toggleSection(k: string) {
    const next = new Set(selected)
    if (next.has(k)) next.delete(k); else next.add(k)
    setSelected(next)
  }

  if (loading || !data) {
    return (
      <div className="fixed inset-0 flex items-end sm:items-center justify-end z-50"
           style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
        <div className="w-full sm:w-[520px] h-full p-6 overflow-y-auto"
             style={{ background: 'var(--bg)' }} onClick={e => e.stopPropagation()}>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
        </div>
      </div>
    )
  }

  const account = data as Account

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-end z-50"
         style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full sm:w-[560px] h-full p-6 overflow-y-auto"
           style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{account.username}</h2>
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{account.uuid}</div>
            <div className="mt-2"><StatusBadge account={account} /></div>
          </div>
          <button onClick={onClose}
                  className="text-xl px-2 hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
          <div><span style={{ color: 'var(--text-muted)' }}>Créé&nbsp;:</span> {fmtDate(account.created_at)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Dernier login&nbsp;:</span> {fmtDate(account.last_login)}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Rôle&nbsp;:</span> {account.role}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>Échecs login&nbsp;:</span> {account.failed_login_count}</div>
          {account.last_failed_login && (
            <div className="col-span-2"><span style={{ color: 'var(--text-muted)' }}>Dernier échec&nbsp;:</span> {fmtDate(account.last_failed_login)}</div>
          )}
        </div>

        {/* Restrictions par section */}
        <section className="mb-5 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-3">Sections bloquées</h3>
          <div className="grid grid-cols-2 gap-2">
            {sections.map(s => (
              <label key={s.key}
                     className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer"
                     style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <input type="checkbox" checked={selected.has(s.key)}
                       onChange={() => toggleSection(s.key)} disabled={!isAdmin || busy} />
                <span className="text-xs">{s.key}</span>
              </label>
            ))}
          </div>
          <button
            disabled={!isAdmin || busy}
            onClick={() => withBusy(() => api.portalAccountRestrictions(account.uuid, [...selected]))}
            className="mt-3 px-3 py-1.5 rounded text-xs font-medium"
            style={{ background: 'var(--accent)', color: '#fff', opacity: !isAdmin || busy ? 0.5 : 1 }}>
            Appliquer les restrictions
          </button>
        </section>

        {/* Ban */}
        <section className="mb-5 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-3">Ban portail</h3>
          {account.is_banned ? (
            <>
              <div className="text-xs mb-2">
                <span style={{ color: 'var(--text-muted)' }}>Jusqu'à&nbsp;:</span> {
                  account.banned_until && account.banned_until > 0 ? fmtDate(account.banned_until) : 'permanent'
                }
              </div>
              {account.ban_reason && (
                <div className="text-xs mb-3"><span style={{ color: 'var(--text-muted)' }}>Raison&nbsp;:</span> {account.ban_reason}</div>
              )}
              <button
                disabled={!isAdmin || busy}
                onClick={() => withBusy(() => api.portalAccountUnban(account.uuid))}
                className="px-3 py-1.5 rounded text-xs font-medium"
                style={{ background: '#22c55e', color: '#fff', opacity: !isAdmin || busy ? 0.5 : 1 }}>
                Lever le ban
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <input
                  type="text" placeholder="Raison (optionnel)"
                  value={banReason} onChange={e => setBanReason(e.target.value)}
                  disabled={!isAdmin || busy}
                  className="w-full px-3 py-2 rounded text-xs"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <input
                  type="number" min="0" placeholder="Durée en heures (vide = permanent)"
                  value={banHours} onChange={e => setBanHours(e.target.value)}
                  disabled={!isAdmin || busy}
                  className="w-full px-3 py-2 rounded text-xs"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <button
                disabled={!isAdmin || busy}
                onClick={() => {
                  const h = banHours.trim() === '' ? null : parseInt(banHours, 10)
                  if (h !== null && (isNaN(h) || h <= 0)) { alert('Durée invalide'); return }
                  return withBusy(() => api.portalAccountBan(account.uuid, {
                    duration_ms: h === null ? null : h * 3600_000,
                    reason: banReason || undefined,
                  }))
                }}
                className="mt-3 px-3 py-1.5 rounded text-xs font-medium"
                style={{ background: '#ef4444', color: '#fff', opacity: !isAdmin || busy ? 0.5 : 1 }}>
                Bannir
              </button>
            </>
          )}
        </section>

        {/* Force reset */}
        <section className="mb-5 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-2">Reset mot de passe forcé</h3>
          <div className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
            {account.must_reset_password
              ? 'Le joueur devra définir un nouveau mot de passe au prochain login.'
              : 'Cliquer pour forcer le joueur à réinitialiser son mot de passe au prochain login.'}
          </div>
          <button
            disabled={!isAdmin || busy}
            onClick={() => withBusy(() => api.portalAccountForceReset(account.uuid, !account.must_reset_password))}
            className="px-3 py-1.5 rounded text-xs font-medium"
            style={{ background: 'var(--accent)', color: '#fff', opacity: !isAdmin || busy ? 0.5 : 1 }}>
            {account.must_reset_password ? 'Désactiver' : 'Forcer le reset'}
          </button>
        </section>

        {/* Reset failed counter */}
        {account.failed_login_count > 0 && (
          <section className="mb-5">
            <button
              disabled={busy}
              onClick={() => withBusy(() => api.portalAccountResetFailed(account.uuid))}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', opacity: busy ? 0.5 : 1 }}>
              Réinitialiser le compteur d'échecs ({account.failed_login_count})
            </button>
          </section>
        )}

        {/* Logins récents */}
        {data.recent_logins && data.recent_logins.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-2">Connexions récentes</h3>
            <div className="space-y-1 text-[11px]">
              {data.recent_logins.slice(0, 10).map((l: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-2 py-1 rounded"
                     style={{ background: 'var(--card)' }}>
                  <span style={{ color: l.success ? '#22c55e' : '#ef4444' }}>
                    {l.success ? '✓' : '✗'}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{fmtDate(l.ts)}</span>
                  <span className="font-mono">{l.ip}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PortalAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [sections, setSections] = useState<SectionDef[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openUuid, setOpenUuid] = useState<string | null>(null)
  const LIMIT = 50

  const load = useCallback(() => {
    setLoading(true)
    api.portalAccountsList({ search, limit: LIMIT, offset })
      .then(d => { setAccounts(d.accounts); setTotal(d.total); setLoading(false) })
      .catch(() => setLoading(false))
  }, [search, offset])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.portalAccountsSections().then(d => setSections(d.sections)).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Comptes portail</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Gestion des comptes joueurs : bans, restrictions de sections, reset mot de passe, sécurité.
        </p>
      </header>

      <div className="mb-4 flex gap-2 items-center">
        <input
          type="text" placeholder="Rechercher un pseudo…"
          value={search}
          onChange={e => { setSearch(e.target.value); setOffset(0) }}
          className="px-3 py-2 rounded text-sm flex-1 max-w-xs"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {total} compte(s)
        </span>
      </div>

      <div className="rounded-xl overflow-hidden"
           style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}>Pseudo</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}>Statut</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}>Dernier login</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}>Échecs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm"
                      style={{ color: 'var(--text-muted)' }}>Chargement…</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm"
                      style={{ color: 'var(--text-muted)' }}>Aucun compte</td></tr>
            ) : accounts.map(a => (
              <tr key={a.uuid} className="hover:bg-white/[0.02]"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-3 py-2 text-sm font-medium">{a.username}</td>
                <td className="px-3 py-2"><StatusBadge account={a} /></td>
                <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(a.last_login)}</td>
                <td className="px-3 py-2 text-xs text-right">{a.failed_login_count}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setOpenUuid(a.uuid)}
                          className="px-3 py-1 text-xs rounded"
                          style={{ background: 'var(--accent)', color: '#fff' }}>
                    Gérer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
            className="px-3 py-1.5 rounded"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', opacity: offset === 0 ? 0.5 : 1 }}>
            ← Précédent
          </button>
          <span style={{ color: 'var(--text-muted)' }}>
            {offset + 1} – {Math.min(offset + LIMIT, total)} / {total}
          </span>
          <button
            onClick={() => setOffset(offset + LIMIT)}
            disabled={offset + LIMIT >= total}
            className="px-3 py-1.5 rounded"
            style={{ background: 'var(--card)', border: '1px solid var(--border)',
                     opacity: offset + LIMIT >= total ? 0.5 : 1 }}>
            Suivant →
          </button>
        </div>
      )}

      {openUuid && (
        <DetailDrawer uuid={openUuid} sections={sections}
                      onClose={() => setOpenUuid(null)} onChanged={load} />
      )}
    </div>
  )
}
