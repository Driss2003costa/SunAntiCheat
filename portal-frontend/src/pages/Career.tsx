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

const BG     = '#080d19'
const CARD   = 'rgba(15,22,40,0.85)'
const BORDER = 'rgba(251,191,36,0.12)'
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
      .catch(e => {
        if (e.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      })
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
      const msg = e?.status === 401       ? 'Session expirée, reconnecte-toi.'
                : reason === 'NO_SLOT'    ? 'Tu as atteint ta limite de métiers.'
                : reason === 'DISABLED'   ? 'Ce métier est désactivé.'
                : reason === 'ALREADY_IN' ? 'Tu es déjà dans ce métier.'
                : reason === 'NOT_FOUND'  ? 'Métier introuvable.'
                : 'Action impossible.'
      setToast({ kind: 'err', msg })
    } finally {
      setBusyJob(null)
    }
  }

  const handleLeave = async (jobId: string) => {
    const token = getToken(); if (!token || !profile) return
    if (!window.confirm('Quitter ce métier ? Tu garderas ton XP, mais tu devras le re-rejoindre pour gagner à nouveau.')) return
    setBusyJob(jobId)
    try {
      const r = await api.jobLeave(token, jobId)
      setToast({ kind: 'ok', msg: 'Métier quitté.' })
      setSlots({ used: r.used, max: r.max, rank: r.rank })
      await loadAll(profile.uuid)
    } catch (e: any) {
      if (e?.status === 401) {
        setToast({ kind: 'err', msg: 'Session expirée, reconnecte-toi.' })
      } else {
        setToast({ kind: 'err', msg: 'Action impossible.' })
      }
    } finally {
      setBusyJob(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center pb-20" style={{ background: BG }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const activeProgress = progress
  const totalLevel     = progress.reduce((s, p) => s + p.level, 0)
  const totalEarned    = progress.reduce((s, p) => s + (p.total_earned ?? 0), 0)
  const joinedIds      = new Set(progress.map(p => p.job_id))
  const inactiveJobs   = jobs.filter(j => !joinedIds.has(j.id))

  const bulletinJob = dynamics?.bulletin?.job_id
    ? jobs.find(j => j.id === dynamics.bulletin?.job_id)
    : null
  const activeEvents = dynamics?.active_events ?? []

  const actionsByJob = new Map<string, number>()
  heatmap?.by_job.forEach(e => actionsByJob.set(e.job_id, e.actions))

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: BG }}>
      <PageAura theme="career" />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden z-10">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(251,191,36,0.14),transparent)' }} />

        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">📈</span>
            <div>
              <h1 className="text-2xl font-black" style={{ color: TEXT }}>Carrière</h1>
              <p className="text-sm" style={{ color: MUTED }}>{profile.username}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniStat icon="🏅" label="Métiers actifs"  value={String(activeProgress.length)} />
            <MiniStat icon="⚡" label="Niveau total"    value={String(totalLevel)} />
            <MiniStat icon="💰" label="Total gagné"     value={fmtEarned(totalEarned)} />
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-sm mx-auto relative z-10">

        {/* Slots banner */}
        {slots && (() => {
          const full = slots.used >= slots.max
          const free = Math.max(0, slots.max - slots.used)
          return (
            <div className="rounded-2xl px-4 py-3 backdrop-blur-sm"
                 style={{
                   background: full ? 'rgba(249,115,22,0.07)' : CARD,
                   border: `1px solid ${full ? 'rgba(249,115,22,0.3)' : BORDER}`,
                 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎟️</span>
                  <span className="text-xs uppercase tracking-widest" style={{ color: MUTED }}>Slots métiers</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(251,191,36,0.08)', color: MUTED }}>
                    {slots.rank}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: full ? '#fb923c' : GOLD }}>
                    {slots.used}
                    <span style={{ color: MUTED, fontWeight: 400 }} className="mx-0.5">/</span>
                    {slots.max}
                  </span>
                  {full ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.35)' }}>
                      Plein
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.15)', color: GOLD, border: `1px solid ${BORDER}` }}>
                      {free} libre{free > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: slots.max }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-full transition-all duration-300"
                       style={{
                         height: 5,
                         background: i < slots.used
                           ? full
                             ? 'linear-gradient(90deg,#f97316,#fb923c)'
                             : 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                           : 'rgba(255,255,255,0.06)',
                       }} />
                ))}
                {slots.used > slots.max && Array.from({ length: slots.used - slots.max }).map((_, i) => (
                  <div key={`over-${i}`} className="flex-1 rounded-full"
                       style={{ height: 5, background: '#ef4444' }} />
                ))}
              </div>
            </div>
          )
        })()}

        {/* Active tickets */}
        {tickets.length > 0 && (
          <div className="rounded-2xl px-4 py-3 backdrop-blur-sm"
               style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2"
               style={{ color: '#a78bfa' }}>🎫 Tickets actifs</p>
            <div className="flex flex-wrap gap-2">
              {tickets.map(t => {
                const remainingMs = t.expires_at - Date.now()
                const remainingH = remainingMs > 0 ? Math.max(1, Math.round(remainingMs / 3_600_000)) : 0
                const label =
                  t.type === 'extra_slot'     ? '+1 slot métier' :
                  t.type === 'xp_boost_25'    ? '+25% XP' :
                  t.type === 'bypass_heatmap' ? 'Bypass heatmap' : t.type
                return (
                  <span key={t.id} className="text-[11px] font-semibold rounded-full px-2.5 py-1"
                        style={{ color: '#c4b5fd', background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)' }}>
                    {label} · {remainingH}h
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* World Dynamics */}
        {dynamics?.enabled && (
          <section className="rounded-2xl overflow-hidden backdrop-blur-sm"
                   style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="px-5 py-3 flex items-center justify-between"
                 style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2">
                <span>🌍</span>
                <span className="text-sm font-semibold" style={{ color: TEXT }}>Monde dynamique</span>
              </div>
              <span className="text-[10px]" style={{ color: MUTED }}>en direct</span>
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              {dynamics.season && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{dynamics.season.icon}</span>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Saison</p>
                      <p className="text-sm font-bold" style={{ color: TEXT }}>{dynamics.season.label}</p>
                    </div>
                  </div>
                </div>
              )}

              {bulletinJob ? (
                <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(251,191,36,0.3)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📰</span>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: GOLD }}>Demande</p>
                      <p className="text-sm font-bold truncate" style={{ color: TEXT }}>
                        {bulletinJob.name}
                        <span className="font-mono ml-1" style={{ color: GOLD }}>×{(dynamics.bulletin?.multiplier ?? 1).toFixed(1)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-3 opacity-50" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📰</span>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Bulletin</p>
                      <p className="text-xs" style={{ color: MUTED }}>À venir</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {activeEvents.length > 0 && (
              <div className="px-5 pb-4">
                <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: MUTED }}>Évènements en cours</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeEvents.map(ev => (
                    <span key={ev.id}
                      className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                      style={{ color: '#fdba74', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
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
          <div className="rounded-2xl p-8 text-center backdrop-blur-sm"
               style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <span className="text-4xl block mb-3">🔧</span>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>Module hors ligne</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>Le système de métiers n'est pas disponible pour le moment.</p>
          </div>
        )}

        {/* Active jobs */}
        {activeProgress.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-0.5" style={{ color: MUTED }}>Mes métiers</p>
            <div className="space-y-3">
              {activeProgress.map(prog => {
                const job       = jobs.find(j => j.id === prog.job_id)
                const isMax     = prog.level >= prog.max_level
                const xpPct     = prog.xp_to_next > 0 ? Math.min(100, Math.round((prog.xp / prog.xp_to_next) * 100)) : 100
                const isHot     = bulletinJob?.id === prog.job_id
                const recent7   = actionsByJob.get(prog.job_id) ?? 0

                return (
                  <div key={prog.job_id}
                    className="rounded-2xl overflow-hidden cursor-pointer backdrop-blur-sm transition-all"
                    style={{
                      background: CARD,
                      border: `1px solid ${isHot ? 'rgba(251,191,36,0.4)' : BORDER}`,
                      boxShadow: isHot ? '0 0 20px rgba(251,191,36,0.06)' : 'none',
                    }}>
                    <div className="flex items-center gap-3 p-4"
                         onClick={() => navigate(`/career/job/${prog.job_id}`)}>
                      <div className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0"
                           style={{
                             background: isHot ? 'rgba(251,191,36,0.12)' : 'rgba(16,185,129,0.08)',
                             border: `1px solid ${isHot ? 'rgba(251,191,36,0.3)' : 'rgba(16,185,129,0.2)'}`,
                           }}>
                        <MinecraftIcon icon={job?.icon} size={32} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-bold truncate flex items-center gap-1.5" style={{ color: TEXT }}>
                            {prog.job_name}
                            {isHot && <span className="text-[10px] font-bold" style={{ color: GOLD }}>★ DEMANDE</span>}
                          </p>
                          <span className="text-xs font-black shrink-0" style={{ color: isMax ? GOLD : '#34d399' }}>
                            Niv.&nbsp;{prog.level}{isMax ? ' ✦' : `/${prog.max_level}`}
                          </span>
                        </div>
                        {prog.total_earned > 0 && (
                          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                            {fmtEarned(prog.total_earned)} gagnés
                            {recent7 > 0 && <span style={{ color: '#475569' }}> · {recent7} actions cette semaine</span>}
                          </p>
                        )}
                      </div>
                      <span className="text-sm shrink-0" style={{ color: MUTED }}>›</span>
                    </div>

                    {/* XP bar */}
                    <div onClick={() => navigate(`/career/job/${prog.job_id}`)}>
                      {!isMax ? (
                        <div className="px-4 pb-3">
                          <div className="flex justify-between text-[10px] mb-1.5" style={{ color: MUTED }}>
                            <span>Vers niveau {prog.level + 1}</span>
                            <span className="font-mono">{xpPct}%</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${xpPct}%`,
                                background: isHot
                                  ? 'linear-gradient(90deg,#d97706,#fbbf24)'
                                  : 'linear-gradient(90deg,#f59e0b,#fb923c)',
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 pb-3">
                          <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                               style={{ background: 'rgba(251,191,36,0.08)', border: `1px solid rgba(251,191,36,0.2)` }}>
                            <span className="text-base">⭐</span>
                            <p className="text-xs font-semibold" style={{ color: GOLD }}>Niveau maximum atteint !</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        disabled={busyJob === prog.job_id}
                        onClick={() => handleLeave(prog.job_id)}
                        className="w-full text-center text-xs font-semibold rounded-xl px-3 py-2 border transition-colors"
                        style={{
                          background: busyJob === prog.job_id ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.08)',
                          border: 'rgba(239,68,68,0.3) 1px solid',
                          color: busyJob === prog.job_id ? MUTED : '#f87171',
                          cursor: busyJob === prog.job_id ? 'wait' : 'pointer',
                        }}>
                        {busyJob === prog.job_id ? '…' : '✖ Quitter ce métier'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Not started yet */}
        {!unavailable && activeProgress.length === 0 && jobs.length > 0 && (
          <div className="flex items-center gap-4 rounded-2xl p-4 backdrop-blur-sm"
               style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <span className="text-3xl shrink-0">🌱</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#6ee7b7' }}>Tu n'as pas encore de métier actif</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>Rejoins le serveur et utilise /métiers pour commencer.</p>
            </div>
          </div>
        )}

        {/* Available jobs */}
        {inactiveJobs.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-0.5" style={{ color: MUTED }}>
              {activeProgress.length > 0 ? 'Autres métiers disponibles' : 'Métiers disponibles'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {inactiveJobs.map(job => {
                const isHot    = bulletinJob?.id === job.id
                const disabled = job.enabled === false
                const noSlot   = !!slots && slots.used >= slots.max
                const canJoin  = !disabled && !noSlot && busyJob !== job.id
                const joinLabel = disabled ? 'Désactivé'
                                : noSlot   ? 'Slots pleins'
                                : busyJob === job.id ? '…' : '➕ Rejoindre'
                return (
                  <div key={job.id}
                    className="rounded-2xl p-4 flex flex-col backdrop-blur-sm"
                    style={{
                      background: CARD,
                      border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : isHot ? 'rgba(251,191,36,0.35)' : BORDER}`,
                      opacity: disabled ? 0.6 : 1,
                    }}>
                    <button type="button" onClick={() => navigate(`/career/job/${job.id}`)}
                      className="text-left flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <MinecraftIcon icon={job.icon} size={36} />
                        {disabled
                          ? <span className="text-[10px] font-bold" style={{ color: MUTED }}>⏸ OFF</span>
                          : isHot && <span className="text-[10px] font-bold" style={{ color: GOLD }}>★</span>}
                      </div>
                      <p className="text-sm font-bold leading-tight mt-2" style={{ color: TEXT }}>{job.name}</p>
                      {job.description && (
                        <p className="text-xs mt-1 line-clamp-2 flex-1" style={{ color: MUTED }}>{job.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-3 mb-3">
                        <span className="text-[10px]" style={{ color: '#475569' }}>Niv. max : {job.max_level}</span>
                        {job.actions && job.actions.length > 0 && (
                          <span className="text-[10px]" style={{ color: '#475569' }}>{job.actions.length} action{job.actions.length > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </button>

                    <button type="button" disabled={!canJoin} onClick={() => handleJoin(job.id)}
                      className="w-full text-center text-xs font-semibold rounded-xl px-3 py-2 border transition-colors"
                      style={{
                        background: canJoin ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.03)',
                        border: canJoin ? `1px solid rgba(251,191,36,0.3)` : '1px solid rgba(255,255,255,0.06)',
                        color: canJoin ? GOLD : MUTED,
                        cursor: canJoin ? 'pointer' : 'not-allowed',
                      }}>
                      {joinLabel}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!unavailable && jobs.length === 0 && (
          <div className="rounded-2xl p-10 text-center backdrop-blur-sm"
               style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <span className="text-5xl block mb-3">💼</span>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>Aucun métier configuré</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>Reviens plus tard pour découvrir les métiers disponibles.</p>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <div className={`px-4 py-2 rounded-full text-xs font-semibold shadow-lg border ${
            toast.kind === 'ok'
              ? 'text-gray-900'
              : 'text-white'
          }`}
               style={{
                 background: toast.kind === 'ok'
                   ? 'linear-gradient(135deg,#f59e0b,#fb923c)'
                   : 'rgba(239,68,68,0.95)',
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

function MiniStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 text-center backdrop-blur-sm"
         style={{ background: 'rgba(15,22,40,0.8)', border: '1px solid rgba(251,191,36,0.12)' }}>
      <span className="text-xl leading-none">{icon}</span>
      <p className="text-[10px] mt-1 leading-none" style={{ color: '#64748b' }}>{label}</p>
      <p className="text-sm font-black mt-1 leading-none truncate" style={{ color: '#fbbf24' }}>{value}</p>
    </div>
  )
}
