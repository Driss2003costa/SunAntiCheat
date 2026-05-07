import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { Button, Tag } from '../components/ui'

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
    <div className="relative min-h-screen overflow-hidden flex flex-col" style={{ background: '#080d19' }}>
      {/* Background immersif */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(255,179,71,0.18) 0%, transparent 60%), radial-gradient(80% 60% at 50% 100%, rgba(224,127,26,0.12) 0%, transparent 60%), linear-gradient(180deg, #0a1024 0%, #080d19 100%)',
        }}
      />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: '#FFB347' }} />
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center gap-7 px-6 pb-32 text-center">
        {/* Animated icon */}
        <div className="relative mb-2">
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255,179,71,0.30), transparent 70%)',
              transform: 'scale(2.8)',
              animation: 'pulse 4s ease-in-out infinite',
            }}
          />
          <div
            className="relative w-28 h-28 rounded-3xl flex items-center justify-center text-6xl"
            style={{
              background: 'rgba(255,179,71,0.12)',
              border: '1px solid rgba(255,179,71,0.30)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {meta.icon}
          </div>
        </div>

        {/* Badge */}
        <Tag tone="gold">{meta.eta ?? 'À venir'}</Tag>

        {/* Title */}
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sun-300 mb-4">Bientôt disponible</p>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-white mb-4 leading-[1.05]">
            {meta.title}
          </h1>
          <p className="text-base sm:text-lg text-white/60 max-w-md mx-auto">
            {meta.description}
          </p>
        </div>

        {/* Progress bar decoration */}
        <div className="w-56 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: '60%',
              background: 'linear-gradient(90deg, #FFB347, #E07F1A)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* Info card */}
        <div
          className="px-6 py-4 rounded-2xl max-w-sm"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs text-white/50 leading-relaxed">
            Cette fonctionnalité est actuellement en cours de développement.
            Reviens bientôt pour la découvrir !
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          <Button to="/portal/profile" size="md">Mon profil</Button>
          <Button to="/portal/home" variant="secondary" size="md">Accueil</Button>
        </div>
      </main>

      <Navbar />
    </div>
  )
}
