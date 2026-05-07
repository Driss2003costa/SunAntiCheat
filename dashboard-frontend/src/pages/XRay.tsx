import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

// ── Types ────────────────────────────────────────────────────────────────────
type Level = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NEGLIGIBLE' | 'INSUFFICIENT'

type PlayerRow = {
  uuid: string; playerName: string; totalBlocks: number;
  diamond: number; iron: number; gold: number; ancientDebris: number; emerald: number
  valuablePercent: number; diamondPer1k: number;
  score: number; level: Level;
  regionId: string; regionName: string; regionEmoji: string;
  lastEventAt: number; reviewed: boolean; online: boolean;
}

type Detail = {
  uuid: string; playerName: string; online: boolean;
  position?: { world: string; x: number; y: number; z: number }; gamemode?: string;
  createdAt: number; lastEventAt: number;
  reviewed: boolean; reviewedAt: number; reviewedBy: string;
  totalBlocks: number; totalCommon: number; totalValuable: number;
  score: number; level: Level;
  oreCounts: Record<string, number>;
  dominantRegion: {
    id: string; displayName: string; emoji: string; share: number;
    expectedValuablePercent: number; expectedDiamondPer1k: number; tolerance: number
  }
  scoreComponents: { id: string; label: string; value: number; maxScore: number; score: number; detail: string }[]
  byY:      { y: number; diamond: number; iron: number; gold: number; ancientDebris: number; emerald: number; common: number }[]
  byWorld:  { world: string;  diamond: number; iron: number; gold: number; ancientDebris: number; common: number }[]
  byRegion: { regionId: string; displayName: string; emoji: string; diamond: number; iron: number; gold: number; ancientDebris: number; common: number }[]
  hourly:   { hour: number; diamond: number; iron: number; gold: number; ancientDebris: number; common: number }[]
  daily:    { day: number;  diamond: number; iron: number; gold: number; ancientDebris: number; common: number }[]
  recentVeins: { timestamp: number; oreType: string; world: string; region: string; x: number; y: number; z: number }[]
}

