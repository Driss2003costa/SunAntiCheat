import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken } from '../api/client'
import Navbar from '../components/Navbar'

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
  BREAK_BLOCK:  'Casser',
  PLACE_BLOCK:  'Placer',
  KILL_ENTITY:  'Tuer',
  KILL_PLAYER:  'PvP',
  CRAFT_ITEM:   'Craft',
  FISH_CATCH:   'Pêche',
  PLAY_TIME:    'Temps',
}

const TYPE_COLORS: Record<string, string> = {
  BREAK_BLOCK:  '#f59e0b',
  PLACE_BLOCK:  '#10b981',
  KILL_ENTITY:  '#ef4444',
  KILL_PLAYER:  '#dc2626',
  CRAFT_ITEM:   '#3b82f6',
  FISH_CATCH:   '#06b6d4',
  PLAY_TIME:    '#8b5cf6',
}

function fmtRemaining(endsAt: number): string {
  const ms = endsAt - Date.now()
  if (ms <= 0) return 'Expirée'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}j ${h % 24}h`
}

function fmtTarget(target: string): string {
  if (!target || target === 'ANY') return 'Tous'
  return target.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
}

// ── QuestCard ──────────────────────────────────────────────────────────────────
function QuestCard({
  quest,
  progress,
  now,
}: {
  quest: PublicQuest
  progress: QuestProgress | null
  now: number
}) {
  const pct    = progress ? Math.min(100, Math.round((progress.progress / quest.goal) * 100)) : 0
  const done   = progress?.completed ?? false
  const expired = quest.endsAt != null && now > quest.endsAt
  const timed  = quest.endsAt != null
  const msLeft = timed ? quest.endsAt! - now : null
  const urgent = msLeft != null && msLeft < 3600_000 && msLeft > 0

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: '#0f172a',
        border: `1px solid ${done ? 'rgba(16,185,129,0.4)' : expired ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`,
        opacity: expired ? 0.6 : 1,
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: done ? '#10b981' : expired ? '#ef4444' : quest.color }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: `${quest.color}22`, border: `1px solid ${quest.color}44` }}
          >
            {quest.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm text-white leading-tight">{quest.title}</h3>
              {done && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
                  ✓ Terminée
                </span>
              )}
              {quest.repeatable && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
                  🔁
                </span>
              )}
            </div>
            {quest.description && (
              <p className="text-xs mt-0.5 text-gray-400 line-clamp-2">{quest.description}</p>
            )}
          </div>
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${TYPE_COLORS[quest.type] ?? '#6b7280'}22`, color: TYPE_COLORS[quest.type] ?? '#9ca3af' }}>
            {TYPE_LABELS[quest.type] ?? quest.type}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
            {fmtTarget(quest.target)}
          </span>
          {quest.rewardLabel && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
              🎁 {quest.rewardLabel}
            </span>
          )}
        </div>

        {/* Personal progress bar */}
        {progress && (
          <div>
            <div className="flex justify-between text-[10px] mb-1" style={{ color: '#9ca3af' }}>
              <span>Ma progression</span>
              <span style={{ color: done ? '#10b981' : 'white' }}>
                {progress.progress} / {quest.goal}
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 7, background: 'rgba(255,255,255,0.07)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: done
                    ? 'linear-gradient(90deg,#10b981,#34d399)'
                    : `linear-gradient(90deg,${quest.color},${quest.color}cc)`,
                }}
              />
            </div>
          </div>
        )}

        {/* Community stats */}
        <div className="flex gap-3 mt-auto pt-1">
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#9ca3af' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span>{quest.completions} complétée{quest.completions !== 1 ? 's' : ''}</span>
          </div>
          {quest.inProgress > 0 && (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#9ca3af' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span>{quest.inProgress} en cours</span>
            </div>
          )}
          {/* Community progress bar */}
          {(quest.completions > 0 || quest.inProgress > 0) && (
            <div className="ml-auto flex items-center gap-1">
              <div className="w-16 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.07)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round(quest.completions / Math.max(quest.completions + quest.inProgress, 1) * 100))}%`,
                    background: 'linear-gradient(90deg,#10b981,#34d399)',
                  }}
                />
              </div>
              <span className="text-[10px]" style={{ color: '#6b7280' }}>
                {Math.round(quest.completions / Math.max(quest.completions + quest.inProgress, 1) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Timer */}
        {timed && (
          <div
            className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg"
            style={{
              background: expired ? 'rgba(239,68,68,0.1)' : urgent ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)',
              color: expired ? '#f87171' : urgent ? '#fbbf24' : '#94a3b8',
            }}
          >
            <span>{expired ? '🔴' : urgent ? '⚡' : '⏱'}</span>
            <span>{expired ? 'Expirée' : `Fin dans ${fmtRemaining(quest.endsAt!)}`}</span>
          </div>
        )}
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
  const [now,      setNow]      = useState(Date.now())
  const token = getToken()

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const loads: Promise<void>[] = [
      fetch('/api/public/quests')
        .then(r => r.json())
        .then(d => setQuests(d.quests ?? []))
        .catch(() => {}),
    ]
    if (token) {
      loads.push(
        fetch('/api/public/quests/player/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.json())
          .then(d => setProgress(d.progress ?? {}))
          .catch(() => {}),
      )
    }
    Promise.all(loads).finally(() => setLoading(false))
  }, [token])

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

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080d19' }}>
      {/* Header */}
      <div className="relative overflow-hidden pt-10 pb-6 px-4">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(139,92,246,0.15),transparent)' }} />
        <div className="relative max-w-screen-sm mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">📜</span>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Quêtes</h1>
          </div>
          <p className="text-sm text-gray-500">
            {quests.length} quête{quests.length !== 1 ? 's' : ''} disponible{quests.length !== 1 ? 's' : ''}
            {token && counts.completed > 0 && (
              <span className="ml-2 text-green-400">· {counts.completed} terminée{counts.completed !== 1 ? 's' : ''}</span>
            )}
          </p>

          {/* Global community stats bar */}
          {(globalCompletions > 0 || globalInProgress > 0) && (
            <div className="mt-4 rounded-xl p-3"
                 style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex justify-between text-[11px] mb-2" style={{ color: '#9ca3af' }}>
                <span>Progression de la communauté</span>
                <span style={{ color: '#34d399' }}>{globalCompletions} complétion{globalCompletions !== 1 ? 's' : ''}</span>
              </div>
              <div className="rounded-full overflow-hidden flex" style={{ height: 8, background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${Math.round(globalCompletions / Math.max(globalCompletions + globalInProgress, 1) * 100)}%`,
                    background: 'linear-gradient(90deg,#10b981,#34d399)',
                  }}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${Math.round(globalInProgress / Math.max(globalCompletions + globalInProgress, 1) * 100)}%`,
                    background: 'rgba(251,191,36,0.5)',
                  }}
                />
              </div>
              <div className="flex gap-4 mt-2 text-[10px]" style={{ color: '#6b7280' }}>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Complétées</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/>En cours</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 max-w-screen-sm mx-auto mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: filter === f.key ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${filter === f.key ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.08)'}`,
                color: filter === f.key ? '#a78bfa' : '#6b7280',
              }}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 max-w-screen-sm mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mb-3" />
            Chargement des quêtes…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-sm">Aucune quête dans cette catégorie</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(q => (
              <QuestCard
                key={q.id}
                quest={q}
                progress={progress[q.id] ?? null}
                now={now}
              />
            ))}
          </div>
        )}

        {!token && (
          <div className="mt-6 rounded-xl p-4 text-center text-sm"
               style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}>
            <button onClick={() => navigate('/login')} className="font-medium underline">
              Connecte-toi
            </button>
            {' '}pour voir ta progression personnelle sur chaque quête.
          </div>
        )}
      </div>

      <Navbar />
    </div>
  )
}
