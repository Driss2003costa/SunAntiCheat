import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

const ROLES = ['ADMIN', 'MOD', 'VIEWER'] as const
type Role = typeof ROLES[number]

const ROLE_META: Record<Role, { label: string; color: string; bg: string; desc: string }> = {
  ADMIN:  { label: 'Admin',   color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   desc: 'Accès total — peut tout modifier' },
  MOD:    { label: 'Modéro',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  desc: 'Modération — sanctions, alertes, reports' },
  VIEWER: { label: 'Lecteur', color: '#64748b', bg: 'rgba(100,116,139,0.15)', desc: 'Lecture seule — ne peut rien modifier' },
}

function ago(ts: number) {
  if (!ts) return 'Jamais connecté'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'À l\'instant'
  if (s < 3600) return `Il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `Il y a ${Math.floor(s / 3600)} h`
  return `Il y a ${Math.floor(s / 86400)} j`
}

function Avatar({ name }: { name: string }) {
  const colors = ['#7C3AED','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
         style={{ background: color }}>
      {name[0].toUpperCase()}
    </div>
  )
}

export default function Users() {
  const { username: me, isAdmin } = useAuthStore()
  const [users, setUsers]         = useState<any[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // Modals state
  const [creating, setCreating]   = useState(false)
  const [editing, setEditing]     = useState<any | null>(null)   // user being edited (role/pw reset)
  const [pwModal, setPwModal]     = useState(false)              // change own pw

  // Form state
  const [form, setForm]           = useState({ username: '', password: '', role: 'MOD' as Role })
  const [newRole, setNewRole]     = useState<Role>('MOD')
  const [newCustomRoleId, setNewCustomRoleId] = useState<string>('')   // '' = aucun
  const [resetPw, setResetPw]     = useState('')
  const [ownPw, setOwnPw]         = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [customRoles, setCustomRoles] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try { setUsers((await api.usersList()).users) } catch {} finally { setLoading(false) }
    try { setCustomRoles((await api.customRolesList()).customRoles || []) } catch {}
  }
  useEffect(() => { load() }, [])

  const flash = (m: string, isErr = false) => {
    setMsg(m); setError(isErr ? m : '')
    setTimeout(() => setMsg(''), 3500)
  }

  // ── Créer ──────────────────────────────────────────────────────────────────
  const create = async () => {
    if (!form.username.trim() || !form.password) { flash('Nom + mot de passe requis.', true); return }
    setSaving(true)
    try {
      await api.userCreate({ username: form.username.trim(), password: form.password, role: form.role })
      setCreating(false); setForm({ username: '', password: '', role: 'MOD' })
      flash(`✅ Compte "${form.username.trim()}" créé.`)
      load()
    } catch (e: any) { flash(e.message, true) } finally { setSaving(false) }
  }

  // ── Modifier rôle ──────────────────────────────────────────────────────────
  const saveRole = async () => {
    if (!editing) return
    setSaving(true)
    try {
      // 1) Update enum role if changed
      if (newRole !== editing.role) {
        await api.userChangeRole(editing.username, newRole)
      }
      // 2) Update custom role assignment (always — '' means "remove")
      const desired = newCustomRoleId || ''
      const current = editing.customRoleId || ''
      if (desired !== current) {
        await api.userChangeCustomRole(editing.username, desired || null)
      }
      flash(`✅ Rôle de "${editing.username}" → ${newRole}${newCustomRoleId ? ' + ' + newCustomRoleId : ''}`)
      setEditing(null); load()
    } catch (e: any) { flash(e.message, true) } finally { setSaving(false) }
  }

  // ── Reset mot de passe ─────────────────────────────────────────────────────
  const doReset = async () => {
    if (!editing) return
    if (resetPw.length < 6) { flash('Mot de passe trop court (min 6 car.)', true); return }
    setSaving(true)
    try {
      await api.userResetPassword(editing.username, resetPw)
      flash(`✅ Mot de passe de "${editing.username}" réinitialisé.`)
      setEditing(null); setResetPw('')
    } catch (e: any) { flash(e.message, true) } finally { setSaving(false) }
  }

  // ── Supprimer ──────────────────────────────────────────────────────────────
  const del = async (username: string) => {
    if (!confirm(`Supprimer le compte "${username}" ?`)) return
    try {
      await api.userDelete(username)
      flash(`✅ Compte "${username}" supprimé.`)
      load()
    } catch (e: any) { flash(e.message, true) }
  }

  // ── Mon mot de passe ───────────────────────────────────────────────────────
  const changeOwnPw = async () => {
    if (ownPw.next.length < 6) { flash('Nouveau mot de passe trop court (min 6)', true); return }
    if (ownPw.next !== ownPw.confirm) { flash('Les mots de passe ne correspondent pas.', true); return }
    setSaving(true)
    try {
      await api.userChangeOwnPassword(ownPw.current, ownPw.next)
      flash('✅ Mot de passe modifié.')
      setPwModal(false); setOwnPw({ current: '', next: '', confirm: '' })
    } catch (e: any) { flash(e.message, true) } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>👤 Comptes & Rôles</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Gérez qui a accès au dashboard et avec quels droits.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPwModal(true)}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            🔑 Mon mot de passe
          </button>
          {isAdmin() && (
            <button onClick={() => setCreating(true)}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ background: 'var(--primary)' }}>
              + Nouveau compte
            </button>
          )}
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div className="px-4 py-2 rounded-lg text-sm"
             style={{ background: error ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: error ? '#ef4444' : '#10b981', border: `1px solid ${error ? '#ef444440' : '#10b98140'}` }}>
          {msg}
        </div>
      )}

      {/* Rôles legend */}
      <div className="grid grid-cols-3 gap-3">
        {ROLES.map(r => {
          const m = ROLE_META[r]
          return (
            <div key={r} className="rounded-xl px-4 py-3" style={{ background: m.bg, border: `1px solid ${m.color}30` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: m.color }}/>
                <span className="font-semibold text-sm" style={{ color: m.color }}>{m.label}</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.desc}</p>
            </div>
          )
        })}
      </div>

      {/* User list */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Aucun compte</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {users.map(u => {
              const rm = ROLE_META[u.role as Role] ?? ROLE_META.VIEWER
              const isSelf = u.username === me
              return (
                <div key={u.username} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition">
                  <Avatar name={u.username} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: 'var(--text)' }}>{u.username}</span>
                      {isSelf && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--primary)', color: 'white' }}>Vous</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Dernière connexion : {ago(u.lastLoginAt)} · Créé le {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}
                    </div>
                  </div>

                  {/* Role badge */}
                  <span className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background: rm.bg, color: rm.color }}>
                    {rm.label}
                  </span>

                  {/* Custom role badge (overlay) */}
                  {u.customRoleId && (() => {
                    const cr = customRoles.find(c => c.id === u.customRoleId)
                    return (
                      <span className="px-2 py-1 rounded-full text-xs flex items-center gap-1"
                            title={`Rôle custom : ${cr?.label || u.customRoleId}`}
                            style={{
                              background: (cr?.color || '#6366f1') + '20',
                              color: cr?.color || '#6366f1',
                              border: `1px solid ${(cr?.color || '#6366f1') + '50'}`,
                            }}>
                        🎨 {cr?.label || u.customRoleId}
                      </span>
                    )
                  })()}

                  {/* Actions (admin only) */}
                  {isAdmin() && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(u); setNewRole(u.role); setNewCustomRoleId(u.customRoleId || ''); setResetPw('') }}
                              className="px-3 py-1.5 rounded-lg text-xs hover:bg-white/10 transition"
                              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        ✏️ Modifier
                      </button>
                      {!isSelf && (
                        <button onClick={() => del(u.username)}
                                className="px-3 py-1.5 rounded-lg text-xs hover:bg-red-500/10 transition"
                                style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                          🗑
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal : Créer ──────────────────────────────────────────────────── */}
      {creating && (
        <Modal title="Nouveau compte" onClose={() => setCreating(false)}>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nom d'utilisateur</label>
          <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                 placeholder="ex: moderateur1" className="w-full px-3 py-2 rounded-lg mb-3" style={inp}
                 autoFocus/>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Mot de passe (min. 6 car.)</label>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                 placeholder="••••••••" className="w-full px-3 py-2 rounded-lg mb-3" style={inp}/>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Rôle</label>
          <RoleSelect value={form.role as Role} onChange={r => setForm({ ...form, role: r })}/>
          <div className="flex gap-2 mt-4">
            <button onClick={create} disabled={saving}
                    className="flex-1 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                    style={{ background: 'var(--primary)' }}>
              {saving ? 'Création...' : '+ Créer le compte'}
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg" style={ghost}>Annuler</button>
          </div>
        </Modal>
      )}

      {/* ── Modal : Modifier (rôle + reset pw) ──────────────────────────── */}
      {editing && (
        <Modal title={`Modifier — ${editing.username}`} onClose={() => setEditing(null)}>
          <div className="space-y-5">
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Rôle de base (hiérarchie)</label>
              <RoleSelect value={newRole} onChange={setNewRole}/>

              <label className="block text-xs mt-3 mb-2" style={{ color: 'var(--text-muted)' }}>
                Rôle custom (optionnel — surcharge les permissions)
              </label>
              {customRoles.length === 0 ? (
                <div className="text-xs italic px-3 py-2 rounded"
                     style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
                  Aucun rôle custom défini.
                  <a href="/permissions" className="underline ml-1" style={{ color: 'var(--primary)' }}>
                    Créer un rôle →
                  </a>
                </div>
              ) : (
                <select value={newCustomRoleId} onChange={e => setNewCustomRoleId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={inp}>
                  <option value="">— Aucun (utiliser permissions du rôle de base) —</option>
                  {customRoles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.label} ({r.permissions.length} perm., base {r.baseRole})
                    </option>
                  ))}
                </select>
              )}

              <button onClick={saveRole}
                      disabled={saving || (newRole === editing.role && (newCustomRoleId || '') === (editing.customRoleId || ''))}
                      className="mt-3 w-full py-2 rounded-lg text-white font-medium disabled:opacity-40"
                      style={{ background: 'var(--primary)' }}>
                {saving ? 'Sauvegarde...' : '💾 Enregistrer le rôle'}
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                Réinitialiser le mot de passe
              </label>
              <input type="password" placeholder="Nouveau mot de passe (min 6 car.)"
                     value={resetPw} onChange={e => setResetPw(e.target.value)}
                     className="w-full px-3 py-2 rounded-lg mb-2" style={inp}/>
              <button onClick={doReset} disabled={saving || resetPw.length < 6}
                      className="w-full py-2 rounded-lg font-medium disabled:opacity-40"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                🔑 Réinitialiser
              </button>
            </div>
          </div>
          <button onClick={() => setEditing(null)} className="mt-4 w-full py-2 rounded-lg" style={ghost}>Fermer</button>
        </Modal>
      )}

      {/* ── Modal : Mon mot de passe ───────────────────────────────────── */}
      {pwModal && (
        <Modal title="Changer mon mot de passe" onClose={() => setPwModal(false)}>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Mot de passe actuel</label>
          <input type="password" value={ownPw.current} onChange={e => setOwnPw({ ...ownPw, current: e.target.value })}
                 placeholder="••••••••" className="w-full px-3 py-2 rounded-lg mb-3" style={inp} autoFocus/>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nouveau mot de passe</label>
          <input type="password" value={ownPw.next} onChange={e => setOwnPw({ ...ownPw, next: e.target.value })}
                 placeholder="••••••••" className="w-full px-3 py-2 rounded-lg mb-3" style={inp}/>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Confirmer</label>
          <input type="password" value={ownPw.confirm} onChange={e => setOwnPw({ ...ownPw, confirm: e.target.value })}
                 placeholder="••••••••" className="w-full px-3 py-2 rounded-lg mb-3" style={inp}/>
          {ownPw.next && ownPw.confirm && ownPw.next !== ownPw.confirm && (
            <p className="text-xs mb-2" style={{ color: '#ef4444' }}>⚠ Les mots de passe ne correspondent pas</p>
          )}
          <div className="flex gap-2">
            <button onClick={changeOwnPw} disabled={saving}
                    className="flex-1 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                    style={{ background: 'var(--primary)' }}>
              {saving ? 'Sauvegarde...' : '💾 Enregistrer'}
            </button>
            <button onClick={() => setPwModal(false)} className="px-4 py-2 rounded-lg" style={ghost}>Annuler</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Composants réutilisables ─────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="rounded-xl w-[420px] p-6 space-y-4 shadow-2xl"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ROLES.map(r => {
        const m = ROLE_META[r]
        return (
          <button key={r} onClick={() => onChange(r)}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold transition"
                  style={{
                    background: value === r ? m.bg : 'var(--surface-2)',
                    border: `1px solid ${value === r ? m.color : 'var(--border)'}`,
                    color: value === r ? m.color : 'var(--text-muted)',
                  }}>
            <span>{r === 'ADMIN' ? '👑' : r === 'MOD' ? '🛡️' : '👁️'}</span>
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

const inp: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
}
const ghost: React.CSSProperties = {
  background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)',
}
