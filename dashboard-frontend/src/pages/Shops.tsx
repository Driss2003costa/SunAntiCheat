import { useEffect, useState, useMemo } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts'

/**
 * Système de gestion des shops avec synchronisation EconomyShopGUI+.
 * UX : éditeur visuel drag-and-drop sur une grille 9x6 façon inventaire Minecraft.
 */

// ── Items palette (liste curée des plus utilisés, pas tous les Materials) ───
const PALETTE_GROUPS: { category: string; icon: string; items: { m: string; name: string; icon?: string }[] }[] = [
  { category: 'Outils', icon: '⚒️', items: [
    { m: 'WOODEN_PICKAXE', name: 'Pioche bois' },
    { m: 'STONE_PICKAXE', name: 'Pioche pierre' },
    { m: 'IRON_PICKAXE', name: 'Pioche fer' },
    { m: 'DIAMOND_PICKAXE', name: 'Pioche diamant' },
    { m: 'NETHERITE_PICKAXE', name: 'Pioche netherite' },
    { m: 'IRON_AXE', name: 'Hache fer' },
    { m: 'DIAMOND_AXE', name: 'Hache diamant' },
    { m: 'IRON_SHOVEL', name: 'Pelle fer' },
    { m: 'FISHING_ROD', name: 'Canne à pêche' },
    { m: 'SHEARS', name: 'Cisailles' },
  ]},
  { category: 'Armes', icon: '⚔️', items: [
    { m: 'WOODEN_SWORD', name: 'Épée bois' },
    { m: 'STONE_SWORD', name: 'Épée pierre' },
    { m: 'IRON_SWORD', name: 'Épée fer' },
    { m: 'DIAMOND_SWORD', name: 'Épée diamant' },
    { m: 'NETHERITE_SWORD', name: 'Épée netherite' },
    { m: 'BOW', name: 'Arc' },
    { m: 'CROSSBOW', name: 'Arbalète' },
    { m: 'TRIDENT', name: 'Trident' },
    { m: 'ARROW', name: 'Flèche' },
    { m: 'SHIELD', name: 'Bouclier' },
  ]},
  { category: 'Armures', icon: '🛡️', items: [
    { m: 'LEATHER_HELMET', name: 'Casque cuir' },
    { m: 'IRON_HELMET', name: 'Casque fer' },
    { m: 'DIAMOND_HELMET', name: 'Casque diamant' },
    { m: 'NETHERITE_HELMET', name: 'Casque netherite' },
    { m: 'IRON_CHESTPLATE', name: 'Plastron fer' },
    { m: 'DIAMOND_CHESTPLATE', name: 'Plastron diamant' },
    { m: 'IRON_LEGGINGS', name: 'Jambières fer' },
    { m: 'DIAMOND_LEGGINGS', name: 'Jambières diamant' },
    { m: 'IRON_BOOTS', name: 'Bottes fer' },
    { m: 'DIAMOND_BOOTS', name: 'Bottes diamant' },
  ]},
  { category: 'Minerais', icon: '💎', items: [
    { m: 'COAL', name: 'Charbon' },
    { m: 'IRON_INGOT', name: 'Lingot fer' },
    { m: 'GOLD_INGOT', name: 'Lingot or' },
    { m: 'DIAMOND', name: 'Diamant' },
    { m: 'EMERALD', name: 'Émeraude' },
    { m: 'LAPIS_LAZULI', name: 'Lapis' },
    { m: 'REDSTONE', name: 'Redstone' },
    { m: 'NETHERITE_INGOT', name: 'Netherite' },
    { m: 'ANCIENT_DEBRIS', name: 'Ancient debris' },
    { m: 'QUARTZ', name: 'Quartz' },
  ]},
  { category: 'Blocs', icon: '🧱', items: [
    { m: 'STONE', name: 'Pierre' },
    { m: 'COBBLESTONE', name: 'Pavé' },
    { m: 'DIRT', name: 'Terre' },
    { m: 'GRASS_BLOCK', name: 'Herbe' },
    { m: 'OAK_LOG', name: 'Bûche chêne' },
    { m: 'OAK_PLANKS', name: 'Planches chêne' },
    { m: 'SAND', name: 'Sable' },
    { m: 'GLASS', name: 'Verre' },
    { m: 'OBSIDIAN', name: 'Obsidienne' },
    { m: 'NETHERRACK', name: 'Netherrack' },
  ]},
  { category: 'Nourriture', icon: '🍖', items: [
    { m: 'BREAD', name: 'Pain' },
    { m: 'APPLE', name: 'Pomme' },
    { m: 'GOLDEN_APPLE', name: 'Pomme d\'or' },
    { m: 'ENCHANTED_GOLDEN_APPLE', name: 'Pomme enchantée' },
    { m: 'COOKED_BEEF', name: 'Steak' },
    { m: 'COOKED_PORKCHOP', name: 'Porc cuit' },
    { m: 'COOKED_CHICKEN', name: 'Poulet cuit' },
    { m: 'COOKED_SALMON', name: 'Saumon cuit' },
    { m: 'CAKE', name: 'Gâteau' },
    { m: 'MILK_BUCKET', name: 'Lait' },
  ]},
  { category: 'Magie', icon: '✨', items: [
    { m: 'ENCHANTED_BOOK', name: 'Livre enchanté' },
    { m: 'EXPERIENCE_BOTTLE', name: 'Fiole XP' },
    { m: 'ENDER_PEARL', name: 'Perle Ender' },
    { m: 'ENDER_EYE', name: 'Œil Ender' },
    { m: 'BLAZE_ROD', name: 'Bâton Blaze' },
    { m: 'GHAST_TEAR', name: 'Larme Ghast' },
    { m: 'NETHER_STAR', name: 'Étoile Nether' },
    { m: 'TOTEM_OF_UNDYING', name: 'Totem immortalité' },
    { m: 'BEACON', name: 'Balise' },
    { m: 'CONDUIT', name: 'Conduit' },
  ]},
  { category: 'Divers', icon: '📦', items: [
    { m: 'CHEST', name: 'Coffre' },
    { m: 'ENDER_CHEST', name: 'Coffre Ender' },
    { m: 'SHULKER_BOX', name: 'Shulker' },
    { m: 'BOOK', name: 'Livre' },
    { m: 'NAME_TAG', name: 'Nametag' },
    { m: 'LEAD', name: 'Laisse' },
    { m: 'SADDLE', name: 'Selle' },
    { m: 'ELYTRA', name: 'Élytre' },
    { m: 'BUCKET', name: 'Seau' },
    { m: 'COMPASS', name: 'Boussole' },
  ]},
]

