import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

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
    PLAYER:    'bg-gray-700 text-gray-300',
    VIP:       'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    MODERATOR: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    ADMIN:     'bg-red-500/20 text-red-400 border border-red-500/30',
  }
  return map[role] ?? 'bg-gray-700 text-gray-300'
}

function rarityStyle(r: Trophy['rarity']) {
  return {
    common:    'border-gray-600 bg-gray-800/60 text-gray-300',
    rare:      'border-blue-500/50 bg-blue-500/10 text-blue-300',
    epic:      'border-purple-500/50 bg-purple-500/10 text-purple-300',
    legendary: 'border-yellow-500/60 bg-yellow-500/15 text-yellow-300',
  }[r]
}

function rarityGlow(r: Trophy['rarity']) {
  return {
    common:    '',
    rare:      'shadow-[0_0_8px_rgba(59,130,246,0.3)]',
    epic:      'shadow-[0_0_10px_rgba(168,85,247,0.4)]',
    legendary: 'shadow-[0_0_12px_rgba(234,179,8,0.5)]',
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
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg space-y-4">

        {/* Logo */}
        <div className="text-center mb-2">
          <div className="text-2xl mb-1">☀️</div>
          <h1 className="text-base font-bold text-white">SunAntiCheat</h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center space-y-3">
            <p className="text-4xl">🔍</p>
            <p className="text-white font-semibold">Profil introuvable</p>
            <p className="text-gray-500 text-sm">{error}</p>
            <Link to="/" className="block text-brand-400 hover:text-brand-300 text-sm font-medium mt-2">
              Créer un compte →
            </Link>
          </div>
        )}

        {profile && (
          <>
            {/* ── Hero ───────────────────────────────────────────────────────── */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="relative bg-gradient-to-br from-brand-600/20 via-orange-600/10 to-transparent px-6 pt-6 pb-4">
                <div className="flex items-end gap-5">
                  {/* Full body skin */}
                  <div className="relative shrink-0">
                    <img
                      src={`https://mc-heads.net/body/${profile.username}/120`}
                      alt={profile.username}
                      className="h-28 w-auto object-contain drop-shadow-lg"
                      onError={e => {
                        const img = e.target as HTMLImageElement
                        img.src = `https://mc-heads.net/avatar/${profile.username}/64`
                        img.className = 'w-16 h-16 rounded-xl border-2 border-gray-700'
                      }}
                    />
                    {/* Online dot */}
                    <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${profile.online ? 'bg-green-500' : 'bg-gray-600'}`} />
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h2 className="text-2xl font-bold text-white leading-none">{profile.username}</h2>
                      {profile.vip?.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                          {profile.vip.plan ?? 'VIP'}
                        </span>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(profile.role)}`}>
                        {profile.role}
                      </span>
                      {profile.lp_group && profile.lp_group.name !== 'default' && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium border"
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

                    <p className={`text-xs ${profile.online ? 'text-green-400' : 'text-gray-500'}`}>
                      {lastSeenLabel(profile.last_seen, profile.online)}
                    </p>
                  </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                  <p className="mt-3 text-sm text-gray-300 italic leading-relaxed">
                    "{profile.bio}"
                  </p>
                )}
              </div>

              {/* ── Stats row ─────────────────────────────────────────────── */}
              <div className="grid grid-cols-4 divide-x divide-gray-800 border-t border-gray-800">
                <StatCell
                  icon="⏱️"
                  value={profile.playtime_formatted ?? '—'}
                  label="Temps de jeu"
                />
                <StatCell
                  icon="📊"
                  value={profile.playtime_rank ? `#${profile.playtime_rank}` : '—'}
                  label="Classement"
                />
                <StatCell
                  icon="🔥"
                  value={profile.daily_streak != null ? String(profile.daily_streak) : '—'}
                  label="Streak"
                />
                <StatCell
                  icon="✅"
                  value={profile.quests ? String(profile.quests.completed_count) : '—'}
                  label="Quêtes"
                />
              </div>
            </div>

            {/* ── Active quests ──────────────────────────────────────────────── */}
            {(profile.quests?.active?.length ?? 0) > 0 && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quêtes en cours</p>
                {profile.quests!.active.map(q => {
                  const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.goal)) * 100))
                  return (
                    <div key={q.questId} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-white flex items-center gap-1.5">
                          <span>{q.icon}</span>
                          <span className="truncate">{q.title}</span>
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">{q.progress}/{q.goal}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
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

            {/* ── Trophies ───────────────────────────────────────────────────── */}
            {(profile.trophies?.length ?? 0) > 0 && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Trophées</p>
                <div className="flex flex-wrap gap-2">
                  {profile.trophies!.map(t => (
                    <div
                      key={t.id}
                      title={t.name}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium ${rarityStyle(t.rarity)} ${rarityGlow(t.rarity)}`}
                    >
                      <span>{t.icon}</span>
                      <span>{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Sanctions actives ──────────────────────────────────────────── */}
            {(profile.active_sanctions?.length ?? 0) > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Sanctions actives</p>
                {profile.active_sanctions!.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                      {s.type}
                    </span>
                    <span className="text-sm text-gray-300">{s.reason || 'Non précisé'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Footer ─────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">
                Membre depuis {fmtDate(profile.created_at)}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={copyLink}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                >
                  {copied ? '✓ Copié !' : '🔗 Partager'}
                </button>
                <span className="text-gray-700">·</span>
                <Link to="/leaderboard" className="text-xs text-brand-400 hover:text-brand-300">🏆 Classement</Link>
                <span className="text-gray-700">·</span>
                <Link to="/login" className="text-xs text-brand-400 hover:text-brand-300">Connexion</Link>
                <span className="text-gray-700">·</span>
                <Link to="/" className="text-xs text-brand-400 hover:text-brand-300">Inscription</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCell({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center py-3 px-2 gap-0.5">
      <span className="text-base">{icon}</span>
      <span className="text-sm font-bold text-white leading-none">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}