// ── Couleurs / styles ────────────────────────────────────────────────────────
const ORE_COLORS: Record<string, string> = {
  diamond:       '#5eead4',
  iron:          '#cbd5e1',
  gold:          '#facc15',
  ancientDebris: '#ef4444',
  emerald:       '#10b981',
  lapis:         '#3b82f6',
  redstone:      '#dc2626',
  copper:        '#f97316',
  coal:          '#1f2937',
  common:        'rgba(148, 163, 184, 0.35)',
}
const LEVEL_COLORS: Record<Level, string> = {
  VERY_HIGH:    '#dc2626',
  HIGH:         '#ef4444',
  MEDIUM:       '#f59e0b',
  LOW:          '#10b981',
  NEGLIGIBLE:   '#3b82f6',
  INSUFFICIENT: '#64748b',
}
const LEVEL_LABEL: Record<Level, string> = {
  VERY_HIGH:    'TRÈS ÉLEVÉ',
  HIGH:         'ÉLEVÉ',
  MEDIUM:       'MOYEN',
  LOW:          'FAIBLE',
  NEGLIGIBLE:   'NÉGLIGEABLE',
  INSUFFICIENT: 'INSUFFISANT',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(ts: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtHour(ts: number) {
  return new Date(ts).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDay(ts: number) {
  return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit' })
}
function fmtAgo(ts: number) {
  if (!ts) return '—'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `il y a ${s}s`
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`
  return `il y a ${Math.floor(s / 86400)}j`
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function XRay() {
  const { isAdmin, canEdit } = usePermission()

  const [overview, setOverview] = useState<any>(null)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<Level | 'ALL'>('ALL')
  const [regionFilter, setRegionFilter] = useState<string>('ALL')
  const [hideReviewed, setHideReviewed] = useState(false)

  const refresh = async () => {
    try {
      const [ov, pl] = await Promise.all([api.xrayOverview(), api.xrayPlayers()])
      setOverview(ov)
      setPlayers(pl)
      // Auto-select le plus suspect au premier chargement
      if (!selected && pl.length > 0) setSelected(pl[0].playerName)
    } catch (e: any) {
      console.error('XRay refresh error', e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 15_000)
    return () => clearInterval(t)
  }, [])

  // Charger le détail du joueur sélectionné
  useEffect(() => {
    if (!selected) { setDetail(null); return }
    let cancelled = false
    api.xrayPlayer(selected).then(d => { if (!cancelled) setDetail(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [selected, players.length])

  const filtered = useMemo(() => {
    return players.filter(p => {
      if (search && !p.playerName?.toLowerCase().includes(search.toLowerCase())) return false
      if (levelFilter !== 'ALL' && p.level !== levelFilter) return false
      if (regionFilter !== 'ALL' && p.regionId !== regionFilter) return false
      if (hideReviewed && p.reviewed) return false
      return true
    })
  }, [players, search, levelFilter, regionFilter, hideReviewed])

  const onResetPlayer = async (name: string) => {
    if (!confirm(`Réinitialiser TOUTES les données X-Ray de ${name} ?`)) return
    try {
      await api.xrayResetPlayer(name)
      if (selected === name) setSelected(null)
      refresh()
    } catch (e: any) { alert('Erreur : ' + e.message) }
  }

  const onClearPlayer = async (name: string) => {
    try {
      await api.xrayClearPlayer(name)
      refresh()
    } catch (e: any) { alert('Erreur : ' + e.message) }
  }

  const onTeleport = async (target: Detail) => {
    if (!target.online) { alert('Joueur hors-ligne'); return }
    try { await api.runCommand(`tp @s ${target.playerName}`) }
    catch (e: any) { alert('Erreur TP : ' + e.message) }
  }

  if (loading) {
    return <div className="p-6" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Colonne gauche : liste joueurs ────────────────────────────────── */}
      <aside className="w-[360px] shrink-0 flex flex-col overflow-hidden"
             style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        {/* En-tête */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⛏️</span>
            <h1 className="text-base font-bold" style={{ color: 'var(--text)' }}>Anti X-Ray</h1>
            <span className="ml-auto text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {players.length}
            </span>
          </div>

          {overview && (
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              <Tile label="Très élevé" n={overview.levels.VERY_HIGH ?? 0} color={LEVEL_COLORS.VERY_HIGH}/>
              <Tile label="Élevé"      n={overview.levels.HIGH ?? 0}      color={LEVEL_COLORS.HIGH}/>
              <Tile label="Moyen"      n={overview.levels.MEDIUM ?? 0}    color={LEVEL_COLORS.MEDIUM}/>
            </div>
          )}

          <input placeholder="🔎 Rechercher un joueur"
                 value={search} onChange={e => setSearch(e.target.value)}
                 className="w-full px-3 py-2 rounded text-sm mb-2"
                 style={inputStyle}/>

          <div className="flex gap-1.5 mb-2">
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value as any)}
                    className="flex-1 px-2 py-1.5 rounded text-xs" style={inputStyle}>
              <option value="ALL">Tous les niveaux</option>
              <option value="VERY_HIGH">Très élevé</option>
              <option value="HIGH">Élevé</option>
              <option value="MEDIUM">Moyen</option>
              <option value="LOW">Faible</option>
              <option value="NEGLIGIBLE">Négligeable</option>
              <option value="INSUFFICIENT">Insuffisant</option>
            </select>
            <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded text-xs" style={inputStyle}>
              <option value="ALL">Toutes régions</option>
              {overview?.regions?.map((r: any) => (
                <option key={r.id} value={r.id}>{r.emoji} {r.displayName}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer"
                 style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={hideReviewed}
                   onChange={e => setHideReviewed(e.target.checked)}/>
            Masquer les joueurs blanchis
          </label>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
              Aucun joueur correspondant
            </div>
          )}
          {filtered.map(p => (
            <button key={p.uuid}
                    onClick={() => setSelected(p.playerName)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: selected === p.playerName ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : undefined,
                      borderLeft: `3px solid ${LEVEL_COLORS[p.level]}`,
                    }}>
              <Avatar name={p.playerName}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{p.playerName}</span>
                  {p.online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"/>}
                  {p.reviewed && <span title="Blanchi" className="text-xs">✅</span>}
                </div>
                <div className="text-xs flex items-center gap-1.5 mt-0.5"
                     style={{ color: 'var(--text-muted)' }}>
                  <span>{p.regionEmoji}</span>
                  <span className="truncate">{p.regionName}</span>
                  <span>·</span>
                  <span>{p.totalBlocks.toLocaleString('fr-FR')} blocs</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-bold tabular-nums" style={{ color: LEVEL_COLORS[p.level] }}>
                  {p.score}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider"
                     style={{ color: LEVEL_COLORS[p.level] }}>
                  {LEVEL_LABEL[p.level]}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Colonne droite : analyse détaillée ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        {!detail && (
          <div className="flex items-center justify-center h-full text-center p-12">
            <div>
              <div className="text-5xl mb-3">🔍</div>
              <div className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>
                Sélectionnez un joueur
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Analyse par couche Y, par monde, par région — veines, beeline, déviation vs baseline.
              </div>
            </div>
          </div>
        )}
        {detail && (
          <PlayerDetail detail={detail}
                        onResetPlayer={() => onResetPlayer(detail.playerName)}
                        onClearPlayer={() => onClearPlayer(detail.playerName)}
                        onTeleport={() => onTeleport(detail)}
                        canEdit={canEdit}
                        isAdmin={isAdmin}/>
        )}
      </div>
    </div>
  )
}

// ── Composant détail joueur ──────────────────────────────────────────────────
function PlayerDetail({ detail, onResetPlayer, onClearPlayer, onTeleport, canEdit, isAdmin }: {
  detail: Detail
  onResetPlayer: () => void
  onClearPlayer: () => void
  onTeleport: () => void
  canEdit: boolean
  isAdmin: boolean
}) {
  const oreDonut = useMemo(() => {
    return Object.entries(detail.oreCounts)
      .filter(([k, v]) => v > 0 && k !== 'common' && k !== 'netherrack')
      .map(([key, value]) => ({ name: key, value, fill: ORE_COLORS[key] || '#888' }))
  }, [detail])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-5">
        <Avatar name={detail.playerName} size={64}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{detail.playerName}</h2>
            {detail.online ? (
              <span className="text-xs px-2 py-0.5 rounded font-semibold flex items-center gap-1.5"
                    style={{ background: '#10b98120', color: '#10b981' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>en ligne
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>hors-ligne</span>
            )}
            {detail.reviewed && (
              <span className="text-xs px-2 py-0.5 rounded font-semibold"
                    style={{ background: '#10b98120', color: '#10b981' }}>
                ✅ Blanchi par {detail.reviewedBy}
              </span>
            )}
          </div>
          <div className="mt-1 text-sm flex items-center gap-3 flex-wrap" style={{ color: 'var(--text-muted)' }}>
            <span>{detail.dominantRegion.emoji} {detail.dominantRegion.displayName}</span>
            <span>·</span>
            <span>{detail.totalBlocks.toLocaleString('fr-FR')} blocs suivis</span>
            <span>·</span>
            <span>Dernier minage : {fmtAgo(detail.lastEventAt)}</span>
            {detail.position && (
              <>
                <span>·</span>
                <span className="font-mono text-xs">
                  {detail.position.world} {detail.position.x},{detail.position.y},{detail.position.z}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {detail.online && canEdit && (
            <button onClick={onTeleport}
                    className="px-3 py-1.5 rounded text-xs font-semibold text-white transition hover:opacity-90"
                    style={{ background: 'var(--primary)' }}>
              ✈ Téléporter
            </button>
          )}
          {canEdit && !detail.reviewed && (
            <button onClick={onClearPlayer}
                    className="px-3 py-1.5 rounded text-xs font-semibold transition"
                    style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98140' }}>
              ✅ Marquer blanchi
            </button>
          )}
          {isAdmin && (
            <button onClick={onResetPlayer}
                    className="px-3 py-1.5 rounded text-xs font-semibold transition"
                    style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
              🗑 Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* KPI : score + breakdown */}
      <div className="grid grid-cols-12 gap-4">
        {/* Score gauge */}
        <div className="col-span-4 rounded-xl p-5 flex flex-col items-center justify-center"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg className="absolute inset-0" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none"
                      stroke="var(--surface-2)" strokeWidth="10"/>
              <circle cx="50" cy="50" r="40" fill="none"
                      stroke={LEVEL_COLORS[detail.level]} strokeWidth="10"
                      strokeDasharray={`${(detail.score / 100) * 251.2} 251.2`}
                      strokeDashoffset="0" strokeLinecap="round"
                      transform="rotate(-90 50 50)"/>
            </svg>
            <div className="text-center z-10">
              <div className="text-5xl font-extrabold tabular-nums"
                   style={{ color: LEVEL_COLORS[detail.level] }}>{detail.score}</div>
              <div className="text-xs font-semibold uppercase tracking-widest mt-1"
                   style={{ color: LEVEL_COLORS[detail.level] }}>
                {LEVEL_LABEL[detail.level]}
              </div>
            </div>
          </div>
          <div className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
            Score de suspicion (0–100) — calculé selon la baseline régionale
          </div>
        </div>

        {/* Components */}
        <div className="col-span-8 rounded-xl p-5"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
            Décomposition du score
          </h3>
          <div className="space-y-3">
            {detail.scoreComponents.map(c => {
              const pct = c.maxScore === 0 ? 0 : (c.score / c.maxScore) * 100
              return (
                <div key={c.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span style={{ color: 'var(--text)' }}>{c.label}</span>
                    <span className="tabular-nums font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.score.toFixed(1)} / {c.maxScore} pts
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mt-1"
                       style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full transition-all"
                         style={{
                           width: `${pct}%`,
                           background: pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#10b981',
                         }}/>
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{c.detail}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bloc région : déviation vs attendue */}
      <div className="rounded-xl p-5 grid grid-cols-3 gap-6"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Région dominante
          </div>
          <div className="text-2xl">{detail.dominantRegion.emoji}</div>
          <div className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            {detail.dominantRegion.displayName}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {detail.dominantRegion.share.toFixed(0)}% des minages dans cette région
          </div>
        </div>
        <DeltaBlock
          label="% minerais précieux"
          actual={detail.totalBlocks === 0 ? 0 : (detail.totalValuable / detail.totalBlocks) * 100}
          expected={detail.dominantRegion.expectedValuablePercent}
          tolerance={detail.dominantRegion.tolerance}
          unit="%"
        />
        <DeltaBlock
          label="Diamants pour 1000 communs"
          actual={detail.totalCommon === 0 ? 0 : 1000 * (detail.oreCounts.diamond ?? 0) / detail.totalCommon}
          expected={detail.dominantRegion.expectedDiamondPer1k}
          tolerance={detail.dominantRegion.tolerance}
          unit=""
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <ChartCard title="Diamants par couche Y" subtitle="Vanilla : densité maximale Y=−59 ; tout au-dessus de 16 = suspect">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={detail.byY} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="y" stroke="var(--text-muted)" fontSize={10} interval={Math.max(0, Math.floor(detail.byY.length / 12))}/>
              <YAxis stroke="var(--text-muted)" fontSize={10}/>
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}/>
              <Bar dataKey="diamond"       stackId="a" fill={ORE_COLORS.diamond}/>
              <Bar dataKey="iron"          stackId="a" fill={ORE_COLORS.iron}/>
              <Bar dataKey="gold"          stackId="a" fill={ORE_COLORS.gold}/>
              <Bar dataKey="ancientDebris" stackId="a" fill={ORE_COLORS.ancientDebris}/>
              <Bar dataKey="emerald"       stackId="a" fill={ORE_COLORS.emerald}/>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribution des minerais" subtitle="Hors blocs communs">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={oreDonut} dataKey="value" nameKey="name"
                   cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3}>
                {oreDonut.map((entry, i) => (
                  <Cell key={i} fill={entry.fill}/>
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Activité — dernières 24h" subtitle="Empilé par minerai (par heure)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={detail.hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={10} tickFormatter={fmtHour}/>
              <YAxis stroke="var(--text-muted)" fontSize={10}/>
              <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtHour}/>
              <Area type="monotone" dataKey="common"        stackId="a" stroke={ORE_COLORS.common}        fill={ORE_COLORS.common}/>
              <Area type="monotone" dataKey="iron"          stackId="a" stroke={ORE_COLORS.iron}          fill={ORE_COLORS.iron}/>
              <Area type="monotone" dataKey="gold"          stackId="a" stroke={ORE_COLORS.gold}          fill={ORE_COLORS.gold}/>
              <Area type="monotone" dataKey="ancientDebris" stackId="a" stroke={ORE_COLORS.ancientDebris} fill={ORE_COLORS.ancientDebris}/>
              <Area type="monotone" dataKey="diamond"       stackId="a" stroke={ORE_COLORS.diamond}       fill={ORE_COLORS.diamond}/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Activité — 14 derniers jours" subtitle="Diamants seuls : pic = potentielle session de farm/X-Ray">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={detail.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} tickFormatter={fmtDay}/>
              <YAxis stroke="var(--text-muted)" fontSize={10}/>
              <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtDay}/>
              <Bar dataKey="diamond"       fill={ORE_COLORS.diamond}/>
              <Bar dataKey="ancientDebris" fill={ORE_COLORS.ancientDebris}/>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Répartition par monde" subtitle="Multivers — détecte les transferts">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={detail.byWorld} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis type="number" stroke="var(--text-muted)" fontSize={10}/>
              <YAxis dataKey="world" type="category" stroke="var(--text-muted)" fontSize={10} width={100}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Bar dataKey="diamond"       stackId="a" fill={ORE_COLORS.diamond}/>
              <Bar dataKey="iron"          stackId="a" fill={ORE_COLORS.iron}/>
              <Bar dataKey="gold"          stackId="a" fill={ORE_COLORS.gold}/>
              <Bar dataKey="ancientDebris" stackId="a" fill={ORE_COLORS.ancientDebris}/>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Répartition par région (pays)" subtitle="Comparaison entre territoires">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={detail.byRegion}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="displayName" stroke="var(--text-muted)" fontSize={10}/>
              <YAxis stroke="var(--text-muted)" fontSize={10}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar dataKey="diamond"       fill={ORE_COLORS.diamond}/>
              <Bar dataKey="iron"          fill={ORE_COLORS.iron}/>
              <Bar dataKey="gold"          fill={ORE_COLORS.gold}/>
              <Bar dataKey="ancientDebris" fill={ORE_COLORS.ancientDebris}/>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Recent veins */}
      <div className="rounded-xl p-5"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Veines récentes ({detail.recentVeins.length})
          </h3>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Distance moyenne entre veines = indicateur beeline
          </div>
        </div>
        {detail.recentVeins.length === 0 && (
          <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Aucune veine de minerai précieux enregistrée
          </div>
        )}
        {detail.recentVeins.length > 0 && (
          <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
            {detail.recentVeins.map((v, i) => {
              const prev = detail.recentVeins[i + 1]
              const dist = prev && prev.world === v.world
                ? Math.sqrt(Math.pow(v.x - prev.x, 2) + Math.pow(v.y - prev.y, 2) + Math.pow(v.z - prev.z, 2))
                : null
              const beeline = dist !== null && dist < 8
              return (
                <div key={i} className="flex items-center gap-3 p-2 rounded text-sm"
                     style={{ background: 'var(--surface-2)', borderLeft: `3px solid ${ORE_COLORS[v.oreType.toLowerCase().replace('_d', 'D')] || ORE_COLORS.diamond}` }}>
                  <OreIcon type={v.oreType}/>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium" style={{ color: 'var(--text)' }}>
                      {v.oreType.replace('_', ' ')}
                    </div>
                    <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <span className="font-mono">{v.world} {v.x},{v.y},{v.z}</span>
                      <span>·</span>
                      <span>{fmtDate(v.timestamp)}</span>
                    </div>
                  </div>
                  {dist !== null && (
                    <span className="text-xs font-mono shrink-0"
                          style={{ color: beeline ? '#ef4444' : 'var(--text-muted)' }}>
                      Δ {dist.toFixed(0)}b
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Composants utilitaires ───────────────────────────────────────────────────
function Tile({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div className="rounded-lg p-2 text-center"
         style={{ background: 'var(--surface-2)', border: `1px solid ${color}30` }}>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>{n}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider"
           style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const url = `https://crafatar.com/avatars/${encodeURIComponent(name || 'Steve')}?size=${size * 2}&overlay`
  return (
    <img src={url} alt={name}
         width={size} height={size}
         onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
         className="rounded-md shrink-0"
         style={{ background: 'var(--surface-2)', imageRendering: 'pixelated' }}/>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="mb-2">
        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</div>
        {subtitle && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function DeltaBlock({ label, actual, expected, tolerance, unit }:
                    { label: string; actual: number; expected: number; tolerance: number; unit: string }) {
  const safeExpected = Math.max(0.5, expected)
  const dev = (actual - expected) / safeExpected
  const ratio = dev / Math.max(0.05, tolerance)
  const color = ratio >= 1 ? '#ef4444' : ratio >= 0.5 ? '#f59e0b' : '#10b981'
  const arrow = dev > 0.05 ? '↑' : dev < -0.05 ? '↓' : '≈'
  return (
    <div>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold tabular-nums" style={{ color }}>
          {actual.toFixed(2)}{unit}
        </div>
        <div className="text-xs" style={{ color }}>{arrow} {(dev * 100).toFixed(0)}%</div>
      </div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        attendu : {expected.toFixed(2)}{unit} (tolérance ×{tolerance})
      </div>
    </div>
  )
}

function OreIcon({ type }: { type: string }) {
  const c = ORE_COLORS[type.toLowerCase().replace('_d', 'D')] || ORE_COLORS.diamond
  return (
    <div className="w-6 h-6 rounded shrink-0 flex items-center justify-center text-xs font-bold"
         style={{ background: c + '30', color: c, border: `1px solid ${c}60` }}>
      {type[0]}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}

const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 12,
  color: 'var(--text)',
}
