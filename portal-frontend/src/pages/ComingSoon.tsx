import Navbar from '../components/Navbar'

const icons: Record<string, string> = {
  '/home':      '🏠',
  '/inventory': '🎒',
  '/minigames': '🎮',
  '/career':    '📈',
  '/shop':      '🛒',
}

const labels: Record<string, string> = {
  '/home':      'Accueil',
  '/inventory': 'Inventaire',
  '/minigames': 'Mini-jeux',
  '/career':    'Carrière',
  '/shop':      'Boutique',
}

export default function ComingSoon({ path }: { path: string }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col pb-20">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="text-6xl">{icons[path] ?? '🚧'}</span>
        <h1 className="text-2xl font-bold text-white">{labels[path] ?? 'Page'}</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          Cette section est en cours de développement.<br />Elle sera disponible prochainement !
        </p>
        <div className="flex gap-1 mt-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-brand-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
      <Navbar />
    </div>
  )
}
