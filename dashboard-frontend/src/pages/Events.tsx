import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

const ICONS = ['🎉', '⚔️', '🏆', '🎁', '🐉', '🏰', '💎', '🎃', '🎄', '💀', '🔥', '⚡']
const COLORS = ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

function toLocalDT(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Events() {
  const { canEdit } = usePermission()
  const [events, setEvents] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)

  const refresh = async () => setEvents((await api.eventsList()).events)
  useEffect(() => { refresh(); const t = setInterval(refresh, 20000); return () => clearInterval(t) }, [])

  const blank = () => ({
    title: '', description: '', startAt: Date.now() + 3600000, durationMinutes: 60,
    color: '#F59E0B', icon: '🎉',
    broadcastMessages: [], broadcastOffsetsMinutes: [60, 15, 5, 1],
    startCommand: '', endCommand: '',
  })

  const save = async () => {
    if (!editing) return
    const data = { ...editing, broadcastOffsetsMinutes: editing.broadcastOffsetsMinutes || [60, 15, 5, 1] }
    if (editing.id) await api.eventUpdate(editing.id, data)
    else await api.eventCreate(data)
    setEditing(null); refresh()
  }
  const del = async (id: string) => { if (!confirm('Supprimer ?')) return; await api.eventDelete(id); refresh() }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>📅 Events</h1>
        <div className="flex gap-2">
          <a href={api.eventsExportUrl()} className="px-3 py-2 rounded text-sm" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            📥 Export .ics
          </a>
          {canEdit && (
            <button onClick={() => setEditing(blank())} className="px-3 py-2 rounded text-white text-sm" style={{ background: 'var(--primary)' }}>
              + Nouvel event
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {events.map(e => (
          <div key={e.id} className="rounded-xl p-5 relative overflow-hidden"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="absolute top-0 left-0 w-1 h-full" style={{ background: e.color }}/>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>{e.icon} {e.title}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{e.description}</div>
                <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  📆 {new Date(e.startAt).toLocaleString('fr-FR')} · ⏳ {e.durationMinutes} min
                </div>
                {e.started && !e.ended && <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">EN COURS</span>}
                {e.ended && <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-zinc-500/20 text-zinc-400">TERMINÉ</span>}
              </div>
              <div className="flex flex-col gap-1">
                {canEdit && <>
                  <button onClick={() => setEditing({ ...e, startAt: e.startAt })} className="text-xs px-2 py-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>✏️</button>
                  <button onClick={() => del(e.id)} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">🗑</button>
                </>}
              </div>
            </div>
          </div>
        ))}
        {events.length === 0 && <div className="col-span-2 text-center py-12" style={{ color: 'var(--text-muted)' }}>Aucun event planifié</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="rounded-xl p-6 w-[600px] max-h-[90vh] overflow-y-auto space-y-3"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{editing.id ? 'Modifier' : 'Nouvel'} event</h2>
            <input placeholder="Titre" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2 rounded" style={inp}/>
            <textarea placeholder="Description" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded" style={inp}/>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Début
                <input type="datetime-local" value={toLocalDT(editing.startAt)} onChange={e => setEditing({ ...editing, startAt: new Date(e.target.value).getTime() })} className="w-full mt-1 px-3 py-2 rounded" style={inp}/>
              </label>
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Durée (min)
                <input type="number" value={editing.durationMinutes} onChange={e => setEditing({ ...editing, durationMinutes: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded" style={inp}/>
              </label>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Icône</div>
              <div className="flex flex-wrap gap-1">
                {ICONS.map(i => (
                  <button key={i} onClick={() => setEditing({ ...editing, icon: i })}
                          className="w-8 h-8 rounded text-lg"
                          style={{ background: editing.icon === i ? 'var(--primary)' : 'var(--surface-2)' }}>{i}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Couleur</div>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setEditing({ ...editing, color: c })}
                          className="w-8 h-8 rounded" style={{ background: c, border: editing.color === c ? '2px solid white' : 'none' }}/>
                ))}
              </div>
            </div>
            <input placeholder="Commande au démarrage (optionnel)" value={editing.startCommand || ''} onChange={e => setEditing({ ...editing, startCommand: e.target.value })} className="w-full px-3 py-2 rounded font-mono text-sm" style={inp}/>
            <input placeholder="Commande à la fin (optionnel)" value={editing.endCommand || ''} onChange={e => setEditing({ ...editing, endCommand: e.target.value })} className="w-full px-3 py-2 rounded font-mono text-sm" style={inp}/>
            <input placeholder="Broadcasts avant début (min, ex: 60,15,5,1)"
                   value={(editing.broadcastOffsetsMinutes || []).join(',')}
                   onChange={e => setEditing({ ...editing, broadcastOffsetsMinutes: e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) })}
                   className="w-full px-3 py-2 rounded" style={inp}/>
            <div className="flex gap-2 pt-2">
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
