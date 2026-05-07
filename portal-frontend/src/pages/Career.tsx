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
import { GridShell, HeroBanner, StatCard, SectionDivider, Card, Button, Tag } from '../components/ui'

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
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: '#FFB347' }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const joinedIds    = new Set(progress.map(p => p.job_id))
  const inactiveJobs = jobs.filter(j => !joinedIds.has(j.id))
  const totalLevel   = progress.reduce((s, p) => s + p.level, 0)
  const totalEarned  = progress.reduce((s, p) => s + (p.total_earned ?? 0), 0)
  const avgLevel     = progress.length > 0 ? Math.round(totalLevel / progress.length) : 0
  const totalStars   = progress.reduce((s, p) => s + (p.prestige_stars ?? 0), 0)
  const bulletinJob  = dynamics?.bulletin?.job_id ? jobs.find(j => j.id === dynamics.bulletin?.job_id) : null
  const activeEvents = dynamics?.active_events ?? []
  const actionsByJob = new Map<string, number>()
  heatmap?.by_job.forEach(e => actionsByJob.set(e.job_id, e.actions))

  return (
    <div className="min-h-screen" style={{ background: '#080d19' }}>
      <PageAura theme="career" />
      <GridShell>
        <HeroBanner
          eyebrow="Carrière"
          variant="jade"
          title={<>Construis ton <span className="text-emerald-300">empire</span></>}
          subtitle={`${progress.length} métier${progress.length > 1 ? 's' : ''} actif${progress.length > 1 ? 's' : ''} · ${jobs.length} disponible${jobs.length > 1 ? 's' : ''}. Progresse, monte en niveau et débloque des étoiles permanentes.`}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-12 lg:mb-16">
          <StatCard label="Métiers actifs" accent="jade"   icon="💼" value={progress.length} hint={`${jobs.length} disponibles`} />
          <StatCard label="Niveau total"   accent="gold"   icon="✦"  value={totalLevel} hint={`Moy. ${avgLevel}`} />
          <StatCard label="Total gagné"    accent="gold"   icon="💰" value={fmtEarned(totalEarned)} hint="Cumul des revenus" />
          <StatCard label="Étoiles"        accent="violet" icon="⭐" value={totalStars} hint="Prestige cumulé" />
        </div>

        {/* Slots */}
        {slots && (() => {
          const full = slots.used >= slots.max
          const free = Math.max(0, slots.max - slots.used)
          return (
            <Card padding="md" className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(241,245,249,0.55)' }}>Slots métiers</p>
                  <Tag tone="neutral" size="xs">{slots.rank}</Tag>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl font-semibold" style={{ color: full ? '#fb923c' : '#fbbf24' }}>
                    {slots.used}<span style={{ color: 'rgba(241,245,249,0.4)' }}>/</span>{slots.max}
                  </span>
                  <Tag tone={full ? 'rose' : 'gold'} size="xs">{full ? 'Plein' : `${free} libre${free > 1 ? 's' : ''}`}</Tag>
                </div>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: slots.max }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-full" style={{
                    height: 6,
                    background: i < slots.used
                      ? full ? 'linear-gradient(90deg,#f97316,#fb923c)' : 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                      : 'rgba(255,255,255,0.06)',
                  }} />
                ))}
              </div>
            </Card>
          )
        })()}

        {/* Tickets + Dynamics row */}
        {(tickets.length > 0 || dynamics?.enabled) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-12 lg:mb-16">
            {tickets.length > 0 && (
              <Card padding="md">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: '#a78bfa' }}>Tickets actifs</p>
                <div className="flex flex-wrap gap-2">
                  {tickets.map(t => {
                    const h = t.expires_at > Date.now() ? Math.max(1, Math.round((t.expires_at - Date.now()) / 3_600_000)) : 0
                    const label = t.type === 'extra_slot' ? '+1 slot' : t.type === 'xp_boost_25' ? '+25% XP' : t.type === 'bypass_heatmap' ? 'Bypass heatmap' : t.type
                    return <Tag key={t.id} tone="violet">{label} · {h}h</Tag>
                  })}
                </div>
              </Card>
            )}
            {dynamics?.enabled && (
              <Card padding="md">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(241,245,249,0.55)' }}>Monde dynamique</p>
                  <Tag tone="jade" size="xs">● en direct</Tag>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {dynamics.season && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(241,245,249,0.5)' }}>Saison</p>
                      <p className="text-sm font-semibold flex items-center gap-2" style={{ color: '#f8fafc' }}>
                        <span className="text-xl">{dynamics.season.icon}</span>{dynamics.season.label}
                      </p>
                    </div>
                  )}
                  {bulletinJob && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#fbbf24' }}>En demande</p>
                      <p className="text-sm font-semibold truncate" style={{ color: '#f8fafc' }}>
                        {bulletinJob.name}
                        <span className="font-mono ml-1 text-xs" style={{ color: '#fbbf24' }}>×{(dynamics.bulletin?.multiplier ?? 1).toFixed(1)}</span>
                      </p>
                    </div>
                  )}
                </div>
                {activeEvents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {activeEvents.map(ev => (
                      <Tag key={ev.id} tone="rose" size="xs">⚡ {ev.id}{ev.target_job ? ` · ${ev.target_job}` : ''}</Tag>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {unavailable && (
          <Card padding="lg" className="text-center mb-12">
            <span className="text-4xl block mb-3">🔧</span>
            <p className="font-semibold" style={{ color: '#f8fafc' }}>Module hors ligne</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>Le système de métiers n'est pas disponible pour le moment.</p>
          </Card>
        )}

        {/* Active jobs */}
        {progress.length > 0 && (
          <>
            <SectionDivider label="Mes métiers" hint={`${progress.length} en cours`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-12 lg:mb-16">
              {progress.map(prog => {
                const job    = jobs.find(j => j.id === prog.job_id)
                const isMax  = prog.level >= prog.max_level
                const xpPct  = prog.xp_to_next > 0 ? Math.min(100, Math.round((prog.xp / prog.xp_to_next) * 100)) : 100
                const isHot  = bulletinJob?.id === prog.job_id
                const recent = actionsByJob.get(prog.job_id) ?? 0
                return (
                  <Card key={prog.job_id} variant="glass" padding="md" hover className="flex flex-col"
                        style={{ borderColor: isHot ? 'rgba(251,191,36,0.35)' : undefined }}>
                    <div className="flex items-center gap-3 mb-3 cursor-pointer"
                         onClick={() => navigate(`/career/job/${prog.job_id}`)}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                           style={{ background: isHot ? 'rgba(251,191,36,0.10)' : 'rgba(16,185,129,0.06)', border: `1px solid ${isHot ? 'rgba(251,191,36,0.25)' : 'rgba(16,185,129,0.20)'}` }}>
                        <MinecraftIcon icon={job?.icon} size={32} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-base font-semibold truncate" style={{ color: '#f8fafc' }}>{prog.job_name}</p>
                        <p className="text-xs" style={{ color: isMax ? '#fbbf24' : '#34d399' }}>
                          Niv. {prog.level}{isMax ? ' ✦' : ` / ${prog.max_level}`}
                        </p>
                      </div>
                      {isHot && <Tag tone="gold" size="xs">★</Tag>}
                    </div>

                    {!isMax ? (
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] mb-1.5" style={{ color: 'rgba(241,245,249,0.5)' }}>
                          <span>Vers Niv. {prog.level + 1}</span>
                          <span>{xpPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-full rounded-full transition-all"
                               style={{ width: `${xpPct}%`, background: isHot ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#f59e0b,#fb923c)' }} />
                        </div>
                      </div>
                    ) : (
                      <Tag tone="gold">⭐ Niveau max</Tag>
                    )}

                    {prog.total_earned > 0 && (
                      <p className="text-xs mt-2" style={{ color: 'rgba(241,245,249,0.55)' }}>
                        {fmtEarned(prog.total_earned)}
                        {recent > 0 && <span style={{ color: 'rgba(241,245,249,0.4)' }}> · {recent} actions/sem</span>}
                      </p>
                    )}

                    <div className="mt-auto pt-3 grid grid-cols-2 gap-2">
                      <Button to={`/career/job/${prog.job_id}`} variant="secondary" size="sm">Détails</Button>
                      <Button onClick={() => handleLeave(prog.job_id)} disabled={busyJob === prog.job_id} variant="danger" size="sm">
                        {busyJob === prog.job_id ? '…' : 'Quitter'}
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {!unavailable && progress.length === 0 && jobs.length > 0 && (
          <Card padding="lg" className="mb-8 flex items-center gap-4"
                style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.18)' }}>
            <span className="text-4xl shrink-0">🌱</span>
            <div>
              <p className="font-semibold" style={{ color: '#6ee7b7' }}>Aucun métier actif</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>Choisis un métier ci-dessous pour commencer.</p>
            </div>
          </Card>
        )}

        {/* Available jobs */}
        {inactiveJobs.length > 0 && (
          <>
            <SectionDivider label={progress.length > 0 ? 'Autres métiers' : 'Métiers disponibles'} hint={`${inactiveJobs.length} à découvrir`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {inactiveJobs.map(job => {
                const isHot   = bulletinJob?.id === job.id
                const disabled = job.enabled === false
                const noSlot  = !!slots && slots.used >= slots.max
                const canJoin = !disabled && !noSlot && busyJob !== job.id
                return (
                  <Card key={job.id} variant="glass" padding="md" className="flex flex-col"
                        style={{ opacity: disabled ? 0.6 : 1, borderColor: isHot ? 'rgba(251,191,36,0.35)' : undefined }}>
                    <button type="button" onClick={() => navigate(`/career/job/${job.id}`)} className="text-left flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                             style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <MinecraftIcon icon={job.icon} size={32} />
                        </div>
                        {disabled
                          ? <Tag tone="neutral" size="xs">⏸ OFF</Tag>
                          : isHot && <Tag tone="gold" size="xs">★ Demande</Tag>}
                      </div>
                      <p className="font-display text-base font-semibold mb-1" style={{ color: '#f8fafc' }}>{job.name}</p>
                      {job.description && <p className="text-xs flex-1 line-clamp-3" style={{ color: 'rgba(241,245,249,0.55)' }}>{job.description}</p>}
                      <div className="flex justify-between mt-3 mb-3 text-[10px]" style={{ color: 'rgba(241,245,249,0.4)' }}>
                        <span>Niv. max {job.max_level}</span>
                        {(job.actions?.length ?? 0) > 0 && <span>{job.actions!.length} actions</span>}
                      </div>
                    </button>
                    <Button onClick={() => handleJoin(job.id)} disabled={!canJoin} fullWidth size="sm"
                            variant={canJoin ? 'primary' : 'secondary'}>
                      {disabled ? 'Désactivé' : noSlot ? 'Slots pleins' : busyJob === job.id ? '…' : '+ Rejoindre'}
                    </Button>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {!unavailable && jobs.length === 0 && (
          <Card padding="lg" className="text-center">
            <span className="text-4xl block mb-3">💼</span>
            <p className="font-semibold" style={{ color: '#f8fafc' }}>Aucun métier configuré</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>Reviens plus tard.</p>
          </Card>
        )}
      </GridShell>

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
