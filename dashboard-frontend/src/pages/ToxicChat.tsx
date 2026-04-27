import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

export default function ToxicChat() {
  const { canEdit } = usePermission()
  const [stats, setStats] = useState<any>({ topPlayers: [], recent: [], wordlistSize: 0 })
  const [words, setWords] = useState<string[]>([])
  const [editing, setEditing] = useState('')

  const refresh = async () => {
    setStats(await api.chatStats())
    const wl = await api.chatWordlist()
    setWords(wl.words)
    setEditing(wl.words.join('\n'))
  }
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t) }, [])

  const save = async () => {
    const list = editing.split('\n').map(s => s.trim()).filter(Boolean)
    await api.chatUpdateWords(list)
    refresh()
  }
  const reset = async (player: string) => {
    if (!confirm(`Reset score de ${player} ?`)) return
    await api.chatResetPlayer(player)
    refresh()
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🗯️ Chat Toxicité</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Mots filtrés" value={stats.wordlistSize}/>
        <Stat label="Joueurs flagués" value={stats.topPlayers?.length ?? 0}/>
        <Stat label="Messages récents" value={stats.recent?.length ?? 0}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Top offenseurs</h2>
          <div className="space-y-2">
            {stats.topPlayers?.map((p: any) => (
              <div key={p.player} className="flex items-center justify-between p-2 rounded"
                   style={{ background: 'var(--surface-2)' }}>
                <div>
                  <div style={{ color: 'var(--text)' }}>{p.player}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(p.lastMsgAt).toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${p.score >= 10 ? 'bg-red-500/30 text-red-400' : p.score >= 6 ? 'bg-orange-500/30 text-orange-400' : 'bg-yellow-500/30 text-yellow-400'}`}>
                    {p.score} pts
                  </span>
                  {canEdit && <button onClick={() => reset(p.player)} className="text-xs text-red-400 hover:underline">reset</button>}
                </div>
              </div>
            ))}
            {(!stats.topPlayers || stats.topPlayers.length === 0) &&
              <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun offenseur</div>}
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Messages récents</h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {stats.recent?.map((m: any, i: number) => (
              <div key={i} className="p-2 rounded text-sm" style={{ background: 'var(--surface-2)' }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text)' }}>{m.player}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>lvl {m.level}</span>
                </div>
                <div className="italic text-xs mt-1" style={{ color: 'var(--text-muted)' }}>« {m.message} »</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Wordlist (un mot par ligne)</h2>
          {canEdit && (
            <button onClick={save} className="px-3 py-1 rounded text-white text-sm" style={{ background: 'var(--primary)' }}>
              💾 Sauvegarder
            </button>
          )}
        </div>
        <textarea value={editing} onChange={e => canEdit && setEditing(e.target.value)}
                  readOnly={!canEdit}
                  rows={10}
                  className="w-full px-3 py-2 rounded font-mono text-sm"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', opacity: canEdit ? 1 : 0.6 }}/>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Seuils : ≥3 pts = warn · ≥6 pts = mute 5min · ≥10 pts = kick
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>{value}</div>
    </div>
  )
}
