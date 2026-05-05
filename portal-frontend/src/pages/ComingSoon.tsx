import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import RuneIcon from '../components/codex/RuneIcon'
import Flourish from '../components/codex/Flourish'

const META: Record<string, { title: string; rune: 'flame' | 'eye' | 'star' | 'compass' | 'feather'; verse: string }> = {
  '/home':      { title: 'L\'Accueil',     rune: 'sun' as any, verse: 'Le foyer du voyageur s\'élève à l\'horizon...' },
  '/inventory': { title: 'L\'Inventaire',  rune: 'star',       verse: 'Le scribe inventorie tes biens un à un...' },
  '/minigames': { title: 'Les Mini-jeux',  rune: 'flame',      verse: 'Les arènes se construisent en silence...' },
  '/career':    { title: 'La Carrière',    rune: 'compass',    verse: 'Ton parcours se grave sur le marbre...' },
  '/shop':      { title: 'La Boutique',    rune: 'feather',    verse: 'Les marchands déballent leurs trésors...' },
}

export default function ComingSoon({ path }: { path: string }) {
  const meta = META[path] ?? { title: 'Page', rune: 'eye' as const, verse: 'Le scribe travaille encore...' }

  return (
    <>
      <PageAura theme="home" />

      <div className="relative min-h-screen flex flex-col pb-24 z-10">

        {/* Étoiles filantes */}
        <svg className="absolute pointer-events-none" style={{
          top: 0, left: 0, width: '100%', height: '100%',
        }} viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="-10" y1="20" x2="20" y2="40"
                stroke="rgba(248,210,103,0.6)" strokeWidth="0.15" strokeLinecap="round"
                style={{ animation: 'codexCometStreak 12s linear infinite' }} />
          <line x1="-10" y1="60" x2="25" y2="80"
                stroke="rgba(244,181,160,0.4)" strokeWidth="0.12" strokeLinecap="round"
                style={{ animation: 'codexCometStreak 16s linear infinite', animationDelay: '6s' }} />
        </svg>

        <main className="flex-1 flex flex-col items-center justify-center gap-7 px-8 text-center max-w-md mx-auto">

          {/* Sablier animé */}
          <div className="relative codex-reveal codex-reveal-1">
            <div className="absolute inset-0 rounded-full blur-2xl"
                 style={{
                   background: 'radial-gradient(circle, rgba(240,169,59,0.25), transparent 70%)',
                   transform: 'scale(2)',
                   animation: 'codexHaloPulse 5s ease-in-out infinite',
                 }} />
            <svg width="80" height="100" viewBox="0 0 80 100" fill="none"
                 className="relative"
                 style={{ animation: 'codexSandFall 8s ease-in-out infinite' }}>
              {/* Cadre */}
              <line x1="10" y1="10" x2="70" y2="10" stroke="#F0A93B" strokeWidth="2" strokeLinecap="round" />
              <line x1="10" y1="90" x2="70" y2="90" stroke="#F0A93B" strokeWidth="2" strokeLinecap="round" />
              {/* Bulles */}
              <path d="M 15 10 Q 15 35, 38 50 Q 15 65, 15 90"
                    stroke="rgba(240,169,59,0.6)" strokeWidth="1.5" fill="none" />
              <path d="M 65 10 Q 65 35, 42 50 Q 65 65, 65 90"
                    stroke="rgba(240,169,59,0.6)" strokeWidth="1.5" fill="none" />
              {/* Sable haut */}
              <path d="M 18 14 Q 28 28, 40 32 Q 52 28, 62 14 Z"
                    fill="rgba(248,210,103,0.4)" />
              {/* Sable bas */}
              <path d="M 22 86 Q 30 72, 40 70 Q 50 72, 58 86 Z"
                    fill="rgba(248,210,103,0.7)" />
              {/* Filet de sable */}
              <line x1="40" y1="48" x2="40" y2="68" stroke="rgba(248,210,103,0.8)" strokeWidth="0.5" />
            </svg>
          </div>

          {/* Titre */}
          <div className="codex-reveal codex-reveal-2">
            <p className="font-codex-rune text-[10px] tracking-[0.4em] text-amber-200/50 mb-3">
              ✦ LE SCRIBE TRAVAILLE ✦
            </p>
            <h1 className="font-codex-display text-3xl sm:text-4xl font-bold leading-tight"
                style={{
                  color: '#FBE9C2',
                  textShadow: '0 4px 24px rgba(240,169,59,0.3)',
                  letterSpacing: '0.06em',
                }}>
              {meta.title}
            </h1>
            <Flourish variant="simple" width={160} className="mt-4" />
          </div>

          {/* Verset */}
          <p className="font-codex-lyric italic text-amber-100/70 text-base leading-relaxed codex-reveal codex-reveal-3">
            « {meta.verse} »
          </p>

          {/* Sub-text */}
          <p className="font-codex-body italic text-amber-100/45 text-sm codex-reveal codex-reveal-4">
            Cette page est en cours d'enluminure.<br />
            Reviens à l'aube prochaine pour la découvrir.
          </p>

          {/* CTA retour */}
          <Link to="/profile"
                className="codex-flare inline-flex items-center gap-3 px-6 py-3 mt-2 codex-reveal codex-reveal-5"
                style={{
                  background: 'linear-gradient(180deg, rgba(184,92,14,0.15), rgba(140,42,31,0.08))',
                  border: '1px solid rgba(240,169,59,0.35)',
                  color: '#FBE9C2',
                }}>
            <RuneIcon rune="compass" size={16} color="#F0A93B" />
            <span className="font-codex-display text-xs tracking-[0.3em]">
              RETOUR AU ROYAUME
            </span>
          </Link>
        </main>

        <Navbar />
      </div>
    </>
  )
}
