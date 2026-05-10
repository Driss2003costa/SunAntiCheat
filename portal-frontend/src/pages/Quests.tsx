import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getToken } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import { GridShell, HeroBanner, SectionDivider, Card, Button, Tag } from '../components/ui'

type PublicQuest = {
  id: string; title: string; description: string;
  titleEn?: string; descriptionEn?: string
  icon: string; color: string
  type: string; target: string; goal: number; rewardLabel: string; rewardLabelEn?: string
  repeatable: boolean; completions: number; inProgress: number; endsAt?: number
}
type QuestProgress = { questId: string; title: string; progress: number; goal: number; completed: boolean }

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${String(d).padStart(2,'0')}:${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function QuestTimer({ endsAt, totalMs, onExpired }: { endsAt: number; totalMs: number; onExpired: () => void }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => {
      const tm = Date.now(); setNow(tm)
      if (tm >= endsAt) { clearInterval(id); setTimeout(onExpired, 800) }
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
  if (d > 0) label = `${d}${t('quests.timer.day')}`
  else if (h > 0) label = `${h}${t('quests.timer.hour')}`
  else label = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`

  return (
    <div className="relative shrink-0 flex items-center justify-center" title={t('quests.timer.expiresIn', { duration: fmtDuration(msLeft) }) as string}
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

/** Petit header de section interne — sobre, sans rivaliser avec le hero. */
function SectionHeader({ icon, label, count, accent }: { icon: string; label: string; count?: number; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base" style={{ filter: `drop-shadow(0 0 8px ${accent}40)` }}>{icon}</span>
      <h3 className="font-semibold text-[11px] uppercase tracking-[0.25em]" style={{ color: '#f8fafc' }}>{label}</h3>
      {count != null && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${accent}1a`, color: accent, border: `1px solid ${accent}33` }}>
          {count}
        </span>
      )}
      <span className="flex-1 h-px ml-1" style={{ background: `linear-gradient(90deg, ${accent}33, transparent)` }} />
    </div>
  )
}

