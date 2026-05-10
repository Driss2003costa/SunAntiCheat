import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

const TYPES = ['BREAK_BLOCK', 'PLACE_BLOCK', 'KILL_ENTITY', 'KILL_PLAYER', 'CRAFT_ITEM', 'FISH_CATCH', 'PLAY_TIME', 'FRIEND_COUNT', 'REFERRAL_COUNT']
const ICONS = ['⭐', '⚔️', '⛏', '🏆', '🐟', '💰', '💎', '🔥', '🛡️', '🎯']

// ── Materials suggérés pour le builder reward ──────────────────────────────────
const COMMON_MATERIALS = [
  'DIAMOND', 'EMERALD', 'GOLD_INGOT', 'IRON_INGOT', 'NETHERITE_INGOT',
  'DIAMOND_PICKAXE', 'DIAMOND_SWORD', 'DIAMOND_AXE',
  'IRON_PICKAXE', 'IRON_SWORD', 'IRON_HELMET', 'IRON_CHESTPLATE', 'IRON_LEGGINGS', 'IRON_BOOTS',
  'BREAD', 'COOKED_BEEF', 'COOKED_PORKCHOP', 'GOLDEN_APPLE', 'ENCHANTED_GOLDEN_APPLE',
  'EXPERIENCE_BOTTLE', 'ENDER_PEARL', 'TOTEM_OF_UNDYING',
  'ELYTRA', 'TRIDENT', 'NETHER_STAR',
  'ENCHANTED_BOOK', 'ANVIL', 'ENCHANTING_TABLE',
  'TNT', 'FIREWORK_ROCKET',
]

const MONEY_PRESETS = [100, 250, 500, 1000, 2500, 5000, 10000]

const ITEM_KITS: { id: string; label: string; emoji: string; items: { material: string; quantity: number }[] }[] = [
  { id: 'starter',    label: 'Starter',    emoji: '🎒', items: [
    { material: 'BREAD', quantity: 16 }, { material: 'WOODEN_SWORD', quantity: 1 }, { material: 'WOODEN_PICKAXE', quantity: 1 },
  ] },
  { id: 'pvp',        label: 'PvP kit',    emoji: '⚔️', items: [
    { material: 'GOLDEN_APPLE', quantity: 8 }, { material: 'ENDER_PEARL', quantity: 8 }, { material: 'ARROW', quantity: 32 },
  ] },
  { id: 'xp',         label: 'XP boost',   emoji: '✨', items: [
    { material: 'EXPERIENCE_BOTTLE', quantity: 32 },
  ] },
  { id: 'food',       label: 'Food pack',  emoji: '🍖', items: [
    { material: 'COOKED_BEEF', quantity: 32 }, { material: 'GOLDEN_CARROT', quantity: 8 },
  ] },
]

type RewardKind = 'money' | 'items' | 'both' | 'custom'

interface RewardItem { material: string; quantity: number }

interface RewardState {
  kind: RewardKind
  money: number
  items: RewardItem[]
  custom: string
}

/** Parse une commande existante en RewardState pour pré-remplir le builder. */
function parseRewardCommand(cmd: string | undefined | null): RewardState {
  const empty: RewardState = { kind: 'money', money: 0, items: [], custom: '' }
  if (!cmd || !cmd.trim()) return empty

  const segments = cmd.split(';').map(s => s.trim()).filter(Boolean)
  const items: RewardItem[] = []
  let money = 0
  let allParsed = true

  for (const seg of segments) {
    // eco give {player} <amount>
    const ecoMatch = seg.match(/^eco\s+give\s+\{player\}\s+(\d+(?:\.\d+)?)\s*$/i)
    if (ecoMatch) { money += parseFloat(ecoMatch[1]); continue }

    // give {player} <material> <quantity>
    const giveMatch = seg.match(/^give\s+\{player\}\s+(\S+)\s+(\d+)\s*$/i)
    if (giveMatch) { items.push({ material: giveMatch[1].toUpperCase(), quantity: parseInt(giveMatch[2], 10) }); continue }

    // Reconnaît aussi `give {player} material{NBT...} qty` (Enchantments etc.)
    const giveNbtMatch = seg.match(/^give\s+\{player\}\s+(\S+\{.*?\})\s+(\d+)\s*$/i)
    if (giveNbtMatch) { items.push({ material: giveNbtMatch[1], quantity: parseInt(giveNbtMatch[2], 10) }); continue }

    allParsed = false
  }

  if (!allParsed) return { kind: 'custom', money: 0, items: [], custom: cmd }

  const hasMoney = money > 0
  const hasItems = items.length > 0
  return {
    kind: hasMoney && hasItems ? 'both' : hasItems ? 'items' : 'money',
    money,
    items,
    custom: '',
  }
}

