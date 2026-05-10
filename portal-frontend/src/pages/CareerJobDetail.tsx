import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  api, getToken, clearToken,
  type PlayerProfile, type CustomJob, type PlayerJobProgress,
  type JobTimelineResponse,
} from '../api/client'
import Navbar from '../components/Navbar'
import MinecraftIcon from '../components/MinecraftIcon'
import PageAura from '../components/PageAura'
import { GridShell, HeroBanner, StatCard, SectionDivider, Card, Button, Tag } from '../components/ui'

export default function CareerJobDetail() {
  const { jobId = '' } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const [profile,   setProfile]   = useState<PlayerProfile | null>(null)
  const [job,       setJob]       = useState<CustomJob | null>(null)
  const [progress,  setProgress]  = useState<PlayerJobProgress | null>(null)
  const [timeline,  setTimeline]  = useState<JobTimelineResponse | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [prestigeBusy, setPrestigeBusy] = useState(false)
  const [toast,     setToast]     = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const numberLocale = i18n.resolvedLanguage?.startsWith('fr') ? 'fr-FR' : 'en-GB'
  const dateLocale = numberLocale

  const fmtNum = (n: number) => Math.round(n).toLocaleString(numberLocale)
  const fmtMoney = (n: number) =>
    n.toLocaleString(numberLocale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
  const fmtHours = (h?: number) => {
    if (h == null || !isFinite(h) || h <= 0) return '—'
    if (h < 1)   return Math.round(h * 60) + ' ' + t('careerDetail.time.min')
    if (h < 48)  return h.toFixed(1) + ' ' + t('careerDetail.time.hour')
    return Math.round(h / 24) + ' ' + t('careerDetail.time.day')
  }
  const fmtDay = (ts: number) =>
    new Date(ts).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' })

  const reloadProgress = async (uuid: string) => {
    const [progs, tl] = await Promise.all([
      api.customJobsPlayer(uuid).catch(() => []),
      api.jobTimeline(uuid, jobId, 30).catch(() => null),
    ])
    setProgress((progs as PlayerJobProgress[]).find(p => p.job_id === jobId) ?? null)
    setTimeline(tl)
  }

  const handlePrestige = async () => {
    const token = getToken(); if (!token || !profile) return
    if (!window.confirm(t('careerDetail.confirm.prestige'))) return
    setPrestigeBusy(true)
    try {
      const r = await api.jobPrestige(token, jobId)
      setToast({ kind: 'ok', msg: t('careerDetail.toast.prestige', { count: r.prestige_stars ?? 0 }) })
      await reloadProgress(profile.uuid)
    } catch (e: any) {
      const reason = e?.reason ?? ''
      const msg = reason === 'NOT_MAX_LEVEL' ? t('careerDetail.error.notMaxLevel')
                : reason === 'MAX_STARS'     ? t('careerDetail.error.maxStars')
                : reason === 'NOT_JOINED'    ? t('careerDetail.error.notJoined')
                : t('career.error.generic')
      setToast({ kind: 'err', msg })
    } finally {
      setPrestigeBusy(false)
    }
  }

  useEffect(() => {
    if (!toast) return
    const tm = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(tm)
  }, [toast])

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }

    api.me(token)
      .then(p => {
        setProfile(p)
        return Promise.all([
          api.customJobsList().catch(() => []),
          api.customJobsPlayer(p.uuid).catch(() => []),
          api.jobTimeline(p.uuid, jobId, 30).catch(() => null),
        ])
      })
      .then(([jobs, progs, tl]) => {
        const j = (jobs as CustomJob[]).find(x => x.id === jobId) ?? null
        const pr = (progs as PlayerJobProgress[]).find(p => p.job_id === jobId) ?? null
        setJob(j); setProgress(pr); setTimeline(tl)
        if (!j) setError(t('careerDetail.error.unknown'))
      })
      .catch(e => {
        if (e.status === 401) { clearToken(); navigate('/login', { replace: true }); return }
        setError(t('careerDetail.error.loading'))
      })
      .finally(() => setLoading(false))
  }, [jobId, navigate, t])

  const chartData = useMemo(() => {
    if (!timeline) return []
    const map = new Map<number, number>()
    timeline.timeline.forEach(p => map.set(p.day_ts, p.xp))
    const days: { ts: number; xp: number }[] = []
    const now = new Date(); now.setHours(0,0,0,0)
    const oneDay = 86_400_000
    const startMs = Math.floor(now.getTime() / oneDay) * oneDay
    for (let i = 13; i >= 0; i--) {
      const ts = startMs - i * oneDay
      days.push({ ts, xp: map.get(ts) ?? 0 })
    }
    return days
  }, [timeline])

  const maxChartXp = Math.max(1, ...chartData.map(d => d.xp))
  const totalXp7 = chartData.slice(-7).reduce((s,d) => s+d.xp, 0)
  const avgXp7  = totalXp7 / 7

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080d19' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(52,211,153,0.2)', borderTopColor: '#34d399' }} />
      <Navbar />
    </div>
  )
  if (!profile) return null
  if (error || !job) return (
    <div className="min-h-screen" style={{ background: '#080d19' }}>
      <PageAura theme="career" />
      <GridShell>
        <Button to="/career" variant="ghost" size="sm">{t('careerDetail.buttonBack')}</Button>
        <Card padding="lg" className="mt-6 text-center">
          <span className="text-4xl block mb-3">❌</span>
          <p className="font-semibold" style={{ color: '#f8fafc' }}>{error ?? t('careerDetail.notFoundTitle')}</p>
        </Card>
      </GridShell>
      <Navbar />
    </div>
  )

  const isMax = progress ? progress.level >= progress.max_level : false
  const xpPct = progress && progress.xp_to_next > 0
    ? Math.min(100, Math.round((progress.xp / progress.xp_to_next) * 100))
    : 100

  return (
    <div className="min-h-screen" style={{ background: '#080d19' }}>
      <PageAura theme="career" />
      <GridShell>
        <Button to="/career" variant="ghost" size="sm">{t('careerDetail.buttonBack')}</Button>

        <div className="mt-4">
          <HeroBanner
            eyebrow={t('careerDetail.eyebrow')}
            variant="jade"
            title={job.name}
            subtitle={job.description ?? undefined}
            rightSlot={
              <div className="flex items-center justify-center">
                <div className="w-32 h-32 rounded-3xl flex items-center justify-center"
                     style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)' }}>
                  <MinecraftIcon icon={job.icon} size={88} />
                </div>
              </div>
            }
          />
        </div>

        {!progress ? (
          <Card padding="lg" className="flex items-center gap-4 mb-8"
                style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.18)' }}>
            <span className="text-4xl shrink-0">🌱</span>
            <div>
              <p className="font-semibold" style={{ color: '#6ee7b7' }}>{t('careerDetail.notStarted.title')}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>
                {t('careerDetail.notStarted.desc', { id: job.id })}
              </p>
            </div>
          </Card>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-12 lg:mb-16">
              <StatCard label={t('careerDetail.stats.level')} accent={isMax ? 'gold' : 'jade'} icon="✦" size="lg"
                        value={`${progress.level}${isMax ? ' ✦' : ''}`}
                        hint={isMax ? t('careerDetail.stats.levelMaster', { name: job.name }) : `/ ${progress.max_level}`} />
              <StatCard label={t('careerDetail.stats.earned')} accent="gold" icon="💰" size="lg"
                        value={fmtMoney(progress.total_earned)} hint={t('careerDetail.stats.earnedHint')} />
              <StatCard label={t('careerDetail.stats.stars')} accent="violet" icon="⭐" size="lg"
                        value={progress.prestige_stars ?? 0}
                        hint={t('careerDetail.stats.starsHint', { percent: ((progress.prestige_stars ?? 0) * 3) })} />
              <StatCard label={t('careerDetail.stats.xpRate')} accent="sky" icon="⚡" size="lg"
                        value={timeline?.forecast?.xp_per_hour ? fmtNum(timeline.forecast.xp_per_hour) : '—'}
                        hint={t('careerDetail.stats.xpRateHint')} />
            </div>

            {/* 3-col layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-12 lg:mb-16">
              {/* Progression */}
              <Card padding="lg" className="lg:col-span-1">
                <SectionDivider label={t('careerDetail.section.progress')} />
                {!isMax ? (
                  <>
                    <div className="flex justify-between text-xs mb-2" style={{ color: 'rgba(241,245,249,0.55)' }}>
                      <span>{t('careerDetail.progress.label', { next: progress.level + 1 })}</span>
                      <span className="font-mono">{xpPct}%</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all"
                           style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
                    </div>
                    <p className="text-[11px] font-mono" style={{ color: 'rgba(241,245,249,0.45)' }}>
                      {fmtNum(progress.xp)} / {fmtNum(progress.xp_to_next)} XP
                    </p>
                  </>
                ) : (
                  <Tag tone="gold">{t('careerDetail.progress.maxed')}</Tag>
                )}
                {(progress.prestige_stars ?? 0) > 0 && (
                  <div className="mt-4 flex items-center gap-2 text-xs">
                    <span className="text-yellow-400">{'⭐'.repeat(progress.prestige_stars ?? 0)}</span>
                    <span style={{ color: 'rgba(241,245,249,0.55)' }}>
                      +{t('careerDetail.stats.permanent', { percent: ((progress.prestige_stars ?? 0) * 3).toFixed(0) })}
                    </span>
                  </div>
                )}
                {isMax && (progress.prestige_stars ?? 0) < 5 && (
                  <Button onClick={handlePrestige} disabled={prestigeBusy} fullWidth size="md" className="mt-4">
                    {prestigeBusy ? '…' : t('careerDetail.buttonPrestige')}
                  </Button>
                )}
                {isMax && (progress.prestige_stars ?? 0) >= 5 && (
                  <Card padding="sm" className="mt-4 text-center"
                        style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(251,191,36,0.15))', borderColor: 'rgba(139,92,246,0.3)' }}>
                    <p className="text-xs font-bold" style={{ color: '#c4b5fd' }}>{t('careerDetail.masterBadge')}</p>
                  </Card>
                )}
              </Card>

              {/* Timeline */}
              <Card padding="lg" className="lg:col-span-1">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(241,245,249,0.55)' }}>{t('careerDetail.timeline.label')}</p>
                  <span className="text-[10px]" style={{ color: 'rgba(241,245,249,0.45)' }}>{t('careerDetail.timeline.average', { xp: fmtNum(avgXp7) })}</span>
                </div>
                <div className="h-32 flex items-end gap-1.5">
                  {chartData.map(d => {
                    const h = Math.max(2, (d.xp / maxChartXp) * 100)
                    const isToday = d.ts === chartData[chartData.length - 1]?.ts
                    return (
                      <div key={d.ts} className="flex-1 flex flex-col items-center justify-end" title={`${fmtDay(d.ts)} · ${fmtNum(d.xp)} XP`}>
                        <div className="w-full rounded-t-sm transition-all"
                             style={{
                               height: `${h}%`,
                               background: d.xp > 0
                                 ? (isToday ? 'linear-gradient(to top, #f59e0b, #fbbf24)' : 'linear-gradient(to top, #047857, #34d399)')
                                 : 'rgba(255,255,255,0.05)',
                             }} />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[9px] font-mono" style={{ color: 'rgba(241,245,249,0.4)' }}>
                  <span>{chartData[0] && fmtDay(chartData[0].ts)}</span>
                  <span>{t('careerDetail.timeline.today')}</span>
                </div>
              </Card>

              {/* Forecast + Targets */}
              <div className="lg:col-span-1 space-y-5">
                {timeline?.forecast && timeline.forecast.xp_per_hour > 0 && (
                  <Card padding="md">
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: 'rgba(241,245,249,0.55)' }}>{t('careerDetail.forecast.label')}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="font-display text-lg font-semibold" style={{ color: '#34d399' }}>{fmtNum(timeline.forecast.xp_per_hour)}</p>
                        <p className="text-[9px]" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('careerDetail.forecast.xpRate')}</p>
                      </div>
                      <div className="text-center">
                        <p className="font-display text-lg font-semibold" style={{ color: '#fbbf24' }}>{fmtHours(timeline.forecast.hours_to_next)}</p>
                        <p className="text-[9px]" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('careerDetail.forecast.nextLevel')}</p>
                      </div>
                      <div className="text-center">
                        <p className="font-display text-lg font-semibold" style={{ color: '#38bdf8' }}>{fmtHours(timeline.forecast.hours_to_max)}</p>
                        <p className="text-[9px]" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('careerDetail.forecast.maxLevel')}</p>
                      </div>
                    </div>
                  </Card>
                )}

                {timeline && timeline.targets.length > 0 && (
                  <Card padding="md">
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: 'rgba(241,245,249,0.55)' }}>{t('careerDetail.targets.label')}</p>
                    <div className="space-y-3">
                      {timeline.targets.slice(0, 6).map((tg, i) => {
                        const max = Math.max(...timeline.targets.map(x => x.actions))
                        const pct = (tg.actions / max) * 100
                        return (
                          <div key={tg.target}>
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                              <p className="text-xs font-mono truncate" style={{ color: 'rgba(241,245,249,0.75)' }}>
                                <span style={{ color: 'rgba(241,245,249,0.4)' }} className="mr-2">#{i+1}</span>
                                {tg.target.replace(/_/g, ' ').toLowerCase()}
                              </p>
                              <p className="text-[10px] shrink-0" style={{ color: 'rgba(241,245,249,0.45)' }}>{fmtNum(tg.actions)}</p>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#34d399' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </GridShell>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <div className={`px-4 py-2 rounded-full text-xs font-semibold shadow-lg border ${toast.kind === 'ok' ? 'text-gray-900' : 'text-white'}`}
               style={{
                 background: toast.kind === 'ok' ? 'linear-gradient(135deg,#10b981,#34d399)' : 'rgba(239,68,68,0.95)',
                 borderColor: toast.kind === 'ok' ? '#34d399' : '#f87171',
               }}>
            {toast.kind === 'ok' ? '✔ ' : '⚠ '}{toast.msg}
          </div>
        </div>
      )}

      <Navbar />
    </div>
  )
}
