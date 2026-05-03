import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

type PublicProfileData = {
  uuid: string
  username: string
  role: string
  online: boolean
  created_at: number
  playtime_formatted?: string
  active_sanctions?: Array<{ type: string; reason: string; expires_at: number | null }>
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    PLAYER:    'bg-gray-700 text-gray-300',
    VIP:       'bg-yellow-500/20 text-yellow-400',
    MODERATOR: 'bg-blue-500/20 text-blue-400',
    ADMIN:     'bg-red-500/20 text-red-400',
  }
  return map[role] ?? 'bg-gray-700 text-gray-300'
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>()
  const [profile, setProfile] = useState<PublicProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

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

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-3xl mb-1">☀️</div>
          <h1 className="text-xl font-bold text-white">SunAntiCheat</h1>
          <p className="text-gray-500 text-xs mt-0.5">Profil public</p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 text-center space-y-3">
            <p className="text-4xl">🔍</p>
            <p className="text-white font-semibold">Profil introuvable</p>
            <p className="text-gray-500 text-sm">{error}</p>
            <Link to="/" className="block text-brand-400 hover:text-brand-300 text-sm font-medium">
              Créer un compte →
            </Link>
          </div>
        )}

        {profile && (
          <>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="bg-gradient-to-r from-brand-600/20 to-orange-600/10 px-6 py-5 flex items-center gap-4">
                <img
                  src={`https://mc-heads.net/avatar/${profile.username}/64`}
                  alt={profile.username}
                  className="w-16 h-16 rounded-xl border-2 border-gray-700 bg-gray-800"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white">{profile.username}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(profile.role)}`}>
                      {profile.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${profile.online ? 'bg-green-500' : 'bg-gray-600'}`} />
                    <span className={`text-xs ${profile.online ? 'text-green-400' : 'text-gray-500'}`}>
                      {profile.online ? 'En ligne' : 'Hors ligne'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-800">
                <div className="flex items-center justify-between px-6 py-3 gap-4">
                  <span className="text-sm text-gray-400 shrink-0">Membre depuis</span>
                  <span className="text-sm text-white">{fmtDate(profile.created_at)}</span>
                </div>
                {profile.playtime_formatted && (
                  <div className="flex items-center justify-between px-6 py-3 gap-4">
                    <span className="text-sm text-gray-400 shrink-0">Temps de jeu</span>
                    <span className="text-sm text-white">{profile.playtime_formatted}</span>
                  </div>
                )}
              </div>
            </div>

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

            <p className="text-center text-xs text-gray-600">
              <Link to="/login" className="text-brand-400 hover:text-brand-300">Connexion</Link>
              {' · '}
              <Link to="/" className="text-brand-400 hover:text-brand-300">Inscription</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
