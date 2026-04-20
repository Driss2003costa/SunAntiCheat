import { useEffect, useState } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { api } from '../api/client'

interface Alert {
  timestamp: number
  type: string
  playerName: string
  world: string
  detail: string
}

const TYPE_BADGE: Record<string, string> = {
  XRAY:     'badge-orange',
  KILLAURA: 'badge-red',
  FREECAM:  'badge-blue',
  WM_CHEST: 'badge-purple',
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

export default function AlertFeed({ limit = 20 }: { limit?: number }) {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    api.alerts(limit).then(setAlerts).catch(() => {})
  }, [limit])

  useWebSocket(['alerts'], (msg) => {
    if (msg.channel === 'alerts' && msg.data) {
      setAlerts(prev => [msg.data, ...prev].slice(0, limit))
    }
  })

  return (
    <div className="card h-full flex flex-col">
      <div className="font-semibold text-sm mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        Alertes temps réel
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {alerts.length === 0 && (
          <p className="text-muted text-sm text-center py-8">Aucune alerte récente</p>
        )}
        {alerts.map((a, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-bg border border-border text-sm">
            <span className={TYPE_BADGE[a.type] ?? 'badge-blue'}>{a.type}</span>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-slate-200">{a.playerName || '?'}</span>
              {a.world && <span className="text-muted ml-1 text-xs">({a.world})</span>}
              {a.detail && <div className="text-muted text-xs truncate">{a.detail}</div>}
            </div>
            <span className="text-muted text-xs shrink-0">{timeAgo(a.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
