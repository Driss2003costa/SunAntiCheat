import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import CodexSky from '../components/codex/CodexSky'
import Cartouche from '../components/codex/Cartouche'
import WaxSeal from '../components/codex/WaxSeal'
import Flourish from '../components/codex/Flourish'
import RuneIcon from '../components/codex/RuneIcon'
import CompassRose from '../components/codex/CompassRose'
import DustParticles from '../components/codex/DustParticles'
import { toRoman } from '../components/codex/RomanNumeral'

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

const RARITY = {
  common:    { label: 'COMMUN',     seal: 'bronze' as const, color: '#E2A87B' },
  rare:      { label: 'RARE',       seal: 'silver' as const, color: '#A2C4E5' },
  epic:      { label: 'ÉPIQUE',     seal: 'jade'   as const, color: '#C9A2EE' },
  legendary: { label: 'LÉGENDAIRE', seal: 'gold'   as const, color: '#F0A93B' },
}

function poeticLastSeen(ts: number | null | undefined, online: boolean): string {
  if (online) return 'présent à l\'instant même'
  if (!ts) return 'jamais aperçu'
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 2)    return 'aperçu à l\'instant'
  if (m < 60)   return `aperçu il y a ${m} minutes`
  const h = Math.floor(m / 60)
  if (h < 24)   return h === 1 ? 'aperçu il y a une heure' : `aperçu il y a ${h} heures`
  const d = Math.floor(h / 24)
  if (d < 30)   return d === 1 ? 'aperçu hier' : `aperçu il y a ${d} jours`
  const mo = Math.floor(d / 30)
  if (mo < 12)  return mo === 1 ? 'aperçu il y a une lune' : `aperçu il y a ${mo} lunes`
  const y = Math.floor(mo / 12)
  return y === 1 ? 'aperçu il y a une année' : `aperçu il y a ${y} années`
}

function poeticDate(ts: number | null | undefined) {
  if (!ts) return '—'
  const d = new Date(ts)
  const month = d.toLocaleDateString('fr-FR', { month: 'long' })
  return `le ${d.getDate()} du mois de ${month}, an ${d.getFullYear()}`
}

