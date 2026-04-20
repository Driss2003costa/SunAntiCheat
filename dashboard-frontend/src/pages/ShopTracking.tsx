import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

const DAYS_OPTIONS = [1, 7, 14, 30]

function fmt(n: number) {
  return `$${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function timeStr(ts: number) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function dateStr(ts: number) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function ShopTracking() {
  const [days, setDays]       = useState(7)
  const [type, setType]       = useState('')
  const [player, setPlayer]   = useState('')
  const [transactions, setTx] = useState<any[]>([])
  const [total, setTotal]     = useState(0)
  const [stats, setStats]     = useState<any>(null)
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(false)

  const token = useAuthStore(s => s.token)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [txRes, statsRes] = await Promise.all([
        api.transactions({ days, type, player, page, size: 50 }),
        api.transactionStats(days),
      ])
      setTx(txRes.transactions ?? [])
      setTotal(txRes.total ?? 0)
      setStats(statsRes)
    } catch {}
    finally { setLoading(false) }
  }, [days, type, player, page])

  useEffect(() => { load(); const i = setInterval(load, 10_000); return () => clearInterval(i) }, [load])

  function handleExport() {
    window.open(api.exportCsvUrl(days, type, player), '_blank')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🛒 Shop Tracking (EconomyShopGUI+)</h1>
        <button className="btn-ghost text-sm" onClick={handleExport}>⬇️ Exporter CSV</button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-muted text-xs uppercase">Transactions</div>
            <div className="text-2xl font-bold text-violet-400">{stats.totalBuy + stats.totalSell}</div>
          </div>
          <div className="card">
            <div className="text-muted text-xs uppercase">Argent dépensé</div>
            <div className="text-2xl font-bold text-emerald-400">{fmt(stats.volumeBuy)}</div>
          </div>
          <div className="card">
            <div className="text-muted text-xs uppercase">Top acheteur</div>
            <div className="text-xl font-bold text-amber-400">{stats.topBuyers?.[0]?.name ?? '—'}</div>
            <div className="text-muted text-xs">{stats.topBuyers?.[0] ? `${stats.topBuyers[0].count} achats` : ''}</div>
          </div>
          <div className="card">
            <div className="text-muted text-xs uppercase">Item le + populaire</div>
            <div className="text-lg font-bold text-blue-400 truncate">{stats.topItems?.[0]?.item ?? '—'}</div>
            <div className="text-muted text-xs">{stats.topItems?.[0] ? `×${stats.topItems[0].quantity}` : ''}</div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted mb-1">Joueur</label>
            <input className="input w-40" value={player} onChange={e => { setPlayer(e.target.value); setPage(0) }} placeholder="Nom..." />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Type</label>
            <select className="input w-28" value={type} onChange={e => { setType(e.target.value); setPage(0) }}>
              <option value="">Tous</option>
              <option value="BUY">Achats</option>
              <option value="SELL">Ventes</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Période</label>
            <div className="flex gap-1">
              {DAYS_OPTIONS.map(d => (
                <button key={d} onClick={() => { setDays(d); setPage(0) }}
                  className={d === days ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-ghost px-3 py-1.5 text-xs'}>
                  {d}j
                </button>
              ))}
            </div>
          </div>
          <button className="btn-ghost text-sm" onClick={() => { setPlayer(''); setType(''); setPage(0) }}>
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted">{total} transaction(s)</span>
          {loading && <span className="text-xs text-muted animate-pulse">Mise à jour...</span>}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-left border-b border-border">
              <th className="pb-2 pr-4">Date/Heure</th>
              <th className="pb-2 pr-4">Joueur</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Item</th>
              <th className="pb-2 pr-4 text-right">Qté</th>
              <th className="pb-2 pr-4 text-right">Prix unit.</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.length === 0 && !loading && (
              <tr><td colSpan={7} className="py-8 text-center text-muted">Aucune transaction</td></tr>
            )}
            {transactions.map((t: any) => (
              <tr key={t.id} className="hover:bg-white/5 transition-colors">
                <td className="py-2 pr-4 text-muted text-xs">
                  <span className="block">{dateStr(t.timestamp)}</span>
                  <span>{timeStr(t.timestamp)}</span>
                </td>
                <td className="py-2 pr-4">
                  <button className="font-medium hover:text-primary transition-colors"
                    onClick={() => { setPlayer(t.playerName); setPage(0) }}>
                    {t.playerName}
                  </button>
                </td>
                <td className="py-2 pr-4">
                  <span className={t.type === 'BUY' ? 'badge-green' : 'badge-orange'}>
                    {t.type === 'BUY' ? '🟢 ACHAT' : '🔴 VENTE'}
                  </span>
                </td>
                <td className="py-2 pr-4 text-slate-300 max-w-[150px] truncate" title={t.itemDisplayName}>
                  {t.itemDisplayName}
                </td>
                <td className="py-2 pr-4 text-right font-mono">{t.quantity}</td>
                <td className="py-2 pr-4 text-right font-mono text-muted">{fmt(t.pricePerUnit)}</td>
                <td className="py-2 text-right font-mono font-semibold text-emerald-400">{fmt(t.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 50 && (
          <div className="flex justify-center gap-2 mt-4">
            <button className="btn-ghost text-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              ← Précédent
            </button>
            <span className="text-muted text-sm self-center">
              Page {page + 1} / {Math.ceil(total / 50)}
            </span>
            <button className="btn-ghost text-sm" disabled={(page + 1) * 50 >= total} onClick={() => setPage(p => p + 1)}>
              Suivant →
            </button>
          </div>
        )}
      </div>

      {/* Top acheteurs */}
      {stats?.topBuyers?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-3">🏆 Top acheteurs</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left border-b border-border">
                <th className="pb-2">Rang</th>
                <th className="pb-2">Joueur</th>
                <th className="pb-2 text-right">Achats</th>
                <th className="pb-2 text-right">Dépensé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.topBuyers.map((b: any, i: number) => (
                <tr key={b.name}>
                  <td className="py-2 text-muted">#{i + 1}</td>
                  <td className="py-2 font-medium">
                    <button className="hover:text-primary transition-colors"
                      onClick={() => { setPlayer(b.name); setPage(0) }}>
                      {b.name}
                    </button>
                  </td>
                  <td className="py-2 text-right">{b.count}</td>
                  <td className="py-2 text-right text-emerald-400 font-mono">{fmt(b.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
