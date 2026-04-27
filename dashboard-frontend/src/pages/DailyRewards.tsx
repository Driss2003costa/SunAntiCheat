import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts'

const ICONS = ['🎁', '⭐', '💎', '🏆', '🎆', '👑', '🌟', '🎊', '🎉', '💰', '🪙', '⚡', '🔥', '🗝️']
const DEFAULT_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185', '#fdba74']

function blankItem() {
  return {
    material: 'DIAMOND',
    customModelData: 0,
    itemAdderId: '',
    amount: 1,
    enchantments: [] as string[],
    lore: [] as string[],
    displayName: '',
  }
}

function blankDay(day: number) {
  return {
    day,
    displayName: `Jour ${day}`,
    icon: ICONS[(day - 1) % ICONS.length],
    color: DEFAULT_COLORS[(day - 1) % DEFAULT_COLORS.length],
    items: [] as any[],
    commands: [] as string[],
    bonusCoins: day * 100,
  }
}

export default function DailyRewards() {
  const { canEdit, isAdmin } = usePermission()
  const [config, setConfig] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [claims, setClaims] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [editingDay, setEditingDay] = useState<any | null>(null)
  const [editingItem, setEditingItem] = useState<{ day: number; item: any; index: number | null } | null>(null)
  const [streakLookup, setStreakLookup] = useState<{ name: string; data: any | null } | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setConfig(await api.dailyConfig())
      setStats(await api.dailyStats(7))
      setClaims(await api.dailyClaims({ days: 7, limit: 100 }))
    } catch {}
  }
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t) }, [])

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 3500) }

  const saveConfig = async () => {
    if (!config) return
    try {
      await api.dailySaveConfig(config)
      showFlash('✓ Configuration enregistrée')
      refresh()
    } catch (e: any) { showFlash('✗ ' + e.message) }
  }

  const setCycleDays = (n: number) => {
    if (!config) return
    const newDays = [...config.days]
    while (newDays.length < n) newDays.push(blankDay(newDays.length + 1))
    while (newDays.length > n) newDays.pop()
    setConfig({ ...config, cycleDays: n, days: newDays })
  }

  const duplicateDay = (day: any) => {
    if (!config) return
    const nextDay = config.days.find((d: any) => d.day === day.day + 1)
    if (!nextDay) return
    const updated = config.days.map((d: any) =>
      d.day === nextDay.day ? { ...day, day: nextDay.day, displayName: `Jour ${nextDay.day}` } : d
    )
    setConfig({ ...config, days: updated })
    showFlash(`✓ Jour ${day.day} dupliqué vers jour ${nextDay.day}`)
  }

  const saveEditingDay = () => {
    if (!editingDay || !config) return
    setConfig({ ...config, days: config.days.map((d: any) => d.day === editingDay.day ? editingDay : d) })
    setEditingDay(null)
  }

  const saveEditingItem = () => {
    if (!editingItem || !editingDay) return
    const items = [...editingDay.items]
    if (editingItem.index !== null) items[editingItem.index] = editingItem.item
    else items.push(editingItem.item)
    setEditingDay({ ...editingDay, items })
    setEditingItem(null)
  }

  const lookupStreak = async () => {
    if (!streakLookup?.name) return
    try {
      const data = await api.dailyStreak(streakLookup.name)
      setStreakLookup({ ...streakLookup, data })
    } catch (e: any) { showFlash('✗ ' + e.message) }
  }

  const resetPlayer = async (name: string) => {
    if (!confirm(`Reset le streak de ${name} ?`)) return
    try {
      await api.dailyReset(name)
      showFlash(`✓ Streak de ${name} reset`)
      if (streakLookup) setStreakLookup({ name: streakLookup.name, data: null })
    } catch (e: any) { showFlash('✗ ' + e.message) }
  }

  if (!config) return <div className="p-6" style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  const filteredClaims = claims.filter(c =>
    !filter || c.playerName?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      {flash && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-2 rounded-lg font-medium"
             style={{ background: flash.startsWith('✓') ? '#10b981' : '#ef4444', color: 'white' }}>
          {flash}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🎁 Daily Rewards</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Cycle de {config.cycleDays} jours · {config.enabled ? <span style={{ color: '#10b981' }}>Activé</span> : <span style={{ color: '#ef4444' }}>Désactivé</span>}
          </p>
        </div>
        {canEdit && (
          <button onClick={saveConfig}
                  className="px-4 py-2 rounded-lg text-white font-medium"
                  style={{ background: 'var(--primary)' }}>
            💾 Enregistrer la config
          </button>
        )}
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Claims (7j)" value={stats.totalClaims || 0} color="#60a5fa"/>
          <Kpi label="Joueurs uniques" value={stats.uniquePlayers || 0} color="#a78bfa"/>
          <Kpi label="Streak moyen" value={(stats.avgStreak || 0).toFixed(1)} color="#fbbf24"/>
          <Kpi label="Claims/joueur" value={stats.uniquePlayers ? (stats.totalClaims / stats.uniquePlayers).toFixed(1) : '0'} color="#34d399"/>
        </div>
      )}

      {/* ── Config globale ──────────────────────────────────────────────── */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>⚙️ Configuration du cycle</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <Toggle checked={config.enabled} onChange={(v: boolean) => setConfig({ ...config, enabled: v })} disabled={!canEdit}/>
            <span style={{ color: 'var(--text)' }}>Système activé</span>
          </div>
          <div className="flex items-center gap-3">
            <Toggle checked={config.resetOnMiss} onChange={(v: boolean) => setConfig({ ...config, resetOnMiss: v })} disabled={!canEdit}/>
            <span style={{ color: 'var(--text)' }}>Reset si un jour raté</span>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Jours dans le cycle</label>
            <input type="number" min={1} max={30} value={config.cycleDays}
                   onChange={e => setCycleDays(+e.target.value)}
                   disabled={!canEdit}
                   style={inputStyle} className="w-full px-3 py-2 rounded"/>
          </div>
        </div>
      </div>

      {/* ── Calendrier des jours ─────────────────────────────────────────── */}
      <div>
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>📅 Récompenses par jour</h2>
        <div className="grid grid-cols-4 gap-3">
          {config.days.map((d: any) => (
            <div key={d.day} className="rounded-xl p-4"
                 style={{ background: 'var(--surface)', border: `2px solid ${d.color}` }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-3xl">{d.icon}</div>
                  <div className="font-bold mt-1" style={{ color: 'var(--text)' }}>{d.displayName}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Jour {d.day}</div>
                </div>
                {canEdit && (
                  <button onClick={() => setEditingDay({ ...d })}
                          className="text-xs px-2 py-1 rounded hover:bg-white/10"
                          style={{ color: 'var(--text-muted)' }}>✏️</button>
                )}
              </div>

              <div className="space-y-1 text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                <div>🎁 {d.items?.length || 0} item{(d.items?.length || 0) > 1 ? 's' : ''}</div>
                {d.bonusCoins > 0 && <div>💰 {d.bonusCoins} coins</div>}
                {d.commands?.length > 0 && <div>⚙️ {d.commands.length} cmd{d.commands.length > 1 ? 's' : ''}</div>}
              </div>

              {stats?.claimsByDay?.[d.day] != null && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Réclamé</div>
                  <div className="font-bold" style={{ color: d.color }}>
                    {stats.claimsByDay[d.day] || 0} fois
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Graphique temporel ────────────────────────────────────────────── */}
      {stats?.claimsPerDay && stats.claimsPerDay.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>📈 Claims sur 7 jours</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.claimsPerDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/>
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11}/>
              <YAxis stroke="var(--text-muted)" fontSize={11}/>
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}/>
              <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top claimers & Recherche ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>🏆 Top claimers</h2>
          <div className="space-y-1">
            {(stats?.topClaimers || []).map((t: any, i: number) => (
              <div key={t.playerName} className="flex items-center justify-between p-2 rounded"
                   style={{ background: i % 2 ? 'var(--surface-2)' : 'transparent' }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 text-center font-bold" style={{ color: i < 3 ? '#fbbf24' : 'var(--text-muted)' }}>
                    {i + 1}
                  </div>
                  <div style={{ color: 'var(--text)' }}>{t.playerName}</div>
                </div>
                <div className="flex gap-3 text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>streak <b style={{ color: 'var(--text)' }}>{t.currentStreak}</b></span>
                  <span style={{ color: 'var(--text-muted)' }}>total <b style={{ color: 'var(--text)' }}>{t.totalClaims}</b></span>
                </div>
              </div>
            ))}
            {(!stats?.topClaimers || stats.topClaimers.length === 0) && (
              <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
                Aucun claim encore
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>🔍 Rechercher un joueur</h2>
          <div className="flex gap-2 mb-3">
            <input placeholder="Nom du joueur"
                   value={streakLookup?.name || ''}
                   onChange={e => setStreakLookup({ name: e.target.value, data: null })}
                   onKeyDown={e => e.key === 'Enter' && lookupStreak()}
                   style={inputStyle} className="flex-1 px-3 py-2 rounded"/>
            <button onClick={lookupStreak}
                    disabled={!streakLookup?.name}
                    className="px-4 py-2 rounded text-white"
                    style={{ background: 'var(--primary)', opacity: streakLookup?.name ? 1 : 0.5 }}>
              Chercher
            </button>
          </div>
          {streakLookup?.data && (
            <div className="space-y-2 text-sm">
              <Row k="Joueur" v={streakLookup.data.playerName}/>
              <Row k="Streak actuel" v={streakLookup.data.currentStreak}/>
              <Row k="Prochain jour" v={streakLookup.data.nextDay}/>
              <Row k="Peut claim" v={streakLookup.data.canClaim ? '✓ Oui' : '✗ Non'}/>
              <Row k="Dernier claim" v={streakLookup.data.lastClaimAt ? new Date(streakLookup.data.lastClaimAt).toLocaleString('fr-FR') : '—'}/>
              {isAdmin && (
                <button onClick={() => resetPlayer(streakLookup.name)}
                        className="w-full mt-2 px-3 py-2 rounded text-sm text-red-400 hover:bg-red-500/10"
                        style={{ border: '1px solid #ef4444' }}>
                  🔄 Reset le streak
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Claims récents ───────────────────────────────────────────────── */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: 'var(--text)' }}>📜 Claims récents</h2>
          <input placeholder="Filtrer…" value={filter} onChange={e => setFilter(e.target.value)}
                 style={inputStyle} className="px-3 py-1 rounded text-sm"/>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead style={{ color: 'var(--text-muted)' }}>
              <tr className="text-left">
                <th className="py-2">Joueur</th>
                <th>Jour</th>
                <th>Items reçus</th>
                <th className="text-right">Quand</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((c, i) => {
                const day = config.days.find((d: any) => d.day === c.day)
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2" style={{ color: 'var(--text)' }}>{c.playerName}</td>
                    <td>
                      {day ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium"
                              style={{ background: day.color, color: 'white' }}>
                          {day.icon} Jour {c.day}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Jour {c.day}</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {c.itemsGiven?.join(', ') || '—'}
                    </td>
                    <td className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                      {timeAgo(c.claimedAt)}
                    </td>
                  </tr>
                )
              })}
              {filteredClaims.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
                    Aucun claim
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal édition jour ──────────────────────────────────────────── */}
      {editingDay && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setEditingDay(null)}>
          <div className="w-[600px] h-full overflow-y-auto"
               style={{ background: 'var(--surface)' }}
               onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
                 style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="text-3xl">{editingDay.icon}</div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Jour {editingDay.day}</h2>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{editingDay.displayName}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {editingDay.day < config.cycleDays && (
                  <button onClick={() => { duplicateDay(editingDay); setEditingDay(null) }}
                          className="px-3 py-1.5 rounded text-sm"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    📋 Dupliquer vers jour suivant
                  </button>
                )}
                <button onClick={() => setEditingDay(null)}
                        className="px-3 py-1.5 rounded text-sm"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  Annuler
                </button>
                <button onClick={saveEditingDay}
                        className="px-4 py-1.5 rounded text-sm text-white font-medium"
                        style={{ background: 'var(--primary)' }}>
                  💾 OK
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom affiché">
                  <input value={editingDay.displayName}
                         onChange={e => setEditingDay({ ...editingDay, displayName: e.target.value })}
                         style={inputStyle} className="w-full px-3 py-2 rounded"/>
                </Field>
                <Field label="Bonus coins">
                  <input type="number" value={editingDay.bonusCoins}
                         onChange={e => setEditingDay({ ...editingDay, bonusCoins: +e.target.value })}
                         style={inputStyle} className="w-full px-3 py-2 rounded"/>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Icône">
                  <div className="flex gap-1 flex-wrap">
                    {ICONS.map(i => (
                      <button key={i} onClick={() => setEditingDay({ ...editingDay, icon: i })}
                              className="w-9 h-9 rounded text-lg transition"
                              style={{
                                background: editingDay.icon === i ? 'var(--primary)' : 'var(--surface-2)',
                              }}>
                        {i}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Couleur">
                  <input type="color" value={editingDay.color}
                         onChange={e => setEditingDay({ ...editingDay, color: e.target.value })}
                         className="w-full h-10 rounded cursor-pointer"/>
                </Field>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    🎁 Items de récompense
                  </label>
                  <button onClick={() => setEditingItem({ day: editingDay.day, item: blankItem(), index: null })}
                          className="text-sm px-2 py-1 rounded text-white"
                          style={{ background: 'var(--primary)' }}>
                    + Item
                  </button>
                </div>
                <div className="space-y-2">
                  {editingDay.items.map((it: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded"
                         style={{ background: 'var(--surface-2)' }}>
                      <div className="text-xl">🎁</div>
                      <div className="flex-1 text-sm">
                        <div style={{ color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: stripColor(it.displayName || it.material) }}/>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {it.itemAdderId || it.material} × {it.amount}
                        </div>
                      </div>
                      <button onClick={() => setEditingItem({ day: editingDay.day, item: { ...it }, index: i })}
                              className="text-xs px-2 py-1 rounded hover:bg-white/10"
                              style={{ color: 'var(--text-muted)' }}>✏️</button>
                      <button onClick={() => setEditingDay({ ...editingDay, items: editingDay.items.filter((_: any, j: number) => j !== i) })}
                              className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">🗑</button>
                    </div>
                  ))}
                  {editingDay.items.length === 0 && (
                    <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Aucun item
                    </div>
                  )}
                </div>
              </div>

              <Field label="Commandes à exécuter ({player})" hint="Une par ligne">
                <textarea value={(editingDay.commands || []).join('\n')}
                          onChange={e => setEditingDay({ ...editingDay, commands: e.target.value.split('\n').filter(Boolean) })}
                          rows={3} style={inputStyle} className="w-full px-3 py-2 rounded font-mono text-sm"
                          placeholder="lp user {player} permission set exemple.vip true"/>
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal édition item ──────────────────────────────────────────── */}
      {editingItem && (
        <Modal onClose={() => setEditingItem(null)} title="🎁 Item">
          <div className="space-y-4">
            <Field label="Nom affiché (codes &)">
              <input value={editingItem.item.displayName}
                     onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, displayName: e.target.value } })}
                     style={inputStyle} className="w-full px-3 py-2 rounded"/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Material">
                <input value={editingItem.item.material}
                       onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, material: e.target.value.toUpperCase() } })}
                       style={inputStyle} className="w-full px-3 py-2 rounded"/>
              </Field>
              <Field label="Custom Model Data">
                <input type="number" value={editingItem.item.customModelData}
                       onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, customModelData: +e.target.value } })}
                       style={inputStyle} className="w-full px-3 py-2 rounded"/>
              </Field>
            </div>
            <Field label="ItemsAdder ID (optionnel)">
              <input value={editingItem.item.itemAdderId}
                     onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, itemAdderId: e.target.value } })}
                     placeholder="itemsadder:mon_item"
                     style={inputStyle} className="w-full px-3 py-2 rounded"/>
            </Field>
            <Field label="Quantité">
              <input type="number" min={1} max={64} value={editingItem.item.amount}
                     onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, amount: +e.target.value } })}
                     style={inputStyle} className="w-full px-3 py-2 rounded"/>
            </Field>
            <Field label="Enchantements (ENCHANT:level, un par ligne)">
              <textarea value={(editingItem.item.enchantments || []).join('\n')}
                        onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, enchantments: e.target.value.split('\n').filter(Boolean) } })}
                        rows={2} style={inputStyle} className="w-full px-3 py-2 rounded font-mono text-sm"/>
            </Field>
            <Field label="Lore">
              <textarea value={(editingItem.item.lore || []).join('\n')}
                        onChange={e => setEditingItem({ ...editingItem, item: { ...editingItem.item, lore: e.target.value.split('\n') } })}
                        rows={2} style={inputStyle} className="w-full px-3 py-2 rounded font-mono text-sm"/>
            </Field>
            <div className="flex gap-2">
              <button onClick={() => setEditingItem(null)}
                      className="flex-1 py-2 rounded"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                Annuler
              </button>
              <button onClick={saveEditingItem}
                      className="flex-1 py-2 rounded text-white font-medium"
                      style={{ background: 'var(--primary)' }}>
                💾 Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-3xl font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--text-muted)' }}>{k}</span>
      <span style={{ color: 'var(--text)' }}>{v}</span>
    </div>
  )
}

function Modal({ onClose, title, children }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-[500px] max-h-[90vh] overflow-y-auto rounded-xl p-5"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: 'var(--text)' }}>{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: any) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>{label}</label>
      {children}
      {hint && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  )
}

function Toggle({ checked, onChange, disabled }: any) {
  return (
    <button onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className="relative w-10 h-6 rounded-full transition"
            style={{
              background: checked ? 'var(--primary)' : 'var(--surface-2)',
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}>
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
           style={{ left: checked ? '1.125rem' : '0.125rem' }}/>
    </button>
  )
}

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
} as const

function stripColor(str: string) {
  if (!str) return ''
  return str.replace(/§[0-9a-fk-or]/g, '').replace(/&[0-9a-fk-or]/g, '')
}

function timeAgo(ts: number) {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'à l\'instant'
  if (sec < 3600) return `${Math.floor(sec / 60)}min`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}j`
}