/** Sérialise un RewardState vers une commande. */
function buildRewardCommand(s: RewardState): string {
  if (s.kind === 'custom') return s.custom.trim()
  const parts: string[] = []
  if ((s.kind === 'money' || s.kind === 'both') && s.money > 0) {
    parts.push(`eco give {player} ${s.money}`)
  }
  if (s.kind === 'items' || s.kind === 'both') {
    for (const it of s.items) {
      const mat = it.material.trim()
      if (mat && it.quantity > 0) {
        parts.push(`give {player} ${mat.toLowerCase()} ${it.quantity}`)
      }
    }
  }
  return parts.join('; ')
}

/** Suggestion de label FR auto-généré à partir du state — purement indicatif. */
function suggestLabel(s: RewardState): string {
  if (s.kind === 'custom') return ''
  const parts: string[] = []
  if ((s.kind === 'money' || s.kind === 'both') && s.money > 0) {
    parts.push(`${s.money} coins`)
  }
  if (s.kind === 'items' || s.kind === 'both') {
    const itemsStr = s.items
      .filter(i => i.material && i.quantity > 0)
      .map(i => `${i.quantity}× ${i.material.toLowerCase().replace(/_/g, ' ')}`)
      .join(', ')
    if (itemsStr) parts.push(itemsStr)
  }
  return parts.join(' + ')
}

