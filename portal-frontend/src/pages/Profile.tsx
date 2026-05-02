import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile } from '../api/client'

function fmtDate(ts: number | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
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

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    api.me(token)
      .then(setProfile)
      .catch(e => {
        if (e.status === 401) { clearToken(); navigate('/login', { replace: true }) }
        else setError(e.message || 'Erreur de chargement.')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  function logout() { clearToken(); navigate('/login', { replace: true }) }

  if (loading) return (
    <Screen>
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Screen>
  )

  if (error) return (
    <Screen>
      <p className="text-red-400 text-center">{error}</p>
    </Screen>
  )

  if (!profile) return null

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      {/* Header */}
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☀️</span>
            <span className="font-bold text-white">SunAntiCheat</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400 text-sm">Portail Joueur</span>
          </div>
          <button onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Déconnexion
          </button>
        </div>

        {/* Profile card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-brand-600/20 to-orange-600/10 px-6 py-5 flex items-center gap-4">
            <img
              src={`https://mc-heads.net/avatar/${profile.username}/64`}
              alt={profile.username}
              className="w-16 h-16 rounded-xl border-2 border-gray-700 bg-gray-800"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white truncate">{profile.username}</h2>
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
            <Row label="UUID" value={<span className="font-mono text-xs text-gray-400 break-all">{profile.uuid}</span>} />
            <Row label="Inscrit le"     value={fmtDate(profile.created_at)} />
            <Row label="Dernière connexion" value={fmtDate(profile.last_login)} />
          </div>
        </div>

        <p className="text-center text-xs text-gray-600">
          D'autres statistiques arrivent bientôt.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-3 gap-4">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className="text-sm text-white text-right">{value}</span>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 p-6">
        {children}
        <Link to="/login" className="block text-center text-sm text-brand-400 hover:text-brand-300 mt-4">
          Retour à la connexion
        </Link>
      </div>
    </div>
  )
}
