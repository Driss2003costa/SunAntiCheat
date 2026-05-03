import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SunSky from '../components/SunSky'
import SunWordmark from '../components/SunWordmark'

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
    <SunSky variant="noon">
      <div className="min-h-screen flex flex-col items-center py-10 px-4">
        <div className="w-full max-w-2xl space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <SunWordmark size="sm" />
            <div className="flex items-center gap-3 text-xs">
              <Link to="/login" className="text-sun-100 hover:text-white transition-colors">Connexion</Link>
              <span className="text-white/30">·</span>
              <Link to="/" className="text-sun-100 hover:text-white transition-colors">Inscription</Link>
            </div>
          </div>

          {/* Title block */}
          <div className="glass rounded-3xl px-7 py-7 text-center">
            <p className="text-[11px] uppercase tracking-[0.25em] text-sand-200/70 font-medium mb-3">Le grand registre</p>
            <h1 className="font-display text-4xl sm:text-5xl font-medium text-white leading-none">
              Classement
            </h1>
            <p className="text-sand-200/80 text-sm mt-3 max-w-md mx-auto">
              Les âmes les plus dévouées du serveur, classées par leur temps d'aventure.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-sun-200 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="glass rounded-3xl p-8 text-center">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Top 3 podium */}
          {data && data.playtime.length >= 3 && (
            <div className="grid grid-cols-3 gap-3">
              <PodiumCard entry={data.playtime[1]} place={2} height="h-36" />
              <PodiumCard entry={data.playtime[0]} place={1} height="h-44" />
              <PodiumCard entry={data.playtime[2]} place={3} height="h-32" />
            </div>
          )}

          {/* Rest of the leaderboard */}
          {data && data.playtime.length > 0 && (
            <div className="glass rounded-3xl overflow-hidden">
              {data.playtime.length === 0 ? (
                <p className="text-center text-white/40 text-sm py-10">Aucune donnée disponible.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {data.playtime.slice(3).map(entry => (
                    <a
                      key={entry.uuid}
                      href={`/portal/player/${entry.username}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors group"
                    >
                      <div className="w-10 shrink-0 text-center">
                        <span className="text-sm font-bold text-sand-300/80 font-display">#{entry.rank}</span>
                      </div>

                      <img
                        src={`https://mc-heads.net/avatar/${entry.username}/36`}
                        alt={entry.username}
                        className="w-9 h-9 rounded-lg border border-white/10 bg-ink-500 shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-sun-200 transition-colors">
                          {entry.username}
                        </p>
                        {entry.balance != null && (
                          <p className="text-[11px] text-sand-300/70">{fmtBalance(entry.balance)}</p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-white">{entry.playtime_formatted}</p>
                        <p className="text-[10px] text-sand-300/60">de jeu</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {data && data.playtime.length === 0 && (
            <div className="glass rounded-3xl p-10 text-center">
              <p className="text-5xl mb-3">🌅</p>
              <p className="font-display text-xl text-white">Le registre est encore vierge</p>
              <p className="text-sand-200/70 text-sm mt-1">Les premières aventures commencent à peine.</p>
            </div>
          )}

          {/* Footer */}
          {data && (
            <p className="text-center text-[11px] text-sand-300/50 font-display italic">
              Mis à jour à {new Date(data.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </SunSky>
  )
}

function PodiumCard({ entry, place, height }: { entry: LeaderboardEntry; place: 1 | 2 | 3; height: string }) {
  const accent = {
    1: 'from-yellow-300/30 to-yellow-600/10 border-yellow-300/40 ring-yellow-300/30',
    2: 'from-gray-200/25 to-gray-400/10  border-gray-200/30 ring-gray-200/20',
    3: 'from-amber-600/25 to-amber-800/10 border-amber-500/30 ring-amber-500/20',
  }[place]
  const medal = medalIcon(place)!
  const order = { 1: 'order-2', 2: 'order-1', 3: 'order-3' }[place]

  return (
    <a
      href={`/portal/player/${entry.username}`}
      className={`${order} bg-gradient-to-br ${accent} border rounded-3xl backdrop-blur-xl ${height}
        p-4 flex flex-col items-center justify-end gap-1 ring-1 hover:scale-[1.02] active:scale-100 transition-transform`}
    >
      <div className="text-2xl mb-1">{medal}</div>
      <img
        src={`https://mc-heads.net/avatar/${entry.username}/48`}
        alt={entry.username}
        className="w-12 h-12 rounded-xl border border-white/15 bg-ink-500 shrink-0"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      <p className="text-sm font-bold text-white truncate max-w-full">{entry.username}</p>
      <p className="text-[10px] text-white/70 font-medium">{entry.playtime_formatted}</p>
    </a>
  )
}
