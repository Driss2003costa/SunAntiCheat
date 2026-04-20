import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'
import ConfirmModal from '../components/ConfirmModal'

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60000) return 'à l\'instant'
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)}h`
  return `il y a ${Math.floor(diff / 86400000)}j`
}

export default function Reports() {
  const [reports, setReports]   = useState<any[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(0)
  const [showResolved, setShow] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [resolving, setResolving] = useState<any | null>(null)
  const isAdmin = useAuthStore(s => s.isAdmin())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.reports({ resolved: showResolved, page, size: 50 })
      setReports(res.reports ?? [])
      setTotal(res.total ?? 0)
    } catch {}
    finally { setLoading(false) }
  }, [showResolved, page])

  useEffect(() => { load() }, [load])

  async function doResolve(id: string) {
    try {
      await api.resolveReport(id)
      setResolving(null)
      load()
    } catch (e: any) { alert('Erreur: ' + e.message) }
  }

  const pending = reports.filter(r => !r.resolved).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Signalements</h1>
          {pending > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-danger text-white text-xs font-bold">{pending} en attente</span>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input type="checkbox" className="accent-primary"
            checked={showResolved} onChange={e => { setShow(e.target.checked); setPage(0) }} />
          Afficher résolus
        </label>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted">{total} signalement(s)</span>
          {loading && <span className="text-xs text-muted animate-pulse">Chargement...</span>}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-left border-b border-border">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Rapporteur</th>
              <th className="pb-2 pr-4">Accusé</th>
              <th className="pb-2 pr-4">Raison</th>
              <th className="pb-2 pr-4">Monde</th>
              <th className="pb-2 pr-4">Statut</th>
              {isAdmin && <th className="pb-2">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {reports.length === 0 && !loading && (
              <tr><td colSpan={7} className="py-8 text-center text-muted">Aucun signalement</td></tr>
            )}
            {reports.map((r: any) => (
              <tr key={r.id} className={`hover:bg-white/5 transition-colors ${!r.resolved ? 'border-l-2 border-danger' : ''}`}>
                <td className="py-2 pr-4">
                  <span className="block text-xs text-muted">{fmtDate(r.timestamp)}</span>
                  <span className="text-xs text-muted/60">{timeAgo(r.timestamp)}</span>
                </td>
                <td className="py-2 pr-4 font-medium">{r.reporterName ?? '—'}</td>
                <td className="py-2 pr-4 font-medium text-amber-400">{r.targetName ?? '—'}</td>
                <td className="py-2 pr-4 text-muted max-w-[200px] truncate" title={r.reason}>{r.reason ?? '—'}</td>
                <td className="py-2 pr-4 text-muted text-xs">{r.world ?? '—'}</td>
                <td className="py-2 pr-4">
                  {r.resolved
                    ? <span className="badge-green text-xs">Résolu</span>
                    : <span className="badge-red text-xs">En attente</span>}
                </td>
                {isAdmin && (
                  <td className="py-2">
                    {!r.resolved && (
                      <button className="btn-ghost text-xs px-2 py-1 text-success"
                        onClick={() => setResolving(r)}>
                        ✓ Résoudre
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

      {resolving && (
        <ConfirmModal
          title={`Marquer comme résolu ?`}
          message={`Signalement de ${resolving.reporterName} contre ${resolving.targetName}.`}
          onConfirm={() => doResolve(resolving.id)}
          onCancel={() => setResolving(null)} />
      )}
    </div>
  )
}
