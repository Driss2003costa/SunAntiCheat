import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../api/client'
import Navbar from '../components/Navbar'
import SunBackground from '../components/SunBackground'

const BG     = '#080d19'
const CARD   = 'rgba(15,22,40,0.8)'
const BORDER = 'rgba(251,191,36,0.12)'
const GOLD   = '#fbbf24'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'

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
    accentBorder: 'rgba(239,68,68,0.3)',
    accentGlow: 'rgba(239,68,68,0.08)',
    playingColor: '#f87171',
  },
  {
    id: 'Skywars',
    icon: '☁️',
    label: 'Skywars',
    desc: 'Bats tous tes adversaires sur ton île suspendue dans le ciel. Seul le dernier survivant gagne.',
    tips: ['Loot vite', 'Construis des ponts', 'Évite les chutes'],
    accentBorder: 'rgba(59,130,246,0.3)',
    accentGlow: 'rgba(59,130,246,0.08)',
    playingColor: '#60a5fa',
  },
  {
    id: 'Thimble',
    icon: '💧',
    label: 'Thimble',
    desc: 'Plonge dans le trou qui correspond à ta forme depuis une plateforme en hauteur. Sois précis !',
    tips: ['Vise bien avant de sauter', 'Regarde la forme du trou', 'Fais vite !'],
    accentBorder: 'rgba(6,182,212,0.3)',
    accentGlow: 'rgba(6,182,212,0.08)',
    playingColor: '#22d3ee',
  },
  {
    id: 'TntRun',
    icon: '💣',
    label: 'TNT Run',
    desc: 'Cours sur un sol qui s\'effondre à chaque pas. Le dernier joueur encore debout remporte la manche.',
    tips: ['Ne t\'arrête jamais', 'Évite les autres joueurs', 'Surveille le sol en dessous'],
    accentBorder: 'rgba(249,115,22,0.3)',
    accentGlow: 'rgba(249,115,22,0.08)',
    playingColor: '#fb923c',
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
    <div className="min-h-screen pb-24 relative" style={{ background: BG }}>
      <SunBackground />

      {/* Header */}
      <div className="relative overflow-hidden z-10">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(251,191,36,0.12),transparent)' }} />
        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎮</span>
              <div>
                <h1 className="text-2xl font-black" style={{ color: TEXT }}>Mini-jeux</h1>
                <p className="text-sm" style={{ color: MUTED }}>SunNetwork</p>
              </div>
            </div>
            {totalOnline !== null && (
              <div className="text-right pb-1">
                <p className="text-2xl font-black" style={{ color: GOLD }}>{totalOnline}</p>
                <p className="text-xs" style={{ color: MUTED }}>en jeu</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-screen-sm mx-auto relative z-10">

        {/* Server join info */}
        <div className="flex items-center gap-4 rounded-2xl p-4 backdrop-blur-sm"
             style={{ background: CARD, border: `1px solid rgba(251,191,36,0.2)` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: 'rgba(251,191,36,0.1)', border: `1px solid rgba(251,191,36,0.25)` }}>
            <span className="text-xl">🌐</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: TEXT }}>Rejoindre le serveur</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: GOLD }}>play.sunnetwork.fr</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px]" style={{ color: MUTED }}>puis</p>
            <p className="text-xs font-mono" style={{ color: '#94a3b8' }}>/minijeux</p>
          </div>
        </div>

        {/* Game cards */}
        {GAMES_STATIC.map(game => {
          const live = liveGame(game.id)
          const isEnabled = live ? (live.enabled && live.installed) : null
          const totalArenas = live?.totalArenas ?? 0
          const playing     = live?.playingArenas ?? 0
          const waiting     = live?.waitingArenas ?? 0
          const isPlaying   = playing > 0

          return (
            <div key={game.id}
              className="rounded-2xl overflow-hidden backdrop-blur-sm"
              style={{
                background: CARD,
                border: `1px solid ${isPlaying ? game.accentBorder : BORDER}`,
                boxShadow: isPlaying ? `0 0 20px ${game.accentGlow}` : 'none',
              }}>

              {/* Card header */}
              <div className="flex items-start gap-4 p-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                     style={{
                       background: game.accentGlow,
                       border: `1px solid ${game.accentBorder}`,
                     }}>
                  <span className="text-3xl">{game.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-base font-bold" style={{ color: TEXT }}>{game.label}</h3>
                    {isEnabled !== null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0"
                            style={isEnabled
                              ? { color: isPlaying ? game.playingColor : '#4ade80', borderColor: isPlaying ? game.accentBorder : 'rgba(74,222,128,0.3)', background: isPlaying ? game.accentGlow : 'rgba(74,222,128,0.08)' }
                              : { color: MUTED, borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
                        {isEnabled ? (isPlaying ? '● En jeu' : '● Actif') : '○ Inactif'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{game.desc}</p>
                </div>
              </div>

              {/* Live stats row */}
              {live && totalArenas > 0 && (
                <div className="flex divide-x border-t"
                     style={{ borderColor: BORDER }}>
                  <LiveStat label="Arènes"    value={totalArenas} color={TEXT} />
                  <LiveStat label="En cours"  value={playing}     color={playing > 0 ? game.playingColor : MUTED} />
                  <LiveStat label="En attente" value={waiting}    color={waiting > 0 ? GOLD : MUTED} />
                </div>
              )}

              {/* Tips */}
              <div className="px-4 py-3 border-t" style={{ borderColor: BORDER }}>
                <div className="flex flex-wrap gap-2">
                  {game.tips.map(tip => (
                    <span key={tip} className="text-[10px] rounded-full px-2 py-0.5"
                          style={{ color: MUTED, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}` }}>
                      {tip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        {/* How to join */}
        <div className="rounded-2xl overflow-hidden backdrop-blur-sm"
             style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-3.5 flex items-center gap-2"
               style={{ borderBottom: `1px solid ${BORDER}` }}>
            <span>📖</span>
            <span className="text-sm font-semibold" style={{ color: TEXT }}>Comment jouer</span>
          </div>
          <div>
            {[
              { step: '1', text: 'Connecte-toi sur play.sunnetwork.fr' },
              { step: '2', text: 'Utilise /minijeux ou le menu principal pour accéder aux jeux' },
              { step: '3', text: 'Rejoins une file d\'attente ou une arène existante' },
              { step: '4', text: 'Gagne des coins et monte dans le classement !' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-4 px-5 py-3"
                   style={{ borderBottom: `1px solid rgba(251,191,36,0.05)` }}>
                <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(251,191,36,0.12)', border: `1px solid rgba(251,191,36,0.3)`, color: GOLD }}>
                  {step}
                </span>
                <p className="text-sm" style={{ color: '#94a3b8' }}>{text}</p>
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
    <div className="flex-1 py-2.5 text-center" style={{ borderColor: 'rgba(251,191,36,0.08)' }}>
      <p className="text-base font-black" style={{ color }}>{value}</p>
      <p className="text-[10px]" style={{ color: '#475569' }}>{label}</p>
    </div>
  )
}
