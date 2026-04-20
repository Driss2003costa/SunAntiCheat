import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function Experiments() {
  const [list, setList] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)

  const refresh = async () => setList((await api.experimentsList()).experiments)
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t) }, [])

  const blank = () => ({
    name: '', description: '', enabled: false,
    variants: [
      { key: 'control', label: 'Control', weight: 50, config: {} },
      { key: 'variant', label: 'Variant', weight: 50, config: {} },
    ],
  })

  const save = async () => {
    if (!editing) return
    if (editing.id) await api.experimentUpdate(editing.id, editing)
    else await api.experimentCreate(editing)
    setEditing(null); refresh()
  }
  const toggle = async (e: any) => { await api.experimentUpdate(e.id, { enabled: !e.enabled }); refresh() }
  const del = async (id: string) => { if (!confirm('Supprimer ?')) return; await api.experimentDelete(id); refresh() }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🧪 A/B Testing</h1>
        <button onClick={() => setEditing(blank())} className="px-3 py-2 rounded text-white text-sm" style={{ background: 'var(--primary)' }}>
          + Nouvelle expérience
        </button>
      </div>

      <div className="space-y-4">
        {list.map(e => (
          <div key={e.id} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{e.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${e.enabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
                    {e.enabled ? 'En cours' : 'Arrêtée'}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{e.description}</div>
                <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  👥 {e.totalAssignments} assignations
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggle(e)} className="text-sm px-3 py-1 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                  {e.enabled ? '⏸ Stop' : '▶ Start'}
                </button>
                <button onClick={() => setEditing(e)} className="text-sm px-3 py-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>✏️</button>
                <button onClick={() => del(e.id)} className="text-sm px-3 py-1 rounded text-red-400 hover:bg-red-500/10">🗑</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {e.variants?.map((v: any) => (
                <div key={v.key} className="p-3 rounded" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{v.label}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>w:{v.weight} · {v.assignedCount} joueurs</span>
                  </div>
                  {v.metrics && Object.keys(v.metrics).length > 0 && (
                    <div className="mt-2 text-xs grid grid-cols-2 gap-1">
                      {Object.entries(v.metrics).map(([k, val]) => (
                        <div key={k} style={{ color: 'var(--text-muted)' }}>{k}: <b style={{ color: 'var(--text)' }}>{String(val)}</b></div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Aucune expérience</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="rounded-xl p-6 w-[600px] max-h-[90vh] overflow-y-auto space-y-3"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{editing.id ? 'Modifier' : 'Nouvelle'} expérience</h2>
            <input placeholder="Nom" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 rounded" style={inp}/>
            <textarea placeholder="Description" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded" style={inp}/>
            <div>
              <div className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Variantes</div>
              {editing.variants.map((v: any, i: number) => (
                <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                  <input placeholder="key" value={v.key} onChange={e => { const vs = [...editing.variants]; vs[i].key = e.target.value; setEditing({ ...editing, variants: vs }) }} className="px-2 py-1 rounded text-sm" style={inp}/>
                  <input placeholder="label" value={v.label} onChange={e => { const vs = [...editing.variants]; vs[i].label = e.target.value; setEditing({ ...editing, variants: vs }) }} className="px-2 py-1 rounded text-sm" style={inp}/>
                  <input type="number" placeholder="weight" value={v.weight} onChange={e => { const vs = [...editing.variants]; vs[i].weight = +e.target.value; setEditing({ ...editing, variants: vs }) }} className="px-2 py-1 rounded text-sm" style={inp}/>
                  <button onClick={() => setEditing({ ...editing, variants: editing.variants.filter((_: any, j: number) => j !== i) })}
                          className="text-xs text-red-400">Supprimer</button>
                </div>
              ))}
              <button onClick={() => setEditing({ ...editing, variants: [...editing.variants, { key: 'v' + (editing.variants.length + 1), label: 'Variant', weight: 50, config: {} }] })}
                      className="text-xs px-3 py-1 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>+ Variante</button>
            </div>
            <div className="flex gap-2 pt-3">
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
