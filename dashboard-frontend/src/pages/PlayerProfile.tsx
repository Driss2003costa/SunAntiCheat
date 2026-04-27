import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

/**
 * Page profil joueur — agrège tout ce qu'on sait du joueur :
 * sanctions, reports, alertes, économie, crates, VIP, daily, LuckPerms, notes.
 */

const TABS = [
  { id: 'overview',  label: 'Aperçu',     icon: '📊' },
  { id: 'sanctions', label: 'Sanctions',  icon: '⚖️' },
  { id: 'alerts',    label: 'Alertes',    icon: '🚨' },
  { id: 'economy',   label: 'Économie',   icon: '💰' },
  { id: 'gameplay',  label: 'Gameplay',   icon: '🎮' },
  { id: 'notes',     label: 'Notes',      icon: '📝' },
] as const

function avatarColor(name: string) {
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4']
  return colors[(name?.charCodeAt(0) || 0) % colors.length]
}

function fmtDate(ts: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(ms: number) {
  if (!ms || ms === 0) return 'Permanent'
  const h = Math.floor(ms / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}j`
  return `${h}h`
}

export default function PlayerProfile() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { canEdit } = usePermission()
  const [profile, setProfile] = useState<any>(null)
  const [tab, setTab] = useState<typeof TABS[number]['id']>('overview')
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')

  const refresh = async () => {
    if (!name) return
    setLoading(true)
    try { setProfile(await api.playerProfile(name)) } catch {} finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [name])

  const addNote = async () => {
    if (!name || !newNote.trim()) return
    try {
      await api.playerNoteAdd(name, newNote.trim())
      setNewNote('')
      refresh()
    } catch (e: any) { alert('Erreur : ' + e.message) }
  }

  const delNote = async (noteId: string) => {
    if (!name || !confirm('Supprimer cette note ?')) return
    try {
      await api.playerNoteDelete(name, noteId)
      refresh()
    } catch (e: any) { alert('Erreur : ' + e.message) }
  }

  if (loading || !profile) {
    return <div className="p-6" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
  }

  const id = profile.identity || {}
  const sanctions = profile.sanctions || []
  const reports = profile.reports || { against: [], sent: [] }
  const alerts = profile.alerts || []
  const economy = profile.economy || {}
  const crates = profile.crates || []
  const vip = profile.vip || { active: [], history: [] }
  const daily = profile.dailyRewards || {}
  const lp = profile.luckperms || {}
  const notes = profile.notes || []

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <button onClick={() => navigate('/players')}
              className="text-sm" style={{ color: 'var(--text-muted)' }}>
        ← Retour aux joueurs
      </button>

      {/* Header avec avatar + identité */}
      <div className="rounded-xl p-6 flex items-center gap-6"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-bold text-white shrink-0"
             style={{ background: avatarColor(id.name || name || '?') }}>
          {(id.name || name || '?')[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{id.name || name}</h1>
            <span className="px-2 py-0.5 rounded text-xs font-bold"
                  style={{ background: id.online ? '#10b98140' : '#6b728040', color: id.online ? '#10b981' : '#94a3b8' }}>
              {id.online ? '● En ligne' : '○ Hors-ligne'}
            </span>
            {id.banned && <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: '#ef444440', color: '#ef4444' }}>🔨 BANNI</span>}
          </div>
          <div className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
            {id.uuid || 'UUID inconnu'}
          </div>
          {id.online ? (
            <div className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              🌍 {id.world} · ❤ {Math.round(id.health || 0)}/20 · 🍗 {id.food || 0}/20 · 📊 lvl {id.level || 0}
              {' · '} 📍 {id.x}, {id.y}, {id.z}
              {' · '} {id.ping}ms
            </div>
          ) : (
            <div className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              Dernière connexion : {fmtDate(id.lastPlayed)} ·
              Première connexion : {fmtDate(id.firstPlayed)}
            </div>
          )}
        </div>

        {/* KPIs résumé */}
        <div className="text-right space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div>⚖ <b style={{ color: 'var(--text)' }}>{sanctions.length}</b> sanctions</div>
          <div>🚨 <b style={{ color: 'var(--text)' }}>{alerts.length}</b> alertes</div>
          <div>📦 <b style={{ color: 'var(--text)' }}>{crates.length}</b> crates ouvertes</div>
          <div>👑 <b style={{ color: 'var(--text)' }}>{vip.active.length}</b> VIP actif</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className="px-4 py-2 text-sm font-medium transition"
                  style={{
                    color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                    borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                  }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* LuckPerms */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>🎖️ Rangs LuckPerms</h3>
            {lp.error || !lp.primaryGroup ? (
              <div style={{ color: 'var(--text-muted)' }} className="text-sm">LuckPerms non disponible ou aucun rang</div>
            ) : (
              <>
                <div className="text-sm">Primaire : <b style={{ color: 'var(--primary)' }}>{lp.primaryGroup}</b></div>
                {lp.groups && lp.groups.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Groupes hérités</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lp.groups.map((g: string) => (
                        <span key={g} className="px-2 py-0.5 rounded text-xs"
                              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>{g}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {lp.permissions || 0} permissions custom
                </div>
              </>
            )}
          </div>

          {/* VIP actif */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>👑 VIP</h3>
            {vip.active.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }} className="text-sm">Aucun VIP actif</div>
            ) : vip.active.map((v: any, i: number) => (
              <div key={i} className="text-sm">
                <div><b style={{ color: 'var(--primary)' }}>{v.planName}</b></div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Expire {fmtDate(v.expiresAt)}
                </div>
              </div>
            ))}
          </div>

          {/* Daily streak */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>🎁 Daily Rewards</h3>
            <div className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
              {daily.currentStreak || 0}
              <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>jours</span>
            </div>
            {daily.canClaim != null && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {daily.canClaim ? '✓ Peut réclamer' : '⏱ Déjà réclamé'}
              </div>
            )}
          </div>

          {/* Économie */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>💰 Solde</h3>
            <div className="text-3xl font-bold" style={{ color: '#10b981' }}>
              {economy.balance != null ? economy.balance.toLocaleString('fr-FR') : '—'}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {economy.shopTransactions?.length || 0} transactions shop
            </div>
          </div>
        </div>
      )}

      {tab === 'sanctions' && (
        <div className="space-y-2">
          {sanctions.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
              ✓ Aucune sanction
            </div>
          ) : sanctions.map((s: any, i: number) => (
            <div key={i} className="rounded-xl p-4 flex items-center gap-3"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-2xl">{s.type === 'BAN' ? '🔨' : s.type === 'KICK' ? '👢' : s.type === 'MUTE' ? '🔇' : '⚠'}</div>
              <div className="flex-1">
                <div className="font-bold" style={{ color: 'var(--text)' }}>{s.type} · {fmtDuration(s.durationMs)}</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{s.reason}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Par {s.staff} · {fmtDate(s.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
              ✓ Aucune alerte anticheat
            </div>
          ) : alerts.map((a: any, i: number) => (
            <div key={i} className="rounded-xl p-3 flex items-start justify-between"
                 style={{ background: 'var(--surface)', borderLeft: '3px solid #f59e0b' }}>
              <div>
                <div className="text-sm font-bold" style={{ color: '#f59e0b' }}>{a.type}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.detail}</div>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {fmtDate(a.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'economy' && (
        <div>
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--surface)' }}>
            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Solde Vault</div>
            <div className="text-3xl font-bold" style={{ color: '#10b981' }}>
              {economy.balance != null ? economy.balance.toLocaleString('fr-FR') : '—'}
            </div>
          </div>
          <h3 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Transactions shop récentes</h3>
          <div className="space-y-1">
            {(economy.shopTransactions || []).map((tx: any, i: number) => (
              <div key={i} className="rounded p-2 flex items-center justify-between text-sm"
                   style={{ background: 'var(--surface)' }}>
                <div>
                  <span style={{ color: tx.type === 'BUY' ? '#10b981' : '#ef4444' }}>{tx.type}</span>
                  {' '}<b style={{ color: 'var(--text)' }}>{tx.itemName}</b>
                  {' x'}{tx.amount} · {tx.shopName}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  {tx.totalPrice} · {fmtDate(tx.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'gameplay' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>📦 Crates ouvertes ({crates.length})</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {crates.map((c: any, i: number) => (
                <div key={i} className="rounded p-2 flex items-center justify-between text-sm"
                     style={{ background: 'var(--surface)' }}>
                  <div>
                    <b style={{ color: 'var(--text)' }}>{c.crateName}</b> → {c.itemName}
                    {c.rarity && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>({c.rarity})</span>}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>{fmtDate(c.openedAt)}</div>
                </div>
              ))}
              {crates.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Aucune ouverture</div>}
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>👑 Historique VIP</h3>
            {vip.history.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>Aucun historique</div>
            ) : vip.history.map((v: any, i: number) => (
              <div key={i} className="rounded p-2 text-sm" style={{ background: 'var(--surface)' }}>
                {v.planName} · {v.status} · {v.amountPaid} {v.currency}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="rounded-xl p-3 flex gap-2" style={{ background: 'var(--surface)' }}>
              <input value={newNote} onChange={e => setNewNote(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && addNote()}
                     placeholder="Ajouter une note staff (visible par MOD/ADMIN)…"
                     style={inputStyle} className="flex-1 px-3 py-2 rounded"/>
              <button onClick={addNote} disabled={!newNote.trim()}
                      className="px-4 py-2 rounded text-white disabled:opacity-30"
                      style={{ background: 'var(--primary)' }}>
                + Note
              </button>
            </div>
          )}
          {notes.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
              Aucune note staff
            </div>
          ) : notes.slice().reverse().map((n: any) => (
            <div key={n.id} className="rounded-xl p-3" style={{ background: 'var(--surface)' }}>
              <div style={{ color: 'var(--text)' }}>{n.text}</div>
              <div className="text-xs mt-1 flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                <span>📝 {n.author} · {fmtDate(n.timestamp)}</span>
                {canEdit && (
                  <button onClick={() => delNote(n.id)} className="text-red-400 hover:underline">Supprimer</button>
                )}
              </div>
            </div>
          ))}
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
