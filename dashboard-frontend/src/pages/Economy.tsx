import { useState } from 'react'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useAnalytics } from '../hooks/useAnalytics'
import { api } from '../api/client'
import KpiCard from '../components/KpiCard'

const DAYS_OPTIONS = [7, 14, 30]
const PIE_COLORS = ['#7C3AED', '#10B981', '#F59E0B', '#3B82F6', '#EF4444']

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
    .format(n).replace('€', '$')
}

function toChartData(raw: any) {
  if (!raw?.labels) return []
  return raw.labels.map((l: string, i: number) => ({ label: l, value: raw.data?.[i] ?? 0 }))
}

export default function Economy() {
  const [days, setDays] = useState(7)

  const summary    = useAnalytics(() => api.economySummary(), 0, 30_000)
  const topRich    = useAnalytics(() => api.topRich(5), 0, 60_000)
  const moneyChart = useAnalytics(api.moneyOverTime, days)
  const stats      = useAnalytics(api.transactionStats, days)

  const moneyData = toChartData(moneyChart.data)
  const s = summary.data

  // Vault / Economy absent → plein écran
  if (s && s.economyAvailable === false) {
    return (
      <div className="p-6">
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-6xl mb-4">💰</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Vault non disponible</h1>
          <p className="max-w-md mx-auto text-sm" style={{ color: 'var(--text-muted)' }}>
            Aucun plugin d'économie compatible <b>Vault</b> n'est détecté sur ce serveur.
            Installe Vault puis un plugin d'économie (EssentialsX, CMI…) pour activer cette section.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            <a href="https://www.spigotmc.org/resources/vault.34315/"
               target="_blank" rel="noreferrer"
               className="inline-block px-5 py-2 rounded-lg text-white font-medium"
               style={{ background: 'var(--primary)' }}>
              📥 Télécharger Vault
            </a>
            <a href="https://www.spigotmc.org/resources/essentialsx.9089/"
               target="_blank" rel="noreferrer"
               className="inline-block px-5 py-2 rounded-lg font-medium"
               style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              📥 EssentialsX
            </a>
          </div>
        </div>
      </div>
    )
  }

  const pieData = stats.data ? [
    { name: 'Achats', value: stats.data.totalBuy },
    { name: 'Ventes', value: stats.data.totalSell },
  ] : []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Économie</h1>
        <div className="flex gap-2">
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={d === days ? 'btn-primary px-4 py-1.5 text-sm' : 'btn-ghost px-4 py-1.5 text-sm'}>
              {d}j
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon="💰" title="Argent total" value={s ? fmt(s.totalMoney) : '—'} color="success" />
        <KpiCard icon="👑" title="Joueur + riche"
          value={s?.topPlayer?.name ?? '—'}
          sub={s?.topPlayer ? fmt(s.topPlayer.balance) : ''}
          color="warning" />
        <KpiCard icon="📦" title="Transactions auj." value={s?.transactionsToday ?? '—'} color="info" />
        <KpiCard icon="📈" title="Volume auj." value={s ? fmt(s.volumeToday) : '—'} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Argent en circulation */}
        <div className="lg:col-span-2 card">
          <h3 className="font-semibold text-sm mb-4">💹 Argent en circulation / jour</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={moneyData}>
              <defs>
                <linearGradient id="moneyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2d2d3d' }}
                formatter={(v: any) => [fmt(v), 'Volume achats']} />
              <Area type="monotone" dataKey="value" stroke="#10B981" fill="url(#moneyGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition BUY/SELL */}
        <div className="card flex flex-col">
          <h3 className="font-semibold text-sm mb-4">📊 Achats vs Ventes</h3>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2d2d3d' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-muted text-xs mt-2">
            {stats.data && `${stats.data.totalBuy + stats.data.totalSell} transactions totales`}
          </div>
        </div>
      </div>

      {/* Top joueurs + Top items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 riches */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4">👑 Top 5 joueurs les plus riches</h3>
          {topRich.data?.map((p: any) => (
            <div key={p.uuid} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className={`text-lg font-bold w-8 text-center ${p.rank === 1 ? 'text-yellow-400' : p.rank === 2 ? 'text-slate-300' : p.rank === 3 ? 'text-amber-600' : 'text-muted'}`}>
                #{p.rank}
              </span>
              <div className="flex-1">
                <div className="font-medium text-sm flex items-center gap-1">
                  {p.name}
                  {p.online && <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />}
                </div>
              </div>
              <span className="text-success font-mono text-sm">{fmt(p.balance)}</span>
            </div>
          ))}
        </div>

        {/* Top items */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4">🛒 Items les plus achetés</h3>
          {stats.data?.topItems?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.data.topItems} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis dataKey="item" type="category" tick={{ fill: '#64748b', fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2d2d3d' }} />
                <Bar dataKey="quantity" fill="#7C3AED" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted text-sm text-center py-8">Aucune donnée</p>
          )}
        </div>
      </div>
    </div>
  )
}
