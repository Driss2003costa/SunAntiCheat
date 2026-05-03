import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  api, getToken, clearToken,
  type PlayerProfile, type CustomJob, type PlayerJobProgress,
  type JobDynamicsSnapshot, type JobHeatmapResponse,
} from '../api/client'
import Navbar from '../components/Navbar'

function fmtEarned(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
}

const SEASON_GRADIENT: Record<string, string> = {
  winter: 'from-cyan-500/20 to-blue-700/10  border-cyan-500/30',
  spring: 'from-green-500/20 to-emerald-700/10 border-green-500/30',
  summer: 'from-yellow-500/20 to-orange-700/10 border-yellow-500/30',
  autumn: 'from-orange-500/20 to-red-700/10  border-orange-500/30',
}

export default function Career() {
  const navigate  = useNavigate()
  const [profile,     setProfile]     = useState<PlayerProfile | null>(null)
  const [jobs,        setJobs]        = useState<CustomJob[]>([])
  const [progress,    setProgress]    = useState<PlayerJobProgress[]>([])
  const [dynamics,    setDynamics]    = useState<JobDynamicsSnapshot | null>(null)
  const [heatmap,     setHeatmap]     = useState<JobHeatmapResponse | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }

    api.me(token)
      .then(p => {
        setProfile(p)
        return Promise.all([
          api.customJobsList().catch(e => { if (e.status === 503) setUnavailable(true); return [] }),
          api.customJobsPlayer(p.uuid).catch(() => []),
          api.jobDynamics().catch(() => null),
          api.jobHeatmap(p.uuid, 7).catch(() => null),
        ])
      })
      .then(([j, pr, dyn, hm]) => {
        setJobs(j as CustomJob[])
        setProgress(pr as PlayerJobProgress[])
        setDynamics(dyn as JobDynamicsSnapshot | null)
        setHeatmap(hm as JobHeatmapResponse | null)
      })
      .catch(e => {
        if (e.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      })
      .finally(() => setLoading(false))
  }, [navigate])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center pb-20">
      <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const activeProgress = progress.filter(p => p.level > 1 || p.xp > 0)
  const totalLevel     = progress.reduce((s, p) => s + p.level, 0)
  const totalEarned    = progress.reduce((s, p) => s + (p.total_earned ?? 0), 0)
  const inactiveJobs   = jobs.filter(j => !progress.some(p => p.job_id === j.id && (p.level > 1 || p.xp > 0)))

  const seasonKey  = dynamics?.season?.key ?? ''
  const seasonGrad = SEASON_GRADIENT[seasonKey] ?? 'from-gray-700/20 to-gray-900/10 border-gray-700/30'
  const bulletinJob = dynamics?.bulletin?.job_id
    ? jobs.find(j => j.id === dynamics.bulletin?.job_id)
    : null
  const activeEvents = dynamics?.active_events ?? []

  // 7-day actions per job (for "favorite jobs" quick stat)
  const actionsByJob = new Map<string, number>()
  heatmap?.by_job.forEach(e => actionsByJob.set(e.job_id, e.actions))

  return (
    <div className="min-h-screen bg-gray-950 pb-24">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/25 via-green-900/10 to-gray-950" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">📈</span>
            <div>
              <h1 className="text-2xl font-black text-white">Carrière</h1>
              <p className="text-sm text-gray-400">{profile.username}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniStat icon="🏅" label="Métiers actifs"  value={String(activeProgress.length)} color="text-emerald-400" />
            <MiniStat icon="⚡" label="Niveau total"    value={String(totalLevel)}             color="text-yellow-400" />
            <MiniStat icon="💰" label="Total gagné"     value={fmtEarned(totalEarned)}         color="text-blue-400" />
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-sm mx-auto">

        {/* ── World Dynamics card ───────────────────────────────────────── */}
        {dynamics?.enabled && (
          <section className={`bg-gradient-to-br ${seasonGrad} border rounded-2xl overflow-hidden`}>
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🌍</span>
                <span className="text-sm font-semibold text-white">Monde dynamique</span>
              </div>
              <span className="text-[10px] text-gray-400">en direct</span>
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              {/* Season tile */}
              {dynamics.season && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{dynamics.season.icon}</span>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Saison</p>
                      <p className="text-sm font-bold text-white">{dynamics.season.label}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulletin tile */}
              {bulletinJob ? (
                <div className="bg-black/40 rounded-xl border border-yellow-500/20 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📰</span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-yellow-400 uppercase tracking-wider">Demande</p>
                      <p className="text-sm font-bold text-white truncate">
                        {bulletinJob.name} <span className="text-yellow-400 font-mono ml-1">×{(dynamics.bulletin?.multiplier ?? 1).toFixed(1)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-black/30 rounded-xl border border-white/5 p-3 opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📰</span>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Bulletin</p>
                      <p className="text-xs text-gray-500">À venir</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Active events */}
            {activeEvents.length > 0 && (
              <div className="px-5 pb-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">Évènements en cours</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeEvents.map(ev => (
                    <span key={ev.id}
                      className="text-[10px] font-semibold text-orange-300 bg-orange-500/15 border border-orange-500/30 rounded-full px-2 py-0.5">
                      ⚡ {ev.id} {ev.target_job ? `· ${ev.target_job}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Module unavailable */}
        {unavailable && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center">
            <span className="text-4xl block mb-3">🔧</span>
            <p className="text-sm font-semibold text-white">Module hors ligne</p>
            <p className="text-xs text-gray-500 mt-1">Le système de métiers n'est pas disponible pour le moment.</p>
          </div>
        )}

        {/* Active jobs */}
        {activeProgress.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 px-0.5">Mes métiers</p>
            <div className="space-y-3">
              {activeProgress.map(prog => {
                const job       = jobs.find(j => j.id === prog.job_id)
                const isMax     = prog.level >= prog.max_level
                const xpPct     = prog.xp_to_next > 0 ? Math.min(100, Math.round((prog.xp / prog.xp_to_next) * 100)) : 100
                const isHot     = bulletinJob?.id === prog.job_id
                const recent7   = actionsByJob.get(prog.job_id) ?? 0

                return (
                  <button
                    type="button"
                    onClick={() => navigate(`/career/job/${prog.job_id}`)}
                    key={prog.job_id}
                    className={`w-full text-left bg-gray-900 rounded-2xl border overflow-hidden transition-colors hover:border-emerald-500/40 ${
                      isHot ? 'border-yellow-500/40' : 'border-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 p-4">
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                        isHot ? 'bg-yellow-500/15 border-yellow-500/30' : 'bg-emerald-500/10 border-emerald-500/20'
                      }`}>
                        <span className="text-2xl">{job?.icon ?? '💼'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                            {prog.job_name}
                            {isHot && <span className="text-[10px] font-bold text-yellow-400">★ DEMANDE</span>}
                          </p>
                          <span className={`text-xs font-black shrink-0 ${isMax ? 'text-yellow-400' : 'text-emerald-400'}`}>
                            Niv.&nbsp;{prog.level}{isMax ? ' ✦' : `/${prog.max_level}`}
                          </span>
                        </div>
                        {prog.total_earned > 0 && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {fmtEarned(prog.total_earned)} gagnés
                            {recent7 > 0 && <span className="text-gray-600"> · {recent7} actions cette semaine</span>}
                          </p>
                        )}
                      </div>
                      <span className="text-gray-600 text-sm shrink-0">›</span>
                    </div>

                    {/* XP bar */}
                    {!isMax ? (
                      <div className="px-4 pb-4">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
                          <span>Vers niveau {prog.level + 1}</span>
                          <span className="font-mono">{xpPct}%</span>
                        </div>
                        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isHot
                                ? 'bg-gradient-to-r from-yellow-600 to-yellow-400'
                                : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                            }`}
                            style={{ width: `${xpPct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 pb-4">
                        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
                          <span className="text-base">⭐</span>
                          <p className="text-xs text-yellow-400 font-semibold">Niveau maximum atteint !</p>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Not started yet prompt */}
        {!unavailable && activeProgress.length === 0 && jobs.length > 0 && (
          <div className="flex items-center gap-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
            <span className="text-3xl shrink-0">🌱</span>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Tu n'as pas encore de métier actif</p>
              <p className="text-xs text-gray-500 mt-0.5">Rejoins le serveur et utilise /métiers pour commencer.</p>
            </div>
          </div>
        )}

        {/* Available jobs */}
        {inactiveJobs.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 px-0.5">
              {activeProgress.length > 0 ? 'Autres métiers disponibles' : 'Métiers disponibles'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {inactiveJobs.map(job => {
                const isHot = bulletinJob?.id === job.id
                return (
                  <button key={job.id}
                    type="button"
                    onClick={() => navigate(`/career/job/${job.id}`)}
                    className={`text-left bg-gray-900 rounded-2xl border p-4 flex flex-col transition-colors hover:border-emerald-500/40 ${
                      isHot ? 'border-yellow-500/40' : 'border-gray-800'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{job.icon ?? '💼'}</span>
                      {isHot && <span className="text-[10px] font-bold text-yellow-400">★</span>}
                    </div>
                    <p className="text-sm font-bold text-white leading-tight mt-2">{job.name}</p>
                    {job.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 flex-1">{job.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[10px] text-gray-600">Niv. max : {job.max_level}</span>
                      {job.actions && job.actions.length > 0 && (
                        <span className="text-[10px] text-gray-600">{job.actions.length} action{job.actions.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Empty state — no jobs at all */}
        {!unavailable && jobs.length === 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center">
            <span className="text-5xl block mb-3">💼</span>
            <p className="text-sm font-semibold text-white">Aucun métier configuré</p>
            <p className="text-xs text-gray-500 mt-1">Reviens plus tard pour découvrir les métiers disponibles.</p>
          </div>
        )}
      </div>

      <Navbar />
    </div>
  )
}

function MiniStat({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-black/30 border border-gray-800/80 rounded-xl p-3 text-center backdrop-blur">
      <span className="text-xl leading-none">{icon}</span>
      <p className="text-[10px] text-gray-500 mt-1 leading-none">{label}</p>
      <p className={`text-sm font-black mt-1 leading-none truncate ${color}`}>{value}</p>
    </div>
  )
}
