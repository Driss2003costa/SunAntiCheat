import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'
import ConfirmModal from '../components/ConfirmModal'

function typeLabel(type: string) {
  switch (type) {
    case 'BAN':     return <span className="badge-red">Ban</span>
    case 'MUTE':    return <span className="badge-orange">Mute</span>
    case 'KICK':    return <span className="badge-blue">Kick</span>
    case 'WARN':    return <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">Warn</span>
    default:        return <span className="text-muted text-xs">{type}</span>
  }
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(ms: number | null) {
  if (!ms) return 'Permanent'
  const h = Math.floor(ms / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}j`
  return `${h}h`
}

export default function Sanctions() {
  const [sanctions, setSanctions] = useState<any[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [playerFilter, setPlayer] = useState('')
  const [typeFilter, setType]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [revoke, setRevoke]       = useState<any | null>(null)
  const isAdmin = useAuthStore(s => s.isAdmin())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.sanctions({ player: playerFilter, type: typeFilter, page, size: 50 })
      setSanctions(res.sanctions ?? [])
      setTotal(res.total ?? 0)
    } catch {}
    finally { setLoading(false) }
  }, [playerFilter, typeFilter, page])

  useEffect(() => { load() }, [load])

  async function doRevoke(id: string) {
    try {
      await api.revokesSanction(id)
      setRevoke(null)
      load()
    } catch (e: any) { alert('Erreur: ' + e.message) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sanctions</h1>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted mb-1">Joueur</label>
            <input className="input w-40" value={playerFilter}
              onChange={e => { setPlayer(e.target.value); setPage(0) }} placeholder="Nom..." />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Type</label>
            <select className="input w-28" value={typeFilter} onChange={e => { setType(e.target.value); setPage(0) }}>
              <option value="">Tous</option>
              <option value="BAN">Ban</option>
              <option value="MUTE">Mute</option>
              <option value="KICK">Kick</option>
              <option value="WARN">Warn</option>
            </select>
          </div>
          <button className="btn-ghost text-sm" onClick={() => { setPlayer(''); setType(''); setPage(0) }}>
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted">{total} sanction(s)</span>
          {loading && <span className="text-xs text-muted animate-pulse">Chargement...</span>}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-left border-b border-border">
              <th className="pb-2 pr-4">Joueur</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Raison</th>
              <th className="pb-2 pr-4">Staff</th>
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Durée</th>
              <th className="pb-2 pr-4">Statut</th>
              {isAdmin && <th className="pb-2">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sanctions.length === 0 && !loading && (
              <tr><td colSpan={8} className="py-8 text-center text-muted">Aucune sanction</td></tr>
            )}
            {sanctions.map((s: any) => (
              <tr key={s.id} className="hover:bg-white/5 transition-colors">
                <td className="py-2 pr-4 font-medium">{s.playerName ?? s.playerUuid}</td>
                <td className="py-2 pr-4">{typeLabel(s.type)}</td>
                <td className="py-2 pr-4 text-muted max-w-[200px] truncate" title={s.reason}>{s.reason ?? '—'}</td>
                <td className="py-2 pr-4 text-muted">{s.staffName ?? '—'}</td>
                <td className="py-2 pr-4 text-muted text-xs">{fmtDate(s.timestamp)}</td>
                <td className="py-2 pr-4 text-muted text-xs">{fmtDuration(s.durationMs)}</td>
                <td className="py-2 pr-4">
                  {s.active
                    ? <span className="badge-red">Actif</span>
                    : <span className="text-xs text-muted">Expiré</span>}
                </td>
                {isAdmin && (
                  <td className="py-2">
                    {s.active && (
                      <button className="btn-ghost text-xs px-2 py-1 text-danger"
                        onClick={() => setRevoke(s)}>
                        Révoquer
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {total > 50 && (
          <div className="flex justify-center gap-2 mt-4">
            <button className="btn-ghost text-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              ← Précédent
            </button>
            <span className="text-muted text-sm self-center">Page {page + 1} / {Math.ceil(total / 50)}</span>
            <button className="btn-ghost text-sm" disabled={(page + 1) * 50 >= total} onClick={() => setPage(p => p + 1)}>
              Suivant →
            </button>
          </div>
        )}
      </div>

      {revoke && (
        <ConfirmModal
          title={`Révoquer la sanction de ${revoke.playerName} ?`}
          message={`Cela va annuler le ${revoke.type.toLowerCase()} de ${revoke.playerName}.`}
          danger
          onConfirm={() => doRevoke(revoke.id)}
          onCancel={() => setRevoke(null)} />
      )}
    </div>
  )
}
