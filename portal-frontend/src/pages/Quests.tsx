import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import RuneIcon from '../components/codex/RuneIcon'
import Flourish from '../components/codex/Flourish'

// ── Types ──────────────────────────────────────────────────────────────────────
type PublicQuest = {
  id: string
  title: string
  description: string
  icon: string
  color: string
  type: string
  target: string
  goal: number
  rewardLabel: string
  repeatable: boolean
  completions: number
  inProgress: number
  endsAt?: number
}

type QuestProgress = {
  questId: string
  title: string
  progress: number
  goal: number
  completed: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  BREAK_BLOCK: 'Casser',
  PLACE_BLOCK: 'Placer',
  KILL_ENTITY: 'Tuer',
  KILL_PLAYER: 'PvP',
  CRAFT_ITEM:  'Craft',
  FISH_CATCH:  'Pêche',
  PLAY_TIME:   'Temps',
}

const TYPE_RUNES: Record<string, 'flame' | 'star' | 'sun' | 'eye' | 'feather' | 'crown' | 'compass'> = {
  BREAK_BLOCK: 'flame',
  PLACE_BLOCK: 'star',
  KILL_ENTITY: 'flame',
  KILL_PLAYER: 'crown',
  CRAFT_ITEM:  'eye',
  FISH_CATCH:  'feather',
  PLAY_TIME:   'compass',
}

