import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

/**
 * Page de gestion des rangs LuckPerms.
 * UX : vue joueurs en cards, clic → panneau de gestion avec drag visuel des groupes.
 */

function avatarColor(name: string) {
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4']
  return colors[name.charCodeAt(0) % colors.length]
}

export default function Ranks() {
  const { isAdmin } = usePermission()
  const [status, setStatus] = useState<any>(null)
  const [groups, setGroups] = useState<any[]>([])
  const [online, setOnline] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)  // joueur sélectionné
  const [search, setSearch] = useState('')
  const [customPlayer, setCustomPlayer] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    try {
      setStatus(await api.lpStatus())
      if ((await api.lpStatus()).available) {
        setGroups(await api.lpGroups())
        setOnline(await api.lpOnline())
      }
    } catch {}
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 15000)
    return () => clearInterval(t)
  }, [])

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 3500) }

  const lookupPlayer = async (name: string) => {
    if (!name) return
    setLoading(true)
    try {
      const info = await api.lpPlayer(name)
      setSelected({ name, ...info })
    } catch (e: any) {
      showFlash('✗ ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const addGroup = async (group: string) => {
    if (!selected) return
    try {
      await api.lpAddGroup(selected.name, group)
      showFlash(`✓ ${group} ajouté à ${selected.name}`)
      await lookupPlayer(selected.name)
      refresh()
    } catch (e: any) { showFlash('✗ ' + e.message) }
  }

  const removeGroup = async (group: string) => {
    if (!selected) return
    if (!confirm(`Retirer le groupe "${group}" de ${selected.name} ?`)) return
    try {
      await api.lpRemoveGroup(selected.name, group)
      showFlash(`✓ ${group} retiré de ${selected.name}`)
      await lookupPlayer(selected.name)
      refresh()
    } catch (e: any) { showFlash('✗ ' + e.message) }
  }

  const setPrimary = async (group: string) => {
    if (!selected) return
    if (selected.primaryGroup === group) return
    try {
      await api.lpSetPrimary(selected.name, group)
      showFlash(`✓ Rang principal de ${selected.name} : ${group}`)
      await lookupPlayer(selected.name)
      refresh()
    } catch (e: any) { showFlash('✗ ' + e.message) }
  }

  // LuckPerms absent
  if (status && !status.available) {
    return (
      <div className="p-6">
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-6xl mb-4">🧩</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>LuckPerms non installé</h1>
          <p className="max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
            Installe le plugin LuckPerms sur ton serveur pour gérer les rangs et permissions
            directement depuis ce dashboard.
          </p>
          <a href="https://luckperms.net/" target="_blank" rel="noreferrer"
             className="inline-block mt-4 px-4 py-2 rounded-lg text-white font-medium"
             style={{ background: 'var(--primary)' }}>
            📥 Télécharger LuckPerms
          </a>
        </div>
      </div>
    )
  }

  const filtered = online.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6 space-y-6">
      {flash && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-2 rounded-lg font-medium"
             style={{ background: flash.startsWith('✓') ? '#10b981' : '#ef4444', color: 'white' }}>
          {flash}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🎖️ Rangs LuckPerms</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {status?.available && <>✓ LuckPerms {status.version} · {groups.length} groupes · {online.length} joueurs en ligne</>}
        </p>
      </div>

      {/* ── Info Banner ──────────────────────────────────────────────────── */}
      <div className="rounded-xl p-4 flex items-start gap-3"
           style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
        <div className="text-2xl">💡</div>
        <div className="text-sm" style={{ color: 'var(--text)' }}>
          <b>Comment ça marche ?</b> Clique sur un joueur ci-dessous pour voir et modifier ses rangs.
          Le <b>rang principal</b> est celui affiché dans le chat. Les autres sont des rangs secondaires (ex: VIP + Moderator).
        </div>
      </div>

      {/* ── Liste des groupes ────────────────────────────────────────────── */}
      <div>
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>📋 Groupes configurés</h2>
        <div className="flex flex-wrap gap-2">
          {groups.map(g => (
            <div key={g.name}
                 className="px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                 style={{
                   background: g.color || 'var(--surface)',
                   color: g.color ? 'white' : 'var(--text)',
                   border: '1px solid var(--border)',
                 }}>
              <span className="font-bold">{g.displayName || g.name}</span>
              <span className="text-xs opacity-60">w{g.weight}</span>
            </div>
          ))}
          {groups.length === 0 && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun groupe configuré</span>
          )}
        </div>
      </div>

      {/* ── Recherche joueur ─────────────────────────────────────────────── */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>🔍 Chercher un joueur hors-ligne</h2>
        <div className="flex gap-2">
          <input placeholder="Nom du joueur..."
                 value={customPlayer}
                 onChange={e => setCustomPlayer(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && lookupPlayer(customPlayer)}
                 style={inputStyle} className="flex-1 px-4 py-3 rounded-lg text-lg"/>
          <button onClick={() => lookupPlayer(customPlayer)}
                  disabled={!customPlayer || loading}
                  className="px-6 py-3 rounded-lg text-white font-medium"
                  style={{ background: 'var(--primary)', opacity: (!customPlayer || loading) ? 0.5 : 1 }}>
            {loading ? '⏳' : '🔎 Chercher'}
          </button>
        </div>
      </div>

      {/* ── Joueurs en ligne ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
            🟢 Joueurs en ligne ({filtered.length})
          </h2>
          <input placeholder="Filtrer..." value={search} onChange={e => setSearch(e.target.value)}
                 style={inputStyle} className="px-3 py-1.5 rounded text-sm"/>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
            <div className="text-4xl mb-2">😴</div>
            <div style={{ color: 'var(--text-muted)' }}>Aucun joueur en ligne</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {filtered.map(p => (
              <button key={p.uuid}
                      onClick={() => lookupPlayer(p.name)}
                      className="rounded-xl p-4 text-left transition hover:scale-[1.02]"
                      style={{
                        background: 'var(--surface)',
                        border: selected?.name === p.name ? '2px solid var(--primary)' : '1px solid var(--border)',
                      }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
                       style={{ background: avatarColor(p.name || '') }}>
                    {(p.name || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate" style={{ color: 'var(--text)' }}>{p.name}</div>
                    <GroupBadge name={p.primaryGroup} groups={groups}/>
                  </div>
                </div>
                {p.groups && p.groups.length > 1 && (
                  <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    +{p.groups.length - 1} groupe{p.groups.length > 2 ? 's' : ''} secondaire{p.groups.length > 2 ? 's' : ''}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Panneau joueur sélectionné ─────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-[600px] h-full overflow-y-auto"
               style={{ background: 'var(--surface)' }}
               onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="sticky top-0 z-10 p-6"
                 style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                       style={{ background: avatarColor(selected.name || '') }}>
                    {(selected.name || '?')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{selected.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <GroupBadge name={selected.primaryGroup} groups={groups} big/>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>rang principal</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                        className="text-2xl leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Groupes actuels */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  ✅ Groupes actuels ({selected.groups?.length || 0})
                </h3>
                <div className="space-y-2">
                  {(selected.groups || []).map((g: string) => {
                    const info = groups.find(gr => gr.name === g) || { name: g, displayName: g }
                    const isPrimary = selected.primaryGroup === g
                    return (
                      <div key={g} className="flex items-center gap-3 p-3 rounded-lg"
                           style={{
                             background: isPrimary ? 'rgba(251,191,36,0.1)' : 'var(--surface-2)',
                             border: isPrimary ? '1px solid #f59e0b' : '1px solid var(--border)',
                           }}>
                        <div className="flex-1 flex items-center gap-2">
                          <GroupBadge name={g} groups={groups}/>
                          {isPrimary && <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>★ PRINCIPAL</span>}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1">
                            {!isPrimary && (
                              <button onClick={() => setPrimary(g)}
                                      title="Définir comme rang principal"
                                      className="text-xs px-2 py-1 rounded"
                                      style={{ background: 'var(--primary)', color: 'white' }}>
                                ★ Principal
                              </button>
                            )}
                            <button onClick={() => removeGroup(g)}
                                    disabled={isPrimary && (selected.groups?.length || 0) === 1}
                                    title={isPrimary ? "Impossible de retirer le seul groupe" : "Retirer ce groupe"}
                                    className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10"
                                    style={{ opacity: isPrimary && (selected.groups?.length || 0) === 1 ? 0.3 : 1 }}>
                              Retirer
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {(!selected.groups || selected.groups.length === 0) && (
                    <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Aucun groupe
                    </div>
                  )}
                </div>
              </div>

              {/* Ajouter un groupe */}
              {isAdmin && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                    ➕ Ajouter un groupe
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {groups
                      .filter(g => !(selected.groups || []).includes(g.name))
                      .map(g => (
                        <button key={g.name}
                                onClick={() => addGroup(g.name)}
                                className="flex items-center justify-between px-4 py-3 rounded-lg text-sm transition hover:scale-[1.02]"
                                style={{
                                  background: 'var(--surface-2)',
                                  border: '1px solid var(--border)',
                                }}>
                          <div className="flex items-center gap-2">
                            <GroupBadge name={g.name} groups={groups}/>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              weight {g.weight}
                            </span>
                          </div>
                          <span style={{ color: 'var(--primary)' }}>+</span>
                        </button>
                      ))}
                    {groups.filter(g => !(selected.groups || []).includes(g.name)).length === 0 && (
                      <div className="col-span-2 text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                        Le joueur est dans tous les groupes disponibles
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)' }}>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                      {selected.groups?.length || 0}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Groupes</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                      {selected.permissions || 0}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Permissions</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: selected.online ? '#10b981' : 'var(--text-muted)' }}>
                      {selected.online ? '🟢' : '⚫'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {selected.online ? 'En ligne' : 'Hors-ligne'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupBadge({ name, groups, big }: { name: string; groups: any[]; big?: boolean }) {
  if (!name) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
  const g = groups.find(gr => gr.name === name) || { name, displayName: name, color: null }
  return (
    <span className={`rounded font-bold ${big ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`}
          style={{
            background: g.color || 'var(--primary)',
            color: 'white',
          }}>
      {g.displayName || g.name}
    </span>
  )
}

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
} as const
