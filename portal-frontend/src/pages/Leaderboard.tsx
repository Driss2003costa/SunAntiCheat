import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

type LeaderboardEntry = {
  rank: number
  username: string
  uuid: string
  playtime_seconds: number
  playtime_formatted: string
  balance?: number
}

type LeaderboardData = {
  playtime: LeaderboardEntry[]
  economy: LeaderboardEntry[]
  updatedAt: number
}

function medalColor(rank: number) {
  if (rank === 1) return 'text-yellow-400'
  if (rank === 2) return 'text-gray-300'
  if (rank === 3) return 'text-amber-600'
  return 'text-gray-600'
}

function medalIcon(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

function fmtBalance(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' $'
}

export default function Leaderboard() {
  const [data, setData]       = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState<'playtime'>('playtime')

  useEffect(() => {
    fetch('/api/public/leaderboard')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw d
        setData(d)
      })
      .catch(e => setError(e.message || 'Erreur de chargement.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg space-y-4">

        {/* Logo + nav */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☀️</span>
            <span className="font-bold text-white">SunAntiCheat</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-xs text-brand-400 hover:text-brand-300">Connexion</Link>
            <span className="text-gray-700">·</span>
            <Link to="/" className="text-xs text-brand-400 hover:text-brand-300">Inscription</Link>
          </div>
        </div>

        {/* Header */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 px-5 py-4">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🏆</span> Classement
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Les meilleurs joueurs du serveur</p>
        </div>

        {/* Tab bar */}
        <div className="flex bg-gray-900 border border-gray-800 rounded-2xl p-1 gap-1">
          <button
            onClick={() => setTab('playtime')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors
              ${tab === 'playtime' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            ⏱️ Temps de jeu
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {data && tab === 'playtime' && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {data.playtime.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-10">Aucune donnée disponible.</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {data.playtime.map(entry => (
                  <a
                    key={entry.uuid}
                    href={`/portal/player/${entry.username}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors group"
                  >
                    {/* Rank */}
                    <div className="w-8 shrink-0 text-center">
                      {medalIcon(entry.rank)
                        ? <span className="text-lg">{medalIcon(entry.rank)}</span>
                        : <span className={`text-sm font-bold ${medalColor(entry.rank)}`}>#{entry.rank}</span>
                      }
                    </div>

                    {/* Avatar */}
                    <img
                      src={`https://mc-heads.net/avatar/${entry.username}/32`}
                      alt={entry.username}
                      className="w-8 h-8 rounded-lg border border-gray-700 bg-gray-800 shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate group-hover:text-brand-300 transition-colors">
                        {entry.username}
                      </p>
                      {entry.balance != null && (
                        <p className="text-xs text-gray-500">{fmtBalance(entry.balance)}</p>
                      )}
                    </div>

                    {/* Playtime */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-white">{entry.playtime_formatted}</p>
                      <p className="text-xs text-gray-600">de jeu</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {data && (
          <p className="text-center text-xs text-gray-700">
            Mis à jour le {new Date(data.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}
