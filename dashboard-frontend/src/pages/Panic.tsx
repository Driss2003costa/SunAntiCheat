import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

export default function Panic() {
  const { isAdmin } = usePermission()
  const [status, setStatus] = useState<any>(null)
  const [reason, setReason] = useState('Maintenance d\'urgence')
  const [loading, setLoading] = useState(false)

  const refresh = () => api.panicStatus().then(setStatus).catch(() => {})
  useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t) }, [])

  const activate = async () => {
    if (!confirm('⚠ Activer le PANIC MODE ? Whitelist ON + kick des non-OP.')) return
    setLoading(true)
    try { const s = await api.panicActivate(reason); setStatus(s) } finally { setLoading(false) }
  }
  const deactivate = async () => {
    setLoading(true)
    try { const s = await api.panicDeactivate(); setStatus(s) } finally { setLoading(false) }
  }

  const active = status?.active

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🚨 Panic Mode</h1>

      <div className="rounded-xl p-8 text-center" style={{
        background: active ? 'rgba(239,68,68,0.15)' : 'var(--surface)',
        border: `2px solid ${active ? '#ef4444' : 'var(--border)'}`,
      }}>
        <div className="text-6xl mb-4">{active ? '🔴' : '🟢'}</div>
        <div className="text-2xl font-bold" style={{ color: active ? '#ef4444' : 'var(--text)' }}>
          {active ? 'PANIC MODE ACTIF' : 'Normal'}
        </div>
        {active && (
          <div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Activé par <b>{status?.activatedBy}</b> — raison : {status?.reason}
            <br />Depuis {status?.activatedAt ? new Date(status.activatedAt).toLocaleString('fr-FR') : ''}
          </div>
        )}
      </div>

      {!isAdmin ? (
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-3">🔒</div>
          <div className="font-semibold" style={{ color: 'var(--text-muted)' }}>Contrôle réservé aux administrateurs</div>
        </div>
      ) : !active ? (
        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <label className="text-sm" style={{ color: 'var(--text-muted)' }}>Raison</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
                   className="w-full mt-1 px-3 py-2 rounded"
                   style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
          </div>
          <button onClick={activate} disabled={loading}
                  className="w-full px-4 py-3 rounded-lg font-bold text-white"
                  style={{ background: '#ef4444' }}>
            🚨 ACTIVER PANIC MODE
          </button>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            • Whitelist activée<br/>
            • Tous les joueurs non-OP sont kickés<br/>
            • Broadcast serveur<br/>
            • Désactivation à tout moment
          </p>
        </div>
      ) : (
        <button onClick={deactivate} disabled={loading}
                className="w-full px-4 py-3 rounded-lg font-bold text-white"
                style={{ background: '#10b981' }}>
          ✅ Désactiver
        </button>
      )}
    </div>
  )
}
