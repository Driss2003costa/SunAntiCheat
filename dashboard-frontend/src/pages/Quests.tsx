import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

const TYPES = ['BREAK_BLOCK', 'PLACE_BLOCK', 'KILL_ENTITY', 'KILL_PLAYER', 'CRAFT_ITEM', 'FISH_CATCH', 'PLAY_TIME', 'FRIEND_COUNT', 'REFERRAL_COUNT']
const ICONS = ['⭐', '⚔️', '⛏', '🏆', '🐟', '💰', '💎', '🔥', '🛡️', '🎯']

// ── Timer hook ─────────────────────────────────────────────────────────────────
function useAdminTimer(endsAt: number | null | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [endsAt])
  if (!endsAt) return null
  return Math.max(0, endsAt - now)
}

// ── QuestAdminCard ─────────────────────────────────────────────────────────────
function QuestAdminCard({ q, canEdit, onEdit, onDelete, onExpired }: {
  q: any
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onExpired: (id: string) => void
}) {
  const msLeft  = useAdminTimer(q.endsAt)
  const expired = msLeft !== null && msLeft <= 0
  const urgent  = msLeft !== null && msLeft > 0 && msLeft < 3_600_000
  const warn    = msLeft !== null && msLeft > 0 && msLeft < 86_400_000

  useEffect(() => {
    if (expired) {
      const t = setTimeout(() => onExpired(q.id), 600)
      return () => clearTimeout(t)
    }
  }, [expired, q.id, onExpired])

  function fmtMs(ms: number) {
    const s  = Math.floor(ms / 1000)
    const d  = Math.floor(s / 86400)
    const h  = Math.floor((s % 86400) / 3600)
    const m  = Math.floor((s % 3600) / 60)
    const sc = s % 60
    if (d > 0) return `${d}j ${h}h`
    if (h > 0) return `${h}h ${m}m`
    return `${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
  }

  const timerColor = urgent ? '#ef4444' : warn ? '#f59e0b' : '#10b981'

  return (
    <div
      className="rounded-xl p-5 transition-all duration-500"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${expired ? 'rgba(239,68,68,0.5)' : q.enabled ? q.color : 'var(--border)'}`,
        opacity: expired ? 0 : 1,
        transform: expired ? 'scale(0.96)' : 'scale(1)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-3xl">{q.icon}</div>
        <div className="flex items-center gap-1">
          {q.titleEn && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold mr-1"
                  title={q.titleEn}
                  style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)' }}>
              EN
            </span>
          )}
          {msLeft !== null && msLeft > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold mr-1"
              style={{
                background: urgent ? 'rgba(239,68,68,0.15)' : warn ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.12)',
                color: timerColor,
                border: `1px solid ${timerColor}40`,
                animation: urgent ? 'pulse 1s ease-in-out infinite' : undefined,
              }}
            >
              ⏱ {fmtMs(msLeft)}
            </span>
          )}
          {expired && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold mr-1"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }}>
              Expirée
            </span>
          )}
          {canEdit && !expired && (
            <>
              <button onClick={onEdit}   className="text-xs px-2 py-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>✏️</button>
              <button onClick={onDelete} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">🗑</button>
            </>
          )}
        </div>
      </div>
      <div className="font-bold" style={{ color: 'var(--text)' }}>{q.title}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{q.description}</div>
      <div className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        <div>🎯 {q.type} · {q.target} · goal <b style={{ color: q.color }}>{q.goal}</b></div>
        {q.rewardLabel && <div>🎁 {q.rewardLabel}</div>}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className={`px-2 py-0.5 rounded ${q.enabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
          {q.enabled ? 'Active' : 'Inactive'}
        </span>
        {q.repeatable && <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">Répétable</span>}
        <span className="ml-auto">✅ {q.completions} · ⏳ {q.inProgress}</span>
      </div>
    </div>
  )
}

// ── Library modal ──────────────────────────────────────────────────────────────
function QuestLibraryModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [data, setData] = useState<{ categories: any[]; templates: any[] } | null>(null)
  const [activeCat, setActiveCat] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    api.questTemplates()
      .then(setData)
      .catch(e => setError(e.message || 'Erreur de chargement'))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const s = search.trim().toLowerCase()
    return data.templates.filter(t => {
      if (activeCat !== 'all' && t.category !== activeCat) return false
      if (!s) return true
      return (
        (t.title?.fr || '').toLowerCase().includes(s) ||
        (t.title?.en || '').toLowerCase().includes(s) ||
        (t.description?.fr || '').toLowerCase().includes(s) ||
        (t.target || '').toLowerCase().includes(s)
      )
    })
  }, [data, activeCat, search])

  const handleAdd = async (template: any) => {
    setAdding(template.id); setError('')
    try {
      await api.questFromTemplate(template.id)
      setAdded(prev => new Set(prev).add(template.id))
      onAdded()
    } catch (e: any) {
      setError(e.message || 'Erreur')
    } finally { setAdding(null) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              📚 Bibliothèque de quêtes
              <span className="text-xs font-normal px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}>
                FR + EN
              </span>
            </h2>
            <button onClick={onClose} className="text-xl px-3 py-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>×</button>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Choisis une quête pré-faite — elle sera ajoutée à ta liste avec les deux langues. Tu pourras toujours l'éditer ensuite.
          </p>
          <input
            placeholder="🔍 Rechercher (titre, description, cible…)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded mb-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveCat('all')}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{
                      background: activeCat === 'all' ? 'var(--primary)' : 'var(--surface-2)',
                      color: activeCat === 'all' ? 'white' : 'var(--text-muted)',
                    }}>
              Tout {data && `(${data.templates.length})`}
            </button>
            {data?.categories.map(c => {
              const count = data.templates.filter(t => t.category === c.id).length
              return (
                <button key={c.id} onClick={() => setActiveCat(c.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1"
                        style={{
                          background: activeCat === c.id ? 'var(--primary)' : 'var(--surface-2)',
                          color: activeCat === c.id ? 'white' : 'var(--text-muted)',
                        }}>
                  <span>{c.icon}</span> {c.labelFr} <span className="opacity-60">({count})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 px-4 py-2 rounded text-sm"
                 style={{ background: 'rgba(239,68,68,0.10)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}
          {!data ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Aucun template ne correspond</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(t => (
                <div key={t.id}
                     className="rounded-xl p-4 transition-all"
                     style={{ background: 'var(--surface-2)', border: `1px solid ${t.color}40` }}>
                  <div className="flex items-start gap-3 mb-2">
                    <div className="text-3xl shrink-0">{t.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{t.title?.fr}</div>
                      <div className="text-[11px] italic" style={{ color: 'rgba(125,211,252,0.85)' }}>
                        EN · {t.title?.en}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    {t.description?.fr}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(56,189,248,0.10)', color: '#7dd3fc' }}>
                      {t.type}
                    </span>
                    {t.target && t.target !== 'ANY' && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
                        {t.target}
                      </span>
                    )}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${t.color}20`, color: t.color }}>
                      goal {t.goal}
                    </span>
                    {t.repeatable && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(139,92,246,0.10)', color: '#c4b5fd' }}>
                        🔁
                      </span>
                    )}
                  </div>
                  {t.rewardLabel?.fr && (
                    <div className="text-xs mb-3 px-2 py-1.5 rounded"
                         style={{ background: 'rgba(251,191,36,0.08)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.2)' }}>
                      🎁 {t.rewardLabel.fr}
                    </div>
                  )}
                  <button
                    onClick={() => handleAdd(t)}
                    disabled={adding === t.id || added.has(t.id)}
                    className="w-full px-3 py-2 rounded text-sm font-semibold transition"
                    style={{
                      background: added.has(t.id) ? 'rgba(16,185,129,0.15)' : 'var(--primary)',
                      color: added.has(t.id) ? '#34d399' : 'white',
                      cursor: adding === t.id || added.has(t.id) ? 'default' : 'pointer',
                    }}>
                    {adding === t.id ? '⏳ Ajout…' : added.has(t.id) ? '✓ Ajoutée' : '+ Ajouter'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between text-xs"
             style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <span>{data ? `${filtered.length} sur ${data.templates.length} templates` : ''}</span>
          {added.size > 0 && (
            <span className="text-emerald-400 font-semibold">✓ {added.size} quête(s) ajoutée(s)</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Quests() {
  const { canEdit } = usePermission()
  const [quests, setQuests] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)

  const refresh = async () => setQuests((await api.questsList()).quests)
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t) }, [])

  const handleExpired = useCallback((id: string) => {
    setQuests(qs => qs.filter(q => q.id !== id))
  }, [])

  const blank = () => ({
    title: '', titleEn: '', description: '', descriptionEn: '',
    icon: '⭐', color: '#8B5CF6',
    type: 'BREAK_BLOCK', target: 'ANY', goal: 100,
    rewardCommand: '', rewardLabel: '', rewardLabelEn: '',
    enabled: true, repeatable: false, endsAtLocal: '',
  })

  const save = async () => {
    if (!editing) return
    const payload = { ...editing }
    if (payload.endsAtLocal) {
      payload.endsAt = new Date(payload.endsAtLocal).getTime()
    } else {
      payload.endsAt = null
    }
    delete payload.endsAtLocal
    if (editing.id) await api.questUpdate(editing.id, payload)
    else await api.questCreate(payload)
    setEditing(null); refresh()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🎯 Quêtes</h1>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setShowLibrary(true)}
                    className="px-3 py-2 rounded text-sm font-semibold flex items-center gap-2"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              📚 Bibliothèque
            </button>
            <button onClick={() => setEditing(blank())} className="px-3 py-2 rounded text-white text-sm" style={{ background: 'var(--primary)' }}>
              + Nouvelle quête
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {quests.map(q => (
          <QuestAdminCard
            key={q.id}
            q={q}
            canEdit={canEdit}
            onEdit={() => setEditing({ ...q, endsAtLocal: q.endsAt ? new Date(q.endsAt).toISOString().slice(0,16) : '' })}
            onDelete={async () => { if (confirm('Supprimer ?')) { await api.questDelete(q.id); refresh() } }}
            onExpired={handleExpired}
          />
        ))}
        {quests.length === 0 && (
          <div className="col-span-3 text-center py-12" style={{ color: 'var(--text-muted)' }}>
            Aucune quête.
            {canEdit && (
              <div className="mt-3">
                <button onClick={() => setShowLibrary(true)}
                        className="px-4 py-2 rounded text-sm text-white"
                        style={{ background: 'var(--primary)' }}>
                  📚 Parcourir la bibliothèque
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showLibrary && (
        <QuestLibraryModal onClose={() => setShowLibrary(false)} onAdded={refresh} />
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="rounded-xl p-6 w-[640px] max-h-[90vh] overflow-y-auto space-y-3"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{editing.id ? 'Modifier' : 'Nouvelle'} quête</h2>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>🇫🇷 Français</div>
              <input placeholder="Titre" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2 rounded" style={inp}/>
              <textarea placeholder="Description" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded mt-2" style={inp}/>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#7dd3fc' }}>🇬🇧 English (optionnel)</div>
              <input placeholder="Title (English)" value={editing.titleEn || ''} onChange={e => setEditing({ ...editing, titleEn: e.target.value })} className="w-full px-3 py-2 rounded" style={inp}/>
              <textarea placeholder="Description (English)" value={editing.descriptionEn || ''} onChange={e => setEditing({ ...editing, descriptionEn: e.target.value })} rows={2} className="w-full px-3 py-2 rounded mt-2" style={inp}/>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Type
                <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })} className="w-full mt-1 px-3 py-2 rounded" style={inp}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Target (ANY ou ex. STONE)
                <input value={editing.target} onChange={e => setEditing({ ...editing, target: e.target.value })} className="w-full mt-1 px-3 py-2 rounded" style={inp}/>
              </label>
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Goal
                <input type="number" value={editing.goal} onChange={e => setEditing({ ...editing, goal: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded" style={inp}/>
              </label>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Icône</div>
              <div className="flex flex-wrap gap-1">
                {ICONS.map(i => <button key={i} onClick={() => setEditing({ ...editing, icon: i })} className="w-8 h-8 rounded text-lg" style={{ background: editing.icon === i ? 'var(--primary)' : 'var(--surface-2)' }}>{i}</button>)}
              </div>
            </div>
            <input placeholder="Commande reward ({player} remplacé)" value={editing.rewardCommand} onChange={e => setEditing({ ...editing, rewardCommand: e.target.value })} className="w-full px-3 py-2 rounded font-mono text-sm" style={inp}/>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Label reward FR (ex: 500 coins)" value={editing.rewardLabel} onChange={e => setEditing({ ...editing, rewardLabel: e.target.value })} className="px-3 py-2 rounded" style={inp}/>
              <input placeholder="Reward label EN (optionnel)" value={editing.rewardLabelEn || ''} onChange={e => setEditing({ ...editing, rewardLabelEn: e.target.value })} className="px-3 py-2 rounded" style={inp}/>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={editing.enabled} onChange={e => setEditing({ ...editing, enabled: e.target.checked })}/> Active
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={editing.repeatable} onChange={e => setEditing({ ...editing, repeatable: e.target.checked })}/> Répétable
              </label>
            </div>
            <label className="text-xs block" style={{ color: 'var(--text-muted)' }}>
              Expiration (optionnelle)
              <input
                type="datetime-local"
                value={editing.endsAtLocal ?? ''}
                onChange={e => setEditing({ ...editing, endsAtLocal: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded"
                style={inp}
              />
            </label>
            <div className="flex gap-2">
              <button onClick={save} className="flex-1 px-4 py-2 rounded text-white" style={{ background: 'var(--primary)' }}>💾 Sauvegarder</button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }
