import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

const TYPES = ['BREAK_BLOCK', 'PLACE_BLOCK', 'KILL_ENTITY', 'KILL_PLAYER', 'CRAFT_ITEM', 'FISH_CATCH', 'PLAY_TIME']
const ICONS = ['⭐', '⚔️', '⛏', '🏆', '🐟', '💰', '💎', '🔥', '🛡️', '🎯']

export default function Quests() {
  const { canEdit } = usePermission()
  const [quests, setQuests] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)

  const refresh = async () => setQuests((await api.questsList()).quests)
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t) }, [])

  const blank = () => ({
    title: '', description: '', icon: '⭐', color: '#8B5CF6',
    type: 'BREAK_BLOCK', target: 'ANY', goal: 100,
    rewardCommand: '', rewardLabel: '', enabled: true, repeatable: false,
  })

  const save = async () => {
    if (!editing) return
    if (editing.id) await api.questUpdate(editing.id, editing)
    else await api.questCreate(editing)
    setEditing(null); refresh()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🎯 Quêtes</h1>
        {canEdit && (
          <button onClick={() => setEditing(blank())} className="px-3 py-2 rounded text-white text-sm" style={{ background: 'var(--primary)' }}>
            + Nouvelle quête
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quests.map(q => (
          <div key={q.id} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: `1px solid ${q.enabled ? q.color : 'var(--border)'}` }}>
            <div className="flex items-start justify-between mb-2">
              <div className="text-3xl">{q.icon}</div>
              <div className="flex gap-1">
                {canEdit && <>
                  <button onClick={() => setEditing(q)} className="text-xs px-2 py-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>✏️</button>
                  <button onClick={async () => { if (confirm('Supprimer ?')) { await api.questDelete(q.id); refresh() } }}
                          className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">🗑</button>
                </>}
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
        ))}
        {quests.length === 0 && <div className="col-span-3 text-center py-12" style={{ color: 'var(--text-muted)' }}>Aucune quête</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="rounded-xl p-6 w-[600px] space-y-3"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{editing.id ? 'Modifier' : 'Nouvelle'} quête</h2>
            <input placeholder="Titre" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2 rounded" style={inp}/>
            <textarea placeholder="Description" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded" style={inp}/>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <input placeholder="Label reward (ex: 500 coins)" value={editing.rewardLabel} onChange={e => setEditing({ ...editing, rewardLabel: e.target.value })} className="w-full px-3 py-2 rounded" style={inp}/>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={editing.enabled} onChange={e => setEditing({ ...editing, enabled: e.target.checked })}/> Active
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={editing.repeatable} onChange={e => setEditing({ ...editing, repeatable: e.target.checked })}/> Répétable
              </label>
            </div>
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
