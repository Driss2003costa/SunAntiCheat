import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'
import ConfirmModal from '../components/ConfirmModal'

export default function Players() {
  const [players, setPlayers]   = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [action, setAction]     = useState<{ type: string; player: any } | null>(null)
  const [reason, setReason]     = useState('')
  const [duration, setDuration] = useState('')
  const isAdmin = useAuthStore(s => s.isAdmin())

  const load = async () => {
    setLoading(true)
    try { setPlayers(await api.players()) } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i) }, [])

  async function doKick(uuid: string, name: string) {
    try {
      await api.kickPlayer(uuid, reason || 'Kicked by admin')
      setAction(null)
      setReason('')
    } catch (e: any) { alert('Erreur: ' + e.message) }
  }

  async function doBan(uuid: string, name: string) {
    try {
      await api.banPlayer(uuid, reason || 'Banned by admin', duration ? parseInt(duration) * 3600000 : undefined)
      setAction(null)
      setReason('')
      setDuration('')
    } catch (e: any) { alert('Erreur: ' + e.message) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Joueurs en ligne</h1>
        <span className="text-muted text-sm">{players.length} connecté(s)</span>
      </div>

      <div className="card overflow-x-auto">
        {loading && players.length === 0 && (
          <p className="text-center text-muted py-8">Chargement...</p>
        )}
        {!loading && players.length === 0 && (
          <p className="text-center text-muted py-8">Aucun joueur en ligne</p>
        )}
        {players.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left border-b border-border">
                <th className="pb-2 pr-4">Joueur</th>
                <th className="pb-2 pr-4">Monde</th>
                <th className="pb-2 pr-4">Position</th>
                <th className="pb-2 pr-4">Ping</th>
                <th className="pb-2 pr-4">Mode de jeu</th>
                {(isAdmin) && <th className="pb-2">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {players.map(p => (
                <tr key={p.uuid} className="hover:bg-white/5 transition-colors">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <div className="text-xs text-muted font-mono">{p.uuid}</div>
                  </td>
                  <td className="py-2 pr-4 text-muted">{p.world}</td>
                  <td className="py-2 pr-4 text-muted text-xs font-mono">
                    {Math.round(p.x)}, {Math.round(p.y)}, {Math.round(p.z)}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={p.ping < 80 ? 'text-success' : p.ping < 200 ? 'text-warning' : 'text-danger'}>
                      {p.ping}ms
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-muted">{p.gameMode}</td>
                  {(isAdmin) && (
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button className="btn-ghost text-xs px-2 py-1"
                          onClick={() => { setAction({ type: 'kick', player: p }); setReason('') }}>
                          Kick
                        </button>
                        {isAdmin && (
                          <button className="text-xs px-2 py-1 rounded bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
                            onClick={() => { setAction({ type: 'ban', player: p }); setReason(''); setDuration('') }}>
                            Ban
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Action modal */}
      {action && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setAction(null)}>
          <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">
              {action.type === 'kick' ? '👢 Kick' : '🔨 Ban'} — {action.player.name}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Raison</label>
                <input className="input w-full" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Raison..." />
              </div>
              {action.type === 'ban' && (
                <div>
                  <label className="block text-xs text-muted mb-1">Durée (heures, vide = permanent)</label>
                  <input className="input w-full" type="number" value={duration}
                    onChange={e => setDuration(e.target.value)} placeholder="Ex: 24" />
                </div>
              )}
              <div className="flex gap-3 justify-end mt-4">
                <button className="btn-ghost" onClick={() => setAction(null)}>Annuler</button>
                <button
                  className={action.type === 'ban' ? 'px-4 py-2 rounded-lg bg-danger text-white font-medium hover:bg-danger/80 transition-colors' : 'btn-primary px-4'}
                  onClick={() => action.type === 'kick' ? doKick(action.player.uuid, action.player.name) : doBan(action.player.uuid, action.player.name)}>
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