export default function Quests() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [quests,   setQuests]   = useState<PublicQuest[]>([])
  const [progress, setProgress] = useState<Record<string, QuestProgress>>({})
  const [loading,  setLoading]  = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const token = getToken()

  const numberLocale = i18n.resolvedLanguage?.startsWith('fr') ? 'fr-FR' : 'en-GB'
  const isEn = !i18n.resolvedLanguage?.startsWith('fr')

  // Picker localisé : si l'utilisateur est en EN et que la quête a une trad EN, l'utilise
  const localized = (q: PublicQuest) => ({
    title:       isEn && q.titleEn       ? q.titleEn       : q.title,
    description: isEn && q.descriptionEn ? q.descriptionEn : q.description,
    rewardLabel: isEn && q.rewardLabelEn ? q.rewardLabelEn : q.rewardLabel,
  })

  const fmtTarget = (target: string) => {
    if (!target || target === 'ANY') return t('quests.target.all')
    return target.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
  }

  const typeLabel = (type: string) => {
    const key = `quests.types.${type}`
    const translated = t(key)
    return translated === key ? type : translated
  }

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

  // ─── Buckets : limited > completed > active (chaque quête dans un seul) ──
  const { limitedQuests, activeQuests, completedQuests } = useMemo(() => {
    const limited: PublicQuest[] = []
    const active: PublicQuest[]  = []
    const completed: PublicQuest[] = []
    const nowMs = Date.now()
    for (const q of quests) {
      const isCompleted = !!progress[q.id]?.completed
      const isLimited   = q.endsAt != null && q.endsAt > nowMs
      if (isLimited && !isCompleted) limited.push(q)
      else if (isCompleted)          completed.push(q)
      else                            active.push(q)
    }
    return { limitedQuests: limited, activeQuests: active, completedQuests: completed }
  }, [quests, progress])

  const allOrdered = useMemo(
    () => [...limitedQuests, ...activeQuests, ...completedQuests],
    [limitedQuests, activeQuests, completedQuests],
  )

  const globalComp = quests.reduce((s, q) => s + q.completions, 0)
  const globalInPr = quests.reduce((s, q) => s + q.inProgress,  0)

  const selected = useMemo(
    () => allOrdered.find(q => q.id === selectedId) ?? allOrdered[0] ?? null,
    [allOrdered, selectedId],
  )

  const totalMs = 7 * 24 * 3600 * 1000

  // ─── Card de quête enrichie (utilisée dans les 3 sections) ─────────────
  const renderQuestCard = (q: PublicQuest) => {
    const prog = progress[q.id] ?? null
    const pct = prog ? Math.min(100, Math.round((prog.progress / q.goal) * 100)) : 0
    const done = prog?.completed ?? false
    const isActive = selected?.id === q.id
    const loc = localized(q)

    return (
      <Card key={q.id} hover padding="md" onClick={() => setSelectedId(q.id)}
            className={done ? 'opacity-70' : ''}
            style={{ borderColor: isActive ? 'rgba(251,191,36,0.45)' : undefined }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
               style={{ background: `${q.color}18`, border: `1px solid ${q.color}33` }}>
            {q.icon}
          </div>
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start gap-2">
              <h3 className="font-semibold text-sm truncate flex-1" style={{ color: '#f8fafc' }}>{loc.title}</h3>
              {q.repeatable && (
                <span className="text-[10px] shrink-0" title={t('quests.detail.tagRepeatable') as string}>🔁</span>
              )}
            </div>

            {/* Description (truncated) */}
            {loc.description && (
              <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(241,245,249,0.5)' }}>
                {loc.description}
              </p>
            )}

            {/* Meta row : type · target · reward */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(56,189,248,0.10)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.25)' }}>
                {typeLabel(q.type)}
              </span>
              {q.target && q.target !== 'ANY' && (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(241,245,249,0.7)' }}>
                  {fmtTarget(q.target)}
                </span>
              )}
              {loc.rewardLabel && (
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(251,191,36,0.10)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.25)' }}>
                  🎁 {loc.rewardLabel}
                </span>
              )}
            </div>

            {/* Progress (only if logged + has progress) */}
            {prog && (
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="font-mono tabular-nums" style={{ color: done ? '#34d399' : 'rgba(241,245,249,0.65)' }}>
                    {t('quests.card.goal', { progress: prog.progress, goal: q.goal })}
                  </span>
                  <span className="font-bold" style={{ color: done ? '#34d399' : '#fbbf24' }}>
                    {pct}%
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                       style={{
                         width: `${pct}%`,
                         background: done
                           ? 'linear-gradient(90deg,#10b981,#34d399)'
                           : `linear-gradient(90deg,${q.color},${q.color}cc)`,
                       }} />
                </div>
              </div>
            )}
            {!prog && token && (
              <p className="text-[10px] mt-2" style={{ color: 'rgba(241,245,249,0.4)' }}>
                {t('quests.card.notStarted')}
              </p>
            )}
          </div>
          {q.endsAt != null && q.endsAt - Date.now() > 0 && (
            <QuestTimer endsAt={q.endsAt} totalMs={totalMs} onExpired={() => handleExpired(q.id)} />
          )}
        </div>
      </Card>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#080d19' }}>
      <PageAura theme="quests" />
      <GridShell>
        <HeroBanner
          eyebrow={t('quests.eyebrow')}
          variant="ember"
          title={<>{t('quests.hero.titleStart')}<span className="text-sun-300">{t('quests.hero.titleHighlight')}</span>{t('quests.hero.titleEnd')}</>}
          subtitle={t('quests.hero.subtitle', { count: quests.length, available: quests.length, completed: completedQuests.length })}
          rightSlot={
            (globalComp > 0 || globalInPr > 0) && (
              <div className="w-full max-w-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] mb-3" style={{ color: '#fb923c' }}>
                  {t('quests.communityProgress.label')}
                </p>
                <p className="font-display text-4xl font-semibold mb-2" style={{ color: '#f8fafc' }}>
                  {globalComp.toLocaleString(numberLocale)} <span className="text-base font-normal" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('quests.communityProgress.suffix', { count: globalComp })}</span>
                </p>
                <div className="rounded-full overflow-hidden flex" style={{ height: 6, background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full transition-all duration-700"
                       style={{ width: `${Math.round(globalComp / Math.max(globalComp + globalInPr, 1) * 100)}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
                  <div className="h-full"
                       style={{ width: `${Math.round(globalInPr / Math.max(globalComp + globalInPr, 1) * 100)}%`, background: 'rgba(251,191,36,0.4)' }} />
                </div>
              </div>
            )
          }
        />

        {loading ? (
          <Card padding="lg" className="text-center">
            <div className="w-7 h-7 rounded-full border-2 animate-spin mx-auto mb-3"
                 style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: '#f59e0b' }} />
            <p className="text-sm" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('quests.loading')}</p>
          </Card>
        ) : quests.length === 0 ? (
          <Card padding="lg" className="text-center">
            <span className="text-4xl block mb-3">📭</span>
            <p className="text-sm" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('quests.empty')}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liste groupée par sections */}
            <div className="flex flex-col gap-6 lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto lg:pr-2">
              {limitedQuests.length > 0 && (
                <section>
                  <SectionHeader icon="⏱" label={t('quests.sections.limited')} count={limitedQuests.length} accent="#f87171" />
                  <div className="flex flex-col gap-3">
                    {limitedQuests.map(renderQuestCard)}
                  </div>
                </section>
              )}

              {activeQuests.length > 0 && (
                <section>
                  <SectionHeader icon="📋" label={t('quests.sections.active')} count={activeQuests.length} accent="#fbbf24" />
                  <div className="flex flex-col gap-3">
                    {activeQuests.map(renderQuestCard)}
                  </div>
                </section>
              )}

              {completedQuests.length > 0 && (
                <section>
                  <SectionHeader icon="✓" label={t('quests.sections.completed')} count={completedQuests.length} accent="#34d399" />
                  <div className="flex flex-col gap-3">
                    {completedQuests.map(renderQuestCard)}
                  </div>
                </section>
              )}
            </div>

            {/* Detail panel */}
            <div className="lg:sticky lg:top-6 lg:self-start">
              {selected ? (() => {
                const sl = localized(selected)
                return (
                <Card variant="glass-warm" padding="lg">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                         style={{ background: `${selected.color}18`, border: `1px solid ${selected.color}35` }}>
                      {selected.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-2xl font-semibold mb-1" style={{ color: '#f8fafc' }}>{sl.title}</h2>
                      {sl.description && (
                        <p className="text-sm" style={{ color: 'rgba(241,245,249,0.6)' }}>{sl.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-5">
                    <Tag tone="sky">{typeLabel(selected.type)}</Tag>
                    <Tag tone="neutral">{fmtTarget(selected.target)}</Tag>
                    {sl.rewardLabel && <Tag tone="gold">🎁 {sl.rewardLabel}</Tag>}
                    {selected.repeatable && <Tag tone="violet">{t('quests.detail.tagRepeatable')}</Tag>}
                  </div>

                  {progress[selected.id] && (
                    <div className="mb-5">
                      <SectionDivider label={t('quests.detail.section')} />
                      <div className="flex justify-between text-xs mb-2" style={{ color: 'rgba(241,245,249,0.6)' }}>
                        <span>{progress[selected.id].progress} / {selected.goal}</span>
                        <span style={{ color: progress[selected.id].completed ? '#34d399' : '#fbbf24' }}>
                          {Math.min(100, Math.round((progress[selected.id].progress / selected.goal) * 100))}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                             style={{
                               width: `${Math.min(100, Math.round((progress[selected.id].progress / selected.goal) * 100))}%`,
                               background: progress[selected.id].completed
                                 ? 'linear-gradient(90deg,#10b981,#34d399)'
                                 : `linear-gradient(90deg,${selected.color},${selected.color}cc)`,
                             }} />
                      </div>
                    </div>
                  )}

                  {(selected.completions > 0 || selected.inProgress > 0) && (
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <Card padding="sm">
                        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('quests.detail.completions')}</p>
                        <p className="font-display text-2xl font-semibold" style={{ color: '#34d399' }}>{selected.completions}</p>
                      </Card>
                      <Card padding="sm">
                        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('quests.detail.inProgress')}</p>
                        <p className="font-display text-2xl font-semibold" style={{ color: '#fbbf24' }}>{selected.inProgress}</p>
                      </Card>
                    </div>
                  )}
                </Card>
                )
              })() : (
                <Card padding="lg" className="text-center">
                  <p className="text-sm" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('quests.noDetailSelected')}</p>
                </Card>
              )}
            </div>
          </div>
        )}

        {!token && (
          <Card padding="md" className="mt-6 text-center">
            <Button onClick={() => navigate('/login')} variant="secondary">{t('quests.loginButton')}</Button>
            <p className="text-xs mt-3" style={{ color: 'rgba(241,245,249,0.55)' }}>{t('quests.loginHint')}</p>
          </Card>
        )}
      </GridShell>
      <Navbar />
    </div>
  )
}
