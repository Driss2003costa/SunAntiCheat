import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'
import { uuid } from '../utils/uuid'

const RARITIES = [
  { key: 'COMMON',    color: '#9CA3AF', label: 'Commun' },
  { key: 'UNCOMMON',  color: '#10B981', label: 'Peu commun' },
  { key: 'RARE',      color: '#3B82F6', label: 'Rare' },
  { key: 'EPIC',      color: '#8B5CF6', label: 'Épique' },
  { key: 'LEGENDARY', color: '#F59E0B', label: 'Légendaire' },
  { key: 'MYTHIC',    color: '#EF4444', label: 'Mythique' },
] as const

const ANIMATIONS = ['SIMPLE', 'CSGO', 'WHEEL', 'FADE']
const COMMON_MATERIALS = [
  'CHEST', 'ENDER_CHEST', 'TRAPPED_CHEST', 'BARREL',
  'DIAMOND_BLOCK', 'GOLD_BLOCK', 'EMERALD_BLOCK', 'NETHERITE_BLOCK',
  'BEACON', 'DRAGON_EGG', 'SHULKER_BOX',
]
const COMMON_KEY_ITEMS = [
  'TRIPWIRE_HOOK', 'PAPER', 'NETHER_STAR', 'FEATHER', 'BLAZE_ROD',
]

function rarityInfo(key: string) {
  return RARITIES.find(r => r.key === key) ?? RARITIES[0]
}

function blankItem() {
  return {
    id: uuid(),
    displayName: 'Nouvel item',
    material: 'DIAMOND',
    customModelData: 0,
    itemAdderId: '',
    amount: 1,
    weight: 100,
    enchantments: [] as string[],
    lore: [] as string[],
    commands: [] as string[],
    isCommand: false,
    rarity: 'COMMON',
    broadcastOnWin: false,
  }
}

function blankCrate() {
  return {
    name: 'new_crate',
    displayName: '§6Nouvelle Crate',
    description: 'Une crate mystérieuse',
    icon: '📦',
    color: '#F59E0B',
    placeholderMaterial: 'CHEST',
    itemAdderBlockId: '',
    usesPhysicalKey: true,
    keyMaterial: 'TRIPWIRE_HOOK',
    keyCustomModelData: 0,
    keyItemAdderId: '',
    keyDisplayName: '§6✦ Clé de Crate',
    animation: 'CSGO',
    pityEnabled: false,
    pityOpens: 50,
    pityGuarantee: 'LEGENDARY',
    dailyLimitEnabled: false,
    dailyLimit: 3,
    openSound: 'UI_BUTTON_CLICK',
    rewardSound: 'ENTITY_PLAYER_LEVELUP',
    fireworkOnWin: true,
    particlesEnabled: true,
    broadcastOnOpen: false,
    broadcastFormat: '§6{player} §ea ouvert §6{crate} §eet gagné §c{item}',
    items: [] as any[],
    totalOpens: 0,
    createdAt: Date.now(),
  }
}