function materialIcon(m: string): string {
  if (!m) return '📦'
  const upper = m.toUpperCase()
  if (upper.includes('PICKAXE')) return '⛏️'
  if (upper.includes('SWORD')) return '⚔️'
  if (upper.includes('AXE')) return '🪓'
  if (upper.includes('SHOVEL')) return '🏗️'
  if (upper.includes('HELMET')) return '⛑️'
  if (upper.includes('CHESTPLATE')) return '🦺'
  if (upper.includes('LEGGINGS')) return '👖'
  if (upper.includes('BOOTS')) return '🥾'
  if (upper.includes('BOW')) return '🏹'
  if (upper.includes('SHIELD')) return '🛡️'
  if (upper.includes('DIAMOND')) return '💎'
  if (upper.includes('EMERALD')) return '💚'
  if (upper.includes('GOLD')) return '🟡'
  if (upper.includes('IRON')) return '⚙️'
  if (upper.includes('NETHERITE')) return '🖤'
  if (upper.includes('COAL')) return '⚫'
  if (upper.includes('REDSTONE')) return '🔴'
  if (upper.includes('LAPIS')) return '🔵'
  if (upper.includes('STONE')) return '🪨'
  if (upper.includes('DIRT')) return '🟤'
  if (upper.includes('GRASS')) return '🌱'
  if (upper.includes('LOG') || upper.includes('PLANKS') || upper.includes('WOOD')) return '🪵'
  if (upper.includes('SAND')) return '🏖️'
  if (upper.includes('GLASS')) return '🪟'
  if (upper.includes('OBSIDIAN')) return '⬛'
  if (upper.includes('APPLE')) return '🍎'
  if (upper.includes('BREAD')) return '🍞'
  if (upper.includes('BEEF') || upper.includes('PORKCHOP') || upper.includes('CHICKEN')) return '🍖'
  if (upper.includes('FISH') || upper.includes('SALMON') || upper.includes('COD')) return '🐟'
  if (upper.includes('CAKE')) return '🍰'
  if (upper.includes('MILK')) return '🥛'
  if (upper.includes('BOOK')) return '📖'
  if (upper.includes('POTION')) return '🧪'
  if (upper.includes('ENDER')) return '👁️'
  if (upper.includes('BLAZE')) return '🔥'
  if (upper.includes('STAR')) return '⭐'
  if (upper.includes('TOTEM')) return '🗿'
  if (upper.includes('BEACON')) return '💡'
  if (upper.includes('ELYTRA')) return '🪽'
  if (upper.includes('CHEST')) return '🎁'
  if (upper.includes('ARROW')) return '🏹'
  if (upper.includes('BUCKET')) return '🪣'
  if (upper.includes('COMPASS')) return '🧭'
  return '📦'
}

function blankShop() {
  return {
    name: 'new_shop',
    displayName: '§6Nouveau Shop',
    description: '',
    iconMaterial: 'CHEST',
    iconCustomModelData: 0,
    iconItemAdderId: '',
    category: 'Général',
    order: 0,
    rows: 3,
    permission: '',
    commandToOpen: '',
    items: [] as any[],
    enabled: true,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    totalTransactions: 0,
    totalRevenue: 0,
  }
}