const TYPE_COLORS: Record<string, string> = {
  BREAK_BLOCK: '#f59e0b',
  PLACE_BLOCK: '#10b981',
  KILL_ENTITY: '#ef4444',
  KILL_PLAYER: '#dc2626',
  CRAFT_ITEM:  '#3b82f6',
  FISH_CATCH:  '#06b6d4',
  PLAY_TIME:   '#8b5cf6',
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return '00:00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(d).padStart(2,'0')}:${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function fmtTarget(target: string): string {
  if (!target || target === 'ANY') return 'Tous'
  return target.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

// ── SolarTimer ─────────────────────────────────────────────────────────────────
function SolarTimer({
  endsAt, totalMs, onExpired,
}: { endsAt: number; totalMs: number; onExpired: () => void }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= endsAt) { clearInterval(id); setTimeout(onExpired, 800) }
    }, 1000)
    return () => clearInterval(id)
  }, [endsAt, onExpired])

  const msLeft = Math.max(0, endsAt - now)
  const pct    = totalMs > 0 ? msLeft / totalMs : 0
  const urgent = msLeft < 3_600_000
  const warn   = msLeft < 86_400_000

  const r    = 14
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - pct)
  const color = urgent ? '#ef4444' : warn ? '#f59e0b' : 'var(--gold)'

  let label: string
  const totalSec = Math.floor(msLeft / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0)      label = `${d}j`
  else if (h > 0) label = `${h}h`
  else            label = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`

  return (
    <div className="relative shrink-0 flex items-center justify-center"
         title={`Expire dans ${fmtDuration(msLeft)}`}
         style={{ width: 36, height: 36 }}>
      <svg width="36" height="36" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dash}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }} />
      </svg>
      <span className="absolute font-mono font-black leading-none" style={{ fontSize: 7, color }}>
        {label}
      </span>
    </div>
  )
}

// ── QuestCard ──────────────────────────────────────────────────────────────────
function QuestCard({
  quest, progress, totalMs, onExpired,
}: {
  quest: PublicQuest
  progress: QuestProgress | null
  totalMs: number
  onExpired: (id: string) => void
}) {
  const [fading, setFading] = useState(false)
  const pct  = progress ? Math.min(100, Math.round((progress.progress / quest.goal) * 100)) : 0
  const done = progress?.completed ?? false
  const timed = quest.endsAt != null
  const msLeft = timed ? Math.max(0, quest.endsAt! - Date.now()) : null
  const urgent = msLeft !== null && msLeft < 3_600_000
  const warn   = msLeft !== null && msLeft < 86_400_000

  const handleExpired = useCallback(() => {
    setFading(true)
    setTimeout(() => onExpired(quest.id), 600)
  }, [quest.id, onExpired])

  const accentColor = done ? '#10b981' : urgent ? '#ef4444' : warn ? '#f59e0b' : quest.color
  const rune = TYPE_RUNES[quest.type] ?? 'star'

  return (
    <div
      className="codex-cartouche rounded-2xl overflow-hidden flex flex-col"
      style={{
        borderColor: done
          ? 'rgba(16,185,129,0.35)'
          : urgent
          ? 'rgba(239,68,68,0.35)'
          : warn
          ? 'rgba(251,191,36,0.2)'
          : 'rgba(240,169,59,0.14)',
        opacity: fading ? 0 : 1,
        transform: fading ? 'scale(0.95)' : 'scale(1)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}
    >
      {/* Accent top bar */}
      <div style={{
        height: 2,
        background: done
          ? 'linear-gradient(90deg,transparent,#10b981,transparent)'
          : urgent
          ? 'linear-gradient(90deg,transparent,#ef4444,transparent)'
          : warn
          ? 'linear-gradient(90deg,transparent,#f59e0b,transparent)'
          : `linear-gradient(90deg,transparent,${quest.color},transparent)`,
      }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
               style={{
                 background: `${quest.color}15`,
                 border: `1px solid ${quest.color}30`,
                 boxShadow: timed && urgent ? `0 0 12px ${quest.color}30` : 'none',
               }}>
            {quest.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm leading-tight font-codex-display" style={{ color: 'var(--ivory)' }}>{quest.title}</h3>
              {done && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold font-codex-rune"
                      style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>✓</span>
              )}
              {quest.repeatable && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-codex-rune"
                      style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>∞</span>
              )}
            </div>
            {quest.description && (
              <p className="text-xs mt-0.5 line-clamp-2 font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>
                {quest.description}
              </p>
            )}
          </div>

          {timed && msLeft !== null && msLeft > 0 && (
            <SolarTimer endsAt={quest.endsAt!} totalMs={totalMs} onExpired={handleExpired} />
          )}
          {timed && msLeft !== null && msLeft <= 0 && (
            <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold"
                 style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
              ✕
            </div>
          )}
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-codex-rune"
                style={{ background: `${TYPE_COLORS[quest.type] ?? '#6b7280'}18`, color: TYPE_COLORS[quest.type] ?? '#9ca3af' }}>
            <RuneIcon rune={rune} size={9} color={TYPE_COLORS[quest.type] ?? '#9ca3af'} />
            {TYPE_LABELS[quest.type] ?? quest.type}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-codex-body"
                style={{ background: 'rgba(240,169,59,0.07)', color: 'var(--parchment-shade)' }}>
            {fmtTarget(quest.target)}
          </span>
          {quest.rewardLabel && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-codex-display"
                  style={{ background: 'rgba(240,169,59,0.15)', color: 'var(--gold)' }}>
              ✦ {quest.rewardLabel}
            </span>
          )}
        </div>

        {/* Personal progress */}
        {progress && (
          <div>
            <div className="flex justify-between text-[10px] mb-1.5 font-codex-rune" style={{ color: 'var(--parchment-shade)' }}>
              <span>Ma progression</span>
              <span style={{ color: done ? '#10b981' : 'var(--ivory)' }}>
                {progress.progress} / {quest.goal}
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                   style={{
                     width: `${pct}%`,
                     background: done
                       ? 'linear-gradient(90deg,#10b981,#34d399)'
                       : `linear-gradient(90deg,${quest.color},${quest.color}cc)`,
                   }} />
            </div>
          </div>
        )}

        {/* Community stats */}
        <div className="flex gap-3 mt-auto pt-1">
          <div className="flex items-center gap-1.5 text-[11px] font-codex-body" style={{ color: 'var(--parchment-shade)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span>{quest.completions} complétée{quest.completions !== 1 ? 's' : ''}</span>
          </div>
          {quest.inProgress > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] font-codex-body" style={{ color: 'var(--parchment-shade)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold)' }} />
              <span>{quest.inProgress} en cours</span>
            </div>
          )}
          {(quest.completions > 0 || quest.inProgress > 0) && (
            <div className="ml-auto flex items-center gap-1">
              <div className="w-14 rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full"
                     style={{
                       width: `${Math.min(100, Math.round(quest.completions / Math.max(quest.completions + quest.inProgress, 1) * 100))}%`,
                       background: 'linear-gradient(90deg,#10b981,#34d399)',
                     }} />
              </div>
              <span className="text-[10px] font-codex-rune" style={{ color: 'var(--parchment-shade)' }}>
                {Math.round(quest.completions / Math.max(quest.completions + quest.inProgress, 1) * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
type Filter = 'all' | 'active' | 'completed' | 'timed'

export default function Quests() {
  const navigate = useNavigate()
  const [quests,   setQuests]   = useState<PublicQuest[]>([])
  const [progress, setProgress] = useState<Record<string, QuestProgress>>({})
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<Filter>('all')
  const token = getToken()

  useEffect(() => {
    const loads: Promise<void>[] = [
      fetch('/api/public/quests')
        .then(r => r.json())
        .then(d => setQuests(d.quests ?? []))
        .catch(() => {}),
    ]
    if (token) {
      loads.push(
        fetch('/api/public/quests/player/me', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => setProgress(d.progress ?? {}))
          .catch(() => {}),
      )
    }
    Promise.all(loads).finally(() => setLoading(false))
  }, [token])

  const handleExpired = useCallback((id: string) => {
    setQuests(qs => qs.filter(q => q.id !== id))
  }, [])

  const filtered = useMemo(() => {
    return quests.filter(q => {
      if (filter === 'active')    return !progress[q.id]?.completed
      if (filter === 'completed') return !!progress[q.id]?.completed
      if (filter === 'timed')     return q.endsAt != null
      return true
    })
  }, [quests, progress, filter])

  const counts = useMemo(() => ({
    all:       quests.length,
    active:    quests.filter(q => !progress[q.id]?.completed).length,
    completed: quests.filter(q => !!progress[q.id]?.completed).length,
    timed:     quests.filter(q => q.endsAt != null).length,
  }), [quests, progress])

  const globalCompletions = quests.reduce((s, q) => s + q.completions, 0)
  const globalInProgress  = quests.reduce((s, q) => s + q.inProgress,  0)

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',       label: 'Toutes' },
    { key: 'active',    label: 'En cours' },
    { key: 'completed', label: 'Terminées' },
    { key: 'timed',     label: '⏱ Limitées' },
  ]

  const FALLBACK_WINDOW = 7 * 24 * 3600 * 1000

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: '#080d19' }}>
      <PageAura theme="quests" />

      {/* Header */}
      <div className="relative overflow-hidden pt-10 pb-4 px-4 z-10">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(240,169,59,0.1),transparent)' }} />
        <div className="relative max-w-screen-sm mx-auto codex-reveal codex-reveal-1">
          <div className="flex items-center gap-3 mb-1">
            <RuneIcon rune="feather" size={22} color="var(--amber)" />
            <h1 className="text-2xl font-black font-codex-display" style={{ color: 'var(--ivory)' }}>
              Parchemins de Mission
            </h1>
          </div>
          <div className="flex items-center gap-3 ml-9 mb-4">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg,var(--amber),transparent)', maxWidth: 120 }} />
            <p className="text-xs font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>
              {quests.length} quête{quests.length !== 1 ? 's' : ''} disponible{quests.length !== 1 ? 's' : ''}
              {token && counts.completed > 0 && (
                <span className="ml-2 text-green-400">· {counts.completed} accomplie{counts.completed !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>

          {/* Community progress */}
          {(globalCompletions > 0 || globalInProgress > 0) && (
            <div className="codex-cartouche rounded-xl p-3 codex-reveal codex-reveal-2">
              <div className="flex justify-between text-[11px] mb-2 font-codex-body" style={{ color: 'var(--parchment-shade)' }}>
                <span>Progression de la communauté</span>
                <span className="text-green-400 font-codex-display">{globalCompletions} complétion{globalCompletions !== 1 ? 's' : ''}</span>
              </div>
              <div className="rounded-full overflow-hidden flex" style={{ height: 6, background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full transition-all duration-700"
                     style={{
                       width: `${Math.round(globalCompletions / Math.max(globalCompletions + globalInProgress, 1) * 100)}%`,
                       background: 'linear-gradient(90deg,#10b981,#34d399)',
                     }} />
                <div className="h-full"
                     style={{
                       width: `${Math.round(globalInProgress / Math.max(globalCompletions + globalInProgress, 1) * 100)}%`,
                       background: 'rgba(240,169,59,0.4)',
                     }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Flourish separator */}
      <div className="flex justify-center mb-3 z-10 relative">
        <Flourish variant="double" color="rgba(240,169,59,0.25)" width={200} />
      </div>

      {/* Filters */}
      <div className="px-4 max-w-screen-sm mx-auto mb-4 relative z-10 codex-reveal codex-reveal-2">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all font-codex-display"
              style={{
                background: filter === f.key ? 'rgba(240,169,59,0.18)' : 'rgba(15,22,40,0.6)',
                border: `1px solid ${filter === f.key ? 'rgba(240,169,59,0.5)' : 'rgba(240,169,59,0.1)'}`,
                color: filter === f.key ? 'var(--gold)' : 'var(--parchment-shade)',
              }}>
              {f.label}
              <span className="ml-1.5 opacity-60 font-codex-rune">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 max-w-screen-sm mx-auto relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--parchment-shade)' }}>
            <div className="w-8 h-8 rounded-full border-2 animate-spin mb-3"
                 style={{ borderColor: 'rgba(240,169,59,0.2)', borderTopColor: 'var(--amber)' }} />
            <p className="text-sm font-codex-lyric italic">Lecture des parchemins…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--parchment-shade)' }}>
            <RuneIcon rune="feather" size={36} color="rgba(240,169,59,0.25)" className="mb-3" />
            <p className="text-sm font-codex-lyric italic">Nul parchemin dans cette catégorie.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((q, i) => (
              <div key={q.id} className="codex-reveal" style={{ animationDelay: `${i * 60}ms` }}>
                <QuestCard
                  quest={q}
                  progress={progress[q.id] ?? null}
                  totalMs={FALLBACK_WINDOW}
                  onExpired={handleExpired}
                />
              </div>
            ))}
          </div>
        )}

        {!token && (
          <div className="codex-cartouche mt-6 rounded-xl p-4 text-center codex-reveal codex-reveal-4">
            <p className="text-sm font-codex-lyric italic" style={{ color: 'var(--gold)' }}>
              <button onClick={() => navigate('/login')} className="font-semibold codex-underline" style={{ color: 'var(--gold)' }}>
                Connecte-toi
              </button>
              {' '}pour voir ta progression sur chaque parchemin.
            </p>
          </div>
        )}
      </div>

      <Navbar />
    </div>
  )
}
