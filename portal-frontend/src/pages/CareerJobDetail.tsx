import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  api, getToken, clearToken,
  type PlayerProfile, type CustomJob, type PlayerJobProgress,
  type JobTimelineResponse,
} from '../api/client'
import Navbar from '../components/Navbar'
import MinecraftIcon from '../components/MinecraftIcon'

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

  // Build chart data — last 14 days, fill empty days with 0
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center pb-20">
      <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <Navbar />
    </div>
  )
  if (!profile) return null
  if (error || !job) return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="px-4 pt-12 max-w-screen-sm mx-auto">
        <button onClick={() => navigate('/career')}
          className="text-xs text-gray-500 hover:text-white transition-colors">← Carrière</button>
        <div className="mt-6 bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center">
          <span className="text-4xl block mb-3">❌</span>
          <p className="text-sm font-semibold text-white">{error ?? 'Métier introuvable'}</p>
        </div>
      </div>
      <Navbar />
    </div>
  )

  const isMax = progress ? progress.level >= progress.max_level : false
  const xpPct = progress && progress.xp_to_next > 0
    ? Math.min(100, Math.round((progress.xp / progress.xp_to_next) * 100))
    : 100

  return (
    <div className="min-h-screen bg-gray-950 pb-24">

      {/* HEADER */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/25 via-green-900/10 to-gray-950" />
        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          <button onClick={() => navigate('/career')}
            className="text-xs text-gray-400 hover:text-white transition-colors mb-3 flex items-center gap-1">
            <span>←</span> <span>Carrière</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <MinecraftIcon icon={job.icon} size={40} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-white truncate">{job.name}</h1>
              {job.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{job.description}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-sm mx-auto">

        {/* Progression */}
        {progress ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="p-5">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Niveau</p>
                  <p className={`text-3xl font-black ${isMax ? 'text-yellow-400' : 'text-emerald-400'}`}>
                    {progress.level}{isMax ? ' ✦' : ` / ${progress.max_level}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Total gagné</p>
                  <p className="text-lg font-bold text-yellow-400">{fmtMoney(progress.total_earned)}</p>
                </div>
              </div>

              {!isMax ? (
                <>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
                    <span>Progression vers niveau {progress.level + 1}</span>
                    <span className="font-mono">{xpPct}%</span>
                  </div>
                  <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
                         style={{ width: `${xpPct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">
                    {fmtNum(progress.xp)} / {fmtNum(progress.xp_to_next)} XP
                  </p>
                </>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-base">⭐</span>
                  <p className="text-xs text-yellow-400 font-semibold">Niveau maximum atteint — Maître {job.name}</p>
                </div>
              )}

              {/* Prestige badge + button */}
              {(progress.prestige_stars ?? 0) > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-yellow-400">{'⭐'.repeat(progress.prestige_stars ?? 0)}</span>
                  <span className="text-gray-400">
                    {progress.prestige_stars} étoile{(progress.prestige_stars ?? 0) > 1 ? 's' : ''} · +{((progress.prestige_stars ?? 0) * 3).toFixed(0)}% bonus permanent
                  </span>
                </div>
              )}

              {isMax && (progress.prestige_stars ?? 0) < 5 && (
                <button
                  type="button"
                  onClick={handlePrestige}
                  disabled={prestigeBusy}
                  className="mt-3 w-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/40 rounded-xl px-4 py-3 text-sm font-bold text-yellow-300 hover:from-yellow-500/30 hover:to-orange-500/30 disabled:opacity-50 transition-all">
                  {prestigeBusy ? '…' : `✨ Renaître — gagner 1 étoile permanente (+3% XP/$)`}
                </button>
              )}
              {isMax && (progress.prestige_stars ?? 0) >= 5 && (
                <div className="mt-3 bg-gradient-to-r from-purple-500/15 to-yellow-500/15 border border-purple-500/30 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs font-bold text-purple-300">⭐⭐⭐⭐⭐ Maître Suprême — Toutes les étoiles atteintes</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-3xl shrink-0">🌱</span>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Tu n'as pas encore commencé ce métier</p>
              <p className="text-xs text-gray-500 mt-0.5">Rejoins le serveur et utilise <span className="font-mono text-gray-300">/job join {job.id}</span></p>
            </div>
          </div>
        )}

        {/* Timeline (14j) */}
        {progress && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>📈</span>
                <span className="text-sm font-semibold text-white">Activité (14 jours)</span>
              </div>
              <span className="text-[10px] text-gray-500">
                Moy. {fmtNum(avgXp7)} XP/j
              </span>
            </div>
            <div className="p-5">
              <div className="h-32 flex items-end gap-1.5">
                {chartData.map(d => {
                  const h = Math.max(2, (d.xp / maxChartXp) * 100)
                  const isToday = d.ts === chartData[chartData.length - 1]?.ts
                  return (
                    <div key={d.ts} className="flex-1 flex flex-col items-center justify-end gap-1 group">
                      <div className={`w-full rounded-t-sm transition-all ${
                        d.xp > 0
                          ? (isToday ? 'bg-gradient-to-t from-yellow-500 to-yellow-300' : 'bg-gradient-to-t from-emerald-700 to-emerald-400')
                          : 'bg-gray-800'
                      }`}
                        style={{ height: `${h}%` }}
                        title={`${fmtDay(d.ts)} · ${fmtNum(d.xp)} XP`}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between mt-2 text-[9px] text-gray-600 font-mono">
                <span>{fmtDay(chartData[0].ts)}</span>
                <span>{fmtDay(chartData[Math.floor(chartData.length / 2)].ts)}</span>
                <span>aujourd'hui</span>
              </div>
            </div>
          </div>
        )}

        {/* Forecast */}
        {timeline?.forecast && timeline.forecast.xp_per_hour > 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
              <span>🔮</span>
              <span className="text-sm font-semibold text-white">Projection</span>
            </div>
            <div className="p-5 grid grid-cols-3 gap-3">
              <ForecastTile label="XP/heure"        value={fmtNum(timeline.forecast.xp_per_hour)}    color="text-emerald-400" />
              <ForecastTile label={`Niv. ${(timeline.forecast.level ?? 0)+1}`}  value={fmtHours(timeline.forecast.hours_to_next)} color="text-yellow-400" />
              <ForecastTile label="Niv. max"        value={fmtHours(timeline.forecast.hours_to_max)}  color="text-blue-400" />
            </div>
            <p className="px-5 pb-4 text-[10px] text-gray-600">Calculé sur ton activité des 30 derniers jours.</p>
          </div>
        )}

        {/* Top targets */}
        {timeline && timeline.targets.length > 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
              <span>🏆</span>
              <span className="text-sm font-semibold text-white">Tes ressources favorites</span>
            </div>
            <div className="divide-y divide-gray-800/60">
              {timeline.targets.slice(0, 6).map((t, i) => {
                const max = Math.max(...timeline.targets.map(x => x.actions))
                const pct = (t.actions / max) * 100
                return (
                  <div key={t.target} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <p className="text-xs font-mono text-gray-300 truncate">
                        <span className="text-gray-600 mr-2">#{i+1}</span>
                        {t.target.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      <p className="text-[10px] text-gray-500 shrink-0">
                        {fmtNum(t.actions)} actions · {fmtNum(t.xp)} XP
                      </p>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <div className={`px-4 py-2 rounded-full text-xs font-semibold shadow-lg border ${
            toast.kind === 'ok'
              ? 'bg-emerald-500/95 text-black border-emerald-300'
              : 'bg-red-500/95 text-white border-red-300'
          }`}>
            {toast.kind === 'ok' ? '✔ ' : '⚠ '}{toast.msg}
          </div>
        </div>
      )}

      <Navbar />
    </div>
  )
}

function ForecastTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-black/30 border border-gray-800/80 rounded-xl p-3 text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-base font-black mt-1 ${color}`}>{value}</p>
    </div>
  )
}