const ROLE_SEAL: Record<string, { color: 'red' | 'gold' | 'silver' | 'bronze' | 'jade'; label: string }> = {
  PLAYER:    { color: 'bronze', label: 'V' },  // Voyageur
  VIP:       { color: 'gold',   label: '✦' },
  MODERATOR: { color: 'jade',   label: 'M' },
  ADMIN:     { color: 'red',    label: 'A' },
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

  // Détermine le ciel selon le rang
  const skyTime = profile && profile.playtime_rank && profile.playtime_rank <= 10
    ? 'triumph' as const
    : 'dawn' as const

  return (
    <CodexSky time={skyTime}>
      <DustParticles count={profile && profile.online ? 12 : 8} />

      {/* Compas filigrane */}
      <CompassRose
        size={460}
        opacity={0.04}
        className="absolute top-[30%] right-[-100px] pointer-events-none hidden md:block"
      />

      <div className="relative z-10 min-h-screen pb-16">

        {/* ── Top bar ─── */}
        <header className="px-5 py-6 flex items-center justify-between max-w-5xl mx-auto codex-reveal codex-reveal-1">
          <Link to="/" className="flex items-center gap-2.5 group">
            <RuneIcon rune="sun" size={22} color="#F0A93B" />
            <span className="font-codex-display text-sm tracking-[0.3em] text-amber-100/90 group-hover:text-amber-100 transition-colors">
              SUNGUARD
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-xs font-codex-lyric tracking-wider">
            <Link to="/leaderboard" className="codex-underline text-amber-100/70 hover:text-amber-100">
              Panthéon
            </Link>
            <span className="text-amber-100/30">◈</span>
            <Link to="/login" className="codex-underline text-amber-100/70 hover:text-amber-100">
              Connexion
            </Link>
          </nav>
        </header>

        <main className="max-w-5xl mx-auto px-5 pt-4">

          {/* ── Loading ─── */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-32 codex-reveal">
              <div className="w-14 h-14 rounded-full border-2 border-amber-200/20 border-t-amber-300 animate-spin" />
              <p className="font-codex-lyric italic text-amber-100/60">
                Le scribe ouvre le grimoire...
              </p>
            </div>
          )}

          {/* ── Error ─── */}
          {error && (
            <Cartouche tone="night" className="px-10 py-14 text-center max-w-md mx-auto codex-reveal mt-12">
              <RuneIcon rune="eye" size={42} color="#C84329" className="mx-auto mb-3" />
              <p className="font-codex-display text-2xl text-amber-100 tracking-wider mb-2">PROFIL INTROUVABLE</p>
              <p className="font-codex-lyric italic text-amber-100/60 mb-5">{error}</p>
              <Link to="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 border font-codex-display text-xs tracking-[0.2em] text-amber-200 hover:text-amber-100 transition-colors"
                    style={{ borderColor: 'rgba(240,169,59,0.4)' }}>
                <span>◈</span> CRÉER UN COMPTE
              </Link>
            </Cartouche>
          )}

          {profile && (
            <>
              {/* ── Page double codex ─── */}
              <article className="codex-reveal codex-reveal-2"
                       style={{ animation: 'codexUnfold 1.2s cubic-bezier(.16,.84,.44,1) both, codexFadeIn 0.9s ease-out both', perspective: '1200px' }}>

                <Cartouche tone="night" className="overflow-hidden">

                  {/* Tranche centrale verticale */}
                  <div className="absolute left-1/2 top-6 bottom-6 w-px hidden md:block pointer-events-none -translate-x-1/2"
                       style={{ background: 'linear-gradient(180deg, transparent, rgba(240,169,59,0.3), transparent)' }} />

                  <div className="grid md:grid-cols-2 gap-6 md:gap-0 p-6 sm:p-8 md:p-10">

                    {/* ─── Page de gauche : identité ─── */}
                    <div className="md:pr-8 space-y-5">

                      {/* Devise héraldique */}
                      {profile.bio && (
                        <p className="font-codex-lyric italic text-base sm:text-lg leading-relaxed text-amber-100/80 text-center md:text-left"
                           style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                          « {profile.bio} »
                        </p>
                      )}
                      {!profile.bio && (
                        <p className="font-codex-lyric italic text-amber-100/40 text-center md:text-left text-sm">
                          « Sans devise gravée »
                        </p>
                      )}

                      <Flourish variant="simple" width={160} className="mx-auto md:mx-0" />

                      {/* Avatar Minecraft */}
                      <div className="flex flex-col items-center md:items-start gap-3 relative">
                        {/* Halo derrière */}
                        <div className="absolute -top-4 left-1/2 md:left-12 -translate-x-1/2 w-44 h-44 rounded-full pointer-events-none"
                             style={{
                               background: 'radial-gradient(circle, rgba(240,169,59,0.18), transparent 70%)',
                               filter: 'blur(24px)',
                               animation: profile.online ? 'codexHaloPulse 4s ease-in-out infinite' : 'none',
                             }} />

                        {/* État online/offline en haut-droite */}
                        <div className="absolute top-0 right-0 flex items-center gap-1.5">
                          {profile.online ? (
                            <>
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-300"
                                    style={{ boxShadow: '0 0 12px rgba(240,169,59,0.8)',
                                             animation: 'codexShimmer 2s ease-in-out infinite' }} />
                              <span className="font-codex-rune text-[9px] tracking-[0.3em] text-amber-200/80">VEILLE</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                              <span className="font-codex-rune text-[9px] tracking-[0.3em] text-amber-100/40">SOMMEIL</span>
                            </>
                          )}
                        </div>

                        {/* Avatar dans cartouche */}
                        <div className="relative p-2"
                             style={{
                               border: '1px solid rgba(240,169,59,0.35)',
                               background: 'linear-gradient(180deg, rgba(244,228,193,0.06), rgba(184,92,14,0.04))',
                             }}>
                          <span className="absolute -top-1 -left-1 w-2 h-2 border-l border-t border-amber-300/60" />
                          <span className="absolute -top-1 -right-1 w-2 h-2 border-r border-t border-amber-300/60" />
                          <span className="absolute -bottom-1 -left-1 w-2 h-2 border-l border-b border-amber-300/60" />
                          <span className="absolute -bottom-1 -right-1 w-2 h-2 border-r border-b border-amber-300/60" />
                          <img
                            src={`https://mc-heads.net/body/${profile.username}/200`}
                            alt={profile.username}
                            className="h-40 w-auto"
                            style={{
                              imageRendering: 'pixelated',
                              filter: 'drop-shadow(0 8px 24px rgba(240,169,59,0.2))',
                            }}
                            onError={e => {
                              const img = e.target as HTMLImageElement
                              img.src = `https://mc-heads.net/avatar/${profile.username}/144`
                              img.className = 'w-32 h-32'
                            }}
                          />
                        </div>

                        {/* Pseudo */}
                        <h1 className="font-codex-display text-3xl sm:text-5xl font-bold leading-none mt-2"
                            style={{
                              color: '#FBE9C2',
                              textShadow: '0 4px 24px rgba(240,169,59,0.4), 0 1px 0 rgba(248,210,103,0.5)',
                              letterSpacing: '0.04em',
                              wordBreak: 'break-word',
                            }}>
                          {profile.username}
                        </h1>

                        {/* Sceaux : rang + VIP + LP */}
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          {(() => {
                            const rs = ROLE_SEAL[profile.role] ?? ROLE_SEAL.PLAYER
                            return <WaxSeal color={rs.color} label={rs.label} size={36} />
                          })()}
                          <div>
                            <p className="font-codex-display text-xs tracking-[0.25em] text-amber-100">
                              {profile.role}
                            </p>
                            {profile.lp_group && profile.lp_group.name !== 'default' && (
                              <p className="font-codex-lyric italic text-xs"
                                 style={{ color: profile.lp_group.color || '#FBE9C2' }}>
                                {profile.lp_group.display}
                              </p>
                            )}
                          </div>

                          {profile.vip?.active && (
                            <>
                              <span className="text-amber-100/30">◈</span>
                              <div className="flex items-center gap-2">
                                <WaxSeal color="gold" label="✦" size={32} />
                                <span className="font-codex-display text-xs tracking-[0.25em] text-amber-100">
                                  {profile.vip.plan ?? 'VIP'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Statut temporel */}
                        <p className="font-codex-lyric italic text-sm text-amber-100/70 mt-2">
                          {poeticLastSeen(profile.last_seen, profile.online)}
                        </p>

                        {/* Date d'arrivée */}
                        <p className="font-codex-body italic text-xs text-amber-100/50 mt-1">
                          Arrivé au royaume {poeticDate(profile.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* ─── Page de droite : faits d'armes ─── */}
                    <div className="md:pl-8 space-y-6 md:border-l-0 md:relative">

                      <SectionHeading rune="flame" label="FAITS D'ARMES" />
                      <div className="grid grid-cols-2 gap-4">
                        <StatBlock
                          icon={<RuneIcon rune="compass" size={20} color="#F0A93B" />}
                          value={profile.playtime_formatted ?? '—'}
                          label="errance"
                        />
                        <StatBlock
                          icon={<RuneIcon rune="crown" size={20} color="#F0A93B" />}
                          value={profile.playtime_rank ? `№ ${toRoman(profile.playtime_rank)}` : '—'}
                          label="au panthéon"
                        />
                        <StatBlock
                          icon={<RuneIcon rune="flame" size={20} color="#F0A93B" />}
                          value={profile.daily_streak != null ? String(profile.daily_streak) : '—'}
                          label="aubes consécutives"
                        />
                        <StatBlock
                          icon={<RuneIcon rune="star" size={20} color="#F0A93B" />}
                          value={profile.quests ? String(profile.quests.completed_count) : '—'}
                          label="quêtes scellées"
                        />
                      </div>

                      {/* Quêtes en cours */}
                      {(profile.quests?.active?.length ?? 0) > 0 && (
                        <div>
                          <SectionHeading rune="feather" label="QUÊTES EN COURS" />
                          <div className="space-y-3">
                            {profile.quests!.active.map(q => {
                              const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.goal)) * 100))
                              return (
                                <div key={q.questId}>
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="flex items-center gap-2 min-w-0">
                                      <span className="text-base shrink-0">{q.icon}</span>
                                      <span className="font-codex-body text-sm text-amber-50 truncate">{q.title}</span>
                                    </span>
                                    <span className="font-codex-rune text-[10px] text-amber-200/60 shrink-0">
                                      {q.progress}/{q.goal}
                                    </span>
                                  </div>
                                  <div className="h-1 overflow-hidden"
                                       style={{ background: 'rgba(240,169,59,0.08)' }}>
                                    <div className="h-full transition-all"
                                         style={{
                                           width: `${pct}%`,
                                           background: `linear-gradient(90deg, ${q.color}80, ${q.color})`,
                                           boxShadow: `0 0 8px ${q.color}60`,
                                         }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Trophées */}
                      {(profile.trophies?.length ?? 0) > 0 && (
                        <div>
                          <SectionHeading rune="star" label="SCEAUX OBTENUS" />
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                            {profile.trophies!.map(t => {
                              const r = RARITY[t.rarity]
                              return (
                                <div key={t.id} title={`${t.name} — ${r.label}`}
                                     className="codex-flare relative aspect-square flex flex-col items-center justify-center gap-1 p-2 group cursor-default"
                                     style={{
                                       background: 'linear-gradient(180deg, rgba(244,228,193,0.05), rgba(184,92,14,0.03))',
                                       border: `1px solid ${r.color}50`,
                                       transform: `rotate(${(t.id.charCodeAt(0) % 5) - 2}deg)`,
                                       transition: 'transform 0.3s ease',
                                     }}
                                     onMouseEnter={e => e.currentTarget.style.transform = 'rotate(0) scale(1.06)'}
                                     onMouseLeave={e => e.currentTarget.style.transform = `rotate(${(t.id.charCodeAt(0) % 5) - 2}deg)`}>
                                  <div className="text-2xl"
                                       style={{ filter: `drop-shadow(0 2px 4px ${r.color}60)` }}>
                                    {t.icon}
                                  </div>
                                  <p className="font-codex-rune text-[8px] tracking-[0.15em] text-center"
                                     style={{ color: r.color }}>
                                    {r.label}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Cartouche>
              </article>

              {/* ── Sanctions ─── */}
              {(profile.active_sanctions?.length ?? 0) > 0 && (
                <Cartouche tone="night" className="mt-6 px-7 py-6 codex-reveal codex-reveal-3"
                           style={{ borderColor: 'rgba(140,42,31,0.5)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <WaxSeal color="red" label="!" size={36} />
                    <p className="font-codex-display text-sm tracking-[0.25em] text-red-200">
                      JUGEMENTS RENDUS
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {profile.active_sanctions!.map((s, i) => (
                      <div key={i} className="flex items-start gap-3 pl-2">
                        <span className="font-codex-rune text-[10px] tracking-[0.2em] px-2 py-1 shrink-0"
                              style={{
                                background: 'rgba(140,42,31,0.25)',
                                color: '#FCA5A5',
                                border: '1px solid rgba(200,67,41,0.4)',
                              }}>
                          {s.type}
                        </span>
                        <span className="font-codex-body italic text-sm text-amber-100/80 pt-1">
                          {s.reason || 'Raison non gravée'}
                        </span>
                      </div>
                    ))}
                  </div>
                </Cartouche>
              )}

              {/* ── Footer ─── */}
              <div className="mt-8 codex-reveal codex-reveal-4">
                <Flourish variant="double" width={220} />
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 mt-4">
                  <p className="font-codex-lyric italic text-xs text-amber-100/40">
                    Page consultée à l'heure du voyageur
                  </p>
                  <div className="flex items-center gap-4">
                    <button onClick={copyLink}
                            className="codex-underline font-codex-display text-xs tracking-[0.25em] text-amber-200 hover:text-amber-100 transition-colors">
                      {copied ? '✓ COPIÉ' : '◈ PARTAGER'}
                    </button>
                    <span className="text-amber-100/30">·</span>
                    <Link to="/" className="codex-underline font-codex-display text-xs tracking-[0.25em] text-amber-200 hover:text-amber-100">
                      ◈ INSCRIPTION
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </CodexSky>
  )
}

function SectionHeading({ rune, label }: { rune: 'flame' | 'feather' | 'star' | 'compass'; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <RuneIcon rune={rune} size={14} color="#F0A93B" />
      <p className="font-codex-display text-xs tracking-[0.3em] text-amber-200/80">
        {label}
      </p>
      <div className="flex-1 h-px"
           style={{ background: 'linear-gradient(90deg, rgba(240,169,59,0.4), transparent)' }} />
    </div>
  )
}

function StatBlock({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="relative p-3.5 group"
         style={{
           background: 'linear-gradient(180deg, rgba(244,228,193,0.04), transparent)',
           border: '1px solid rgba(240,169,59,0.15)',
         }}>
      <div className="flex items-center gap-2 mb-1.5 opacity-70">
        {icon}
      </div>
      <p className="font-codex-display text-lg sm:text-xl text-amber-50 leading-none tracking-wider">
        {value}
      </p>
      <p className="font-codex-lyric italic text-[10px] text-amber-100/55 mt-1">
        {label}
      </p>
    </div>
  )
}
