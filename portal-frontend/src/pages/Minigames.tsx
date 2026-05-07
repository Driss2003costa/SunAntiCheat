import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import { GridShell, HeroBanner, StatCard, SectionDivider, Card, Button, Tag } from '../components/ui'

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
    id: 'CTF', icon: '🚩', label: 'Capture The Flag',
    desc: 'Infiltre la base adverse, vole son drapeau et ramène-le sans te faire éliminer.',
    tips: ['Protège ton drapeau', 'Travaille en équipe', 'Utilise les passages secrets'],
    accent: 'rgba(239,68,68,0.3)', glow: 'rgba(239,68,68,0.10)',
  },
  {
    id: 'Skywars', icon: '☁️', label: 'Skywars',
    desc: 'Bats tous tes adversaires sur ton île suspendue dans le ciel. Seul le dernier survivant gagne.',
    tips: ['Loot vite', 'Construis des ponts', 'Évite les chutes'],
    accent: 'rgba(59,130,246,0.3)', glow: 'rgba(59,130,246,0.10)',
  },
  {
    id: 'Thimble', icon: '💧', label: 'Thimble',
    desc: 'Plonge dans le trou qui correspond à ta forme depuis une plateforme en hauteur. Sois précis !',
    tips: ['Vise bien avant de sauter', 'Regarde la forme du trou', 'Fais vite !'],
    accent: 'rgba(6,182,212,0.3)', glow: 'rgba(6,182,212,0.10)',
  },
  {
    id: 'TntRun', icon: '💣', label: 'TNT Run',
    desc: 'Cours sur un sol qui s\'effondre à chaque pas. Le dernier joueur encore debout remporte la manche.',
    tips: ['Ne t\'arrête jamais', 'Évite les autres joueurs', 'Surveille le sol en dessous'],
    accent: 'rgba(249,115,22,0.3)', glow: 'rgba(249,115,22,0.10)',
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

  const totalOnline = liveData?.playing ?? 0
  const totalArenas = liveData?.totalArenas ?? 0
  const totalWaiting = liveData?.waiting ?? 0

  // Featured: jeu avec le plus de joueurs en cours
  const featured = (() => {
    let best: typeof GAMES_STATIC[number] | null = null
    let bestPlaying = 0
    GAMES_STATIC.forEach(g => {
      const live = liveGame(g.id)
      if (live && live.playingArenas > bestPlaying) {
        bestPlaying = live.playingArenas
        best = g
      }
    })
    return best ? { game: best, playing: bestPlaying } : null
  })()

  return (
    <div className="min-h-screen" style={{ background: '#080d19' }}>
      <PageAura theme="games" />
      <GridShell>
        <HeroBanner
          eyebrow="Mini-jeux"
          variant="aurora"
          title={<>Plonge dans l'<span className="text-emerald-300">arène</span></>}
          subtitle="CTF, Skywars, TNT Run, Thimble… Trouve ton jeu, rejoins une partie et grimpe au classement."
          cta={
            <>
              <Button href="https://play.sunnetwork.fr" target="_blank" size="lg">play.sunnetwork.fr</Button>
              <Button to="/leaderboard" variant="secondary" size="lg">Voir les classements</Button>
            </>
          }
          rightSlot={
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#5DD4C8' }}>
                En jeu maintenant
              </p>
              <p className="font-display text-6xl lg:text-7xl font-semibold" style={{ color: '#34d399' }}>
                {totalOnline}
              </p>
              <p className="text-sm mt-1" style={{ color: 'rgba(241,245,249,0.55)' }}>joueur{totalOnline !== 1 ? 's' : ''}</p>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-12 lg:mb-16">
          <StatCard label="Arènes totales"  accent="violet" icon="🎮" value={totalArenas} hint="configurées" />
          <StatCard label="Parties en cours" accent="jade"   icon="●"  value={liveData?.playing ?? 0} hint="actives maintenant" />
          <StatCard label="En attente"       accent="gold"   icon="⏳" value={totalWaiting} hint="rejoignables" />
          <StatCard label="Mini-jeux"        accent="sky"    icon="✦"  value={GAMES_STATIC.length} hint="modes disponibles" />
        </div>

        {/* Featured */}
        {featured && (
          <>
            <SectionDivider label="Vedette" hint="Le jeu le plus actif en ce moment" />
            <Card variant="glass-warm" padding="lg" className="mb-12 lg:mb-16 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl"
                   style={{ background: featured.game.glow }} />
              <div className="relative grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 items-center">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-5xl shrink-0"
                       style={{ background: featured.game.glow, border: `1px solid ${featured.game.accent}` }}>
                    {featured.game.icon}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#fb923c' }}>★ Vedette</p>
                    <h2 className="font-display text-3xl lg:text-4xl font-semibold mb-2" style={{ color: '#f8fafc' }}>
                      {featured.game.label}
                    </h2>
                    <p className="text-sm" style={{ color: 'rgba(241,245,249,0.65)' }}>{featured.game.desc}</p>
                  </div>
                </div>
                <div className="text-center lg:text-right">
                  <Tag tone="jade">● {featured.playing} arène{featured.playing > 1 ? 's' : ''} en cours</Tag>
                  <div className="mt-4">
                    <Button href="https://play.sunnetwork.fr" target="_blank" size="lg">Rejoindre →</Button>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Games grid */}
        <SectionDivider label="Tous les mini-jeux" hint={`${GAMES_STATIC.length} modes disponibles sur play.sunnetwork.fr`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12 lg:mb-16">
          {GAMES_STATIC.map(game => {
            const live = liveGame(game.id)
            const isEnabled = live ? (live.enabled && live.installed) : null
            const playing   = live?.playingArenas ?? 0
            const waiting   = live?.waitingArenas ?? 0
            const totalAr   = live?.totalArenas ?? 0

            return (
              <Card key={game.id} variant="glass" padding="md" hover className="flex flex-col">
                <div className="relative h-32 rounded-2xl mb-4 overflow-hidden flex items-center justify-center"
                     style={{
                       background: `radial-gradient(circle at 50% 50%, ${game.glow} 0%, transparent 70%), linear-gradient(135deg, rgba(15,22,40,0.6), rgba(20,30,55,0.4))`,
                       border: `1px solid ${game.accent}`,
                     }}>
                  <span className="text-7xl drop-shadow-2xl">{game.icon}</span>
                  {playing > 0 && (
                    <span className="absolute top-2 right-2">
                      <Tag tone="jade" size="xs">● {playing} live</Tag>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-display text-xl font-semibold" style={{ color: '#f8fafc' }}>{game.label}</h3>
                  {isEnabled !== null && (
                    isEnabled
                      ? <Tag tone="jade" size="xs">Actif</Tag>
                      : <Tag tone="neutral" size="xs">Inactif</Tag>
                  )}
                </div>
                <p className="text-xs mb-4 flex-1" style={{ color: 'rgba(241,245,249,0.6)' }}>{game.desc}</p>

                {live && totalAr > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center">
                      <p className="font-display text-lg font-semibold" style={{ color: '#f8fafc' }}>{totalAr}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(241,245,249,0.5)' }}>Arènes</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-lg font-semibold" style={{ color: playing > 0 ? '#34d399' : 'rgba(241,245,249,0.4)' }}>{playing}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(241,245,249,0.5)' }}>En cours</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-lg font-semibold" style={{ color: waiting > 0 ? '#fbbf24' : 'rgba(241,245,249,0.4)' }}>{waiting}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(241,245,249,0.5)' }}>Attente</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {game.tips.map(tip => (
                    <Tag key={tip} tone="neutral" size="xs">{tip}</Tag>
                  ))}
                </div>

                <Button href="https://play.sunnetwork.fr" target="_blank" fullWidth>
                  Rejoindre
                </Button>
              </Card>
            )
          })}
        </div>

        {/* How to join */}
        <SectionDivider label="Comment jouer" hint="4 étapes pour entrer en jeu" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { step: '1', text: 'Connecte-toi sur play.sunnetwork.fr' },
            { step: '2', text: 'Utilise /minijeux ou le menu principal' },
            { step: '3', text: 'Rejoins une file d\'attente ou une arène' },
            { step: '4', text: 'Gagne des coins et monte dans le classement !' },
          ].map(({ step, text }) => (
            <Card key={step} padding="md">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold mb-3"
                   style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
                {step}
              </div>
              <p className="text-sm" style={{ color: 'rgba(241,245,249,0.75)' }}>{text}</p>
            </Card>
          ))}
        </div>
      </GridShell>

      <Navbar />
    </div>
  )
}
