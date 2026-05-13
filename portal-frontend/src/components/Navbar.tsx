import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'
import { isSectionBlocked } from '../api/client'

export default function Navbar() {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  const items = [
    {
      label: t('navbar.home'),
      to: '/home',
      section: null as string | null,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M3 12L12 3l9 9" /><path d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9" />
        </svg>
      ),
    },
    {
      label: t('navbar.career'),
      to: '/career',
      section: 'career',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
    {
      label: t('navbar.quests'),
      to: '/quests',
      section: 'quests',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      ),
    },
    {
      label: t('navbar.friends'),
      to: '/friends',
      section: 'friends',
      matchPaths: ['/friends', '/messages'],
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
    },
    {
      label: t('navbar.shop'),
      to: '/shop',
      section: 'shop',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
        </svg>
      ),
    },
    {
      label: t('navbar.profile'),
      to: '/profile',
      section: null as string | null,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      ),
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div
        className="absolute inset-0 backdrop-blur-xl border-t"
        style={{ background: 'rgba(10,16,32,0.9)', borderColor: 'rgba(251,191,36,0.1)' }}
      />
      <div className="relative flex items-stretch max-w-screen-sm mx-auto px-1">
        {items.filter(it => !it.section || !isSectionBlocked(it.section)).map(item => {
          const active = pathname === item.to
            || (item.to === '/profile' && pathname === '/')
            || ('matchPaths' in item && Array.isArray((item as any).matchPaths) && (item as any).matchPaths.some((p: string) => pathname.startsWith(p)))
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all relative"
              style={{ color: active ? '#fbbf24' : '#4b5563' }}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg,#f59e0b,#fbbf24)' }}
                />
              )}
              <div style={{ transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }}>
                {item.icon}
              </div>
              <span
                className="text-[9px] font-semibold tracking-wide"
                style={{ color: active ? '#fbbf24' : '#4b5563' }}
              >
                {item.label}
              </span>
              {active && (
                <span
                  className="absolute bottom-1.5 w-1 h-1 rounded-full"
                  style={{ background: '#fbbf24' }}
                />
              )}
            </Link>
          )
        })}
        {/* Sélecteur de langue à droite, hors-tab */}
        <LanguageSwitcher variant="compact" />
      </div>
    </nav>
  )
}
