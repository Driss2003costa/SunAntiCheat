import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  api, getToken, clearToken,
  type PlayerProfile, type CustomJob, type PlayerJobProgress,
  type JobDynamicsSnapshot, type JobHeatmapResponse, type SlotsSnapshot,
  type ActiveTicket,
} from '../api/client'
import Navbar from '../components/Navbar'
import MinecraftIcon from '../components/MinecraftIcon'
import PageAura from '../components/PageAura'
import DegradedNotice from '../components/DegradedNotice'

const GLASS  = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const GOLD   = '#fbbf24'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'

function fmtEarned(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
}

export default function Career() {
  const navigate  = useNavigate()
  const [profile,     setProfile]     = useState<PlayerProfile | null>(null)
  const [jobs,        setJobs]        = useState<CustomJob[]>([])
  const [progress,    setProgress]    = useState<PlayerJobProgress[]>([])
  const [dynamics,    setDynamics]    = useState<JobDynamicsSnapshot | null>(null)
  const [heatmap,     setHeatmap]     = useState<JobHeatmapResponse | null>(null)
  const [slots,       setSlots]       = useState<SlotsSnapshot | null>(null)
  const [tickets,     setTickets]     = useState<ActiveTicket[]>([])
  const [loading,     setLoading]     = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [busyJob,     setBusyJob]     = useState<string | null>(null)
  const [toast,       setToast]       = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const loadAll = async (uuid: string) => {
    const token = getToken()
    const [j, pr, dyn, hm, sl, tk] = await Promise.all([
      api.customJobsList().catch(e => { if (e.status === 503) setUnavailable(true); return [] }),
      api.customJobsPlayer(uuid).catch(() => []),
      api.jobDynamics().catch(() => null),
      api.jobHeatmap(uuid, 7).catch(() => null),
      token ? api.jobSlots(token).catch(() => null)   : Promise.resolve(null),
      token ? api.myTickets(token).catch(() => [])    : Promise.resolve([]),
    ])
    setJobs(j as CustomJob[])
    setProgress(pr as PlayerJobProgress[])
    setDynamics(dyn as JobDynamicsSnapshot | null)
    setHeatmap(hm as JobHeatmapResponse | null)
    setSlots(sl as SlotsSnapshot | null)
    setTickets(tk as ActiveTicket[])
  }

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    api.me(token)
      .then(p => { setProfile(p); return loadAll(p.uuid) })
      .catch(e => { if (e.status === 401) { clearToken(); navigate('/login', { replace: true }) } })
      .finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const handleJoin = async (jobId: string) => {
    const token = getToken(); if (!token || !profile) return
    setBusyJob(jobId)
    try {
      const r = await api.jobJoin(token, jobId)
      setToast({ kind: 'ok', msg: 'Métier rejoint !' })
      setSlots({ used: r.used, max: r.max, rank: r.rank })
      await loadAll(profile.uuid)
    } catch (e: any) {
      const reason = e?.reason ?? ''
      const msg = e?.status === 401       ? 'Session expirée.'
                : reason === 'NO_SLOT'    ? 'Limite de métiers atteinte.'
                : reason === 'DISABLED'   ? 'Ce métier est désactivé.'
                : reason === 'ALREADY_IN' ? 'Déjà dans ce métier.'
                : reason === 'NOT_FOUND'  ? 'Métier introuvable.'
                : 'Action impossible.'
      setToast({ kind: 'err', msg })
    } finally { setBusyJob(null) }
  }

  const handleLeave = async (jobId: string) => {
    const token = getToken(); if (!token || !profile) return
    if (!window.confirm('Quitter ce métier ? Tu garderas ton XP.')) return
    setBusyJob(jobId)
    try {
      const r = await api.jobLeave(token, jobId)
      setToast({ kind: 'ok', msg: 'Métier quitté.' })
      setSlots({ used: r.used, max: r.max, rank: r.rank })
      await loadAll(profile.uuid)
    } catch (e: any) {
      setToast({ kind: 'err', msg: e?.status === 401 ? 'Session expirée.' : 'Action impossible.' })
    } finally { setBusyJob(null) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080d19' }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const joinedIds   = new Set(progress.map(p => p.job_id))
  const inactiveJobs = jobs.filter(j => !joinedIds.has(j.id))
  const totalLevel  = progress.reduce((s, p) => s + p.level, 0)
  const totalEarned = progress.reduce((s, p) => s + (p.total_earned ?? 0), 0)
  const bulletinJob = dynamics?.bulletin?.job_id ? jobs.find(j => j.id === dynamics.bulletin?.job_id) : null
  const activeEvents = dynamics?.active_events ?? []
  const actionsByJob = new Map<string, number>()
  heatmap?.by_job.forEach(e => actionsByJob.set(e.job_id, e.actions))

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080d19' }}>
      <PageAura theme="career" />

      {/* Header */}
      <div className="relative z-10 px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
        <DegradedNotice sectionKey="career"/>
        <h1 className="text-xl font-bold mb-1" style={{ color: TEXT }}>Carrière</h1>
        <p className="text-sm mb-6" style={{ color: MUTED }}>{profile.username}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: 'Métiers actifs',  value: String(progress.length) },
            { label: 'Niveau total',    value: String(totalLevel) },
            { label: 'Total gagné',     value: fmtEarned(totalEarned) },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center"
                 style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
              <p className="text-sm font-bold truncate" style={{ color: TEXT }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Slots */}
        {slots && (() => {
          const full = slots.used >= slots.max
          const free = Math.max(0, slots.max - slots.used)
          return (
            <div className="rounded-2xl px-4 py-3 mb-4"
                 style={{ background: GLASS, border: `1px solid ${full ? 'rgba(249,115,22,0.3)' : BORDER}`, backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: MUTED }}>Slots métiers</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'rgba(255,255,255,0.05)', color: MUTED }}>{slots.rank}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: full ? '#fb923c' : GOLD }}>
                    {slots.used}<span style={{ color: MUTED }}>/</span>{slots.max}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: full ? 'rgba(249,115,22,0.15)' : 'rgba(251,191,36,0.1)',
                          color: full ? '#fb923c' : GOLD,
                          border: `1px solid ${full ? 'rgba(249,115,22,0.3)' : 'rgba(251,191,36,0.25)'}`,
                        }}>
                    {full ? 'Plein' : `${free} libre${free > 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: slots.max }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-full" style={{
                    height: 4,
                    background: i < slots.used
                      ? full ? 'linear-gradient(90deg,#f97316,#fb923c)' : 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                      : 'rgba(255,255,255,0.06)',
                  }} />
                ))}
              </div>
            </div>
          )
        })()}

        {/* Tickets */}
        {tickets.length > 0 && (
          <div className="rounded-2xl px-4 py-3 mb-4"
               style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#a78bfa' }}>Tickets actifs</p>
            <div className="flex flex-wrap gap-2">
              {tickets.map(t => {
                const h = t.expires_at > Date.now() ? Math.max(1, Math.round((t.expires_at - Date.now()) / 3_600_000)) : 0
                const label = t.type === 'extra_slot' ? '+1 slot' : t.type === 'xp_boost_25' ? '+25% XP' : t.type === 'bypass_heatmap' ? 'Bypass heatmap' : t.type
                return (
                  <span key={t.id} className="text-[11px] font-semibold rounded-full px-2.5 py-1"
                        style={{ color: '#c4b5fd', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)' }}>
                    {label} · {h}h
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* World dynamics */}
        {dynamics?.enabled && (
          <div className="rounded-2xl overflow-hidden mb-4"
               style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: BORDER }}>
              <span className="text-sm font-semibold" style={{ color: TEXT }}>Monde dynamique</span>
              <span className="text-[10px]" style={{ color: MUTED }}>en direct</span>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-3">
              {dynamics.season && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${BORDER}` }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: MUTED }}>Saison</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{dynamics.season.icon}</span>
                    <p className="text-sm font-semibold" style={{ color: TEXT }}>{dynamics.season.label}</p>
                  </div>
                </div>
              )}
              {bulletinJob ? (
                <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(251,191,36,0.25)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: GOLD }}>En demande</p>
                  <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                    {bulletinJob.name}
                    <span className="font-mono ml-1 text-xs" style={{ color: GOLD }}>×{(dynamics.bulletin?.multiplier ?? 1).toFixed(1)}</span>
                  </p>
                </div>
              ) : (
                <div className="rounded-xl p-3 opacity-40" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER}` }}>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Bulletin</p>
                  <p className="text-xs mt-1" style={{ color: MUTED }}>À venir</p>
                </div>
              )}
            </div>
            {activeEvents.length > 0 && (
              <div className="px-4 pb-3">
                <div className="flex flex-wrap gap-1.5">
                  {activeEvents.map(ev => (
                    <span key={ev.id} className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                          style={{ color: '#fdba74', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>
                      ⚡ {ev.id} {ev.target_job ? `· ${ev.target_job}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unavailable */}
        {unavailable && (
          <div className="rounded-2xl p-8 text-center mb-4"
               style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
            <span className="text-4xl block mb-3">🔧</span>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>Module hors ligne</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>Le système de métiers n'est pas disponible pour le moment.</p>
          </div>
        )}

        {/* Active jobs */}
        {progress.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: MUTED }}>Mes métiers</p>
            <div className="space-y-3">
              {progress.map(prog => {
                const job    = jobs.find(j => j.id === prog.job_id)
                const isMax  = prog.level >= prog.max_level
                const xpPct  = prog.xp_to_next > 0 ? Math.min(100, Math.round((prog.xp / prog.xp_to_next) * 100)) : 100
                const isHot  = bulletinJob?.id === prog.job_id
                const recent = actionsByJob.get(prog.job_id) ?? 0
                return (
                  <div key={prog.job_id} className="rounded-2xl overflow-hidden"
                       style={{ background: GLASS, border: `1px solid ${isHot ? 'rgba(251,191,36,0.3)' : BORDER}`, backdropFilter: 'blur(12px)' }}>
                    <div className="flex items-center gap-3 p-4 cursor-pointer"
                         onClick={() => navigate(`/career/job/${prog.job_id}`)}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                           style={{ background: isHot ? 'rgba(251,191,36,0.1)' : 'rgba(16,185,129,0.06)', border: `1px solid ${isHot ? 'rgba(251,191,36,0.25)' : 'rgba(16,185,129,0.15)'}` }}>
                        <MinecraftIcon icon={job?.icon} size={32} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                            {prog.job_name}
                            {isHot && <span className="ml-1.5 text-[10px] font-bold" style={{ color: GOLD }}>★ DEMANDE</span>}
                          </p>
                          <span className="text-xs font-bold shrink-0" style={{ color: isMax ? GOLD : '#34d399' }}>
                            Niv.{prog.level}{isMax ? ' ✦' : `/${prog.max_level}`}
                          </span>
                        </div>
                        {prog.total_earned > 0 && (
                          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                            {fmtEarned(prog.total_earned)}
                            {recent > 0 && <span style={{ color: '#475569' }}> · {recent} actions cette semaine</span>}
                          </p>
                        )}
                      </div>
                      <span style={{ color: MUTED }}>›</span>
                    </div>
                    {!isMax ? (
                      <div className="px-4 pb-3 cursor-pointer" onClick={() => navigate(`/career/job/${prog.job_id}`)}>
                        <div className="flex justify-between text-[10px] mb-1.5" style={{ color: MUTED }}>
                          <span>Vers niveau {prog.level + 1}</span>
                          <span>{xpPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-full rounded-full transition-all"
                               style={{ width: `${xpPct}%`, background: isHot ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#f59e0b,#fb923c)' }} />
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 pb-3 cursor-pointer" onClick={() => navigate(`/career/job/${prog.job_id}`)}>
                        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                             style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
                          <span>⭐</span>
                          <p className="text-xs font-semibold" style={{ color: GOLD }}>Niveau maximum atteint !</p>
                        </div>
                      </div>
                    )}
                    <div className="px-4 pb-4">
                      <button type="button" disabled={busyJob === prog.job_id} onClick={() => handleLeave(prog.job_id)}
                        className="w-full text-xs font-semibold rounded-xl px-3 py-2 transition-colors"
                        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: busyJob === prog.job_id ? MUTED : '#f87171', cursor: busyJob === prog.job_id ? 'wait' : 'pointer' }}>
                        {busyJob === prog.job_id ? '…' : '✕ Quitter ce métier'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No active */}
        {!unavailable && progress.length === 0 && jobs.length > 0 && (
          <div className="flex items-center gap-4 rounded-2xl p-4 mb-4"
               style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.18)' }}>
            <span className="text-3xl shrink-0">🌱</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#6ee7b7' }}>Aucun métier actif</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>Rejoins le serveur et utilise /métiers pour commencer.</p>
            </div>
          </div>
        )}

        {/* Available jobs */}
        {inactiveJobs.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: MUTED }}>
              {progress.length > 0 ? 'Autres métiers' : 'Métiers disponibles'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {inactiveJobs.map(job => {
                const isHot   = bulletinJob?.id === job.id
                const disabled = job.enabled === false
                const noSlot  = !!slots && slots.used >= slots.max
                const canJoin = !disabled && !noSlot && busyJob !== job.id
                return (
                  <div key={job.id} className="rounded-2xl p-4 flex flex-col"
                       style={{ background: GLASS, border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : isHot ? 'rgba(251,191,36,0.3)' : BORDER}`, backdropFilter: 'blur(12px)', opacity: disabled ? 0.6 : 1 }}>
                    <button type="button" onClick={() => navigate(`/career/job/${job.id}`)} className="text-left flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <MinecraftIcon icon={job.icon} size={36} />
                        {disabled
                          ? <span className="text-[10px]" style={{ color: MUTED }}>⏸ OFF</span>
                          : isHot && <span className="text-[10px] font-bold" style={{ color: GOLD }}>★</span>}
                      </div>
                      <p className="text-sm font-semibold leading-tight" style={{ color: TEXT }}>{job.name}</p>
                      {job.description && <p className="text-xs mt-1 line-clamp-2 flex-1" style={{ color: MUTED }}>{job.description}</p>}
                      <div className="flex justify-between mt-2 mb-3">
                        <span className="text-[10px]" style={{ color: '#475569' }}>Niv. max {job.max_level}</span>
                        {(job.actions?.length ?? 0) > 0 && <span className="text-[10px]" style={{ color: '#475569' }}>{job.actions!.length} action{job.actions!.length > 1 ? 's' : ''}</span>}
                      </div>
                    </button>
                    <button type="button" disabled={!canJoin} onClick={() => handleJoin(job.id)}
                      className="w-full text-xs font-semibold rounded-xl px-3 py-2 transition-colors"
                      style={{
                        background: canJoin ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)',
                        border: canJoin ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.06)',
                        color: canJoin ? GOLD : MUTED,
                        cursor: canJoin ? 'pointer' : 'not-allowed',
                      }}>
                      {disabled ? 'Désactivé' : noSlot ? 'Slots pleins' : busyJob === job.id ? '…' : '+ Rejoindre'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!unavailable && jobs.length === 0 && (
          <div className="rounded-2xl p-10 text-center"
               style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
            <span className="text-4xl block mb-3">💼</span>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>Aucun métier configuré</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>Reviens plus tard.</p>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <div className={`px-4 py-2 rounded-full text-xs font-semibold shadow-lg border ${toast.kind === 'ok' ? 'text-gray-900' : 'text-white'}`}
               style={{
                 background: toast.kind === 'ok' ? 'linear-gradient(135deg,#f59e0b,#fb923c)' : 'rgba(239,68,68,0.95)',
                 borderColor: toast.kind === 'ok' ? '#fbbf24' : '#f87171',
               }}>
            {toast.kind === 'ok' ? '✔ ' : '⚠ '}{toast.msg}
          </div>
        </div>
      )}

      <Navbar />
    </div>
  )
}
