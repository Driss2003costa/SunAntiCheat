import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
    id: 'CTF', icon: '🚩', i18nKey: 'ctf',
    accent: 'rgba(239,68,68,0.3)', glow: 'rgba(239,68,68,0.10)',
  },
  {
    id: 'Skywars', icon: '☁️', i18nKey: 'skywars',
    accent: 'rgba(59,130,246,0.3)', glow: 'rgba(59,130,246,0.10)',
  },
  {
    id: 'Thimble', icon: '💧', i18nKey: 'thimble',
    accent: 'rgba(6,182,212,0.3)', glow: 'rgba(6,182,212,0.10)',
  },
  {
    id: 'TntRun', icon: '💣', i18nKey: 'tntrun',
    accent: 'rgba(249,115,22,0.3)', glow: 'rgba(249,115,22,0.10)',
  },
]

export default function Minigames() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
  const featured: { game: typeof GAMES_STATIC[number]; playing: number } | null = (() => {
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
      <PageAura theme="home" />
      <GridShell>
        <HeroBanner
          eyebrow={t('minigames.hero.eyebrow')}
          variant="aurora"
          title={<>{t('minigames.hero.titleStart')}<span className="text-emerald-300">{t('minigames.hero.titleHighlight')}</span></>}
          subtitle={t('minigames.hero.subtitle')}
          cta={
            <>
              <Button href="https://play.sunnetwork.fr" target="_blank" size="lg">play.sunnetwork.fr</Button>
              <Button to="/leaderboard" variant="secondary" size="lg">{t('minigames.cta.viewLeaderboards')}</Button>
            </>
          }
          rightSlot={
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#5DD4C8' }}>
                {t('minigames.hero.onlineNow')}
              </p>
              <p className="font-display text-6xl lg:text-7xl font-semibold" style={{ color: '#34d399' }}>
                {totalOnline}
              </p>
              <p className="text-sm mt-1" style={{ color: 'rgba(241,245,249,0.55)' }}>{t('minigames.hero.player', { count: totalOnline })}</p>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-12 lg:mb-16">
          <StatCard label={t('minigames.stats.arenas')}  accent="violet" icon="🎮" value={totalArenas} hint={t('minigames.stats.arenasHint')} />
          <StatCard label={t('minigames.stats.playing')} accent="jade"   icon="●"  value={liveData?.playing ?? 0} hint={t('minigames.stats.playingHint')} />
          <StatCard label={t('minigames.stats.waiting')} accent="gold"   icon="⏳" value={totalWaiting} hint={t('minigames.stats.waitingHint')} />
          <StatCard label={t('minigames.stats.games')}   accent="sky"    icon="✦"  value={GAMES_STATIC.length} hint={t('minigames.stats.gamesHint')} />
        </div>

        {/* Featured */}
        {featured && (
          <>
            <SectionDivider label={t('minigames.featured.section')} hint={t('minigames.featured.hint')} />
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
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#fb923c' }}>{t('minigames.featured.badge')}</p>
                    <h2 className="font-display text-3xl lg:text-4xl font-semibold mb-2" style={{ color: '#f8fafc' }}>
                      {t(`minigames.${featured.game.i18nKey}.name`)}
                    </h2>
                    <p className="text-sm" style={{ color: 'rgba(241,245,249,0.65)' }}>{t(`minigames.${featured.game.i18nKey}.desc`)}</p>
                  </div>
                </div>
                <div className="text-center lg:text-right">
                  <Tag tone="jade">{t('minigames.featured.tag', { count: featured.playing })}</Tag>
                  <div className="mt-4">
                    <Button href="https://play.sunnetwork.fr" target="_blank" size="lg">{t('minigames.cta.joinArrow')}</Button>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Games grid */}
        <SectionDivider label={t('minigames.all.section')} hint={t('minigames.all.hint', { count: GAMES_STATIC.length })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12 lg:mb-16">
          {GAMES_STATIC.map(game => {
            const live = liveGame(game.id)
            const isEnabled = live ? (live.enabled && live.installed) : null
            const playing   = live?.playingArenas ?? 0
            const waiting   = live?.waitingArenas ?? 0
            const totalAr   = live?.totalArenas ?? 0
            const tips = [
              t(`minigames.${game.i18nKey}.tip1`),
              t(`minigames.${game.i18nKey}.tip2`),
              t(`minigames.${game.i18nKey}.tip3`),
            ]

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
                      <Tag tone="jade" size="xs">{t('minigames.game.live', { count: playing })}</Tag>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-display text-xl font-semibold" style={{ color: '#f8fafc' }}>{t(`minigames.${game.i18nKey}.name`)}</h3>
                  {isEnabled !== null && (
                    isEnabled
                      ? <Tag tone="jade" size="xs">{t('minigames.game.active')}</Tag>
                      : <Tag tone="neutral" size="xs">{t('minigames.game.inactive')}</Tag>
                  )}
                </div>
                <p className="text-xs mb-4 flex-1" style={{ color: 'rgba(241,245,249,0.6)' }}>{t(`minigames.${game.i18nKey}.desc`)}</p>

                {live && totalAr > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center">
                      <p className="font-display text-lg font-semibold" style={{ color: '#f8fafc' }}>{totalAr}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('minigames.game.arenas')}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-lg font-semibold" style={{ color: playing > 0 ? '#34d399' : 'rgba(241,245,249,0.4)' }}>{playing}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('minigames.game.playing')}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-lg font-semibold" style={{ color: waiting > 0 ? '#fbbf24' : 'rgba(241,245,249,0.4)' }}>{waiting}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('minigames.game.waiting')}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {tips.map(tip => (
                    <Tag key={tip} tone="neutral" size="xs">{tip}</Tag>
                  ))}
                </div>

                <Button href="https://play.sunnetwork.fr" target="_blank" fullWidth>
                  {t('minigames.cta.join')}
                </Button>
              </Card>
            )
          })}
        </div>

        {/* How to join */}
        <SectionDivider label={t('minigames.howToJoin.section')} hint={t('minigames.howToJoin.hint')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { step: '1', text: t('minigames.howToJoin.step1') },
            { step: '2', text: t('minigames.howToJoin.step2') },
            { step: '3', text: t('minigames.howToJoin.step3') },
            { step: '4', text: t('minigames.howToJoin.step4') },
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
