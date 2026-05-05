import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import SunSky from '../components/SunSky'

const BG     = '#080d19'
const CARD   = 'rgba(15,22,40,0.85)'
const BORDER = 'rgba(251,191,36,0.12)'
const GOLD   = '#fbbf24'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'

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

function roleBadge(role: string) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    PLAYER:    { bg: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: 'rgba(255,255,255,0.12)' },
    VIP:       { bg: 'rgba(251,191,36,0.15)',  color: GOLD,      border: 'rgba(251,191,36,0.35)' },
    MODERATOR: { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', border: 'rgba(59,130,246,0.35)' },
    ADMIN:     { bg: 'rgba(239,68,68,0.15)',   color: '#f87171', border: 'rgba(239,68,68,0.35)' },
  }
  return map[role] ?? map.PLAYER
}

function rarityStyle(r: Trophy['rarity']) {
  return {
    common:    { border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.04)', color: '#e2e8f0' },
    rare:      { border: 'rgba(96,165,250,0.4)',   bg: 'rgba(59,130,246,0.08)',  color: '#bfdbfe' },
    epic:      { border: 'rgba(192,132,252,0.4)',  bg: 'rgba(139,92,246,0.08)',  color: '#e9d5ff' },
    legendary: { border: 'rgba(251,191,36,0.5)',   bg: 'rgba(251,191,36,0.12)', color: '#fde68a' },
  }[r]
}

