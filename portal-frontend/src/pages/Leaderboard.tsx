import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import CodexSky from '../components/codex/CodexSky'
import Cartouche from '../components/codex/Cartouche'
import WaxSeal from '../components/codex/WaxSeal'
import Flourish from '../components/codex/Flourish'
import RuneIcon from '../components/codex/RuneIcon'
import CompassRose from '../components/codex/CompassRose'
import DustParticles from '../components/codex/DustParticles'
import RomanNumeral, { toRoman } from '../components/codex/RomanNumeral'

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
    <CodexSky time="noon">
      <DustParticles count={10} />

      {/* Compas filigrane en fond */}
      <CompassRose
        size={520}
        opacity={0.05}
        className="absolute top-[20%] left-1/2 -translate-x-1/2 pointer-events-none hidden md:block"
      />

      {/* Oiseau qui passe */}
      <svg
        className="absolute pointer-events-none"
        style={{
          top: '12%', left: 0,
          width: 32, height: 24,
          opacity: 0.45,
          animation: 'codexBirdFly 38s linear infinite',
          animationDelay: '4s',
        }}
        viewBox="0 0 32 24" fill="none" stroke="#FBE9C2" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M 2 14 Q 8 4, 14 14 Q 20 4, 30 14" />
      </svg>

      <div className="relative z-10 min-h-screen pb-20">

        {/* ── Top bar ─── */}
        <header className="px-5 py-6 flex items-center justify-between max-w-6xl mx-auto codex-reveal codex-reveal-1">
          <Link to="/" className="flex items-center gap-2.5 group">
            <RuneIcon rune="sun" size={22} color="#F0A93B" />
            <span className="font-codex-display text-sm tracking-[0.3em] text-amber-100/90 group-hover:text-amber-100 transition-colors">
              SUNGUARD
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-xs font-codex-lyric tracking-wider">
            <Link to="/login" className="codex-underline text-amber-100/70 hover:text-amber-100">
              Connexion
            </Link>
            <span className="text-amber-100/30">◈</span>
            <Link to="/" className="codex-underline text-amber-100/70 hover:text-amber-100">
              Inscription
            </Link>
          </nav>
        </header>

        <main className="max-w-4xl mx-auto px-5 pt-6 space-y-12">

          {/* ── Titre cérémoniel ─── */}
          <section className="text-center codex-reveal codex-reveal-2">
            <p className="font-codex-rune text-[10px] tracking-[0.4em] text-amber-200/50 mb-5">
              ✦ LIVRE I ✦ DU PANTHÉON ✦
            </p>
            <h1 className="font-codex-display text-5xl sm:text-7xl font-bold leading-[0.9]"
                style={{
                  color: '#FBE9C2',
                  textShadow: '0 4px 30px rgba(240,169,59,0.3), 0 1px 0 rgba(248,210,103,0.4)',
                  letterSpacing: '0.08em',
                }}>
              PANTHÉON<br />
              <span className="text-3xl sm:text-5xl text-amber-200/80">DES VOYAGEURS</span>
            </h1>
            <Flourish variant="royal" width={260} className="mt-6" />
            <p className="font-codex-lyric italic text-amber-100/70 text-lg mt-4 max-w-md mx-auto">
              « Ceux qui ont vu l'aube se lever sur les royaumes de Sun »
            </p>
          </section>

          {/* ── Loading ─── */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-20 codex-reveal">
              <div className="w-14 h-14 rounded-full border-2 border-amber-200/20 border-t-amber-300 animate-spin" />
              <p className="font-codex-lyric italic text-amber-100/60 text-sm">
                Le scribe consulte les grands registres...
              </p>
            </div>
          )}

          {/* ── Error ─── */}
          {error && (
            <Cartouche tone="night" className="px-8 py-10 text-center codex-reveal">
              <RuneIcon rune="flame" size={36} color="#C84329" className="mx-auto mb-3" />
              <p className="font-codex-display text-2xl text-red-200 mb-2">Le registre est scellé</p>
              <p className="font-codex-body italic text-amber-100/60">{error}</p>
            </Cartouche>
          )}

          {/* ── Top 3 podium ─── */}
          {data && data.playtime.length >= 3 && (
            <section className="codex-reveal codex-reveal-3">
              <p className="text-center font-codex-rune text-[10px] tracking-[0.4em] text-amber-200/50 mb-6">
                ✦ LES TROIS ÉLUS ✦
              </p>
              <div className="grid grid-cols-3 gap-3 sm:gap-5 items-end">
                <PodiumPillar entry={data.playtime[1]} place={2} />
                <PodiumPillar entry={data.playtime[0]} place={1} />
                <PodiumPillar entry={data.playtime[2]} place={3} />
              </div>
            </section>
          )}

          {/* ── Reste du classement ─── */}
          {data && data.playtime.length > 3 && (
            <section className="codex-reveal codex-reveal-4">
              <Flourish variant="double" width={200} className="mb-6" />
              <Cartouche tone="night" className="overflow-hidden">
                <div className="px-6 py-4 border-b border-amber-300/10 flex items-center justify-between">
                  <p className="font-codex-display text-xs tracking-[0.3em] text-amber-200/70">
                    LES INSCRITS
                  </p>
                  <p className="font-codex-rune text-[10px] text-amber-100/40">
                    rang · pseudo · temps
                  </p>
                </div>
                <ol className="divide-y divide-amber-300/5">
                  {data.playtime.slice(3).map((entry, i) => (
                    <li key={entry.uuid}
                        className="codex-reveal"
                        style={{ animationDelay: `${600 + i * 80}ms` }}>
                      <a
                        href={`/portal/player/${entry.username}`}
                        className="codex-row flex items-center gap-4 px-6 py-3.5 group"
                      >
                        {/* Numéro romain */}
                        <div className="w-12 shrink-0 text-center">
                          <span className="font-codex-display text-sm text-amber-200/50 group-hover:text-amber-200 transition-colors tracking-wider">
                            {toRoman(entry.rank)}
                          </span>
                        </div>

                        {/* Avatar */}
                        <img
                          src={`https://mc-heads.net/avatar/${entry.username}/40`}
                          alt={entry.username}
                          className="w-10 h-10 shrink-0"
                          style={{
                            border: '1px solid rgba(240,169,59,0.25)',
                            imageRendering: 'pixelated',
                          }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />

                        {/* Pseudo */}
                        <div className="flex-1 min-w-0">
                          <p className="font-codex-lyric text-amber-50 truncate text-base group-hover:italic transition-all">
                            {entry.username}
                          </p>
                        </div>

                        {/* Temps */}
                        <div className="text-right shrink-0">
                          <p className="font-codex-display text-sm text-amber-200/90 tracking-wider">
                            {entry.playtime_formatted}
                          </p>
                          <p className="font-codex-lyric italic text-[10px] text-amber-100/40">
                            heures d'errance
                          </p>
                        </div>
                      </a>
                    </li>
                  ))}
                </ol>
              </Cartouche>
            </section>
          )}

          {/* ── Vide ─── */}
          {data && data.playtime.length === 0 && (
            <Cartouche tone="ivory" className="px-10 py-16 text-center codex-reveal">
              <RuneIcon rune="feather" size={48} color="#F0A93B" className="mx-auto mb-4" />
              <p className="font-codex-display text-2xl text-amber-100 mb-2 tracking-wider">
                LE REGISTRE EST VIERGE
              </p>
              <p className="font-codex-lyric italic text-amber-100/60">
                Les premières aventures s'écrivent à peine.
              </p>
            </Cartouche>
          )}

          {/* ── Footer ─── */}
          {data && (
            <div className="text-center codex-reveal codex-reveal-5">
              <Flourish variant="simple" width={180} />
              <p className="font-codex-lyric italic text-[11px] text-amber-100/50 mt-3">
                Mis à jour à l'heure de {new Date(data.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
        </main>
      </div>
    </CodexSky>
  )
}

function PodiumPillar({ entry, place }: { entry: LeaderboardEntry; place: 1 | 2 | 3 }) {
  const config = {
    1: {
      sealColor: 'gold' as const,
      pillarH: 'h-56 sm:h-64',
      avatarSize: 64,
      ornament: '👑',
      glowColor: 'rgba(240,169,59,0.45)',
      borderColor: 'rgba(240,169,59,0.55)',
      bgGradient: 'linear-gradient(180deg, rgba(240,169,59,0.18), rgba(184,92,14,0.08) 60%, rgba(20,15,30,0.5))',
      label: 'PREMIER',
    },
    2: {
      sealColor: 'silver' as const,
      pillarH: 'h-44 sm:h-52',
      avatarSize: 52,
      ornament: '✦',
      glowColor: 'rgba(192,197,204,0.3)',
      borderColor: 'rgba(192,197,204,0.4)',
      bgGradient: 'linear-gradient(180deg, rgba(192,197,204,0.15), rgba(74,107,138,0.08) 60%, rgba(20,15,30,0.5))',
      label: 'SECOND',
    },
    3: {
      sealColor: 'bronze' as const,
      pillarH: 'h-36 sm:h-44',
      avatarSize: 48,
      ornament: '✦',
      glowColor: 'rgba(184,92,14,0.35)',
      borderColor: 'rgba(184,92,14,0.5)',
      bgGradient: 'linear-gradient(180deg, rgba(184,92,14,0.18), rgba(140,63,10,0.08) 60%, rgba(20,15,30,0.5))',
      label: 'TROISIÈME',
    },
  }[place]

  const tilt = place === 1 ? '0deg' : place === 2 ? '-1.5deg' : '1.5deg'

  return (
    <a
      href={`/portal/player/${entry.username}`}
      className={`relative block ${config.pillarH} group`}
      style={{ transform: `rotate(${tilt})`, transition: 'transform 0.4s ease' }}
      onMouseEnter={e => e.currentTarget.style.transform = `rotate(0deg) translateY(-4px)`}
      onMouseLeave={e => e.currentTarget.style.transform = `rotate(${tilt})`}
    >
      {/* Halo */}
      {place === 1 && (
        <div className="absolute -inset-4 rounded-full pointer-events-none"
             style={{
               background: `radial-gradient(circle, ${config.glowColor}, transparent 70%)`,
               filter: 'blur(20px)',
               animation: 'codexHaloPulse 4s ease-in-out infinite',
             }} />
      )}

      {/* Pilier */}
      <div className="relative h-full flex flex-col items-center justify-end px-3 pb-4 pt-5"
           style={{
             background: config.bgGradient,
             border: `1px solid ${config.borderColor}`,
             boxShadow: place === 1
               ? `0 20px 40px -10px ${config.glowColor}, inset 0 1px 0 rgba(255,255,255,0.1)`
               : `0 12px 24px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`,
           }}>

        {/* Coins ornés */}
        <span className="absolute top-2 left-2 w-3 h-3 border-l border-t" style={{ borderColor: config.borderColor }} />
        <span className="absolute top-2 right-2 w-3 h-3 border-r border-t" style={{ borderColor: config.borderColor }} />
        <span className="absolute bottom-2 left-2 w-3 h-3 border-l border-b" style={{ borderColor: config.borderColor }} />
        <span className="absolute bottom-2 right-2 w-3 h-3 border-r border-b" style={{ borderColor: config.borderColor }} />

        {/* Sceau de cire avec rang romain */}
        <div className="absolute -top-5 left-1/2 -translate-x-1/2">
          <WaxSeal color={config.sealColor} label={toRoman(place)} size={place === 1 ? 52 : 42} rotate={-4} />
        </div>

        {/* Avatar */}
        <div className="relative mb-2 mt-3">
          <img
            src={`https://mc-heads.net/avatar/${entry.username}/${config.avatarSize * 2}`}
            alt={entry.username}
            style={{
              width: config.avatarSize, height: config.avatarSize,
              imageRendering: 'pixelated',
              border: `1px solid ${config.borderColor}`,
              boxShadow: `0 4px 12px rgba(0,0,0,0.4)`,
            }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {place === 1 && (
            <span className="absolute -top-1 -right-1 text-2xl"
                  style={{ filter: `drop-shadow(0 2px 4px ${config.glowColor})` }}>
              {config.ornament}
            </span>
          )}
        </div>

        {/* Pseudo */}
        <p className={`font-codex-display text-center truncate w-full leading-tight ${place === 1 ? 'text-base sm:text-lg' : 'text-sm'}`}
           style={{
             color: place === 1 ? '#FFF6E5' : '#FBE9C2',
             textShadow: place === 1 ? '0 2px 8px rgba(240,169,59,0.4)' : 'none',
             letterSpacing: '0.05em',
             fontWeight: place === 1 ? 700 : 500,
           }}>
          {entry.username}
        </p>

        {/* Temps */}
        <p className="font-codex-lyric italic text-[10px] sm:text-xs text-amber-100/70 mt-0.5">
          {entry.playtime_formatted}
        </p>

        {/* Label de rang */}
        <p className="font-codex-rune text-[9px] tracking-[0.25em] text-amber-200/50 mt-1.5 pt-1.5 border-t w-full text-center"
           style={{ borderColor: config.borderColor }}>
          {config.label}
        </p>
      </div>
    </a>
  )
}