export default function Crates() {
  const { canEdit, isAdmin } = usePermission()
  const [crates, setCrates] = useState<any[]>([])
  const [opens, setOpens] = useState<any[]>([])
  const [placed, setPlaced] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)
  const [tab, setTab] = useState<'general' | 'block' | 'key' | 'items' | 'fx'>('general')
  const [stats, setStats] = useState<any | null>(null)
  const [giveKeyModal, setGiveKeyModal] = useState<{ crateId: string; crateName: string } | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setCrates(await api.cratesList())
      setOpens(await api.crateAllOpens(50))
      setPlaced(await api.cratesPlaced())
    } catch {}
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 15000)
    return () => clearInterval(t)
  }, [])

  const showFlash = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 3500)
  }

  const save = async () => {
    if (!editing) return
    try {
      if (editing.id) await api.crateUpdate(editing.id, editing)
      else await api.crateCreate(editing)
      setEditing(null)
      showFlash('✓ Crate enregistrée')
      refresh()
    } catch (e: any) {
      showFlash('✗ ' + e.message)
    }
  }

  const del = async (id: string) => {
    if (!confirm('Supprimer définitivement cette crate ?')) return
    try {
      await api.crateDelete(id)
      showFlash('✓ Crate supprimée')
      refresh()
    } catch (e: any) {
      showFlash('✗ ' + e.message)
    }
  }

  const openStats = async (id: string) => {
    setStats(await api.crateStats(id))
  }

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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>📦 Lootboxes</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {crates.length} crate{crates.length > 1 ? 's' : ''} · {placed.length} placée{placed.length > 1 ? 's' : ''} · {crates.reduce((s, c) => s + (c.totalOpens || 0), 0)} ouvertures totales
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditing(blankCrate()); setTab('general') }}
                  className="px-4 py-2 rounded-lg text-white font-medium"
                  style={{ background: 'var(--primary)' }}>
            + Nouvelle crate
          </button>
        )}
      </div>

      {crates.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
          <div className="text-5xl mb-3">📦</div>
          <div className="font-semibold" style={{ color: 'var(--text)' }}>Aucune crate configurée</div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Crée ta première lootbox pour commencer
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {crates.map(c => (
          <div key={c.id} className="rounded-xl overflow-hidden"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="h-2" style={{ background: c.color }}/>
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="text-4xl">{c.icon}</div>
                <div className="flex gap-1">
                  <button onClick={() => openStats(c.id)}
                          title="Statistiques"
                          className="text-xs px-2 py-1 rounded hover:bg-white/10"
                          style={{ color: 'var(--text-muted)' }}>📊</button>
                  {canEdit && (
                    <button onClick={() => { setEditing({ ...c }); setTab('general') }}
                            title="Éditer"
                            className="text-xs px-2 py-1 rounded hover:bg-white/10"
                            style={{ color: 'var(--text-muted)' }}>✏️</button>
                  )}
                  {!c.usesPhysicalKey && canEdit && (
                    <button onClick={() => setGiveKeyModal({ crateId: c.id, crateName: c.displayName })}
                            title="Donner clés"
                            className="text-xs px-2 py-1 rounded hover:bg-white/10"
                            style={{ color: 'var(--text-muted)' }}>🗝️</button>
                  )}
                  {isAdmin && (
                    <button onClick={() => del(c.id)}
                            title="Supprimer"
                            className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">🗑</button>
                  )}
                </div>
              </div>

              <div className="font-bold" style={{ color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: stripColor(c.displayName) }}/>
              <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{c.description}</div>

              <div className="space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <div>🎁 <b style={{ color: c.color }}>{c.items?.length || 0}</b> items</div>
                <div>📂 {c.totalOpens || 0} ouvertures</div>
                <div>🎬 {c.animation}</div>
                <div>🗝️ {c.usesPhysicalKey ? 'Clé physique' : 'Clé virtuelle'}</div>
                {c.pityEnabled && <div>🎯 Garanti {rarityInfo(c.pityGuarantee).label} tous les {c.pityOpens} opens</div>}
                {c.dailyLimitEnabled && <div>⏱ Max {c.dailyLimit}/jour</div>}
              </div>

              <div className="mt-3 text-xs px-2 py-1 rounded inline-block"
                   style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                <code>/crate place {c.name}</code>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Ouvertures récentes ────────────────────────────────────────────── */}
      {opens.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>📜 Ouvertures récentes</h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {opens.map((o, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 px-3 rounded"
                   style={{ background: i % 2 ? 'var(--surface-2)' : 'transparent' }}>
                <div style={{ color: 'var(--text)' }}>
                  <b>{o.playerName}</b>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  ouvre <b style={{ color: 'var(--text)' }}>{o.crateName}</b>
                </div>
                <div style={{ color: rarityInfo(o.rarity).color }}>
                  <b dangerouslySetInnerHTML={{ __html: stripColor(o.itemName) }}/>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {timeAgo(o.openedAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal stats ─────────────────────────────────────────────────────── */}
      {stats && (
        <Modal onClose={() => setStats(null)} title={`📊 Stats — ${stats.crateName || ''}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Ouvertures" value={stats.totalOpens || 0}/>
              <StatCard label="Joueurs uniques" value={stats.uniquePlayers || 0}/>
              <StatCard label="Opens/joueur" value={(stats.avgOpensPerPlayer || 0).toFixed(1)}/>
            </div>

            {stats.dropRates && stats.dropRates.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                  Taux de drop réels vs théoriques
                </h3>
                <div className="space-y-2">
                  {stats.dropRates.map((r: any) => (
                    <div key={r.itemId} className="flex items-center gap-3 text-sm">
                      <div className="w-40 truncate" style={{ color: 'var(--text)' }}
                           dangerouslySetInnerHTML={{ __html: stripColor(r.displayName) }}/>
                      <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                        <div className="h-full flex items-center px-2 text-xs font-bold text-white"
                             style={{ width: `${r.actualPct}%`, background: rarityInfo(r.rarity).color, minWidth: 40 }}>
                          {r.actualPct.toFixed(1)}%
                        </div>
                      </div>
                      <div className="w-16 text-xs text-right" style={{ color: 'var(--text-muted)' }}>
                        théo {r.theoreticalPct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Modal give key ──────────────────────────────────────────────────── */}
      {giveKeyModal && (
        <GiveKeyModal
          crateId={giveKeyModal.crateId}
          crateName={giveKeyModal.crateName}
          onClose={() => setGiveKeyModal(null)}
          onSuccess={(msg: string) => { showFlash(msg); refresh() }}
        />
      )}

      {/* ── Drawer édition ──────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setEditing(null)}>
          <div className="w-[700px] h-full overflow-y-auto"
               style={{ background: 'var(--surface)' }}
               onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
                 style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="text-3xl">{editing.icon}</div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                    {editing.id ? 'Éditer' : 'Nouvelle'} crate
                  </h2>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {editing.name}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)}
                        className="px-3 py-1.5 rounded text-sm"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  Annuler
                </button>
                <button onClick={save}
                        className="px-4 py-1.5 rounded text-sm text-white font-medium"
                        style={{ background: 'var(--primary)' }}>
                  💾 Enregistrer
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
              {(['general', 'block', 'key', 'items', 'fx'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                        className="px-3 py-1.5 rounded text-sm font-medium transition"
                        style={{
                          background: tab === t ? 'var(--primary)' : 'transparent',
                          color: tab === t ? 'white' : 'var(--text-muted)',
                        }}>
                  {t === 'general' && '📋 Général'}
                  {t === 'block' && '🧱 Bloc'}
                  {t === 'key' && '🗝️ Clé'}
                  {t === 'items' && '🎁 Récompenses'}
                  {t === 'fx' && '✨ Effets'}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {tab === 'general' && (
                <>
                  <Field label="Nom interne (slug, unique)">
                    <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                           style={inputStyle} className="w-full px-3 py-2 rounded"/>
                  </Field>
                  <Field label="Nom affiché (codes &)">
                    <input value={editing.displayName} onChange={e => setEditing({ ...editing, displayName: e.target.value })}
                           style={inputStyle} className="w-full px-3 py-2 rounded"/>
                  </Field>
                  <Field label="Description">
                    <textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}
                              rows={2} style={inputStyle} className="w-full px-3 py-2 rounded"/>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Icône (emoji)">
                      <input value={editing.icon} onChange={e => setEditing({ ...editing, icon: e.target.value })}
                             style={inputStyle} className="w-full px-3 py-2 rounded text-center text-2xl"/>
                    </Field>
                    <Field label="Couleur">
                      <input type="color" value={editing.color} onChange={e => setEditing({ ...editing, color: e.target.value })}
                             className="w-full h-10 rounded cursor-pointer"/>
                    </Field>
                  </div>
                  <Field label="Animation d'ouverture">
                    <div className="grid grid-cols-4 gap-2">
                      {ANIMATIONS.map(a => (
                        <button key={a} onClick={() => setEditing({ ...editing, animation: a })}
                                className="py-2 rounded text-sm font-medium transition"
                                style={{
                                  background: editing.animation === a ? 'var(--primary)' : 'var(--surface-2)',
                                  color: editing.animation === a ? 'white' : 'var(--text-muted)',
                                }}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              )}

              {tab === 'block' && (
                <>
                  <div className="p-4 rounded-lg text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    💡 Le bloc physique où le joueur clique-droit. Utilise ItemsAdder pour du custom.
                  </div>
                  <Field label="Material Bukkit">
                    <input value={editing.placeholderMaterial}
                           onChange={e => setEditing({ ...editing, placeholderMaterial: e.target.value.toUpperCase() })}
                           list="common-materials" style={inputStyle} className="w-full px-3 py-2 rounded"/>
                    <datalist id="common-materials">
                      {COMMON_MATERIALS.map(m => <option key={m} value={m}/>)}
                    </datalist>
                  </Field>
                  <Field label="ItemsAdder Block ID (optionnel)" hint="Ex: itemsadder:mystic_crate. Laisse vide pour vanilla.">
                    <input value={editing.itemAdderBlockId} onChange={e => setEditing({ ...editing, itemAdderBlockId: e.target.value })}
                           placeholder="itemsadder:mon_bloc"
                           style={inputStyle} className="w-full px-3 py-2 rounded"/>
                  </Field>
                  <div className="p-4 rounded-lg text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div style={{ color: 'var(--text)' }}><b>Placement en jeu :</b></div>
                    <code className="text-xs" style={{ color: 'var(--primary)' }}>
                      /crate place {editing.name}
                    </code>
                    <div style={{ color: 'var(--text-muted)' }} className="text-xs">
                      Vise le bloc et lance la commande — il sera enregistré comme crate.
                    </div>
                  </div>
                </>
              )}

              {tab === 'key' && (
                <>
                  <Field label="Type de clé">
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setEditing({ ...editing, usesPhysicalKey: true })}
                              className="py-3 rounded text-sm font-medium transition"
                              style={{
                                background: editing.usesPhysicalKey ? 'var(--primary)' : 'var(--surface-2)',
                                color: editing.usesPhysicalKey ? 'white' : 'var(--text-muted)',
                              }}>
                        🗝️ Clé physique (item)
                      </button>
                      <button onClick={() => setEditing({ ...editing, usesPhysicalKey: false })}
                              className="py-3 rounded text-sm font-medium transition"
                              style={{
                                background: !editing.usesPhysicalKey ? 'var(--primary)' : 'var(--surface-2)',
                                color: !editing.usesPhysicalKey ? 'white' : 'var(--text-muted)',
                              }}>
                        💾 Clé virtuelle (dashboard)
                      </button>
                    </div>
                  </Field>

                  {editing.usesPhysicalKey ? (
                    <>
                      <Field label="Material de la clé">
                        <input value={editing.keyMaterial} onChange={e => setEditing({ ...editing, keyMaterial: e.target.value.toUpperCase() })}
                               list="common-keys" style={inputStyle} className="w-full px-3 py-2 rounded"/>
                        <datalist id="common-keys">
                          {COMMON_KEY_ITEMS.map(m => <option key={m} value={m}/>)}
                        </datalist>
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Custom Model Data">
                          <input type="number" value={editing.keyCustomModelData}
                                 onChange={e => setEditing({ ...editing, keyCustomModelData: +e.target.value })}
                                 style={inputStyle} className="w-full px-3 py-2 rounded"/>
                        </Field>
                        <Field label="ItemsAdder ID">
                          <input value={editing.keyItemAdderId}
                                 onChange={e => setEditing({ ...editing, keyItemAdderId: e.target.value })}
                                 placeholder="itemsadder:ma_clé"
                                 style={inputStyle} className="w-full px-3 py-2 rounded"/>
                        </Field>
                      </div>
                      <Field label="Nom affiché de la clé">
                        <input value={editing.keyDisplayName}
                               onChange={e => setEditing({ ...editing, keyDisplayName: e.target.value })}
                               style={inputStyle} className="w-full px-3 py-2 rounded"/>
                      </Field>
                    </>
                  ) : (
                    <div className="p-4 rounded-lg text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      🗝️ Les clés virtuelles sont stockées en base. Distribue-les via le bouton 🗝️ sur la card de la crate ou la commande <code>/crate givekey</code>.
                    </div>
                  )}
                </>
              )}

              {tab === 'items' && (
                <CrateItemsEditor crate={editing} setCrate={setEditing}/>
              )}

              {tab === 'fx' && (
                <>
                  <div className="p-4 rounded-lg text-sm font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                    ✨ Effets visuels & sons
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Son à l'ouverture">
                      <input value={editing.openSound} onChange={e => setEditing({ ...editing, openSound: e.target.value })}
                             placeholder="UI_BUTTON_CLICK"
                             style={inputStyle} className="w-full px-3 py-2 rounded"/>
                    </Field>
                    <Field label="Son de récompense">
                      <input value={editing.rewardSound} onChange={e => setEditing({ ...editing, rewardSound: e.target.value })}
                             placeholder="ENTITY_PLAYER_LEVELUP"
                             style={inputStyle} className="w-full px-3 py-2 rounded"/>
                    </Field>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle checked={editing.fireworkOnWin} onChange={v => setEditing({ ...editing, fireworkOnWin: v })}/>
                    <span style={{ color: 'var(--text)' }}>🎆 Feu d'artifice au gain</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle checked={editing.particlesEnabled} onChange={v => setEditing({ ...editing, particlesEnabled: v })}/>
                    <span style={{ color: 'var(--text)' }}>✨ Particules autour du bloc</span>
                  </div>

                  <div className="p-4 rounded-lg text-sm font-semibold mt-6" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                    🎯 Pity system & Limites
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle checked={editing.pityEnabled} onChange={v => setEditing({ ...editing, pityEnabled: v })}/>
                    <span style={{ color: 'var(--text)' }}>🎯 Pity system (garantie)</span>
                  </div>
                  {editing.pityEnabled && (
                    <div className="grid grid-cols-2 gap-3 pl-8">
                      <Field label="Nombre d'ouvertures">
                        <input type="number" value={editing.pityOpens}
                               onChange={e => setEditing({ ...editing, pityOpens: +e.target.value })}
                               style={inputStyle} className="w-full px-3 py-2 rounded"/>
                      </Field>
                      <Field label="Rareté garantie">
                        <select value={editing.pityGuarantee}
                                onChange={e => setEditing({ ...editing, pityGuarantee: e.target.value })}
                                style={inputStyle} className="w-full px-3 py-2 rounded">
                          {RARITIES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                        </select>
                      </Field>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Toggle checked={editing.dailyLimitEnabled} onChange={v => setEditing({ ...editing, dailyLimitEnabled: v })}/>
                    <span style={{ color: 'var(--text)' }}>⏱ Limite quotidienne</span>
                  </div>
                  {editing.dailyLimitEnabled && (
                    <div className="pl-8">
                      <Field label="Max ouvertures / joueur / jour">
                        <input type="number" value={editing.dailyLimit}
                               onChange={e => setEditing({ ...editing, dailyLimit: +e.target.value })}
                               style={inputStyle} className="w-full px-3 py-2 rounded"/>
                      </Field>
                    </div>
                  )}

                  <div className="p-4 rounded-lg text-sm font-semibold mt-6" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                    📢 Broadcasts
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle checked={editing.broadcastOnOpen} onChange={v => setEditing({ ...editing, broadcastOnOpen: v })}/>
                    <span style={{ color: 'var(--text)' }}>📢 Annoncer chaque ouverture</span>
                  </div>
                  <Field label="Format du broadcast" hint="{player} {crate} {item} disponibles">
                    <input value={editing.broadcastFormat}
                           onChange={e => setEditing({ ...editing, broadcastFormat: e.target.value })}
                           style={inputStyle} className="w-full px-3 py-2 rounded"/>
                  </Field>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CrateItemsEditor({ crate, setCrate }: { crate: any; setCrate: (c: any) => void }) {
  const [editingItem, setEditingItem] = useState<any | null>(null)

  const addItem = () => setEditingItem(blankItem())
  const saveItem = () => {
    if (!editingItem) return
    const items = crate.items.filter((i: any) => i.id !== editingItem.id)
    items.push(editingItem)
    setCrate({ ...crate, items })
    setEditingItem(null)
  }
  const delItem = (id: string) => {
    setCrate({ ...crate, items: crate.items.filter((i: any) => i.id !== id) })
  }

  const totalWeight = crate.items.reduce((s: number, i: any) => s + (i.weight || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {crate.items.length} items · poids total {totalWeight}
        </div>
        <button onClick={addItem}
                className="px-3 py-1.5 rounded text-sm text-white font-medium"
                style={{ background: 'var(--primary)' }}>
          + Ajouter un item
        </button>
      </div>

      {/* Distribution visuelle */}
      {totalWeight > 0 && (
        <div className="h-6 rounded overflow-hidden flex" style={{ background: 'var(--surface-2)' }}>
          {crate.items.map((it: any) => (
            <div key={it.id}
                 title={`${it.displayName}: ${((it.weight / totalWeight) * 100).toFixed(1)}%`}
                 style={{
                   width: `${(it.weight / totalWeight) * 100}%`,
                   background: rarityInfo(it.rarity).color,
                 }}/>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {crate.items.map((it: any) => (
          <div key={it.id} className="flex items-center gap-3 p-3 rounded"
               style={{ background: 'var(--surface-2)', border: `1px solid ${rarityInfo(it.rarity).color}44` }}>
            <div className="text-2xl">{it.isCommand ? '⚙️' : '🎁'}</div>
            <div className="flex-1">
              <div className="font-medium" style={{ color: 'var(--text)' }}
                   dangerouslySetInnerHTML={{ __html: stripColor(it.displayName) }}/>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {it.isCommand ? 'Commande' : (it.itemAdderId || `${it.material}${it.customModelData ? ` (CMD=${it.customModelData})` : ''}`)}
                · x{it.amount}
                <span className="ml-2 px-1.5 rounded" style={{ background: rarityInfo(it.rarity).color, color: 'white' }}>
                  {rarityInfo(it.rarity).label}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold" style={{ color: rarityInfo(it.rarity).color }}>
                {totalWeight > 0 ? ((it.weight / totalWeight) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                poids {it.weight}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditingItem({ ...it })}
                      className="text-xs px-2 py-1 rounded hover:bg-white/10"
                      style={{ color: 'var(--text-muted)' }}>✏️</button>
              <button onClick={() => delItem(it.id)}
                      className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">🗑</button>
            </div>
          </div>
        ))}
      </div>

      {crate.items.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          Aucune récompense — ajoute au moins un item
        </div>
      )}

      {/* Modal item editor */}
      {editingItem && (
        <Modal onClose={() => setEditingItem(null)} title="✏️ Item de récompense">
          <div className="space-y-4">
            <Field label="Type">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setEditingItem({ ...editingItem, isCommand: false })}
                        className="py-2 rounded text-sm font-medium"
                        style={{
                          background: !editingItem.isCommand ? 'var(--primary)' : 'var(--surface-2)',
                          color: !editingItem.isCommand ? 'white' : 'var(--text-muted)',
                        }}>
                  🎁 Item
                </button>
                <button onClick={() => setEditingItem({ ...editingItem, isCommand: true })}
                        className="py-2 rounded text-sm font-medium"
                        style={{
                          background: editingItem.isCommand ? 'var(--primary)' : 'var(--surface-2)',
                          color: editingItem.isCommand ? 'white' : 'var(--text-muted)',
                        }}>
                  ⚙️ Commande seulement
                </button>
              </div>
            </Field>

            <Field label="Nom affiché (codes &)">
              <input value={editingItem.displayName}
                     onChange={e => setEditingItem({ ...editingItem, displayName: e.target.value })}
                     style={inputStyle} className="w-full px-3 py-2 rounded"/>
            </Field>

            {!editingItem.isCommand && (
              <>
                <Field label="Source">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setEditingItem({ ...editingItem, itemAdderId: '' })}
                            className="py-2 rounded text-sm"
                            style={{
                              background: !editingItem.itemAdderId ? 'var(--primary)' : 'var(--surface-2)',
                              color: !editingItem.itemAdderId ? 'white' : 'var(--text-muted)',
                            }}>
                      Vanilla / CMData
                    </button>
                    <button onClick={() => setEditingItem({ ...editingItem, itemAdderId: editingItem.itemAdderId || 'itemsadder:' })}
                            className="py-2 rounded text-sm"
                            style={{
                              background: editingItem.itemAdderId ? 'var(--primary)' : 'var(--surface-2)',
                              color: editingItem.itemAdderId ? 'white' : 'var(--text-muted)',
                            }}>
                      ItemsAdder
                    </button>
                  </div>
                </Field>

                {editingItem.itemAdderId ? (
                  <Field label="ItemsAdder ID">
                    <input value={editingItem.itemAdderId}
                           onChange={e => setEditingItem({ ...editingItem, itemAdderId: e.target.value })}
                           placeholder="itemsadder:mon_item"
                           style={inputStyle} className="w-full px-3 py-2 rounded"/>
                  </Field>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Material">
                      <input value={editingItem.material}
                             onChange={e => setEditingItem({ ...editingItem, material: e.target.value.toUpperCase() })}
                             style={inputStyle} className="w-full px-3 py-2 rounded"/>
                    </Field>
                    <Field label="Custom Model Data">
                      <input type="number" value={editingItem.customModelData}
                             onChange={e => setEditingItem({ ...editingItem, customModelData: +e.target.value })}
                             style={inputStyle} className="w-full px-3 py-2 rounded"/>
                    </Field>
                  </div>
                )}

                <Field label="Quantité">
                  <input type="number" min={1} max={64} value={editingItem.amount}
                         onChange={e => setEditingItem({ ...editingItem, amount: +e.target.value })}
                         style={inputStyle} className="w-full px-3 py-2 rounded"/>
                </Field>

                <Field label="Enchantements" hint="Format ENCHANT:level (un par ligne)">
                  <textarea value={(editingItem.enchantments || []).join('\n')}
                            onChange={e => setEditingItem({ ...editingItem, enchantments: e.target.value.split('\n').filter(Boolean) })}
                            rows={3} style={inputStyle} className="w-full px-3 py-2 rounded font-mono text-sm"
                            placeholder="SHARPNESS:5&#10;UNBREAKING:3"/>
                </Field>

                <Field label="Lore (codes &)">
                  <textarea value={(editingItem.lore || []).join('\n')}
                            onChange={e => setEditingItem({ ...editingItem, lore: e.target.value.split('\n') })}
                            rows={3} style={inputStyle} className="w-full px-3 py-2 rounded font-mono text-sm"/>
                </Field>
              </>
            )}

            <Field label="Commandes récompense (une par ligne, {player})">
              <textarea value={(editingItem.commands || []).join('\n')}
                        onChange={e => setEditingItem({ ...editingItem, commands: e.target.value.split('\n').filter(Boolean) })}
                        rows={2} style={inputStyle} className="w-full px-3 py-2 rounded font-mono text-sm"
                        placeholder="say {player} a gagné !"/>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Poids (${editingItem.weight})`}>
                <input type="range" min={1} max={1000} value={editingItem.weight}
                       onChange={e => setEditingItem({ ...editingItem, weight: +e.target.value })}
                       className="w-full"/>
              </Field>
              <Field label="Rareté">
                <select value={editingItem.rarity}
                        onChange={e => setEditingItem({ ...editingItem, rarity: e.target.value })}
                        style={inputStyle} className="w-full px-3 py-2 rounded">
                  {RARITIES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <Toggle checked={editingItem.broadcastOnWin}
                      onChange={v => setEditingItem({ ...editingItem, broadcastOnWin: v })}/>
              <span style={{ color: 'var(--text)' }}>📢 Annoncer si gagné (item rare)</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingItem(null)}
                      className="flex-1 py-2 rounded"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                Annuler
              </button>
              <button onClick={saveItem}
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

function GiveKeyModal({ crateId, crateName, onClose, onSuccess }: any) {
  const [playerName, setPlayerName] = useState('')
  const [count, setCount] = useState(1)
  const submit = async () => {
    try {
      await api.crateGiveKey(crateId, playerName, count)
      onSuccess(`✓ ${count} clé(s) donnée(s) à ${playerName}`)
      onClose()
    } catch (e: any) {
      onSuccess('✗ ' + e.message)
    }
  }
  return (
    <Modal onClose={onClose} title={`🗝️ Donner des clés — ${stripColor(crateName).replace(/<[^>]+>/g, '')}`}>
      <div className="space-y-4">
        <Field label="Nom du joueur">
          <input value={playerName} onChange={e => setPlayerName(e.target.value)}
                 style={inputStyle} className="w-full px-3 py-2 rounded"/>
        </Field>
        <Field label="Nombre de clés">
          <input type="number" min={1} value={count} onChange={e => setCount(+e.target.value)}
                 style={inputStyle} className="w-full px-3 py-2 rounded"/>
        </Field>
        <button onClick={submit}
                disabled={!playerName}
                className="w-full py-2 rounded text-white font-medium"
                style={{ background: 'var(--primary)', opacity: playerName ? 1 : 0.5 }}>
          Donner
        </button>
      </div>
    </Modal>
  )
}

function Modal({ onClose, title, children }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="w-[500px] max-h-[90vh] overflow-y-auto rounded-xl p-5"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: 'var(--text)' }}>{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none hover:opacity-60"
                  style={{ color: 'var(--text-muted)' }}>×</button>
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
            className="relative w-10 h-6 rounded-full transition"
            style={{ background: checked ? 'var(--primary)' : 'var(--surface-2)' }}>
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
           style={{ left: checked ? '1.125rem' : '0.125rem' }}/>
    </button>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>{value}</div>
    </div>
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
