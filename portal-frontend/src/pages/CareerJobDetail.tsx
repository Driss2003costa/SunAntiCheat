import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  api, getToken, clearToken,
  type PlayerProfile, type CustomJob, type PlayerJobProgress,
  type JobTimelineResponse,
} from '../api/client'
import Navbar from '../components/Navbar'
import MinecraftIcon from '../components/MinecraftIcon'
import PageAura from '../components/PageAura'
import { GridShell, HeroBanner, StatCard, SectionDivider, Card, Button, Tag } from '../components/ui'

function fmtNum(n: number) { return Math.round(n).toLocaleString('fr-FR') }
function fmtMoney(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
}
function fmtHours(h?: number) {
  if (h == null || !isFinite(h) || h <= 0) return '—'
  if (h < 1)   return Math.round(h * 60) + ' min'
  if (h < 48)  return h.toFixed(1) + ' h'
  return Math.round(h / 24) + ' j'
}
function fmtDay(ts: number) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export default function CareerJobDetail() {
  const { jobId = '' } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const [profile,   setProfile]   = useState<PlayerProfile | null>(null)
  const [job,       setJob]       = useState<CustomJob | null>(null)
  const [progress,  setProgress]  = useState<PlayerJobProgress | null>(null)
  const [timeline,  setTimeline]  = useState<JobTimelineResponse | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [prestigeBusy, setPrestigeBusy] = useState(false)
  const [toast,     setToast]     = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

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
    if (!window.confirm("Renaître ? Tu reset ton niveau à 1 mais gagnes une étoile permanente (+3% XP/argent).")) return
    setPrestigeBusy(true)
    try {
      const r = await api.jobPrestige(token, jobId)
      setToast({ kind: 'ok', msg: `Renaissance ! ⭐ ${r.prestige_stars ?? '?'} étoile(s)` })
      await reloadProgress(profile.uuid)
    } catch (e: any) {
      const reason = e?.reason ?? ''
      const msg = reason === 'NOT_MAX_LEVEL' ? 'Tu dois être au niveau maximum.'
                : reason === 'MAX_STARS'     ? 'Maximum d\'étoiles atteint (5).'
                : reason === 'NOT_JOINED'    ? 'Tu n\'es pas dans ce métier.'
                : 'Action impossible.'
      setToast({ kind: 'err', msg })
    } finally {
      setPrestigeBusy(false)
    }
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
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
        if (!j) setError("Métier inconnu")
      })
      .catch(e => {
        if (e.status === 401) { clearToken(); navigate('/login', { replace: true }); return }
        setError("Erreur de chargement")
      })
      .finally(() => setLoading(false))
  }, [jobId, navigate])

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
        <Button to="/career" variant="ghost" size="sm">← Carrière</Button>
        <Card padding="lg" className="mt-6 text-center">
          <span className="text-4xl block mb-3">❌</span>
          <p className="font-semibold" style={{ color: '#f8fafc' }}>{error ?? 'Métier introuvable'}</p>
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
        <Button to="/career" variant="ghost" size="sm">← Carrière</Button>

        <div className="mt-4">
          <HeroBanner
            eyebrow="Métier"
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
              <p className="font-semibold" style={{ color: '#6ee7b7' }}>Tu n'as pas encore commencé ce métier</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>
                Rejoins le serveur et utilise <span className="font-mono" style={{ color: '#cbd5e1' }}>/job join {job.id}</span>
              </p>
            </div>
          </Card>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-12 lg:mb-16">
              <StatCard label="Niveau" accent={isMax ? 'gold' : 'jade'} icon="✦" size="lg"
                        value={`${progress.level}${isMax ? ' ✦' : ''}`}
                        hint={isMax ? `Maître ${job.name}` : `/ ${progress.max_level}`} />
              <StatCard label="Total gagné" accent="gold" icon="💰" size="lg"
                        value={fmtMoney(progress.total_earned)} hint="Cumul" />
              <StatCard label="Étoiles" accent="violet" icon="⭐" size="lg"
                        value={progress.prestige_stars ?? 0}
                        hint={`+${((progress.prestige_stars ?? 0) * 3)}% bonus`} />
              <StatCard label="XP / heure" accent="sky" icon="⚡" size="lg"
                        value={timeline?.forecast?.xp_per_hour ? fmtNum(timeline.forecast.xp_per_hour) : '—'}
                        hint="moy. récente" />
            </div>

            {/* 3-col layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-12 lg:mb-16">
              {/* Progression */}
              <Card padding="lg" className="lg:col-span-1">
                <SectionDivider label="Progression" />
                {!isMax ? (
                  <>
                    <div className="flex justify-between text-xs mb-2" style={{ color: 'rgba(241,245,249,0.55)' }}>
                      <span>Vers Niv. {progress.level + 1}</span>
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
                  <Tag tone="gold">⭐ Niveau maximum atteint</Tag>
                )}
                {(progress.prestige_stars ?? 0) > 0 && (
                  <div className="mt-4 flex items-center gap-2 text-xs">
                    <span className="text-yellow-400">{'⭐'.repeat(progress.prestige_stars ?? 0)}</span>
                    <span style={{ color: 'rgba(241,245,249,0.55)' }}>
                      +{((progress.prestige_stars ?? 0) * 3).toFixed(0)}% permanent
                    </span>
                  </div>
                )}
                {isMax && (progress.prestige_stars ?? 0) < 5 && (
                  <Button onClick={handlePrestige} disabled={prestigeBusy} fullWidth size="md" className="mt-4">
                    {prestigeBusy ? '…' : '✨ Renaître'}
                  </Button>
                )}
                {isMax && (progress.prestige_stars ?? 0) >= 5 && (
                  <Card padding="sm" className="mt-4 text-center"
                        style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(251,191,36,0.15))', borderColor: 'rgba(139,92,246,0.3)' }}>
                    <p className="text-xs font-bold" style={{ color: '#c4b5fd' }}>⭐⭐⭐⭐⭐ Maître Suprême</p>
                  </Card>
                )}
              </Card>

              {/* Timeline */}
              <Card padding="lg" className="lg:col-span-1">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(241,245,249,0.55)' }}>Activité 14j</p>
                  <span className="text-[10px]" style={{ color: 'rgba(241,245,249,0.45)' }}>Moy. {fmtNum(avgXp7)} XP/j</span>
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
                  <span>aujourd'hui</span>
                </div>
              </Card>

              {/* Forecast + Targets */}
              <div className="lg:col-span-1 space-y-5">
                {timeline?.forecast && timeline.forecast.xp_per_hour > 0 && (
                  <Card padding="md">
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: 'rgba(241,245,249,0.55)' }}>🔮 Projection</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="font-display text-lg font-semibold" style={{ color: '#34d399' }}>{fmtNum(timeline.forecast.xp_per_hour)}</p>
                        <p className="text-[9px]" style={{ color: 'rgba(241,245,249,0.5)' }}>XP/h</p>
                      </div>
                      <div className="text-center">
                        <p className="font-display text-lg font-semibold" style={{ color: '#fbbf24' }}>{fmtHours(timeline.forecast.hours_to_next)}</p>
                        <p className="text-[9px]" style={{ color: 'rgba(241,245,249,0.5)' }}>Niv. +1</p>
                      </div>
                      <div className="text-center">
                        <p className="font-display text-lg font-semibold" style={{ color: '#38bdf8' }}>{fmtHours(timeline.forecast.hours_to_max)}</p>
                        <p className="text-[9px]" style={{ color: 'rgba(241,245,249,0.5)' }}>Niv. max</p>
                      </div>
                    </div>
                  </Card>
                )}

                {timeline && timeline.targets.length > 0 && (
                  <Card padding="md">
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: 'rgba(241,245,249,0.55)' }}>🏆 Top ressources</p>
                    <div className="space-y-3">
                      {timeline.targets.slice(0, 6).map((t, i) => {
                        const max = Math.max(...timeline.targets.map(x => x.actions))
                        const pct = (t.actions / max) * 100
                        return (
                          <div key={t.target}>
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                              <p className="text-xs font-mono truncate" style={{ color: 'rgba(241,245,249,0.75)' }}>
                                <span style={{ color: 'rgba(241,245,249,0.4)' }} className="mr-2">#{i+1}</span>
                                {t.target.replace(/_/g, ' ').toLowerCase()}
                              </p>
                              <p className="text-[10px] shrink-0" style={{ color: 'rgba(241,245,249,0.45)' }}>{fmtNum(t.actions)}</p>
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