function blankItem(slot: number, material = 'DIAMOND') {
  return {
    id: crypto.randomUUID(),
    slot,
    material,
    customModelData: 0,
    itemAdderId: '',
    amount: 1,
    displayName: '',
    lore: [] as string[],
    enchantments: [] as string[],
    buyPrice: 100,
    sellPrice: 50,
    priceType: 'MONEY',
    priceItem: '',
    buyLimit: 0,
    sellLimit: 0,
    stockLimit: 0,
    stockCurrent: 0,
    buyCooldownSeconds: 0,
    permission: '',
    commandsOnBuy: [] as string[],
    buyMessage: '',
    rewardType: 'ITEM',
    dynamicPricing: false,
    basePriceBuy: 0,
    basePriceSell: 0,
    priceElasticity: 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Shops() {
  const { canEdit, isAdmin } = usePermission()
  const [shops, setShops] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [esgStatus, setEsgStatus] = useState<any>(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [view, setView] = useState<'list' | 'editor' | 'stats'>('list')
  const [statsShop, setStatsShop] = useState<any | null>(null)
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState<any[] | null>(null)

  const refresh = async () => {
    try {
      setShops(await api.shopsList())
      setStats(await api.shopsGlobalStats(7))
      setEsgStatus(await api.shopEsgStatus())
    } catch {}
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 20000)
    return () => clearInterval(t)
  }, [])

  const showFlash = (text: string, ok = true) => {
    setFlash({ text, ok })
    setTimeout(() => setFlash(null), 3500)
  }

  const openEditor = async (shop: any) => {
    try {
      const full = await api.shopGet(shop.id)
      setEditing(full)
      setView('editor')
    } catch (e: any) { showFlash('✗ ' + e.message, false) }
  }

  const createNew = () => {
    setEditing(blankShop())
    setView('editor')
  }

  const openStats = async (shop: any) => {
    try {
      const s = await api.shopStats(shop.id, 7)
      setStatsShop({ ...shop, stats: s })
      setView('stats')
    } catch (e: any) { showFlash('✗ ' + e.message, false) }
  }

  const syncNow = async () => {
    setSyncing(true)
    try {
      const r = await api.shopSync()
      if (r.success) showFlash('✓ ' + r.message)
      else showFlash('⚠ ' + r.message, false)
    } catch (e: any) { showFlash('✗ ' + e.message, false) }
    finally { setSyncing(false); refresh() }
  }

  const openImport = async () => {
    try {
      const data = await api.shopImportESG()
      setImporting(data)
    } catch (e: any) { showFlash('✗ ' + e.message, false) }
  }

  const backToList = () => {
    setEditing(null)
    setView('list')
    refresh()
  }

  // ── Views ──────────────────────────────────────────────────────────────────

  if (view === 'editor' && editing) {
    return (
      <ShopEditor
        shop={editing}
        onSave={async (s: any) => {
          try {
            if (s.id) await api.shopUpdate(s.id, s)
            else await api.shopCreate(s)
            showFlash('✓ Shop enregistré & synchronisé')
            backToList()
          } catch (e: any) { showFlash('✗ ' + e.message, false) }
        }}
        onCancel={backToList}
        onDelete={async () => {
          if (!editing.id || !confirm('Supprimer définitivement ce shop ?')) return
          try {
            await api.shopDelete(editing.id)
            showFlash('✓ Shop supprimé')
            backToList()
          } catch (e: any) { showFlash('✗ ' + e.message, false) }
        }}
        canEdit={canEdit}
        isAdmin={isAdmin}
        flash={flash}
      />
    )
  }

  if (view === 'stats' && statsShop) {
    return (
      <ShopStatsView
        shop={statsShop}
        onBack={() => { setStatsShop(null); setView('list') }}
      />
    )
  }

  // Vue liste par défaut
  return (
    <div className="p-6 space-y-6">
      {flash && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-2 rounded-lg font-medium"
             style={{ background: flash.ok ? '#10b981' : '#ef4444', color: 'white' }}>
          {flash.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🛒 Shops</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Gestion visuelle des shops — synchronisation automatique avec EconomyShopGUI+
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={openImport}
                    title="Importer les shops depuis EconomyShopGUI+"
                    className="px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              📥 Importer ESG
            </button>
          )}
          {isAdmin && (
            <button onClick={syncNow}
                    disabled={syncing}
                    className="px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              {syncing ? '⏳ Sync...' : '🔄 Synchroniser ESG'}
            </button>
          )}
          {canEdit && (
            <button onClick={createNew}
                    className="px-4 py-2 rounded-lg text-white font-medium"
                    style={{ background: 'var(--primary)' }}>
              + Nouveau shop
            </button>
          )}
        </div>
      </div>

      {/* ESG Status Banner */}
      {esgStatus && (
        <div className="rounded-xl p-4 flex items-start gap-3"
             style={{
               background: esgStatus.installed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
               border: `1px solid ${esgStatus.installed ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
             }}>
          <div className="text-2xl">{esgStatus.installed ? '✅' : '⚠️'}</div>
          <div className="flex-1 text-sm">
            {esgStatus.installed ? (
              <>
                <b style={{ color: 'var(--text)' }}>EconomyShopGUI{esgStatus.premium ? '+' : ''}</b> détecté — les shops créés ici seront automatiquement synchronisés.
                <div className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                  📁 {esgStatus.shopsFolder}
                </div>
              </>
            ) : (
              <>
                <b style={{ color: '#ef4444' }}>EconomyShopGUI non installé</b> — tu peux toujours créer des shops,
                mais ils ne seront pas synchronisés jusqu'à ce que tu installes le plugin.
              </>
            )}
          </div>
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Shops configurés" value={shops.length} color="#60a5fa"/>
          <Kpi label="Transactions (7j)" value={stats.totalTransactions || 0} color="#a78bfa"/>
          <Kpi label="CA total (7j)" value={`${(stats.totalRevenue || 0).toLocaleString('fr-FR')} $`} color="#10b981"/>
          <Kpi label="Clients uniques (7j)" value={stats.uniqueCustomers || 0} color="#f59e0b"/>
        </div>
      )}

      {/* Grille des shops */}
      {shops.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Aucun shop pour le moment</h2>
          <p className="max-w-md mx-auto mb-6" style={{ color: 'var(--text-muted)' }}>
            Crée ton premier shop avec l'éditeur visuel, ou importe les shops existants d'EconomyShopGUI+.
          </p>
          <div className="flex gap-2 justify-center">
            {canEdit && (
              <button onClick={createNew}
                      className="px-6 py-3 rounded-lg text-white font-medium"
                      style={{ background: 'var(--primary)' }}>
                🎨 Créer mon premier shop
              </button>
            )}
            {isAdmin && esgStatus?.installed && (
              <button onClick={openImport}
                      className="px-6 py-3 rounded-lg font-medium"
                      style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                📥 Importer depuis ESG
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {shops.map(s => (
            <ShopCard key={s.id} shop={s}
                      onOpen={() => openEditor(s)}
                      onStats={() => openStats(s)}
                      canEdit={canEdit}/>
          ))}
        </div>
      )}

      {/* Modal import */}
      {importing && (
        <ImportModal shops={importing}
                     onImport={async (selected: any) => {
                       try {
                         const mapped = {
                           ...blankShop(),
                           name: selected.name,
                           displayName: selected.displayName,
                           iconMaterial: selected.displayItem || 'CHEST',
                           rows: selected.rows || 3,
                           permission: selected.permission || '',
                           items: (selected.items || []).map((it: any) => ({
                             ...blankItem(it.slot || 0, it.material),
                             slot: it.slot || 0,
                             material: it.material,
                             amount: it.amount || 1,
                             displayName: it.name || '',
                             lore: it.lore || [],
                             buyPrice: it.buyPrice ?? null,
                             sellPrice: it.sellPrice ?? null,
                             stockLimit: it.stock || 0,
                             buyLimit: it.limit || 0,
                             priceType: it.priceType || 'MONEY',
                             permission: it.permission || '',
                             customModelData: it.customModelData || 0,
                             enchantments: it.enchantments || [],
                             commandsOnBuy: it.commandsOnBuy || [],
                           })),
                         }
                         await api.shopCreate(mapped)
                         showFlash(`✓ ${selected.name} importé`)
                         setImporting(importing.filter((x: any) => x !== selected))
                         refresh()
                       } catch (e: any) { showFlash('✗ ' + e.message, false) }
                     }}
                     onClose={() => setImporting(null)}/>
      )}
    </div>
  )
}

// ── Carte shop ──────────────────────────────────────────────────────────────
function ShopCard({ shop, onOpen, onStats, canEdit }: any) {
  return (
    <div className="rounded-xl overflow-hidden"
         style={{ background: 'var(--surface)', border: `1px solid ${shop.enabled ? 'var(--border)' : 'rgba(239,68,68,0.3)'}` }}>
      <div className="h-2" style={{ background: 'var(--primary)' }}/>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="text-5xl">{materialIcon(shop.iconMaterial)}</div>
          <div className="text-right">
            {!shop.enabled && <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>Désactivé</span>}
            {shop.category && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{shop.category}</div>}
          </div>
        </div>

        <div className="font-bold text-lg" style={{ color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: mcFormat(shop.displayName) }}/>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>/{shop.name}</div>

        {shop.description && (
          <div className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{shop.description}</div>
        )}

        <div className="mt-3 space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div>🎁 {shop.itemCount || 0} items</div>
          <div>💰 {shop.totalTransactions || 0} transactions</div>
          <div>💵 {(shop.totalRevenue || 0).toLocaleString('fr-FR')} $ CA total</div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onStats}
                  className="flex-1 text-sm px-3 py-2 rounded"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            📊 Stats
          </button>
          <button onClick={onOpen}
                  className="flex-1 text-sm px-3 py-2 rounded text-white"
                  style={{ background: 'var(--primary)' }}>
            {canEdit ? '✏️ Éditer' : '👁 Voir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Éditeur visuel de shop ──────────────────────────────────────────────────
function ShopEditor({ shop, onSave, onCancel, onDelete, canEdit, isAdmin, flash }: any) {
  const [draft, setDraft] = useState<any>(shop)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [paletteCategory, setPaletteCategory] = useState(PALETTE_GROUPS[0].category)
  const [paletteSearch, setPaletteSearch] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)

  const items: any[] = draft.items || []
  const itemsBySlot = useMemo(() => {
    const m: Record<number, any> = {}
    for (const it of items) m[it.slot] = it
    return m
  }, [items])

  const selectedItem = selectedSlot !== null ? itemsBySlot[selectedSlot] : null

  const visibleRows = Math.max(1, Math.min(6, draft.rows || 3))
  const totalSlots = visibleRows * 9

  const updateItem = (slot: number, updates: any) => {
    setDraft({
      ...draft,
      items: items.map(i => i.slot === slot ? { ...i, ...updates } : i),
    })
  }

  const placeItem = (slot: number, material: string) => {
    // Si déjà un item à ce slot : update le material
    if (itemsBySlot[slot]) {
      updateItem(slot, { material })
    } else {
      const newItem = blankItem(slot, material)
      setDraft({ ...draft, items: [...items, newItem] })
    }
    setSelectedSlot(slot)
  }

  const moveItem = (fromSlot: number, toSlot: number) => {
    if (fromSlot === toSlot) return
    const destItem = itemsBySlot[toSlot]
    const sourceItem = itemsBySlot[fromSlot]
    if (!sourceItem) return

    const updated = items.map(i => {
      if (i.slot === fromSlot) return { ...i, slot: toSlot }
      if (destItem && i.slot === toSlot) return { ...i, slot: fromSlot }
      return i
    })
    setDraft({ ...draft, items: updated })
    setSelectedSlot(toSlot)
  }

  const removeItem = (slot: number) => {
    setDraft({ ...draft, items: items.filter(i => i.slot !== slot) })
    setSelectedSlot(null)
  }

  // Palette filtrée
  const currentGroup = PALETTE_GROUPS.find(g => g.category === paletteCategory) || PALETTE_GROUPS[0]
  const paletteItems = paletteSearch
    ? PALETTE_GROUPS.flatMap(g => g.items).filter(it =>
        it.m.toLowerCase().includes(paletteSearch.toLowerCase()) ||
        it.name.toLowerCase().includes(paletteSearch.toLowerCase()))
    : currentGroup.items

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {flash && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-2 rounded-lg font-medium"
             style={{ background: flash.ok ? '#10b981' : '#ef4444', color: 'white' }}>
          {flash.text}
        </div>
      )}

      {/* Header sticky */}
      <div className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between gap-4"
           style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onCancel}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          ← Retour
        </button>

        <div className="flex-1 flex items-center gap-3">
          <div className="text-3xl">{materialIcon(draft.iconMaterial)}</div>
          <input
            value={draft.displayName}
            onChange={e => setDraft({ ...draft, displayName: e.target.value })}
            placeholder="Nom du shop (avec codes &)"
            disabled={!canEdit}
            style={{ ...inputStyle, fontSize: '1.1rem', fontWeight: 'bold' }}
            className="flex-1 px-3 py-2 rounded-lg"/>

          <button onClick={() => setShowSettings(!showSettings)}
                  className="px-3 py-2 rounded text-sm"
                  style={{
                    background: showSettings ? 'var(--primary)' : 'var(--surface-2)',
                    color: showSettings ? 'white' : 'var(--text-muted)',
                  }}>
            ⚙️ Paramètres
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Toggle checked={draft.enabled} onChange={(v: boolean) => setDraft({ ...draft, enabled: v })} disabled={!canEdit}/>
            <span>{draft.enabled ? 'Actif' : 'Désactivé'}</span>
          </div>
          {isAdmin && shop.id && (
            <button onClick={onDelete}
                    className="px-3 py-1.5 rounded text-sm text-red-400 hover:bg-red-500/10"
                    style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
              🗑 Supprimer
            </button>
          )}
          {canEdit && (
            <button onClick={() => onSave(draft)}
                    className="px-5 py-2 rounded text-white font-medium"
                    style={{ background: '#10b981' }}>
              💾 Enregistrer & Sync
            </button>
          )}
        </div>
      </div>

      {/* Paramètres panel */}
      {showSettings && (
        <ShopSettings shop={draft} setShop={setDraft} canEdit={canEdit}/>
      )}

      {/* Body 3 columns */}
      <div className="flex-1 grid grid-cols-[280px_1fr_320px] gap-4 p-4 overflow-hidden">

        {/* Colonne palette */}
        <div className="rounded-xl flex flex-col overflow-hidden"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="p-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
              📦 Palette d'items
            </div>
            <input placeholder="Rechercher..."
                   value={paletteSearch}
                   onChange={e => setPaletteSearch(e.target.value)}
                   style={inputStyle} className="w-full px-3 py-1.5 rounded text-sm"/>
          </div>

          {!paletteSearch && (
            <div className="flex flex-wrap gap-1 p-2" style={{ borderBottom: '1px solid var(--border)' }}>
              {PALETTE_GROUPS.map(g => (
                <button key={g.category}
                        onClick={() => setPaletteCategory(g.category)}
                        title={g.category}
                        className="w-8 h-8 rounded text-lg transition"
                        style={{
                          background: paletteCategory === g.category ? 'var(--primary)' : 'var(--surface-2)',
                        }}>
                  {g.icon}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-4 gap-1">
              {paletteItems.map(it => (
                <div key={it.m}
                     draggable={canEdit}
                     onDragStart={e => {
                       const payload = JSON.stringify({ type: 'new', material: it.m })
                       try { e.dataTransfer.setData('text/plain', payload) } catch {}
                       try { e.dataTransfer.setData('application/json', payload) } catch {}
                       e.dataTransfer.effectAllowed = 'copyMove'
                     }}
                     title={`${it.name} (${it.m}) — glisser dans la grille`}
                     className="aspect-square rounded flex items-center justify-center text-xl transition hover:scale-110 cursor-grab"
                     style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  {materialIcon(it.m)}
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 rounded text-xs text-center" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              💡 Glisse un item dans la grille →
            </div>
            <div className="mt-2 p-2 rounded text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              <b style={{ color: 'var(--text)' }}>Item custom ?</b>
              <br/>Clique sur un slot de la grille puis modifie "Material" ou "ItemAdder ID" à droite.
            </div>
          </div>
        </div>

        {/* Colonne grille centrale */}
        <div className="rounded-xl overflow-hidden flex flex-col"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              🎨 Grille du shop · {items.length} item{items.length > 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span>Rows :</span>
              {[1,2,3,4,5,6].map(r => (
                <button key={r}
                        onClick={() => canEdit && setDraft({ ...draft, rows: r })}
                        disabled={!canEdit}
                        className="w-7 h-7 rounded text-xs font-bold"
                        style={{
                          background: draft.rows === r ? 'var(--primary)' : 'var(--surface-2)',
                          color: draft.rows === r ? 'white' : 'var(--text-muted)',
                        }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6 flex items-center justify-center overflow-auto">
            <div className="p-3 rounded-lg"
                 style={{
                   background: '#2d2d2d',
                   boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                 }}>
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(9, 52px)' }}>
                {Array.from({ length: totalSlots }, (_, i) => {
                  const item = itemsBySlot[i]
                  const isSelected = selectedSlot === i
                  const isDragOver = dragOverSlot === i
                  return (
                    <div key={i}
                         draggable={canEdit && !!item}
                         onDragStart={e => {
                           if (!item) return
                           const payload = JSON.stringify({ type: 'move', fromSlot: i })
                           try { e.dataTransfer.setData('text/plain', payload) } catch {}
                           try { e.dataTransfer.setData('application/json', payload) } catch {}
                           e.dataTransfer.effectAllowed = 'copyMove'
                         }}
                         onDragOver={e => {
                           if (!canEdit) return
                           e.preventDefault()
                           e.dataTransfer.dropEffect = 'copy'
                           setDragOverSlot(i)
                         }}
                         onDragEnter={e => {
                           if (!canEdit) return
                           e.preventDefault()
                         }}
                         onDragLeave={() => setDragOverSlot(null)}
                         onDrop={e => {
                           e.preventDefault()
                           e.stopPropagation()
                           setDragOverSlot(null)
                           if (!canEdit) return
                           // Essaie les deux MIME types (text/plain fallback)
                           let raw = e.dataTransfer.getData('text/plain')
                           if (!raw) raw = e.dataTransfer.getData('application/json')
                           if (!raw) return
                           try {
                             const data = JSON.parse(raw)
                             if (data.type === 'new') placeItem(i, data.material)
                             else if (data.type === 'move') moveItem(data.fromSlot, i)
                           } catch (err) {
                             console.error('Drop parse error:', err, 'raw:', raw)
                           }
                         }}
                         onClick={() => setSelectedSlot(i)}
                         onContextMenu={e => {
                           e.preventDefault()
                           if (canEdit && item) removeItem(i)
                         }}
                         className="w-[52px] h-[52px] rounded cursor-pointer flex items-center justify-center text-2xl transition relative"
                         style={{
                           background: isDragOver ? 'rgba(16,185,129,0.3)' :
                                       item ? '#8b8b8b' : '#5a5a5a',
                           border: isSelected ? '2px solid #fbbf24' : '2px solid #3f3f3f',
                           boxShadow: item ? 'inset 0 0 4px rgba(0,0,0,0.4)' : 'none',
                         }}>
                      {item && (
                        <>
                          <span>{item.itemAdderId ? '✨' : materialIcon(item.material)}</span>
                          {item.amount > 1 && (
                            <span className="absolute bottom-0 right-1 text-xs font-bold text-white"
                                  style={{ textShadow: '1px 1px 2px black' }}>
                              {item.amount}
                            </span>
                          )}
                          {item.buyPrice != null && (
                            <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full"
                                 title={`Achat ${item.buyPrice}$`}
                                 style={{ background: '#10b981' }}/>
                          )}
                          {item.sellPrice != null && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                                 title={`Vente ${item.sellPrice}$`}
                                 style={{ background: '#f59e0b' }}/>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {canEdit && (
                <div className="mt-3 text-center text-xs" style={{ color: '#aaa' }}>
                  💡 Clic gauche = sélectionner · Glisser = déplacer · Clic droit = retirer
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne éditeur item */}
        <div className="rounded-xl overflow-hidden flex flex-col"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="p-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {selectedItem ? '✏️ Édition de l\'item' : '👆 Sélectionne un slot'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!selectedItem ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📦</div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Glisse un item depuis la palette dans la grille,<br/>
                  ou clique sur un slot pour le modifier.
                </p>
              </div>
            ) : (
              <ItemEditor item={selectedItem}
                          update={(u: any) => updateItem(selectedItem.slot, u)}
                          onRemove={() => removeItem(selectedItem.slot)}
                          canEdit={canEdit}/>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Paramètres shop (section collapsible) ───────────────────────────────────
function ShopSettings({ shop, setShop, canEdit }: any) {
  return (
    <div className="p-4 grid grid-cols-3 gap-4"
         style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
      <Field label="Nom interne (slug unique)">
        <input value={shop.name}
               onChange={e => setShop({ ...shop, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
               disabled={!canEdit}
               style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
      </Field>
      <Field label="Catégorie">
        <input value={shop.category}
               onChange={e => setShop({ ...shop, category: e.target.value })}
               disabled={!canEdit}
               style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
      </Field>
      <Field label="Icône Material">
        <input value={shop.iconMaterial}
               onChange={e => setShop({ ...shop, iconMaterial: e.target.value.toUpperCase() })}
               disabled={!canEdit}
               style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
      </Field>
      <Field label="Permission (vide = tous)">
        <input value={shop.permission || ''}
               onChange={e => setShop({ ...shop, permission: e.target.value })}
               placeholder="shop.vip"
               disabled={!canEdit}
               style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
      </Field>
      <Field label="Commande pour ouvrir">
        <input value={shop.commandToOpen || ''}
               onChange={e => setShop({ ...shop, commandToOpen: e.target.value })}
               placeholder="shop vip"
               disabled={!canEdit}
               style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
      </Field>
      <Field label="Ordre d'affichage">
        <input type="number" value={shop.order}
               onChange={e => setShop({ ...shop, order: +e.target.value })}
               disabled={!canEdit}
               style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
      </Field>
      <div className="col-span-3">
        <Field label="Description">
          <input value={shop.description || ''}
                 onChange={e => setShop({ ...shop, description: e.target.value })}
                 disabled={!canEdit}
                 style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
        </Field>
      </div>
    </div>
  )
}

// ── Éditeur d'item dans la colonne droite ───────────────────────────────────
function ItemEditor({ item, update, onRemove, canEdit }: any) {
  const buyable = item.buyPrice != null
  const sellable = item.sellPrice != null
  return (
    <div className="space-y-3">
      {/* Aperçu */}
      <div className="p-4 rounded-lg text-center"
           style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="text-4xl mb-2">{item.itemAdderId ? '✨' : materialIcon(item.material)}</div>
        <div className="text-sm font-bold" style={{ color: 'var(--text)' }}
             dangerouslySetInnerHTML={{ __html: mcFormat(item.displayName || item.material) }}/>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Slot {item.slot + 1} · x{item.amount}
        </div>
      </div>

      <Field label="Material / Item">
        <input value={item.material}
               onChange={e => update({ material: e.target.value.toUpperCase() })}
               disabled={!canEdit}
               style={inputStyle} className="w-full px-3 py-2 rounded text-sm font-mono"/>
      </Field>

      <Field label="ItemsAdder ID (optionnel)" hint="Prioritaire sur Material si présent">
        <input value={item.itemAdderId || ''}
               onChange={e => update({ itemAdderId: e.target.value })}
               disabled={!canEdit}
               placeholder="itemsadder:mon_item"
               style={inputStyle} className="w-full px-3 py-2 rounded text-sm font-mono"/>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Quantité">
          <input type="number" min={1} max={64} value={item.amount}
                 onChange={e => update({ amount: +e.target.value })}
                 disabled={!canEdit}
                 style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
        </Field>
        <Field label="CustomModelData">
          <input type="number" value={item.customModelData || 0}
                 onChange={e => update({ customModelData: +e.target.value })}
                 disabled={!canEdit}
                 style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
        </Field>
      </div>

      <Field label="Nom affiché (codes &)">
        <input value={item.displayName || ''}
               onChange={e => update({ displayName: e.target.value })}
               disabled={!canEdit}
               style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
      </Field>

      {/* Prix */}
      <div className="p-3 rounded-lg space-y-2" style={{ background: 'var(--surface-2)' }}>
        <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>💰 Prix</div>
        <div className="flex items-center gap-2">
          <Toggle checked={buyable} onChange={(v: boolean) => update({ buyPrice: v ? (item.buyPrice || 100) : null })} disabled={!canEdit}/>
          <span className="text-sm" style={{ color: 'var(--text)' }}>Achetable</span>
          {buyable && (
            <input type="number" min={0} step={0.01} value={item.buyPrice || 0}
                   onChange={e => update({ buyPrice: +e.target.value })}
                   disabled={!canEdit}
                   style={inputStyle} className="ml-auto w-24 px-2 py-1 rounded text-sm"/>
          )}
          {buyable && <span className="text-xs" style={{ color: '#10b981' }}>$</span>}
        </div>
        <div className="flex items-center gap-2">
          <Toggle checked={sellable} onChange={(v: boolean) => update({ sellPrice: v ? (item.sellPrice || 50) : null })} disabled={!canEdit}/>
          <span className="text-sm" style={{ color: 'var(--text)' }}>Vendable</span>
          {sellable && (
            <input type="number" min={0} step={0.01} value={item.sellPrice || 0}
                   onChange={e => update({ sellPrice: +e.target.value })}
                   disabled={!canEdit}
                   style={inputStyle} className="ml-auto w-24 px-2 py-1 rounded text-sm"/>
          )}
          {sellable && <span className="text-xs" style={{ color: '#f59e0b' }}>$</span>}
        </div>
      </div>

      {/* Limites */}
      <div className="p-3 rounded-lg space-y-2" style={{ background: 'var(--surface-2)' }}>
        <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>⏱ Limites (0 = aucune)</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Max achat/jour">
            <input type="number" min={0} value={item.buyLimit || 0}
                   onChange={e => update({ buyLimit: +e.target.value })}
                   disabled={!canEdit}
                   style={inputStyle} className="w-full px-2 py-1 rounded text-sm"/>
          </Field>
          <Field label="Max vente/jour">
            <input type="number" min={0} value={item.sellLimit || 0}
                   onChange={e => update({ sellLimit: +e.target.value })}
                   disabled={!canEdit}
                   style={inputStyle} className="w-full px-2 py-1 rounded text-sm"/>
          </Field>
          <Field label="Stock global">
            <input type="number" min={0} value={item.stockLimit || 0}
                   onChange={e => update({ stockLimit: +e.target.value })}
                   disabled={!canEdit}
                   style={inputStyle} className="w-full px-2 py-1 rounded text-sm"/>
          </Field>
          <Field label="Cooldown (sec)">
            <input type="number" min={0} value={item.buyCooldownSeconds || 0}
                   onChange={e => update({ buyCooldownSeconds: +e.target.value })}
                   disabled={!canEdit}
                   style={inputStyle} className="w-full px-2 py-1 rounded text-sm"/>
          </Field>
        </div>
      </div>

      <Field label="Permission requise (optionnel)">
        <input value={item.permission || ''}
               onChange={e => update({ permission: e.target.value })}
               placeholder="shop.vip.diamond"
               disabled={!canEdit}
               style={inputStyle} className="w-full px-3 py-2 rounded text-sm font-mono"/>
      </Field>

      <Field label="Lore (une ligne par champ)">
        <textarea value={(item.lore || []).join('\n')}
                  onChange={e => update({ lore: e.target.value.split('\n') })}
                  disabled={!canEdit}
                  rows={2}
                  style={inputStyle} className="w-full px-3 py-2 rounded text-sm font-mono"/>
      </Field>

      <Field label="Commandes au buy (une par ligne, {player})">
        <textarea value={(item.commandsOnBuy || []).join('\n')}
                  onChange={e => update({ commandsOnBuy: e.target.value.split('\n').filter(Boolean) })}
                  disabled={!canEdit}
                  rows={2}
                  style={inputStyle} className="w-full px-3 py-2 rounded text-sm font-mono"
                  placeholder="say {player} a acheté !"/>
      </Field>

      {canEdit && (
        <button onClick={onRemove}
                className="w-full py-2 rounded text-sm text-red-400 hover:bg-red-500/10"
                style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
          🗑 Retirer de la grille
        </button>
      )}
    </div>
  )
}

// ── Vue stats d'un shop ─────────────────────────────────────────────────────
function ShopStatsView({ shop, onBack }: any) {
  const s = shop.stats || {}
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          ← Retour
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text)' }}>
            <span>{materialIcon(shop.iconMaterial)}</span>
            <span dangerouslySetInnerHTML={{ __html: mcFormat(shop.displayName) }}/>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Statistiques sur 7 jours</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Transactions" value={s.totalTransactions || 0} color="#60a5fa"/>
        <Kpi label="CA total" value={`${(s.totalRevenue || 0).toLocaleString('fr-FR')} $`} color="#10b981"/>
        <Kpi label="Clients uniques" value={s.uniqueCustomers || 0} color="#a78bfa"/>
        <Kpi label="Panier moyen"
             value={s.totalTransactions ? `${(s.totalRevenue / s.totalTransactions).toFixed(2)} $` : '0 $'}
             color="#f59e0b"/>
      </div>

      {s.dailyRevenue && s.dailyRevenue.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>📈 CA par jour</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={s.dailyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/>
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11}/>
              <YAxis stroke="var(--text-muted)" fontSize={11}/>
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}/>
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {s.topItems && s.topItems.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>🏆 Top items</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={s.topItems.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/>
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11}/>
              <YAxis stroke="var(--text-muted)" fontSize={11}/>
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}/>
              <Bar dataKey="count" fill="#a78bfa" name="Ventes"/>
              <Bar dataKey="revenue" fill="#10b981" name="CA"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Modal d'import ESG ───────────────────────────────────────────────────────
function ImportModal({ shops, onImport, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-[700px] max-h-[80vh] overflow-y-auto rounded-xl p-6"
           style={{ background: 'var(--surface)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            📥 Importer depuis EconomyShopGUI+
          </h2>
          <button onClick={onClose}
                  className="text-2xl leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        {shops.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            Aucun shop trouvé dans EconomyShopGUI+.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {shops.length} shop{shops.length > 1 ? 's' : ''} détecté{shops.length > 1 ? 's' : ''} dans EconomyShopGUI
              </p>
              <button onClick={async () => {
                        if (!confirm(`Importer les ${shops.length} shops d'un coup ?`)) return
                        for (const s of shops) {
                          try { await onImport(s) } catch {}
                        }
                      }}
                      className="px-3 py-1.5 rounded text-sm text-white font-medium"
                      style={{ background: '#10b981' }}>
                ⚡ Tout importer
              </button>
            </div>
            <div className="p-3 rounded-lg text-xs mb-2"
                 style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--text)', border: '1px solid rgba(59,130,246,0.3)' }}>
              💡 L'import crée une copie éditable dans le dashboard. Les fichiers ESG d'origine ne sont PAS modifiés. Tu peux éditer puis re-synchroniser.
            </div>
            {shops.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg"
                   style={{ background: 'var(--surface-2)' }}>
                <div className="text-3xl">{materialIcon(s.displayItem || 'CHEST')}</div>
                <div className="flex-1">
                  <div className="font-bold" style={{ color: 'var(--text)' }}
                       dangerouslySetInnerHTML={{ __html: mcFormat(s.displayName || s.name) }}/>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    /{s.name} · {s.items?.length || 0} items · {s.rows || 3} lignes
                  </div>
                </div>
                <button onClick={() => onImport(s)}
                        className="px-3 py-1.5 rounded text-sm text-white"
                        style={{ background: 'var(--primary)' }}>
                  Importer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, color }: any) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  )
}

function Field({ label, hint, children }: any) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
      {hint && <div className="text-xs mt-1 opacity-70" style={{ color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  )
}

function Toggle({ checked, onChange, disabled }: any) {
  return (
    <button onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className="relative w-10 h-6 rounded-full transition shrink-0"
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

const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
}

function mcFormat(text: string): string {
  if (!text) return ''
  const input = text.replace(/§/g, '&')
  let out = ''
  let i = 0
  let color = 'inherit'
  let bold = false, italic = false, underline = false
  while (i < input.length) {
    const c = input[i]
    if (c === '&' && i + 1 < input.length) {
      const code = input[i + 1].toLowerCase()
      if (MC_COLORS[code]) { color = MC_COLORS[code]; bold = italic = underline = false }
      else if (code === 'l') bold = true
      else if (code === 'o') italic = true
      else if (code === 'n') underline = true
      else if (code === 'r') { color = 'inherit'; bold = italic = underline = false }
      i += 2
      continue
    }
    const style = `color:${color};${bold ? 'font-weight:bold;' : ''}${italic ? 'font-style:italic;' : ''}${underline ? 'text-decoration:underline;' : ''}`
    out += `<span style="${style}">${escapeHtml(c)}</span>`
    i++
  }
  return out
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
