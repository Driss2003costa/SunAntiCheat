import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

const DAYS_OPTIONS = [1, 7, 14, 30]
type SortKey = 'quantity' | 'revenue' | 'buyers' | 'avgPrice' | 'transactions'

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
  const [esgStatus, setEsgStatus] = useState<any>(null)
  const [itemSearch, setItemSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('quantity')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const token = useAuthStore(s => s.token)

  useEffect(() => {
    api.shopEsgStatus().then(setEsgStatus).catch(() => {})
  }, [])

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

  // Tri + filtrage de itemSales (côté client, c'est juste de l'agrégation déjà faite)
  const itemSalesSorted = useMemo(() => {
    if (!stats?.itemSales) return [] as any[]
    const search = itemSearch.trim().toLowerCase()
    const filtered = search
      ? stats.itemSales.filter((r: any) => (r.item || '').toLowerCase().includes(search))
      : stats.itemSales
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a: any, b: any) => ((a[sortKey] || 0) - (b[sortKey] || 0)) * dir)
  }, [stats, itemSearch, sortKey, sortDir])

  const itemSalesTotals = useMemo(() => {
    if (!stats?.itemSales) return { quantity: 0, revenue: 0 }
    return stats.itemSales.reduce(
      (acc: any, r: any) => ({
        quantity: acc.quantity + (r.quantity || 0),
        revenue: acc.revenue + (r.revenue || 0),
      }),
      { quantity: 0, revenue: 0 },
    )
  }, [stats])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  function handleExport() {
    window.open(api.exportCsvUrl(days, type, player), '_blank')
  }

  // EconomyShopGUI absent → plein écran
  if (esgStatus && !esgStatus.installed) {
    return (
      <div className="p-6">
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-6xl mb-4">🛒</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>EconomyShopGUI non installé</h1>
          <p className="max-w-md mx-auto text-sm" style={{ color: 'var(--text-muted)' }}>
            Le plugin <b>EconomyShopGUI</b> (ou EconomyShopGUI+) n'est pas détecté sur ce serveur.
            Le tracking des transactions de shops nécessite ce plugin.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            <a href="https://www.spigotmc.org/resources/economyshopgui.69476/"
               target="_blank" rel="noreferrer"
               className="inline-block px-5 py-2 rounded-lg text-white font-medium"
               style={{ background: 'var(--primary)' }}>
              📥 Télécharger EconomyShopGUI
            </a>
            <a href="https://polymart.org/resource/economyshopgui.598"
               target="_blank" rel="noreferrer"
               className="inline-block px-5 py-2 rounded-lg font-medium"
               style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              💎 EconomyShopGUI+
            </a>
          </div>
        </div>
      </div>
    )
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

      {/* Ventes par item — total agrégé tous joueurs */}
      {stats?.itemSales?.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-sm">📦 Ventes totales par item</h3>
              <p className="text-xs text-muted">
                Agrégé sur tous les joueurs · {stats.itemSales.length} item(s) ·
                {' '}<b className="text-emerald-400">{itemSalesTotals.quantity.toLocaleString('fr-FR')}</b> unités vendues ·
                {' '}<b className="text-emerald-400">{fmt(itemSalesTotals.revenue)}</b> CA total
              </p>
            </div>
            <input
              className="input w-48 text-sm"
              placeholder="🔍 Filtrer..."
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}/>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left border-b border-border">
                  <th className="pb-2 pr-4">Item</th>
                  <SortableTh label="Qté totale"   active={sortKey === 'quantity'}     dir={sortDir} onClick={() => toggleSort('quantity')}     align="right"/>
                  <SortableTh label="Transactions" active={sortKey === 'transactions'} dir={sortDir} onClick={() => toggleSort('transactions')} align="right"/>
                  <SortableTh label="Acheteurs"    active={sortKey === 'buyers'}       dir={sortDir} onClick={() => toggleSort('buyers')}       align="right"/>
                  <SortableTh label="Prix moyen"   active={sortKey === 'avgPrice'}     dir={sortDir} onClick={() => toggleSort('avgPrice')}     align="right"/>
                  <SortableTh label="Revenu total" active={sortKey === 'revenue'}      dir={sortDir} onClick={() => toggleSort('revenue')}      align="right"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {itemSalesSorted.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-muted">Aucun item ne correspond</td></tr>
                )}
                {itemSalesSorted.map((row: any) => {
                  const pctOfTotal = itemSalesTotals.quantity > 0
                    ? Math.round((row.quantity / itemSalesTotals.quantity) * 100)
                    : 0
                  return (
                    <tr key={row.item} className="hover:bg-white/5 transition-colors">
                      <td className="py-2 pr-4 max-w-[260px] truncate font-medium" title={row.item}>{row.item}</td>
                      <td className="py-2 pr-4 text-right font-mono">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted">{pctOfTotal}%</span>
                          <span className="font-semibold text-emerald-400">×{row.quantity.toLocaleString('fr-FR')}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-muted">{row.transactions}</td>
                      <td className="py-2 pr-4 text-right font-mono">{row.buyers}</td>
                      <td className="py-2 pr-4 text-right font-mono text-muted">{fmt(row.avgPrice)}</td>
                      <td className="py-2 text-right font-mono font-semibold text-amber-400">{fmt(row.revenue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

function SortableTh({ label, active, dir, onClick, align = 'left' }: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th className={`pb-2 pr-4 cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
        onClick={onClick}>
      <span className={`inline-flex items-center gap-1 transition ${active ? 'text-primary' : 'hover:text-primary'}`}>
        {label}
        <span className="text-[10px] opacity-60">
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  )
}
