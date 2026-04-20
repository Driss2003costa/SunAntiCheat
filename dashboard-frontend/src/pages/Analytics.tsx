import { useState } from 'react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useAnalytics } from '../hooks/useAnalytics'
import { api } from '../api/client'

const DAYS_OPTIONS = [7, 14, 30]

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-sm mb-4">{title}</h3>
      {children}
    </div>
  )
}

function toChartData(raw: any) {
  if (!raw?.labels) return []
  return raw.labels.map((label: string, i: number) => {
    const obj: any = { label }
    raw.datasets?.forEach((ds: any) => { obj[ds.label] = ds.data[i] ?? 0 })
    return obj
  })
}

const COLORS = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6']

export default function Analytics() {
  const [days, setDays] = useState(7)

  const connections = useAnalytics(api.analyticsConnections, days)
  const sessions    = useAnalytics(api.analyticsSessionDur,   days)
  const newPlayers  = useAnalytics(api.analyticsNewPlayers,   days)
  const tps         = useAnalytics(api.analyticsTps,          days)
  const ram         = useAnalytics(api.analyticsRam,          days)
  const alerts      = useAnalytics(api.analyticsAlerts,       days)

  const connData    = toChartData(connections.data)
  const sessionData = toChartData(sessions.data)
  const newPlayData = toChartData(newPlayers.data)
  const tpsData     = toChartData(tps.data)
  const ramData     = toChartData(ram.data)
  const alertsData  = toChartData(alerts.data)

  const alertKeys   = alerts.data?.datasets?.map((d: any) => d.label) ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-2">
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={d === days ? 'btn-primary px-4 py-1.5 text-sm' : 'btn-ghost px-4 py-1.5 text-sm'}>
              {d}j
            </button>
          ))}
        </div>
      </div>

      {/* Section 1 — Activité joueurs */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Activité joueurs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChartCard title="Connexions / jour">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={connData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2d2d3d' }} />
                <Line type="monotone" dataKey="Connexions" stroke="#7C3AED" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Durée session moyenne (min)">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={sessionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2d2d3d' }} />
                <Line type="monotone" dataKey="Durée moy. (min)" stroke="#10B981" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Nouveaux joueurs / jour">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={newPlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2d2d3d' }} />
                <Bar dataKey="Nouveaux joueurs" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Section 2 — Santé serveur */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Santé serveur</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="TPS moyen / jour">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tpsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis domain={[0, 20]} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2d2d3d' }} />
                <Line type="monotone" dataKey="TPS moyen" stroke="#10B981" dot={false} strokeWidth={2} />
                {/* Zone rouge TPS < 15 */}
                <line x1="0" x2="100%" y1="15" y2="15" stroke="#EF4444" strokeDasharray="4" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="RAM utilisée (MB)">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={ramData}>
                <defs>
                  <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2d2d3d' }} />
                <Area type="monotone" dataKey="RAM (MB)" stroke="#7C3AED" fill="url(#ramGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Section 3 — Sécurité */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Sécurité</h2>
        <ChartCard title="Alertes anti-cheat par type / jour">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={alertsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2d2d3d' }} />
              <Legend />
              {alertKeys.map((key: string, i: number) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
