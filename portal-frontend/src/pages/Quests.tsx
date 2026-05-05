import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'

const GLASS  = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'

type PublicQuest = {
  id: string; title: string; description: string; icon: string; color: string
  type: string; target: string; goal: number; rewardLabel: string
  repeatable: boolean; completions: number; inProgress: number; endsAt?: number
}
type QuestProgress = { questId: string; title: string; progress: number; goal: number; completed: boolean }

const TYPE_LABELS: Record<string, string> = {
  BREAK_BLOCK: 'Casser', PLACE_BLOCK: 'Placer', KILL_ENTITY: 'Tuer',
  KILL_PLAYER: 'PvP', CRAFT_ITEM: 'Craft', FISH_CATCH: 'Pêche', PLAY_TIME: 'Temps',
}
const TYPE_COLORS: Record<string, string> = {
  BREAK_BLOCK: '#f59e0b', PLACE_BLOCK: '#10b981', KILL_ENTITY: '#ef4444',
  KILL_PLAYER: '#dc2626', CRAFT_ITEM: '#3b82f6', FISH_CATCH: '#06b6d4', PLAY_TIME: '#8b5cf6',
}

function fmtTarget(t: string) {
  if (!t || t === 'ANY') return 'Tous'
  return t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${String(d).padStart(2,'0')}:${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function QuestTimer({ endsAt, totalMs, onExpired }: { endsAt: number; totalMs: number; onExpired: () => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now(); setNow(t)
      if (t >= endsAt) { clearInterval(id); setTimeout(onExpired, 800) }
    }, 1000)
    return () => clearInterval(id)
  }, [endsAt, onExpired])

  const msLeft = Math.max(0, endsAt - now)
  const pct    = totalMs > 0 ? msLeft / totalMs : 0
  const urgent = msLeft < 3_600_000
  const warn   = msLeft < 86_400_000
  const color  = urgent ? '#ef4444' : warn ? '#f59e0b' : '#fbbf24'
  const r = 14, circ = 2 * Math.PI * r

  let label: string
  const totalSec = Math.floor(msLeft / 1000)
  const d = Math.floor(totalSec / 86400), h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60
  if (d > 0) label = `${d}j`
  else if (h > 0) label = `${h}h`
  else label = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`

  return (
    <div className="relative shrink-0 flex items-center justify-center" title={`Expire dans ${fmtDuration(msLeft)}`}
         style={{ width: 36, height: 36 }}>
      <svg width="36" height="36" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }} />
      </svg>
      <span className="absolute font-mono font-black" style={{ fontSize: 7, color }}>{label}</span>
    </div>
  )
}

function QuestCard({ quest, progress, totalMs, onExpired }: {
  quest: PublicQuest; progress: QuestProgress | null; totalMs: number; onExpired: (id: string) => void
}) {
  const [fading, setFading] = useState(false)
  const pct    = progress ? Math.min(100, Math.round((progress.progress / quest.goal) * 100)) : 0
  const done   = progress?.completed ?? false
  const timed  = quest.endsAt != null
  const msLeft = timed ? Math.max(0, quest.endsAt! - Date.now()) : null
  const urgent = msLeft !== null && msLeft < 3_600_000
  const warn   = msLeft !== null && msLeft < 86_400_000

  const handleExpired = useCallback(() => {
    setFading(true); setTimeout(() => onExpired(quest.id), 600)
  }, [quest.id, onExpired])

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{
           background: urgent ? 'rgba(239,68,68,0.05)' : GLASS,
           border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : urgent ? 'rgba(239,68,68,0.3)' : warn ? 'rgba(251,191,36,0.18)' : BORDER}`,
           backdropFilter: 'blur(12px)',
           opacity: fading ? 0 : 1,
           transform: fading ? 'scale(0.95)' : 'scale(1)',
           transition: 'opacity 0.6s, transform 0.6s',
         }}>
      {/* Accent bar */}
      <div style={{
        height: 2,
        background: done ? '#10b981' : urgent ? '#ef4444' : warn ? '#f59e0b' : quest.color,
      }} />
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
               style={{ background: `${quest.color}15`, border: `1px solid ${quest.color}28` }}>
            {quest.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm" style={{ color: TEXT }}>{quest.title}</h3>
              {done && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>✓ Terminée</span>}
              {quest.repeatable && <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                         style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>🔁</span>}
            </div>
            {quest.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: MUTED }}>{quest.description}</p>}
          </div>
          {timed && msLeft !== null && msLeft > 0 && (
            <QuestTimer endsAt={quest.endsAt!} totalMs={totalMs} onExpired={handleExpired} />
          )}
          {timed && msLeft !== null && msLeft <= 0 && (
            <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                 style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: 11, fontWeight: 700 }}>
              ✕
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${TYPE_COLORS[quest.type] ?? '#6b7280'}18`, color: TYPE_COLORS[quest.type] ?? '#9ca3af' }}>
            {TYPE_LABELS[quest.type] ?? quest.type}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: MUTED }}>
            {fmtTarget(quest.target)}
          </span>
          {quest.rewardLabel && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
              🎁 {quest.rewardLabel}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {progress && (
          <div>
            <div className="flex justify-between text-[10px] mb-1.5" style={{ color: MUTED }}>
              <span>Ma progression</span>
              <span style={{ color: done ? '#10b981' : TEXT }}>{progress.progress} / {quest.goal}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                   style={{
                     width: `${pct}%`,
                     background: done ? 'linear-gradient(90deg,#10b981,#34d399)' : `linear-gradient(90deg,${quest.color},${quest.color}cc)`,
                   }} />
            </div>
          </div>
        )}

        {/* Community */}
        {(quest.completions > 0 || quest.inProgress > 0) && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              {quest.completions} complétée{quest.completions !== 1 ? 's' : ''}
            </span>
            {quest.inProgress > 0 && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                {quest.inProgress} en cours
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <div className="w-14 rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full"
                     style={{
                       width: `${Math.min(100, Math.round(quest.completions / Math.max(quest.completions + quest.inProgress, 1) * 100))}%`,
                       background: 'linear-gradient(90deg,#10b981,#34d399)',
                     }} />
              </div>
              <span className="text-[10px]" style={{ color: MUTED }}>
                {Math.round(quest.completions / Math.max(quest.completions + quest.inProgress, 1) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
      fetch('/api/public/quests').then(r => r.json()).then(d => setQuests(d.quests ?? [])).catch(() => {}),
    ]
    if (token) {
      loads.push(
        fetch('/api/public/quests/player/me', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(d => setProgress(d.progress ?? {})).catch(() => {}),
      )
    }
    Promise.all(loads).finally(() => setLoading(false))
  }, [token])

  const handleExpired = useCallback((id: string) => setQuests(qs => qs.filter(q => q.id !== id)), [])

  const counts = useMemo(() => ({
    all:       quests.length,
    active:    quests.filter(q => !progress[q.id]?.completed).length,
    completed: quests.filter(q => !!progress[q.id]?.completed).length,
    timed:     quests.filter(q => q.endsAt != null).length,
  }), [quests, progress])

  const filtered = useMemo(() => quests.filter(q => {
    if (filter === 'active')    return !progress[q.id]?.completed
    if (filter === 'completed') return !!progress[q.id]?.completed
    if (filter === 'timed')     return q.endsAt != null
    return true
  }), [quests, progress, filter])

  const globalComp = quests.reduce((s, q) => s + q.completions, 0)
  const globalInPr = quests.reduce((s, q) => s + q.inProgress,  0)

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Toutes' }, { key: 'active', label: 'En cours' },
    { key: 'completed', label: 'Terminées' }, { key: 'timed', label: '⏱ Limitées' },
  ]

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080d19' }}>
      <PageAura theme="quests" />

      {/* Header */}
      <div className="relative z-10 px-4 pt-12 pb-4 max-w-screen-sm mx-auto">
        <h1 className="text-xl font-bold mb-1" style={{ color: TEXT }}>Quêtes</h1>
        <p className="text-sm mb-5" style={{ color: MUTED }}>
          {quests.length} quête{quests.length !== 1 ? 's' : ''}
          {token && counts.completed > 0 && (
            <span className="ml-2 text-emerald-400">· {counts.completed} terminée{counts.completed !== 1 ? 's' : ''}</span>
          )}
        </p>

        {/* Community progress */}
        {(globalComp > 0 || globalInPr > 0) && (
          <div className="rounded-xl p-3 mb-5" style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
            <div className="flex justify-between text-[11px] mb-2" style={{ color: MUTED }}>
              <span>Progression communautaire</span>
              <span className="text-emerald-400">{globalComp} complétion{globalComp !== 1 ? 's' : ''}</span>
            </div>
            <div className="rounded-full overflow-hidden flex" style={{ height: 6, background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full transition-all duration-700"
                   style={{ width: `${Math.round(globalComp / Math.max(globalComp + globalInPr, 1) * 100)}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
              <div className="h-full"
                   style={{ width: `${Math.round(globalInPr / Math.max(globalComp + globalInPr, 1) * 100)}%`, background: 'rgba(251,191,36,0.4)' }} />
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mb-4">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: filter === f.key ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filter === f.key ? 'rgba(251,191,36,0.4)' : BORDER}`,
                color: filter === f.key ? '#fbbf24' : MUTED,
              }}>
              {f.label} <span className="ml-1 opacity-60">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: MUTED }}>
            <div className="w-7 h-7 rounded-full border-2 animate-spin mb-3"
                 style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: '#f59e0b' }} />
            <p className="text-sm">Chargement des quêtes…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: MUTED }}>
            <span className="text-4xl mb-3">📭</span>
            <p className="text-sm">Aucune quête dans cette catégorie.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(q => (
              <QuestCard key={q.id} quest={q} progress={progress[q.id] ?? null}
                         totalMs={7 * 24 * 3600 * 1000} onExpired={handleExpired} />
            ))}
          </div>
        )}

        {!token && (
          <div className="mt-5 rounded-xl p-4 text-center text-sm"
               style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', color: '#fbbf24' }}>
            <button onClick={() => navigate('/login')} className="font-semibold underline">Connecte-toi</button>
            {' '}pour voir ta progression personnelle.
          </div>
        )}
      </div>

      <Navbar />
    </div>
  )
}