function lastSeenLabel(ts: number | null | undefined, online: boolean): string {
  if (online) return 'En ligne maintenant'
  if (!ts) return 'Jamais vu'
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'Vu à l\'instant'
  if (m < 60) return `Vu il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Vu il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `Vu il y a ${d}j`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `Vu il y a ${mo} mois`
  return `Vu il y a ${Math.floor(mo / 12)} an(s)`
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    if (!username) return
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

  return (
    <SunSky variant="noon" twist={{ fogIntensity: 'light' }}>
      <div className="min-h-screen relative pb-10">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">☀️</span>
            <span className="text-sm font-bold" style={{ color: TEXT }}>SunAntiCheat</span>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: MUTED }}>
            <Link to="/leaderboard" className="hover:text-white transition-colors">Classement</Link>
            <span style={{ color: '#1e293b' }}>·</span>
            <Link to="/login" className="hover:text-white transition-colors">Connexion</Link>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
                 style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
          </div>
        )}

        {error && (
          <div className="rounded-3xl p-10 text-center space-y-3 backdrop-blur-sm"
               style={{ background: CARD, border: `1px solid rgba(239,68,68,0.2)` }}>
            <p className="text-5xl">🔍</p>
            <p className="text-2xl font-black" style={{ color: TEXT }}>Profil introuvable</p>
            <p className="text-sm" style={{ color: MUTED }}>{error}</p>
            <Link to="/" className="inline-block text-sm font-medium mt-2 underline-offset-4 hover:underline"
                  style={{ color: GOLD }}>
              Créer un compte →
            </Link>
          </div>
        )}

        {profile && (
          <>
            {/* ── Hero card ──────────────────────────────────────────────────── */}
            <div className="rounded-3xl overflow-hidden backdrop-blur-sm"
                 style={{ background: CARD, border: `1px solid rgba(251,191,36,0.2)` }}>
              <div className="relative px-7 pt-7 pb-5">
                {/* Sun halo behind avatar */}
                <div className="absolute top-4 left-4 w-40 h-40 rounded-full blur-3xl pointer-events-none"
                     style={{ background: 'radial-gradient(circle,rgba(251,191,36,0.12),transparent)' }} />

                <div className="flex items-end gap-5 relative">
                  {/* Body skin */}
                  <div className="relative shrink-0">
                    <img
                      src={`https://mc-heads.net/body/${profile.username}/130`}
                      alt={profile.username}
                      className="h-32 w-auto object-contain"
                      style={{ filter: 'drop-shadow(0 8px 24px rgba(251,191,36,0.1))' }}
                      onError={e => {
                        const img = e.target as HTMLImageElement
                        img.src = `https://mc-heads.net/avatar/${profile.username}/72`
                        img.className = 'w-20 h-20 rounded-2xl'
                        img.style.cssText = `border: 2px solid rgba(251,191,36,0.3)`
                      }}
                    />
                    <span className={`absolute bottom-1 right-0 w-3.5 h-3.5 rounded-full border-2 ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`}
                          style={{ borderColor: '#0f1628' }} />
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h2 className="text-3xl font-black leading-none" style={{ color: TEXT }}>{profile.username}</h2>
                      {profile.vip?.active && (
                        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold"
                              style={{ background: 'rgba(251,191,36,0.2)', color: GOLD, border: `1px solid rgba(251,191,36,0.4)` }}>
                          {profile.vip.plan ?? 'VIP'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {(() => { const rb = roleBadge(profile.role); return (
                        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-medium border"
                              style={{ background: rb.bg, color: rb.color, borderColor: rb.border }}>
                          {profile.role}
                        </span>
                      )})()}
                      {profile.lp_group && profile.lp_group.name !== 'default' && (
                        <span
                          className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-medium border"
                          style={{
                            color: profile.lp_group.color ?? undefined,
                            borderColor: profile.lp_group.color ? `${profile.lp_group.color}55` : undefined,
                            backgroundColor: profile.lp_group.color ? `${profile.lp_group.color}15` : undefined,
                          }}
                        >
                          {profile.lp_group.display}
                        </span>
                      )}
                    </div>

                    <p className="text-xs" style={{ color: profile.online ? '#4ade80' : MUTED }}>
                      {lastSeenLabel(profile.last_seen, profile.online)}
                    </p>
                  </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                  <p className="mt-4 text-sm italic leading-relaxed" style={{ color: '#cbd5e1' }}>
                    « {profile.bio} »
                  </p>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 border-t" style={{ borderColor: BORDER }}>
                <StatCell icon="⏱️" value={profile.playtime_formatted ?? '—'}                                  label="Temps de jeu" />
                <StatCell icon="📊" value={profile.playtime_rank ? `#${profile.playtime_rank}` : '—'}          label="Classement"   />
                <StatCell icon="🔥" value={profile.daily_streak != null ? String(profile.daily_streak) : '—'}  label="Série"        />
                <StatCell icon="✦"  value={profile.quests ? String(profile.quests.completed_count) : '—'}      label="Quêtes"       />
              </div>
            </div>

            {/* Active quests */}
            {(profile.quests?.active?.length ?? 0) > 0 && (
              <div className="rounded-3xl p-6 space-y-3 backdrop-blur-sm"
                   style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: MUTED }}>
                  Quêtes en cours
                </p>
                {profile.quests!.active.map(q => {
                  const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.goal)) * 100))
                  return (
                    <div key={q.questId} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm flex items-center gap-1.5" style={{ color: TEXT }}>
                          <span>{q.icon}</span>
                          <span className="truncate">{q.title}</span>
                        </span>
                        <span className="text-xs shrink-0 font-mono" style={{ color: MUTED }}>{q.progress}/{q.goal}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: q.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Trophies */}
            {(profile.trophies?.length ?? 0) > 0 && (
              <div className="rounded-3xl p-6 space-y-3 backdrop-blur-sm"
                   style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: MUTED }}>Trophées</p>
                <div className="flex flex-wrap gap-2">
                  {profile.trophies!.map(t => {
                    const rs = rarityStyle(t.rarity)
                    return (
                      <div key={t.id} title={t.name}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium"
                        style={{ background: rs.bg, border: `1px solid ${rs.border}`, color: rs.color }}>
                        <span>{t.icon}</span>
                        <span>{t.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sanctions */}
            {(profile.active_sanctions?.length ?? 0) > 0 && (
              <div className="rounded-3xl p-6 space-y-2 backdrop-blur-sm"
                   style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">Sanctions actives</p>
                {profile.active_sanctions!.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0"
                          style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' }}>
                      {s.type}
                    </span>
                    <span className="text-sm" style={{ color: '#e2e8f0' }}>{s.reason || 'Non précisé'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 px-2">
              <p className="text-[11px] italic" style={{ color: MUTED }}>
                Membre depuis {fmtDate(profile.created_at)}
              </p>
              <div className="flex items-center gap-3">
                <button onClick={copyLink}
                  className="text-xs transition-colors flex items-center gap-1"
                  style={{ color: GOLD }}>
                  {copied ? '✓ Copié' : '🔗 Partager'}
                </button>
                <span style={{ color: '#1e293b' }}>·</span>
                <Link to="/" className="text-xs transition-colors hover:text-white"
                      style={{ color: MUTED }}>
                  Inscription
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </SunSky>
  )
}

function StatCell({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center py-4 px-2 gap-0.5"
         style={{ borderRight: `1px solid rgba(251,191,36,0.08)` }}>
      <span className="text-base">{icon}</span>
      <span className="text-base font-black leading-none" style={{ color: '#f1f5f9' }}>{value}</span>
      <span className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: '#64748b' }}>{label}</span>
    </div>
  )
}
