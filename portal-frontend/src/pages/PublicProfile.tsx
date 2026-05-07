import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import SunGuardBg from '../components/SunGuardBg'
import { GridShell, HeroBanner, StatCard, SectionDivider, Card, Button, Tag } from '../components/ui'

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

const ROLE_TONE: Record<string, 'danger' | 'violet' | 'gold' | 'neutral'> = {
  ADMIN:     'danger',
  MODERATOR: 'violet',
  VIP:       'gold',
  PLAYER:    'neutral',
}
const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin', MODERATOR: 'Modérateur', VIP: 'VIP', PLAYER: 'Joueur',
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

  return (
    <SunGuardBg>
      <div className="min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 px-6 py-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,9,15,0.7)', backdropFilter: 'blur(12px)' }}>
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group no-underline">
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
              <span className="text-sm font-bold tracking-widest text-white/90 group-hover:text-white transition-colors">SUNGUARD</span>
            </Link>
            <nav className="flex items-center gap-3 text-xs">
              <Link to="/leaderboard" className="text-white/50 hover:text-white/80 transition-colors no-underline">Classement</Link>
              <Button to="/login" variant="secondary" size="sm">Connexion</Button>
            </nav>
          </div>
        </header>

        <GridShell>
          {/* LOADING */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-32">
              <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-amber-400 animate-spin" />
              <p className="text-sm text-white/40">Chargement du profil…</p>
            </div>
          )}

          {/* ERROR */}
          {error && !loading && (
            <Card padding="lg" className="max-w-md mx-auto mt-16 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-xl font-bold text-white mb-2">Profil introuvable</p>
              <p className="text-sm text-white/50 mb-6">{error}</p>
              <Button to="/" size="md">Créer un compte</Button>
            </Card>
          )}

          {profile && !loading && (
            <>
              {/* HERO */}
              <HeroBanner
                eyebrow={profile.online ? 'En ligne maintenant' : lastSeen(profile.last_seen, false)}
                variant="sun"
                title={profile.username}
                subtitle={profile.bio
                  ? <>« {profile.bio} »</>
                  : <>Membre SunGuard depuis {fmtDate(profile.created_at)}</>}
                cta={
                  <>
                    <Button onClick={copyLink} variant={copied ? 'secondary' : 'primary'} size="lg">
                      {copied ? '✓ Lien copié' : '⬡ Partager'}
                    </Button>
                    <Button to="/leaderboard" variant="secondary" size="lg">Voir le classement</Button>
                    <Tag tone={ROLE_TONE[profile.role] ?? 'neutral'}>{ROLE_LABEL[profile.role] ?? profile.role}</Tag>
                    {profile.vip?.active && <Tag tone="gold">✦ {profile.vip.plan ?? 'VIP'}</Tag>}
                    {profile.lp_group && profile.lp_group.name !== 'default' && (
                      <Tag tone="violet">{profile.lp_group.display}</Tag>
                    )}
                  </>
                }
                rightSlot={
                  <div className="relative">
                    <div className="absolute -inset-8 rounded-full blur-3xl opacity-50"
                         style={{ background: 'radial-gradient(circle, rgba(255,179,71,0.5) 0%, transparent 70%)' }} />
                    <div className="relative">
                      <img src={`https://mc-heads.net/body/${profile.username}/280`}
                           alt={profile.username}
                           className="w-48 lg:w-64 drop-shadow-2xl"
                           style={{ imageRendering: 'pixelated' }}
                           onError={e => {
                             const img = e.target as HTMLImageElement
                             img.src = `https://mc-heads.net/avatar/${profile.username}/160`
                             img.className = 'w-32 h-32 rounded-2xl drop-shadow-2xl'
                           }} />
                    </div>
                  </div>
                }
              />

              {/* STATS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-12 lg:mb-16">
                <StatCard label="Temps de jeu" accent="jade" icon="⏱" size="lg"
                          value={profile.playtime_formatted ?? '—'} hint="Total cumulé" />
                <StatCard label="Classement" accent="gold" icon="🏆" size="lg"
                          value={profile.playtime_rank ? `#${profile.playtime_rank}` : '—'}
                          hint={profile.playtime_rank_total ? `sur ${profile.playtime_rank_total}` : 'Top playtime'} />
                <StatCard label="Streak" accent="rose" icon="🔥" size="lg"
                          value={profile.daily_streak != null ? `${profile.daily_streak}j` : '—'} hint="Quotidienne" />
                <StatCard label="Quêtes" accent="violet" icon="✅" size="lg"
                          value={profile.quests ? String(profile.quests.completed_count) : '—'} hint="Complétées" />
              </div>

              {/* PROGRESSION + TROPHIES grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 mb-12">
                <div className="lg:col-span-2 space-y-8">
                  {/* Quests */}
                  {(profile.quests?.active?.length ?? 0) > 0 && (
                    <section>
                      <SectionDivider label="Quêtes en cours" hint="Progression actuelle" />
                      <Card padding="lg">
                        <div className="space-y-5">
                          {profile.quests!.active.map(q => {
                            const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.goal)) * 100))
                            return (
                              <div key={q.questId}>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <span className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xl shrink-0">{q.icon}</span>
                                    <span className="text-sm text-white/85 font-semibold truncate">{q.title}</span>
                                  </span>
                                  <span className="text-xs text-white/40 shrink-0 tabular-nums">{q.progress}/{q.goal}</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                  <div className="h-full rounded-full transition-all"
                                       style={{ width: `${pct}%`, background: q.color, boxShadow: `0 0 8px ${q.color}60` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    </section>
                  )}

                  {/* Sanctions */}
                  {(profile.active_sanctions?.length ?? 0) > 0 && (
                    <section>
                      <SectionDivider label="Sanctions actives"
                        action={<Tag tone="danger">{profile.active_sanctions!.length}</Tag>} />
                      <Card padding="lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <div className="space-y-3">
                          {profile.active_sanctions!.map((s, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <Tag tone="danger" size="sm">{s.type}</Tag>
                              <span className="text-sm text-white/70 pt-0.5">{s.reason || 'Aucune raison précisée'}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </section>
                  )}
                </div>

                {/* Trophies sidebar */}
                <aside className="space-y-5">
                  <SectionDivider label="Trophées"
                    hint={(profile.trophies?.length ?? 0) > 0 ? `${profile.trophies!.length} obtenu(s)` : undefined} />
                  <Card padding="lg">
                    {(profile.trophies?.length ?? 0) > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {profile.trophies!.map(t => {
                          const r = RARITY_STYLE[t.rarity]
                          return (
                            <div key={t.id} title={`${t.name} — ${r.label}`}
                                 className="rounded-xl p-3 flex flex-col items-center gap-1.5 cursor-default transition-transform hover:scale-105"
                                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: `0 0 12px ${r.glow}` }}>
                              <span className="text-2xl" style={{ filter: `drop-shadow(0 2px 6px ${r.glow})` }}>{t.icon}</span>
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-center" style={{ color: r.color }}>
                                {r.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-sm text-white/40 py-4">Aucun trophée pour l'instant</p>
                    )}
                  </Card>

                  <SectionDivider label="Informations" />
                  <Card padding="md">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-white/50">Membre depuis</span>
                        <span className="text-white/85">{fmtDate(profile.created_at)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/50">Statut</span>
                        <Tag tone={profile.online ? 'jade' : 'neutral'} size="xs">
                          {profile.online ? 'En ligne' : 'Hors ligne'}
                        </Tag>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-white/50">Rôle</span>
                        <Tag tone={ROLE_TONE[profile.role] ?? 'neutral'} size="xs">{ROLE_LABEL[profile.role] ?? profile.role}</Tag>
                      </div>
                    </div>
                  </Card>
                </aside>
              </div>

              {/* CTA Footer */}
              <Card variant="glass-warm" padding="lg" className="text-center">
                <p className="font-display text-2xl lg:text-3xl font-semibold mb-2" style={{ color: '#f8fafc' }}>
                  Rejoins {profile.username} sur SunGuard
                </p>
                <p className="text-sm mb-5" style={{ color: 'rgba(241,245,249,0.5)' }}>
                  Crée ton compte et commence ton aventure dès aujourd'hui.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button to="/" size="lg">Créer un compte</Button>
                  <Button to="/login" variant="secondary" size="lg">Connexion</Button>
                </div>
              </Card>
            </>
          )}
        </GridShell>
      </div>
    </SunGuardBg>
  )
}
