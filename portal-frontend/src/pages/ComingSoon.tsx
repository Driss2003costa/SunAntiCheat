import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import { Button, Tag } from '../components/ui'

const ICONS: Record<string, string> = {
  '/home': '🏠', '/inventory': '🎒', '/minigames': '🎮', '/career': '💼', '/shop': '🛍',
}

export default function ComingSoon({ path }: { path: string }) {
  const { t } = useTranslation()
  const ns = path.replace('/', '') // ex. "/home" -> "home"
  const known = ['home', 'inventory', 'minigames', 'career', 'shop'].includes(ns) ? ns : 'default'
  const meta = {
    icon: ICONS[path] ?? '⚙️',
    title: t(`comingSoon.${known}.title`),
    description: t(`comingSoon.${known}.desc`),
    eta: known !== 'default' && known !== 'home' && known !== 'shop'
      ? t(`comingSoon.${known}.badge`)
      : undefined,
  }

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
        <Tag tone="gold">{meta.eta ?? t('comingSoon.comingBadge')}</Tag>

        {/* Title */}
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sun-300 mb-4">{t('comingSoon.available')}</p>
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
            {t('comingSoon.message')}
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          <Button to="/portal/profile" size="md">{t('comingSoon.buttonProfile')}</Button>
          <Button to="/portal/home" variant="secondary" size="md">{t('comingSoon.buttonHome')}</Button>
        </div>
      </main>

      <Navbar />
    </div>
  )
}
