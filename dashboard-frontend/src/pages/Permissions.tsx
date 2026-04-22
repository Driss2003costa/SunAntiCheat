import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

/**
 * Matrice éditable des permissions par rôle.
 * VIEWER / MOD modifiables · ADMIN toujours tout (non modifiable pour sécurité).
 */

type PermDef = { id: string; label: string; description: string; category: string }
type Snapshot = {
  roles: Record<string, string[]>  // "ADMIN": ["PERM_X", ...], "MOD": [...], "VIEWER": [...]
  catalog: PermDef[]
}

const ROLES = ['VIEWER', 'MOD', 'ADMIN'] as const
const ROLE_META: Record<string, { color: string; label: string; icon: string }> = {
  VIEWER: { color: '#10b981', label: 'Viewer',     icon: '👁' },
  MOD:    { color: '#3b82f6', label: 'Modérateur', icon: '🛡' },
  ADMIN:  { color: '#ef4444', label: 'Admin',      icon: '⚡' },
}

export default function Permissions() {
  const { isAdmin } = usePermission()
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [draft, setDraft] = useState<Record<string, Set<string>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null)

  const refresh = async () => {
    try {
      const s = await api.permsGet()
      setSnap(s)
      // Drafts sync avec l'état serveur
      const d: Record<string, Set<string>> = {}
      for (const [role, perms] of Object.entries(s.roles)) {
        d[role] = new Set(perms)
      }
      setDraft(d)
    } catch (e: any) {
      showFlash('✗ ' + e.message, false)
    }
  }

  useEffect(() => { refresh() }, [])

  const showFlash = (text: string, ok = true) => {
    setFlash({ text, ok })
    setTimeout(() => setFlash(null), 3500)
  }

  const togglePerm = (role: string, permId: string) => {
    if (role === 'ADMIN') return  // protégé
    setDraft(prev => {
      const next = { ...prev }
      const set = new Set(next[role] || [])
      if (set.has(permId)) set.delete(permId); else set.add(permId)
      next[role] = set
      return next
    })
  }

  const saveRole = async (role: string) => {
    if (!isAdmin || role === 'ADMIN') return
    const perms = Array.from(draft[role] || [])
    setSaving(role)
    try {
      await api.permsUpdate(role, perms)
      showFlash(`✓ Permissions ${ROLE_META[role].label} enregistrées`)
      refresh()
    } catch (e: any) {
      showFlash('✗ ' + e.message, false)
    } finally {
      setSaving(null)
    }
  }

  const resetAll = async () => {
    if (!confirm('Restaurer toutes les permissions aux valeurs par défaut ?\n\nTu perdras toutes tes modifications.')) return
    try {
      await api.permsReset()
      showFlash('✓ Permissions restaurées aux défauts')
      refresh()
    } catch (e: any) { showFlash('✗ ' + e.message, false) }
  }

  if (!snap) {
    return (
      <div className="p-6" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
    )
  }

  // Groupe par catégorie
  const byCategory: Record<string, PermDef[]> = {}
  for (const p of snap.catalog) {
    (byCategory[p.category] ||= []).push(p)
  }

  // Détecte si un rôle a des changements non sauvés
  const hasChanges = (role: string) => {
    const original = new Set(snap.roles[role] || [])
    const current = draft[role] || new Set()
    if (original.size !== current.size) return true
    for (const p of original) if (!current.has(p)) return true
    return false
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {flash && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-2 rounded-lg font-medium"
             style={{ background: flash.ok ? '#10b981' : '#ef4444', color: 'white' }}>
          {flash.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🔐 Permissions par rôle</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Contrôle granulaire de ce que chaque rôle peut faire dans le dashboard.
          </p>
        </div>
        {isAdmin && (
          <button onClick={resetAll}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            🔄 Restaurer les défauts
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="rounded-xl p-4 flex items-start gap-3"
           style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
        <div className="text-2xl">💡</div>
        <div className="text-sm" style={{ color: 'var(--text)' }}>
          <b>Comment ça marche ?</b> Coche une case pour donner la permission au rôle.
          Les changements sont sauvés par rôle via le bouton <b>"Enregistrer {ROLE_META.MOD.label}"</b> ou <b>"... {ROLE_META.VIEWER.label}"</b>.
          <br/>
          🔒 <b>ADMIN</b> a toujours <b>toutes les permissions</b> (non modifiable — par sécurité, il doit toujours y avoir un accès complet).
        </div>
      </div>

      {/* Tableau */}
      <div className="rounded-xl overflow-hidden"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Header de colonnes */}
        <div className="grid sticky top-0 z-10"
             style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      background: 'var(--surface-2)',
                      borderBottom: '1px solid var(--border)' }}>
          <div className="px-4 py-3 text-xs uppercase tracking-wider font-semibold"
               style={{ color: 'var(--text-muted)' }}>
            Action
          </div>
          {ROLES.map(role => {
            const m = ROLE_META[role]
            return (
              <div key={role} className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">{m.icon}</span>
                  <span className="font-bold" style={{ color: m.color }}>{m.label}</span>
                </div>
                {role !== 'ADMIN' && hasChanges(role) && (
                  <button onClick={() => saveRole(role)}
                          disabled={saving === role || !isAdmin}
                          className="mt-1 text-xs px-2 py-0.5 rounded"
                          style={{
                            background: saving === role ? 'var(--surface)' : m.color,
                            color: saving === role ? 'var(--text-muted)' : 'white',
                            opacity: isAdmin ? 1 : 0.5,
                          }}>
                    {saving === role ? '⏳' : '💾 Enregistrer'}
                  </button>
                )}
                {role === 'ADMIN' && (
                  <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    🔒 Verrouillé
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Lignes par catégorie */}
        {Object.entries(byCategory).map(([cat, perms]) => (
          <div key={cat}>
            {/* Séparateur de catégorie */}
            <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
                 style={{
                   background: 'var(--surface-2)',
                   color: 'var(--text-muted)',
                   borderTop: '1px solid var(--border)',
                 }}>
              {cat}
            </div>
            {perms.map(p => (
              <div key={p.id}
                   className="grid items-center transition hover:bg-white/[0.02]"
                   style={{
                     gridTemplateColumns: '2fr 1fr 1fr 1fr',
                     borderTop: '1px solid var(--border)',
                   }}>
                <div className="px-4 py-3">
                  <div className="font-medium" style={{ color: 'var(--text)' }}>{p.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.description}</div>
                </div>
                {ROLES.map(role => {
                  const checked = (draft[role] || new Set()).has(p.id)
                  const disabled = role === 'ADMIN' || !isAdmin
                  return (
                    <div key={role} className="px-4 py-3 flex justify-center">
                      <button onClick={() => togglePerm(role, p.id)}
                              disabled={disabled}
                              className="w-6 h-6 rounded flex items-center justify-center transition"
                              style={{
                                background: checked ? ROLE_META[role].color : 'var(--surface-2)',
                                border: `1px solid ${checked ? ROLE_META[role].color : 'var(--border)'}`,
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                opacity: disabled && role !== 'ADMIN' ? 0.5 : 1,
                              }}>
                        {checked && <span className="text-white text-sm font-bold">✓</span>}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-3 gap-3">
        {ROLES.map(role => {
          const m = ROLE_META[role]
          const count = (draft[role] || new Set()).size
          const total = snap.catalog.length
          return (
            <div key={role} className="rounded-xl p-4"
                 style={{ background: 'var(--surface)', border: `1px solid ${m.color}30` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{m.icon}</span>
                <span className="font-bold" style={{ color: m.color }}>{m.label}</span>
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                <b style={{ color: m.color }}>{count}</b> / {total} permissions
              </div>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full transition-all"
                     style={{ width: `${(count / total) * 100}%`, background: m.color }}/>
              </div>
            </div>
          )
        })}
      </div>

      {!isAdmin && (
        <div className="rounded-xl p-4 text-sm text-center"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          👁 Vue lecture seule — seul un ADMIN peut modifier les permissions.
        </div>
      )}
    </div>
  )
}
