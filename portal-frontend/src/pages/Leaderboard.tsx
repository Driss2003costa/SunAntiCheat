import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SunSky from '../components/SunSky'

const BG     = '#080d19'
const CARD   = 'rgba(15,22,40,0.85)'
const BORDER = 'rgba(251,191,36,0.12)'
const GOLD   = '#fbbf24'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'

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
    <SunSky variant="noon" twist={{ cloudLayer: true, mountainMood: 'snowy' }}>
      <div className="min-h-screen pb-10 relative">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☀️</span>
            <span className="text-base font-bold" style={{ color: TEXT }}>SunAntiCheat</span>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: MUTED }}>
            <Link to="/login" className="hover:text-white transition-colors" style={{ color: MUTED }}>Connexion</Link>
            <span style={{ color: '#1e293b' }}>·</span>
            <Link to="/" className="hover:text-white transition-colors" style={{ color: MUTED }}>Inscription</Link>
          </div>
        </div>

        {/* Title */}
        <div className="rounded-3xl px-7 py-7 text-center backdrop-blur-sm"
             style={{ background: CARD, border: `1px solid rgba(251,191,36,0.2)` }}>
          <p className="text-[11px] uppercase tracking-[0.25em] mb-3 font-medium" style={{ color: MUTED }}>
            Le grand registre
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-none" style={{ color: TEXT }}>Classement</h1>
          <p className="text-sm mt-3 max-w-md mx-auto" style={{ color: MUTED }}>
            Les âmes les plus dévouées du serveur, classées par leur temps d'aventure.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
                 style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-3xl p-8 text-center backdrop-blur-sm"
               style={{ background: CARD, border: `1px solid ${BORDER}` }}>
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

        {/* Rest of leaderboard */}
        {data && data.playtime.length > 0 && (
          <div className="rounded-3xl overflow-hidden backdrop-blur-sm"
               style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {data.playtime.slice(3).map(entry => (
              <a
                key={entry.uuid}
                href={`/portal/player/${entry.username}`}
                className="flex items-center gap-4 px-5 py-3 transition-colors group"
                style={{ borderBottom: `1px solid rgba(251,191,36,0.05)` }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="w-10 shrink-0 text-center">
                  <span className="text-sm font-bold" style={{ color: MUTED }}>#{entry.rank}</span>
                </div>

                <img
                  src={`https://mc-heads.net/avatar/${entry.username}/36`}
                  alt={entry.username}
                  className="w-9 h-9 rounded-lg shrink-0"
                  style={{ border: `1px solid ${BORDER}` }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate transition-colors" style={{ color: TEXT }}>
                    {entry.username}
                  </p>
                  {entry.balance != null && (
                    <p className="text-[11px]" style={{ color: MUTED }}>{fmtBalance(entry.balance)}</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: TEXT }}>{entry.playtime_formatted}</p>
                  <p className="text-[10px]" style={{ color: MUTED }}>de jeu</p>
                </div>
              </a>
            ))}
          </div>
        )}

        {data && data.playtime.length === 0 && (
          <div className="rounded-3xl p-10 text-center backdrop-blur-sm"
               style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-5xl mb-3">🌅</p>
            <p className="text-xl font-black" style={{ color: TEXT }}>Le registre est encore vierge</p>
            <p className="text-sm mt-1" style={{ color: MUTED }}>Les premières aventures commencent à peine.</p>
          </div>
        )}

        {/* Footer */}
        {data && (
          <p className="text-center text-[11px] italic" style={{ color: MUTED }}>
            Mis à jour à {new Date(data.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
      </div>
    </SunSky>
  )
}

function PodiumCard({ entry, place, height }: { entry: LeaderboardEntry; place: 1 | 2 | 3; height: string }) {
  const styles = {
    1: {
      bg: 'linear-gradient(160deg,rgba(251,191,36,0.25),rgba(217,119,6,0.1))',
      border: 'rgba(251,191,36,0.4)',
      crown: '👑',
      glow: '0 0 30px rgba(251,191,36,0.15)',
    },
    2: {
      bg: 'linear-gradient(160deg,rgba(203,213,225,0.2),rgba(148,163,184,0.08))',
      border: 'rgba(203,213,225,0.3)',
      crown: '🥈',
      glow: 'none',
    },
    3: {
      bg: 'linear-gradient(160deg,rgba(217,119,6,0.2),rgba(180,83,9,0.08))',
      border: 'rgba(217,119,6,0.35)',
      crown: '🥉',
      glow: 'none',
    },
  }[place]

  const order = { 1: 'order-2', 2: 'order-1', 3: 'order-3' }[place]

  return (
    <a
      href={`/portal/player/${entry.username}`}
      className={`${order} rounded-3xl backdrop-blur-sm ${height}
        p-4 flex flex-col items-center justify-end gap-1 transition-transform hover:scale-[1.02] active:scale-100`}
      style={{ background: styles.bg, border: `1px solid ${styles.border}`, boxShadow: styles.glow }}
    >
      <div className="text-2xl mb-1">{styles.crown}</div>
      <img
        src={`https://mc-heads.net/avatar/${entry.username}/48`}
        alt={entry.username}
        className="w-12 h-12 rounded-xl shrink-0"
        style={{ border: `1px solid ${styles.border}` }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      <p className="text-sm font-bold truncate max-w-full" style={{ color: TEXT }}>{entry.username}</p>
      <p className="text-[10px] font-medium" style={{ color: MUTED }}>{entry.playtime_formatted}</p>
    </a>
  )
}