// ── RewardBuilder — sélecteur visuel pour la commande reward ─────────────────
function RewardBuilder({ command, onChange }: { command: string; onChange: (cmd: string) => void }) {
  const [state, setState] = useState<RewardState>(() => parseRewardCommand(command))

  // Émet vers le parent à chaque mutation. Le parent fait une comparaison
  // d'égalité avant setEditing → pas de boucle infinie.
  useEffect(() => {
    onChange(buildRewardCommand(state))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const set = (patch: Partial<RewardState>) => setState(s => ({ ...s, ...patch }))
  const updateItem = (idx: number, patch: Partial<RewardItem>) =>
    set({ items: state.items.map((it, i) => i === idx ? { ...it, ...patch } : it) })
  const addItem = () => set({ items: [...state.items, { material: 'DIAMOND', quantity: 1 }] })
  const removeItem = (idx: number) => set({ items: state.items.filter((_, i) => i !== idx) })

  const tabs: { id: RewardKind; label: string; emoji: string }[] = [
    { id: 'money',  label: 'Argent',       emoji: '💰' },
    { id: 'items',  label: 'Items',        emoji: '🎁' },
    { id: 'both',   label: 'Argent + Items', emoji: '💎' },
    { id: 'custom', label: 'Avancé',       emoji: '⚙️' },
  ]

  const previewCmd = buildRewardCommand(state)

  return (
    <div className="rounded-lg p-3 space-y-3"
         style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
          🎁 Récompense
        </div>
        <div className="flex flex-wrap gap-1">
          {tabs.map(t => (
            <button key={t.id}
                    onClick={() => set({ kind: t.id })}
                    className="px-3 py-1.5 rounded text-xs font-semibold transition"
                    style={{
                      background: state.kind === t.id ? 'var(--primary)' : 'var(--surface)',
                      color: state.kind === t.id ? 'white' : 'var(--text-muted)',
                      border: `1px solid ${state.kind === t.id ? 'var(--primary)' : 'var(--border)'}`,
                    }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section Argent */}
      {(state.kind === 'money' || state.kind === 'both') && (
        <div className="rounded p-3 space-y-2"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Argent (Vault)</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={0} step={1}
                   value={state.money}
                   onChange={e => set({ money: Math.max(0, +e.target.value || 0) })}
                   className="w-32 px-3 py-1.5 rounded text-sm font-mono"
                   style={inpInner}/>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>coins</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] uppercase tracking-wider self-center mr-1" style={{ color: 'var(--text-muted)' }}>Préréglages :</span>
            {MONEY_PRESETS.map(amt => (
              <button key={amt}
                      onClick={() => set({ money: amt })}
                      className="px-2 py-1 rounded text-[11px] font-mono"
                      style={{
                        background: state.money === amt ? 'rgba(251,191,36,0.18)' : 'var(--surface-2)',
                        color: state.money === amt ? '#fbbf24' : 'var(--text-muted)',
                        border: `1px solid ${state.money === amt ? 'rgba(251,191,36,0.4)' : 'var(--border)'}`,
                      }}>
                {amt >= 1000 ? `${amt/1000}k` : amt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section Items */}
      {(state.kind === 'items' || state.kind === 'both') && (
        <div className="rounded p-3 space-y-2"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎁</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Items</span>
              {state.items.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {state.items.length}
                </span>
              )}
            </div>
            <button onClick={addItem}
                    className="text-xs px-2 py-1 rounded hover:opacity-80"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              + Ajouter un item
            </button>
          </div>

          {/* Kits préréglés */}
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] uppercase tracking-wider self-center mr-1" style={{ color: 'var(--text-muted)' }}>Kits rapides :</span>
            {ITEM_KITS.map(k => (
              <button key={k.id}
                      onClick={() => set({ items: [...state.items, ...k.items] })}
                      title={`Ajoute : ${k.items.map(i => `${i.quantity}× ${i.material.toLowerCase()}`).join(', ')}`}
                      className="px-2 py-1 rounded text-[11px]"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                {k.emoji} {k.label}
              </button>
            ))}
            {state.items.length > 0 && (
              <button onClick={() => set({ items: [] })}
                      className="ml-auto px-2 py-1 rounded text-[11px] text-red-400 hover:bg-red-500/10">
                Vider
              </button>
            )}
          </div>

          {state.items.length === 0 ? (
            <p className="text-xs italic py-2" style={{ color: 'var(--text-muted)' }}>
              Aucun item. Clique « + Ajouter un item » ou un kit rapide ci-dessus.
            </p>
          ) : (
            <div className="space-y-1.5">
              <datalist id="material-suggestions">
                {COMMON_MATERIALS.map(m => <option key={m} value={m} />)}
              </datalist>
              {state.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    list="material-suggestions"
                    value={item.material}
                    onChange={e => updateItem(idx, { material: e.target.value.toUpperCase() })}
                    placeholder="MATERIAL"
                    className="flex-1 px-2 py-1.5 rounded text-xs font-mono"
                    style={inpInner}/>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>×</span>
                  <input type="number" min={1} max={2304}
                    value={item.quantity}
                    onChange={e => updateItem(idx, { quantity: Math.max(1, +e.target.value || 1) })}
                    className="w-16 px-2 py-1.5 rounded text-xs font-mono text-right"
                    style={inpInner}/>
                  <button onClick={() => removeItem(idx)}
                          className="text-xs w-7 h-7 rounded text-red-400 hover:bg-red-500/10">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode custom */}
      {state.kind === 'custom' && (
        <div className="rounded p-3 space-y-2"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚙️</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Commande personnalisée</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Sépare plusieurs commandes par <code>;</code>. Utilise <code>{'{player}'}</code> pour le pseudo.
          </p>
          <textarea rows={2}
                    value={state.custom}
                    onChange={e => set({ custom: e.target.value })}
                    placeholder="lp user {player} parent addtemp vip 7d; eco give {player} 500"
                    className="w-full px-3 py-2 rounded font-mono text-xs"
                    style={inpInner}/>
        </div>
      )}

      {/* Preview */}
      {previewCmd && state.kind !== 'custom' && (
        <div className="rounded p-2.5"
             style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#34d399' }}>
            Commande générée
          </div>
          <code className="text-[11px] font-mono break-all" style={{ color: '#6ee7b7' }}>{previewCmd}</code>
          {suggestLabel(state) && (
            <div className="text-[10px] mt-1.5 italic" style={{ color: 'var(--text-muted)' }}>
              Suggestion de label : « {suggestLabel(state)} »
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const inpInner: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }

// ── Timer hook ─────────────────────────────────────────────────────────────────
function useAdminTimer(endsAt: number | null | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [endsAt])
  if (!endsAt) return null
  return Math.max(0, endsAt - now)
}

// ── QuestAdminCard ─────────────────────────────────────────────────────────────
function QuestAdminCard({ q, canEdit, onEdit, onDelete, onExpired }: {
  q: any
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onExpired: (id: string) => void
}) {
  const msLeft  = useAdminTimer(q.endsAt)
  const expired = msLeft !== null && msLeft <= 0
  const urgent  = msLeft !== null && msLeft > 0 && msLeft < 3_600_000
  const warn    = msLeft !== null && msLeft > 0 && msLeft < 86_400_000

  useEffect(() => {
    if (expired) {
      const t = setTimeout(() => onExpired(q.id), 600)
      return () => clearTimeout(t)
    }
  }, [expired, q.id, onExpired])

  function fmtMs(ms: number) {
    const s  = Math.floor(ms / 1000)
    const d  = Math.floor(s / 86400)
    const h  = Math.floor((s % 86400) / 3600)
    const m  = Math.floor((s % 3600) / 60)
    const sc = s % 60
    if (d > 0) return `${d}j ${h}h`
    if (h > 0) return `${h}h ${m}m`
    return `${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
  }

  const timerColor = urgent ? '#ef4444' : warn ? '#f59e0b' : '#10b981'

  return (
    <div
      className="rounded-xl p-5 transition-all duration-500"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${expired ? 'rgba(239,68,68,0.5)' : q.enabled ? q.color : 'var(--border)'}`,
        opacity: expired ? 0 : 1,
        transform: expired ? 'scale(0.96)' : 'scale(1)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-3xl">{q.icon}</div>
        <div className="flex items-center gap-1">
          {q.titleEn && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold mr-1"
                  title={q.titleEn}
                  style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)' }}>
              EN
            </span>
          )}
          {msLeft !== null && msLeft > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold mr-1"
              style={{
                background: urgent ? 'rgba(239,68,68,0.15)' : warn ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.12)',
                color: timerColor,
                border: `1px solid ${timerColor}40`,
                animation: urgent ? 'pulse 1s ease-in-out infinite' : undefined,
              }}
            >
              ⏱ {fmtMs(msLeft)}
            </span>
          )}
          {expired && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold mr-1"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }}>
              Expirée
            </span>
          )}
          {canEdit && !expired && (
            <>
              <button onClick={onEdit}   className="text-xs px-2 py-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>✏️</button>
              <button onClick={onDelete} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">🗑</button>
            </>
          )}
        </div>
      </div>
      <div className="font-bold" style={{ color: 'var(--text)' }}>{q.title}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{q.description}</div>
      <div className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        <div>🎯 {q.type} · {q.target} · goal <b style={{ color: q.color }}>{q.goal}</b></div>
        {q.rewardLabel && <div>🎁 {q.rewardLabel}</div>}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className={`px-2 py-0.5 rounded ${q.enabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
          {q.enabled ? 'Active' : 'Inactive'}
        </span>
        {q.repeatable && <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">Répétable</span>}
        <span className="ml-auto">✅ {q.completions} · ⏳ {q.inProgress}</span>
      </div>
    </div>
  )
}

// ── Library modal ──────────────────────────────────────────────────────────────
function QuestLibraryModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [data, setData] = useState<{ categories: any[]; templates: any[] } | null>(null)
  const [activeCat, setActiveCat] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    api.questTemplates()
      .then(setData)
      .catch(e => setError(e.message || 'Erreur de chargement'))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const s = search.trim().toLowerCase()
    return data.templates.filter(t => {
      if (activeCat !== 'all' && t.category !== activeCat) return false
      if (!s) return true
      return (
        (t.title?.fr || '').toLowerCase().includes(s) ||
        (t.title?.en || '').toLowerCase().includes(s) ||
        (t.description?.fr || '').toLowerCase().includes(s) ||
        (t.target || '').toLowerCase().includes(s)
      )
    })
  }, [data, activeCat, search])

  const handleAdd = async (template: any) => {
    setAdding(template.id); setError('')
    try {
      await api.questFromTemplate(template.id)
      setAdded(prev => new Set(prev).add(template.id))
      onAdded()
    } catch (e: any) {
      setError(e.message || 'Erreur')
    } finally { setAdding(null) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              📚 Bibliothèque de quêtes
              <span className="text-xs font-normal px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}>
                FR + EN
              </span>
            </h2>
            <button onClick={onClose} className="text-xl px-3 py-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>×</button>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Choisis une quête pré-faite — elle sera ajoutée à ta liste avec les deux langues. Tu pourras toujours l'éditer ensuite.
          </p>
          <input
            placeholder="🔍 Rechercher (titre, description, cible…)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded mb-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveCat('all')}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{
                      background: activeCat === 'all' ? 'var(--primary)' : 'var(--surface-2)',
                      color: activeCat === 'all' ? 'white' : 'var(--text-muted)',
                    }}>
              Tout {data && `(${data.templates.length})`}
            </button>
            {data?.categories.map(c => {
              const count = data.templates.filter(t => t.category === c.id).length
              return (
                <button key={c.id} onClick={() => setActiveCat(c.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1"
                        style={{
                          background: activeCat === c.id ? 'var(--primary)' : 'var(--surface-2)',
                          color: activeCat === c.id ? 'white' : 'var(--text-muted)',
                        }}>
                  <span>{c.icon}</span> {c.labelFr} <span className="opacity-60">({count})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 px-4 py-2 rounded text-sm"
                 style={{ background: 'rgba(239,68,68,0.10)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}
          {!data ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Aucun template ne correspond</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(t => (
                <div key={t.id}
                     className="rounded-xl p-4 transition-all"
                     style={{ background: 'var(--surface-2)', border: `1px solid ${t.color}40` }}>
                  <div className="flex items-start gap-3 mb-2">
                    <div className="text-3xl shrink-0">{t.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{t.title?.fr}</div>
                      <div className="text-[11px] italic" style={{ color: 'rgba(125,211,252,0.85)' }}>
                        EN · {t.title?.en}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    {t.description?.fr}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(56,189,248,0.10)', color: '#7dd3fc' }}>
                      {t.type}
                    </span>
                    {t.target && t.target !== 'ANY' && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
                        {t.target}
                      </span>
                    )}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${t.color}20`, color: t.color }}>
                      goal {t.goal}
                    </span>
                    {t.repeatable && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(139,92,246,0.10)', color: '#c4b5fd' }}>
                        🔁
                      </span>
                    )}
                  </div>
                  {t.rewardLabel?.fr && (
                    <div className="text-xs mb-3 px-2 py-1.5 rounded"
                         style={{ background: 'rgba(251,191,36,0.08)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.2)' }}>
                      🎁 {t.rewardLabel.fr}
                    </div>
                  )}
                  <button
                    onClick={() => handleAdd(t)}
                    disabled={adding === t.id || added.has(t.id)}
                    className="w-full px-3 py-2 rounded text-sm font-semibold transition"
                    style={{
                      background: added.has(t.id) ? 'rgba(16,185,129,0.15)' : 'var(--primary)',
                      color: added.has(t.id) ? '#34d399' : 'white',
                      cursor: adding === t.id || added.has(t.id) ? 'default' : 'pointer',
                    }}>
                    {adding === t.id ? '⏳ Ajout…' : added.has(t.id) ? '✓ Ajoutée' : '+ Ajouter'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between text-xs"
             style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <span>{data ? `${filtered.length} sur ${data.templates.length} templates` : ''}</span>
          {added.size > 0 && (
            <span className="text-emerald-400 font-semibold">✓ {added.size} quête(s) ajoutée(s)</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Quests() {
  const { canEdit } = usePermission()
  const [quests, setQuests] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)

  const refresh = async () => setQuests((await api.questsList()).quests)
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t) }, [])

  const handleExpired = useCallback((id: string) => {
    setQuests(qs => qs.filter(q => q.id !== id))
  }, [])

  const blank = () => ({
    title: '', titleEn: '', description: '', descriptionEn: '',
    icon: '⭐', color: '#8B5CF6',
    type: 'BREAK_BLOCK', target: 'ANY', goal: 100,
    rewardCommand: '', rewardLabel: '', rewardLabelEn: '',
    enabled: true, repeatable: false, endsAtLocal: '',
  })

  const save = async () => {
    if (!editing) return
    const payload = { ...editing }
    if (payload.endsAtLocal) {
      payload.endsAt = new Date(payload.endsAtLocal).getTime()
    } else {
      payload.endsAt = null
    }
    delete payload.endsAtLocal
    if (editing.id) await api.questUpdate(editing.id, payload)
    else await api.questCreate(payload)
    setEditing(null); refresh()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🎯 Quêtes</h1>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setShowLibrary(true)}
                    className="px-3 py-2 rounded text-sm font-semibold flex items-center gap-2"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              📚 Bibliothèque
            </button>
            <button onClick={() => setEditing(blank())} className="px-3 py-2 rounded text-white text-sm" style={{ background: 'var(--primary)' }}>
              + Nouvelle quête
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {quests.map(q => (
          <QuestAdminCard
            key={q.id}
            q={q}
            canEdit={canEdit}
            onEdit={() => setEditing({ ...q, endsAtLocal: q.endsAt ? new Date(q.endsAt).toISOString().slice(0,16) : '' })}
            onDelete={async () => { if (confirm('Supprimer ?')) { await api.questDelete(q.id); refresh() } }}
            onExpired={handleExpired}
          />
        ))}
        {quests.length === 0 && (
          <div className="col-span-3 text-center py-12" style={{ color: 'var(--text-muted)' }}>
            Aucune quête.
            {canEdit && (
              <div className="mt-3">
                <button onClick={() => setShowLibrary(true)}
                        className="px-4 py-2 rounded text-sm text-white"
                        style={{ background: 'var(--primary)' }}>
                  📚 Parcourir la bibliothèque
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showLibrary && (
        <QuestLibraryModal onClose={() => setShowLibrary(false)} onAdded={refresh} />
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="rounded-xl p-6 w-[640px] max-h-[90vh] overflow-y-auto space-y-3"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{editing.id ? 'Modifier' : 'Nouvelle'} quête</h2>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>🇫🇷 Français</div>
              <input placeholder="Titre" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2 rounded" style={inp}/>
              <textarea placeholder="Description" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded mt-2" style={inp}/>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#7dd3fc' }}>🇬🇧 English (optionnel)</div>
              <input placeholder="Title (English)" value={editing.titleEn || ''} onChange={e => setEditing({ ...editing, titleEn: e.target.value })} className="w-full px-3 py-2 rounded" style={inp}/>
              <textarea placeholder="Description (English)" value={editing.descriptionEn || ''} onChange={e => setEditing({ ...editing, descriptionEn: e.target.value })} rows={2} className="w-full px-3 py-2 rounded mt-2" style={inp}/>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Type
                <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })} className="w-full mt-1 px-3 py-2 rounded" style={inp}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Target (ANY ou ex. STONE)
                <input value={editing.target} onChange={e => setEditing({ ...editing, target: e.target.value })} className="w-full mt-1 px-3 py-2 rounded" style={inp}/>
              </label>
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Goal
                <input type="number" value={editing.goal} onChange={e => setEditing({ ...editing, goal: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded" style={inp}/>
              </label>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Icône</div>
              <div className="flex flex-wrap gap-1">
                {ICONS.map(i => <button key={i} onClick={() => setEditing({ ...editing, icon: i })} className="w-8 h-8 rounded text-lg" style={{ background: editing.icon === i ? 'var(--primary)' : 'var(--surface-2)' }}>{i}</button>)}
              </div>
            </div>
            <RewardBuilder
              command={editing.rewardCommand || ''}
              onChange={(cmd) => setEditing((prev: any) => prev?.rewardCommand === cmd ? prev : { ...prev, rewardCommand: cmd })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Label reward FR (ex: 500 coins)" value={editing.rewardLabel} onChange={e => setEditing({ ...editing, rewardLabel: e.target.value })} className="px-3 py-2 rounded" style={inp}/>
              <input placeholder="Reward label EN (optionnel)" value={editing.rewardLabelEn || ''} onChange={e => setEditing({ ...editing, rewardLabelEn: e.target.value })} className="px-3 py-2 rounded" style={inp}/>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={editing.enabled} onChange={e => setEditing({ ...editing, enabled: e.target.checked })}/> Active
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={editing.repeatable} onChange={e => setEditing({ ...editing, repeatable: e.target.checked })}/> Répétable
              </label>
            </div>
            <label className="text-xs block" style={{ color: 'var(--text-muted)' }}>
              Expiration (optionnelle)
              <input
                type="datetime-local"
                value={editing.endsAtLocal ?? ''}
                onChange={e => setEditing({ ...editing, endsAtLocal: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded"
                style={inp}
              />
            </label>
            <div className="flex gap-2">
              <button onClick={save} className="flex-1 px-4 py-2 rounded text-white" style={{ background: 'var(--primary)' }}>💾 Sauvegarder</button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }
