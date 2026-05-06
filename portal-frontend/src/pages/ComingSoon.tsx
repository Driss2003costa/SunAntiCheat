import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import SunGuardBg from '../components/SunGuardBg'

const GLASS  = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const AMBER  = 'rgba(251,191,36,0.12)'
const AMBER_B = 'rgba(251,191,36,0.25)'

const META: Record<string, { title: string; description: string; icon: string; eta?: string }> = {
  '/home':      { title: 'Accueil',     icon: '🏠', description: 'Votre tableau de bord arrive bientôt.' },
  '/inventory': { title: 'Inventaire',  icon: '🎒', description: 'Gérez votre inventaire en jeu depuis ici.', eta: 'Bientôt' },
  '/minigames': { title: 'Mini-jeux',   icon: '🎮', description: 'Suivez vos scores et statistiques de mini-jeux.', eta: 'En développement' },
  '/career':    { title: 'Carrière',    icon: '💼', description: 'Votre progression de carrière sur le serveur.', eta: 'Bientôt' },
  '/shop':      { title: 'Boutique',    icon: '🛍', description: 'La boutique en jeu arrive prochainement.' },
}

export default function ComingSoon({ path }: { path: string }) {
  const meta = META[path] ?? { title: 'Page', icon: '⚙️', description: 'Cette fonctionnalité est en cours de développement.' }

  return (
    <SunGuardBg>
      <div className="relative min-h-screen flex flex-col pb-24">
        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">

          {/* Animated icon */}
          <div className="relative mb-2">
            <div className="absolute inset-0 rounded-full pointer-events-none"
                 style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.15), transparent 70%)',
                          transform: 'scale(2.5)',
                          animation: 'pulse 4s ease-in-out infinite' }} />
            <div className="relative w-24 h-24 rounded-2xl flex items-center justify-center text-5xl"
                 style={{ background: AMBER, border: `1px solid ${AMBER_B}`, backdropFilter: 'blur(8px)' }}>
              {meta.icon}
            </div>
          </div>

          {/* Badge */}
          <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
                style={{ background: AMBER, border: `1px solid ${AMBER_B}`, color: '#fbbf24' }}>
            {meta.eta ?? 'À venir'}
          </span>

          {/* Title */}
          <div>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-2">
              {meta.title}
            </h1>
            <p className="text-white/50 text-base max-w-sm mx-auto">
              {meta.description}
            </p>
          </div>

          {/* Progress bar decoration */}
          <div className="w-48 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full"
                 style={{
                   width: '60%',
                   background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                   animation: 'pulse 2s ease-in-out infinite',
                 }} />
          </div>

          {/* Info card */}
          <div className="mt-2 px-6 py-4 rounded-xl max-w-xs"
               style={{ background: GLASS, border: `1px solid ${BORDER}` }}>
            <p className="text-xs text-white/40 leading-relaxed">
              Cette fonctionnalité est actuellement en cours de développement.
              Reviens bientôt pour la découvrir !
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
            <Link to="/portal/profile"
                  className="px-6 py-2.5 rounded-full text-sm font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                  style={{ background: AMBER, border: `1px solid ${AMBER_B}` }}>
              Mon profil
            </Link>
            <Link to="/portal/home"
                  className="px-6 py-2.5 rounded-full text-sm font-semibold transition-colors hover:text-white"
                  style={{ background: GLASS, border: `1px solid ${BORDER}`, color: 'rgba(255,255,255,0.5)' }}>
              Accueil
            </Link>
          </div>
        </main>

        <Navbar />
      </div>
    </SunGuardBg>
  )
}
