import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

const DAYS = [
  { v: 1, l: 'Lun' }, { v: 2, l: 'Mar' }, { v: 3, l: 'Mer' },
  { v: 4, l: 'Jeu' }, { v: 5, l: 'Ven' }, { v: 6, l: 'Sam' }, { v: 7, l: 'Dim' },
]

function fmtCountdown(ms: number) {
  if (ms <= 0) return '—'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 24) return `${Math.floor(h / 24)}j ${h % 24}h`
  if (h > 0)  return `${h}h ${m}m`
  if (m > 0)  return `${m}m ${sec}s`
  return `${sec}s`
}
const fmtDate = (ts: number) => new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function RebootPage() {
  const [status, setStatus] = useState<any>(null)
  const [mode, setMode] = useState<'DAILY' | 'WEEKLY' | 'ONCE'>('DAILY')
  const [hhmm, setHhmm] = useState('04:00')
  const [days, setDays] = useState<number[]>([1, 3, 5]) // Lun Mer Ven par défaut
  const [onceAt, setOnceAt] = useState('')
  const [now, setNow] = useState(Date.now())
  const isAdmin = useAuthStore(s => s.isAdmin())

  const load = () => api.rebootStatus().then(s => {
    setStatus(s)
    if (s.mode !== 'DISABLED') {
      setMode(s.mode)
      setHhmm(s.hhmm || '04:00')
      setDays(s.weeklyDays || [])
      if (s.onceAt) setOnceAt(new Date(s.onceAt).toISOString().slice(0, 16))
    }
  })
  useEffect(() => {
    load()
    const poll = setInterval(load, 5000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [])

  const schedule = async () => {
    if (mode === 'ONCE') {
      if (!onceAt) return alert('Date requise')
      await api.rebootSchedule({ mode: 'ONCE', at: new Date(onceAt).getTime() })
    } else if (mode === 'DAILY') {
      await api.rebootSchedule({ mode: 'DAILY', hhmm })
    } else {
      if (days.length === 0) return alert('Au moins 1 jour')
      await api.rebootSchedule({ mode: 'WEEKLY', hhmm, days })
    }
    load()
  }

  const cancel = async () => { if (confirm('Annuler le reboot planifié ?')) { await api.rebootCancel(); load() } }
  const rebootNow = async () => {
    if (!confirm('⚠ Reboot dans 5 secondes ?\n\nLe serveur va broadcast puis redémarrer.')) return
    await api.rebootNow(); load()
  }

  const nextAt = status?.nextAt ?? -1
  const countdown = nextAt > 0 ? nextAt - now : -1
  const isImminent = countdown > 0 && countdown < 60_000
  const isSoon     = countdown > 0 && countdown < 600_000

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3"><span>🔄</span> Reboot Scheduler</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Redémarrage automatique avec broadcast countdown (10m, 5m, 1m, 30s, 10s…)
        </p>
      </div>

      {/* Status card */}
      <div className="card relative overflow-hidden">
        {isImminent && (
          <div className="absolute inset-0 animate-pulse pointer-events-none"
               style={{ background: 'radial-gradient(circle at top right, rgba(239,68,68,0.15), transparent)' }} />
        )}
        <div className="flex items-center justify-between flex-wrap gap-4 relative">
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>État</div>
            {status?.mode === 'DISABLED' || nextAt <= 0 ? (
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text-muted)' }}>⏸ Aucun reboot planifié</div>
            ) : (
              <>
                <div className="text-2xl font-bold mt-1"
                     style={{ color: isImminent ? '#EF4444' : isSoon ? '#F59E0B' : '#10B981' }}>
                  {fmtCountdown(countdown)}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {fmtDate(nextAt)} — mode {status.mode}
                </div>
              </>
            )}
          </div>

          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              {nextAt > 0 && <button onClick={cancel} className="btn-ghost">✕ Annuler</button>}
              <button onClick={rebootNow} className="btn-danger">⚠ Reboot maintenant</button>
            </div>
          )}
        </div>
      </div>

      {/* Scheduler form */}
      {isAdmin && (
        <div className="card">
          <div className="text-lg font-semibold mb-4">Programmer</div>

          <div className="flex gap-1 mb-5" style={{ background: 'var(--surface-2)', padding: '3px', borderRadius: '8px', width: 'fit-content' }}>
            {(['DAILY', 'WEEKLY', 'ONCE'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-4 py-1.5 rounded text-sm transition"
                style={{
                  background: mode === m ? 'var(--primary)' : 'transparent',
                  color: mode === m ? 'white' : 'var(--text-muted)',
                }}
              >
                {m === 'DAILY' ? 'Quotidien' : m === 'WEEKLY' ? 'Hebdomadaire' : 'Une fois'}
              </button>
            ))}
          </div>

          {(mode === 'DAILY' || mode === 'WEEKLY') && (
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Heure</label>
              <input type="time" className="input mt-1 max-w-[200px] font-mono text-lg text-center"
                     value={hhmm} onChange={e => setHhmm(e.target.value)} />
            </div>
          )}

          {mode === 'WEEKLY' && (
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Jours</label>
              <div className="mt-2 flex gap-2 flex-wrap">
                {DAYS.map(d => {
                  const active = days.includes(d.v)
                  return (
                    <button
                      key={d.v}
                      onClick={() => setDays(active ? days.filter(x => x !== d.v) : [...days, d.v])}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition"
                      style={{
                        background: active ? 'var(--primary)' : 'var(--surface-2)',
                        color: active ? 'white' : 'var(--text-muted)',
                      }}
                    >
                      {d.l}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {mode === 'ONCE' && (
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Date &amp; heure</label>
              <input type="datetime-local" className="input mt-1 max-w-[260px]"
                     value={onceAt} onChange={e => setOnceAt(e.target.value)} />
            </div>
          )}

          <button onClick={schedule} className="btn-primary">💾 Enregistrer la planification</button>
        </div>
      )}

      {/* History */}
      {status?.history?.length > 0 && (
        <div className="card">
          <div className="text-lg font-semibold mb-3">Historique des reboots</div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {[...status.history].reverse().map((ts: number, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm px-3 py-2 rounded"
                   style={{ background: 'var(--surface-2)' }}>
                <span>🔄 {fmtDate(ts)}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  il y a {fmtCountdown(Date.now() - ts)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
