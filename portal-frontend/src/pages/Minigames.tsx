import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken, clearToken } from '../api/client'
import Navbar from '../components/Navbar'

type GameArena = {
  game: string; gameLabel: string; icon: string; name: string
  minPlayers: number; maxPlayers: number; currentPlayers: number
  status: 'PLAYING' | 'WAITING'
}
type GameInfo = {
  id: string; label: string; icon: string; installed: boolean; enabled: boolean
  totalArenas: number; playingArenas: number; waitingArenas: number
}
type ArenasData = {
  arenas: GameArena[]; games: GameInfo[]
  totalArenas: number; playing: number; waiting: number
}

const GAMES_STATIC = [
  {
    id: 'CTF',
    icon: '🚩',
    label: 'Capture The Flag',
    desc: 'Infiltre la base adverse, vole son drapeau et ramène-le sans te faire éliminer.',
    tips: ['Protège ton drapeau', 'Travaille en équipe', 'Utilise les passages secrets'],
    color: 'from-red-600/15 border-red-500/20',
    ping: 'from-red-500/20 to-red-700/10',
  },
  {
    id: 'Skywars',
    icon: '☁️',
    label: 'Skywars',
    desc: 'Bats tous tes adversaires sur ton île suspendue dans le ciel. Seul le dernier survivant gagne.',
    tips: ['Loot vite', 'Construis des ponts', 'Évite les chutes'],
    color: 'from-blue-600/15 border-blue-500/20',
    ping: 'from-blue-500/20 to-blue-700/10',
  },
  {
    id: 'Thimble',
    icon: '💧',
    label: 'Thimble',
    desc: 'Plonge dans le trou qui correspond à ta forme depuis une plateforme en hauteur. Sois précis !',
    tips: ['Vise bien avant de sauter', 'Regarde la forme du trou', 'Fais vite !'],
    color: 'from-cyan-600/15 border-cyan-500/20',
    ping: 'from-cyan-500/20 to-cyan-700/10',
  },
  {
    id: 'TntRun',
    icon: '💣',
    label: 'TNT Run',
    desc: 'Cours sur un sol qui s\'effondre à chaque pas. Le dernier joueur encore debout remporte la manche.',
    tips: ['Ne t\'arrête jamais', 'Évite les autres joueurs', 'Surveille le sol en dessous'],
    color: 'from-orange-600/15 border-orange-500/20',
    ping: 'from-orange-500/20 to-orange-700/10',
  },
]

export default function Minigames() {
  const navigate = useNavigate()
  const [liveData, setLiveData] = useState<ArenasData | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    fetch('/api/public/games/arenas')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLiveData(d) })
      .catch(() => {})
  }, [navigate])

  function liveGame(id: string): GameInfo | undefined {
    return liveData?.games?.find(g => g.id === id)
  }

  const totalOnline = liveData?.playing ?? null

  return (
    <div className="min-h-screen bg-gray-950 pb-24">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/25 via-cyan-900/10 to-gray-950" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎮</span>
              <div>
                <h1 className="text-2xl font-black text-white">Mini-jeux</h1>
                <p className="text-sm text-gray-400">SunNetwork</p>
              </div>
            </div>
            {totalOnline !== null && (
              <div className="text-right pb-1">
                <p className="text-2xl font-black text-blue-400">{totalOnline}</p>
                <p className="text-xs text-gray-500">en jeu</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-screen-sm mx-auto">

        {/* Server join info */}
        <div className="flex items-center gap-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <span className="text-xl">🌐</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Rejoindre le serveur</p>
            <p className="text-xs font-mono text-blue-400 mt-0.5">play.sunnetwork.fr</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-600">puis</p>
            <p className="text-xs font-mono text-gray-400">/minijeux</p>
          </div>
        </div>

        {/* Game cards */}
        {GAMES_STATIC.map(game => {
          const live = liveGame(game.id)
          const isEnabled = live ? (live.enabled && live.installed) : null
          const totalArenas = live?.totalArenas ?? 0
          const playing     = live?.playingArenas ?? 0
          const waiting     = live?.waitingArenas ?? 0

          return (
            <div key={game.id}
              className={`bg-gradient-to-br ${game.color} bg-gray-900 rounded-2xl border overflow-hidden`}>

              {/* Card header */}
              <div className="flex items-start gap-4 p-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${game.ping} border flex items-center justify-center shrink-0 ${game.color.split(' ')[1]}`}>
                  <span className="text-3xl">{game.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-base font-bold text-white">{game.label}</h3>
                    {isEnabled !== null && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        isEnabled
                          ? 'text-green-400 border-green-500/30 bg-green-500/10'
                          : 'text-gray-500 border-gray-700 bg-gray-800/50'
                      }`}>
                        {isEnabled ? '● Actif' : '○ Inactif'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{game.desc}</p>
                </div>
              </div>

              {/* Live stats row */}
              {live && totalArenas > 0 && (
                <div className="flex divide-x divide-gray-800/60 border-t border-gray-800/60">
                  <LiveStat label="Arènes"    value={totalArenas} color="text-gray-300" />
                  <LiveStat label="En cours"  value={playing}     color="text-blue-400" />
                  <LiveStat label="En attente" value={waiting}    color="text-green-400" />
                </div>
              )}

              {/* Tips */}
              <div className="px-4 py-3 border-t border-gray-800/60">
                <div className="flex flex-wrap gap-2">
                  {game.tips.map(tip => (
                    <span key={tip} className="text-[10px] text-gray-500 bg-gray-800/60 border border-gray-700/50 px-2 py-0.5 rounded-full">
                      {tip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        {/* How to join */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
            <span>📖</span>
            <span className="text-sm font-semibold text-white">Comment jouer</span>
          </div>
          <div className="divide-y divide-gray-800/50">
            {[
              { step: '1', text: 'Connecte-toi sur play.sunnetwork.fr' },
              { step: '2', text: 'Utilise /minijeux ou le menu principal pour accéder aux jeux' },
              { step: '3', text: 'Rejoins une file d\'attente ou une arène existante' },
              { step: '4', text: 'Gagne des coins et monte dans le classement !' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-4 px-5 py-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0">
                  {step}
                </span>
                <p className="text-sm text-gray-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Navbar />
    </div>
  )
}

function LiveStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 py-2.5 text-center">
      <p className={`text-base font-black ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-600">{label}</p>
    </div>
  )
}
