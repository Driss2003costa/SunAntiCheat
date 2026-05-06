import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import SunGuardBg from '../components/SunGuardBg'

type LpGroup = { name: string; display: string; color: string | null }
type Vip = { active: boolean; plan?: string; expires_at?: number }
type Quest = { questId: string; title: string; icon: string; color: string; progress: number; goal: number }
type Trophy = { id: string; name: string; icon: string; rarity: 'common' | 'rare' | 'epic' | 'legendary' }
type Sanction = { type: string; reason: string; expires_at: number | null }

type Profile = {
  uuid: string
  username: string
  role: string
  online: boolean
  created_at: number
  last_seen: number | null
  bio: string
  playtime_seconds?: number
  playtime_formatted?: string
  playtime_rank?: number
  playtime_rank_total?: number
  lp_group?: LpGroup
  vip?: Vip
  daily_streak?: number
  quests?: { completed_count: number; active: Quest[] }
  active_sanctions?: Sanction[]
  trophies?: Trophy[]
}

const GLASS   = 'rgba(255,255,255,0.05)'
const BORDER  = 'rgba(255,255,255,0.08)'
const AMBER   = 'rgba(251,191,36,0.12)'
const AMBER_B = 'rgba(251,191,36,0.25)'

const ROLE_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  ADMIN:     { label: 'Admin',     bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  MODERATOR: { label: 'Modérateur', bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc' },
  VIP:       { label: 'VIP',       bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
  PLAYER:    { label: 'Joueur',    bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' },
}

const RARITY_STYLE = {
  common:    { label: 'Commun',    color: '#94a3b8', glow: 'rgba(148,163,184,0.25)' },
  rare:      { label: 'Rare',      color: '#60a5fa', glow: 'rgba(96,165,250,0.25)' },
  epic:      { label: 'Épique',    color: '#c084fc', glow: 'rgba(192,132,252,0.25)' },
  legendary: { label: 'Légendaire',color: '#fbbf24', glow: 'rgba(251,191,36,0.35)' },
}

function lastSeen(ts: number | null | undefined, online: boolean): string {
  if (online) return 'En ligne maintenant'
  if (!ts) return 'Jamais connecté'
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 2)   return 'Vu à l\'instant'
  if (m < 60)  return `Vu il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `Vu il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30)  return `Vu il y a ${d}j`
  const mo = Math.floor(d / 30)
  return `Vu il y a ${mo} mois`
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    if (!username) return
    setLoading(true); setError('')
    fetch(`/api/public/profile/${encodeURIComponent(username)}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw data
        setProfile(data)
      })
      .catch(e => setError(e.message || 'Profil introuvable.'))
      .finally(() => setLoading(false))
  }, [username])

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const role = profile ? (ROLE_STYLE[profile.role] ?? ROLE_STYLE.PLAYER) : null

  return (
    <SunGuardBg>
      <div className="min-h-screen pb-16">

        {/* Navbar */}
        <header style={{ borderBottom: `1px solid ${BORDER}`, background: 'rgba(6,9,15,0.7)', backdropFilter: 'blur(12px)' }}
                className="sticky top-0 z-20 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="6" fill="#fbbf24" />
                {[0,45,90,135,180,225,270,315].map((deg, i) => (
                  <line key={i}
                    x1={14 + Math.cos((deg-90)*Math.PI/180)*8}
                    y1={14 + Math.sin((deg-90)*Math.PI/180)*8}
                    x2={14 + Math.cos((deg-90)*Math.PI/180)*12}
                    y2={14 + Math.sin((deg-90)*Math.PI/180)*12}
                    stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                ))}
              </svg>
              <span className="text-sm font-bold tracking-widest text-white/90 group-hover:text-white transition-colors">
                SUNGUARD
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-xs text-white/50">
              <Link to="/leaderboard" className="hover:text-white/80 transition-colors">Classement</Link>
              <Link to="/login"
                    className="px-4 py-1.5 rounded-full text-amber-300 hover:text-amber-200 transition-colors"
                    style={{ border: '1px solid rgba(251,191,36,0.3)' }}>
                Connexion
              </Link>
            </nav>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-5 pt-8">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-32">
              <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-amber-400 animate-spin" />
              <p className="text-sm text-white/40">Chargement du profil…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="max-w-md mx-auto mt-16 text-center p-10 rounded-2xl"
                 style={{ background: GLASS, border: `1px solid ${BORDER}` }}>
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-xl font-bold text-white mb-2">Profil introuvable</p>
              <p className="text-sm text-white/50 mb-6">{error}</p>
              <Link to="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-amber-300 transition-colors hover:text-amber-200"
                    style={{ background: AMBER, border: `1px solid ${AMBER_B}` }}>
                Créer un compte
              </Link>
            </div>
          )}

          {profile && (
            <div className="space-y-5">

              {/* Hero card */}
              <div className="rounded-2xl overflow-hidden"
                   style={{ background: GLASS, border: `1px solid ${BORDER}` }}>

                {/* Top amber strip */}
                <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.5), transparent)' }} />

                <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-7 items-center sm:items-start">

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {profile.online && (
                      <div className="absolute inset-0 rounded-xl pointer-events-none"
                           style={{ boxShadow: '0 0 32px rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.3)' }} />
                    )}
                    <div className="rounded-xl overflow-hidden"
                         style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${BORDER}` }}>
                      <img
                        src={`https://mc-heads.net/body/${profile.username}/160`}
                        alt={profile.username}
                        className="h-40 w-auto block"
                        style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 8px 24px rgba(251,191,36,0.15))' }}
                        onError={e => {
                          const img = e.target as HTMLImageElement
                          img.src = `https://mc-heads.net/avatar/${profile.username}/128`
                          img.className = 'w-32 h-32 block'
                        }}
                      />
                    </div>
                    {/* Online dot */}
                    <div className="absolute -bottom-1 -right-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                         style={{
                           background: profile.online ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.2)',
                           border: `1px solid ${profile.online ? 'rgba(34,197,94,0.35)' : 'rgba(100,116,139,0.3)'}`,
                           color: profile.online ? '#4ade80' : '#94a3b8',
                         }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: profile.online ? '#4ade80' : '#64748b',
                                     boxShadow: profile.online ? '0 0 6px #4ade80' : 'none' }} />
                      {profile.online ? 'En ligne' : lastSeen(profile.last_seen, false)}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    {/* Bio */}
                    {profile.bio && (
                      <p className="text-sm italic text-white/50 mb-3">« {profile.bio} »</p>
                    )}

                    {/* Username */}
                    <h1 className="text-4xl sm:text-5xl font-black text-white leading-none tracking-tight mb-3"
                        style={{ textShadow: '0 4px 24px rgba(251,191,36,0.2)' }}>
                      {profile.username}
                    </h1>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mb-4">
                      {role && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ background: role.bg, color: role.color }}>
                          {role.label}
                        </span>
                      )}
                      {profile.vip?.active && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                          ✦ {profile.vip.plan ?? 'VIP'}
                        </span>
                      )}
                      {profile.lp_group && profile.lp_group.name !== 'default' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ background: 'rgba(255,255,255,0.06)', color: profile.lp_group.color || 'white' }}>
                          {profile.lp_group.display}
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <p className="text-xs text-white/30">Membre depuis {fmtDate(profile.created_at)}</p>
                  </div>

                  {/* Share btn */}
                  <button onClick={copyLink}
                          className="shrink-0 self-start px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                          style={{ background: GLASS, border: `1px solid ${BORDER}`, color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)' }}>
                    {copied ? '✓ Copié' : '⬡ Partager'}
                  </button>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: '⏱', label: 'Temps de jeu', value: profile.playtime_formatted ?? '—' },
                  { icon: '🏆', label: 'Classement',   value: profile.playtime_rank ? `#${profile.playtime_rank}` : '—' },
                  { icon: '🔥', label: 'Streak',       value: profile.daily_streak != null ? `${profile.daily_streak}j` : '—' },
                  { icon: '✅', label: 'Quêtes',        value: profile.quests ? String(profile.quests.completed_count) : '—' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl p-4 text-center"
                       style={{ background: GLASS, border: `1px solid ${BORDER}` }}>
                    <div className="text-2xl mb-1">{stat.icon}</div>
                    <div className="text-xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-white/40 mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Active quests */}
              {(profile.quests?.active?.length ?? 0) > 0 && (
                <div className="rounded-2xl p-5 sm:p-6" style={{ background: GLASS, border: `1px solid ${BORDER}` }}>
                  <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest mb-4">Quêtes en cours</h2>
                  <div className="space-y-4">
                    {profile.quests!.active.map(q => {
                      const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.goal)) * 100))
                      return (
                        <div key={q.questId}>
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-lg shrink-0">{q.icon}</span>
                              <span className="text-sm text-white/80 font-medium truncate">{q.title}</span>
                            </span>
                            <span className="text-xs text-white/40 shrink-0">{q.progress}/{q.goal}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full transition-all"
                                 style={{ width: `${pct}%`, background: q.color, boxShadow: `0 0 8px ${q.color}60` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Trophies */}
              {(profile.trophies?.length ?? 0) > 0 && (
                <div className="rounded-2xl p-5 sm:p-6" style={{ background: GLASS, border: `1px solid ${BORDER}` }}>
                  <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest mb-4">Trophées</h2>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                    {profile.trophies!.map(t => {
                      const r = RARITY_STYLE[t.rarity]
                      return (
                        <div key={t.id} title={`${t.name} — ${r.label}`}
                             className="rounded-xl p-3 flex flex-col items-center gap-1.5 cursor-default transition-transform hover:scale-105"
                             style={{ background: GLASS, border: `1px solid ${BORDER}`, boxShadow: `0 0 12px ${r.glow}` }}>
                          <span className="text-2xl" style={{ filter: `drop-shadow(0 2px 6px ${r.glow})` }}>
                            {t.icon}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-center"
                                style={{ color: r.color }}>
                            {r.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Sanctions */}
              {(profile.active_sanctions?.length ?? 0) > 0 && (
                <div className="rounded-2xl p-5 sm:p-6"
                     style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-red-400">⚠</span>
                    <h2 className="text-sm font-bold text-red-400 uppercase tracking-widest">Sanctions actives</h2>
                  </div>
                  <div className="space-y-2.5">
                    {profile.active_sanctions!.map((s, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold shrink-0 uppercase"
                              style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                          {s.type}
                        </span>
                        <span className="text-sm text-white/60 pt-0.5">{s.reason || 'Aucune raison précisée'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 pb-4 px-1">
                <p className="text-xs text-white/25">SunGuard · Profil public</p>
                <div className="flex items-center gap-4">
                  <Link to="/leaderboard" className="text-xs text-white/40 hover:text-white/60 transition-colors">
                    Classement
                  </Link>
                  <Link to="/"
                        className="px-4 py-2 rounded-full text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                        style={{ background: AMBER, border: `1px solid ${AMBER_B}` }}>
                    Créer un compte
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </SunGuardBg>
  )
}
