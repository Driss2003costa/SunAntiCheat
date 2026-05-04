import { Link, useLocation } from 'react-router-dom'

const items = [
  {
    label: 'Home',
    to: '/home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 12L12 3l9 9" /><path d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9" />
      </svg>
    ),
  },
  {
    label: 'Inventaire',
    to: '/inventory',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
  {
    label: 'Minijeux',
    to: '/minigames',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="2" y="6" width="20" height="12" rx="4" /><path d="M6 12h4M8 10v4" /><circle cx="15" cy="11" r="1" fill="currentColor" stroke="none" /><circle cx="18" cy="13" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'Carrière',
    to: '/career',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    label: 'Quêtes',
    to: '/quests',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    label: 'Shop',
    to: '/shop',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    label: 'Profil',
    to: '/profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-xl border-t border-white/5" />

      <div className="relative flex items-stretch max-w-screen-sm mx-auto px-2">
        {items.map(item => {
          const active = pathname === item.to || (item.to === '/profile' && pathname === '/')
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all
                ${active
                  ? 'text-brand-400'
                  : 'text-gray-600 hover:text-gray-400'
                }`}
            >
              {/* Active indicator bar */}
              <div className={`absolute top-0 w-8 h-0.5 rounded-full transition-all ${active ? 'bg-brand-400' : 'bg-transparent'}`} />

              <div className={`transition-transform ${active ? 'scale-110' : 'scale-100'}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-medium tracking-wide ${active ? 'text-brand-400' : 'text-gray-600'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
