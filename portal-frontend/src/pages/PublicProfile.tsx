import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import SunSky from '../components/SunSky'
import SunWordmark from '../components/SunWordmark'

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function roleBadge(role: string) {
  const map: Record<string, string> = {
    PLAYER:    'bg-white/10 text-white/80 border-white/20',
    VIP:       'bg-yellow-400/15 text-yellow-200 border-yellow-300/30',
    MODERATOR: 'bg-blue-400/15 text-blue-200 border-blue-300/30',
    ADMIN:     'bg-red-400/15 text-red-200 border-red-300/30',
  }
  return map[role] ?? 'bg-white/10 text-white/80 border-white/20'
}

function rarityStyle(r: Trophy['rarity']) {
  return {
    common:    'border-white/15 bg-white/5 text-white/80',
    rare:      'border-blue-400/40 bg-blue-400/10 text-blue-100',
    epic:      'border-purple-400/40 bg-purple-400/10 text-purple-100',
    legendary: 'border-yellow-300/50 bg-yellow-300/15 text-yellow-100',
  }[r]
}

function rarityGlow(r: Trophy['rarity']) {
  return {
    common:    '',
    rare:      'shadow-[0_0_12px_rgba(96,165,250,0.4)]',
    epic:      'shadow-[0_0_14px_rgba(192,132,252,0.45)]',
    legendary: 'shadow-[0_0_16px_rgba(252,211,77,0.55)]',
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

// ── Component ─────────────────────────────────────────────────────────────────

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
    <SunSky variant="dusk">
      <div className="min-h-screen flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-2xl space-y-4">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-2">
            <SunWordmark size="sm" />
            <div className="flex items-center gap-3 text-xs">
              <Link to="/leaderboard" className="text-sun-100 hover:text-white transition-colors">Classement</Link>
              <span className="text-white/30">·</span>
              <Link to="/login" className="text-sun-100 hover:text-white transition-colors">Connexion</Link>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-sun-200 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="glass-warm rounded-3xl p-10 text-center space-y-3">
              <p className="text-5xl">🔍</p>
              <p className="text-white font-display text-2xl">Profil introuvable</p>
              <p className="text-sand-200/80 text-sm">{error}</p>
              <Link to="/" className="inline-block text-sun-200 hover:text-sun-100 text-sm font-medium mt-2 underline-offset-4 hover:underline">
                Créer un compte →
              </Link>
            </div>
          )}

          {profile && (
            <>
              {/* ── Hero card ───────────────────────────────────────────────── */}
              <div className="glass-warm rounded-3xl overflow-hidden">
                <div className="relative px-7 pt-7 pb-5">
                  <div className="flex items-end gap-5">
                    {/* Body skin */}
                    <div className="relative shrink-0">
                      <img
                        src={`https://mc-heads.net/body/${profile.username}/130`}
                        alt={profile.username}
                        className="h-32 w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                        onError={e => {
                          const img = e.target as HTMLImageElement
                          img.src = `https://mc-heads.net/avatar/${profile.username}/72`
                          img.className = 'w-20 h-20 rounded-2xl border-2 border-white/15'
                        }}
                      />
                      <span className={`absolute bottom-1 right-0 w-3.5 h-3.5 rounded-full border-2 border-ink-500 ${profile.online ? 'bg-jade-300' : 'bg-white/30'}`} />
                    </div>

                    {/* Identity */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h2 className="font-display text-3xl font-medium text-white leading-none">{profile.username}</h2>
                        {profile.vip?.active && (
                          <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold bg-yellow-300/20 text-yellow-100 border border-yellow-300/40">
                            {profile.vip.plan ?? 'VIP'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-medium border ${roleBadge(profile.role)}`}>
                          {profile.role}
                        </span>
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

                      <p className={`text-xs ${profile.online ? 'text-jade-300' : 'text-sand-300/70'}`}>
                        {lastSeenLabel(profile.last_seen, profile.online)}
                      </p>
                    </div>
                  </div>

                  {/* Bio */}
                  {profile.bio && (
                    <p className="mt-4 text-sm text-sand-200/90 italic leading-relaxed font-display">
                      « {profile.bio} »
                    </p>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 divide-x divide-white/5 border-t border-white/5">
                  <StatCell icon="⏱️" value={profile.playtime_formatted ?? '—'}                                label="Temps de jeu" />
                  <StatCell icon="📊" value={profile.playtime_rank ? `#${profile.playtime_rank}` : '—'}        label="Classement"   />
                  <StatCell icon="🔥" value={profile.daily_streak != null ? String(profile.daily_streak) : '—'} label="Série"        />
                  <StatCell icon="✦"  value={profile.quests ? String(profile.quests.completed_count) : '—'}    label="Quêtes"       />
                </div>
              </div>

              {/* ── Active quests ──────────────────────────────────────────── */}
              {(profile.quests?.active?.length ?? 0) > 0 && (
                <div className="glass rounded-3xl p-6 space-y-3">
                  <p className="text-[11px] font-semibold text-sand-200/70 uppercase tracking-[0.2em]">Quêtes en cours</p>
                  {profile.quests!.active.map(q => {
                    const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.goal)) * 100))
                    return (
                      <div key={q.questId} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-white flex items-center gap-1.5">
                            <span>{q.icon}</span>
                            <span className="truncate">{q.title}</span>
                          </span>
                          <span className="text-xs text-white/60 shrink-0 font-mono">{q.progress}/{q.goal}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: q.color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Trophies ───────────────────────────────────────────────── */}
              {(profile.trophies?.length ?? 0) > 0 && (
                <div className="glass rounded-3xl p-6 space-y-3">
                  <p className="text-[11px] font-semibold text-sand-200/70 uppercase tracking-[0.2em]">Trophées</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.trophies!.map(t => (
                      <div
                        key={t.id}
                        title={t.name}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium backdrop-blur ${rarityStyle(t.rarity)} ${rarityGlow(t.rarity)}`}
                      >
                        <span>{t.icon}</span>
                        <span>{t.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Sanctions ──────────────────────────────────────────────── */}
              {(profile.active_sanctions?.length ?? 0) > 0 && (
                <div className="bg-red-500/10 backdrop-blur-xl border border-red-400/30 rounded-3xl p-6 space-y-2">
                  <p className="text-[11px] font-semibold text-red-200 uppercase tracking-[0.2em]">Sanctions actives</p>
                  {profile.active_sanctions!.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/30 text-red-100 border border-red-400/40 shrink-0">
                        {s.type}
                      </span>
                      <span className="text-sm text-white/90">{s.reason || 'Non précisé'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 px-2">
                <p className="text-[11px] text-sand-300/60 font-display italic">
                  Membre depuis {fmtDate(profile.created_at)}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={copyLink}
                    className="text-xs text-sun-100 hover:text-white transition-colors flex items-center gap-1"
                  >
                    {copied ? '✓ Copié' : '🔗 Partager'}
                  </button>
                  <span className="text-white/30">·</span>
                  <Link to="/" className="text-xs text-sun-100 hover:text-white transition-colors">Inscription</Link>
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
    <div className="flex flex-col items-center py-4 px-2 gap-0.5">
      <span className="text-base">{icon}</span>
      <span className="font-display text-base font-medium text-white leading-none">{value}</span>
      <span className="text-[10px] uppercase tracking-widest text-sand-200/60 mt-0.5">{label}</span>
    </div>
  )
}
