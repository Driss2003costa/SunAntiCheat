import { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: string | ReactNode
  subtitle?: string | ReactNode
  cta?: ReactNode
  rightSlot?: ReactNode
  variant?: 'sun' | 'aurora' | 'ember' | 'jade'
  minHeight?: string
}

const VARIANTS = {
  sun: {
    bg: 'radial-gradient(120% 90% at 0% 0%, rgba(255,179,71,0.22) 0%, transparent 55%), radial-gradient(80% 80% at 100% 100%, rgba(224,127,26,0.18) 0%, transparent 60%), linear-gradient(160deg, #181f3d 0%, #0a1024 100%)',
    accent: '#FFB347',
    border: 'rgba(255,179,71,0.18)',
  },
  aurora: {
    bg: 'radial-gradient(100% 80% at 0% 0%, rgba(93,212,200,0.20) 0%, transparent 55%), radial-gradient(80% 80% at 100% 100%, rgba(139,92,246,0.18) 0%, transparent 60%), linear-gradient(160deg, #141b3a 0%, #0a1024 100%)',
    accent: '#5DD4C8',
    border: 'rgba(93,212,200,0.18)',
  },
  ember: {
    bg: 'radial-gradient(100% 80% at 100% 0%, rgba(239,68,68,0.18) 0%, transparent 55%), radial-gradient(80% 80% at 0% 100%, rgba(251,146,60,0.16) 0%, transparent 60%), linear-gradient(160deg, #1a1530 0%, #0a1024 100%)',
    accent: '#fb923c',
    border: 'rgba(251,146,60,0.18)',
  },
  jade: {
    bg: 'radial-gradient(100% 80% at 0% 100%, rgba(16,185,129,0.20) 0%, transparent 55%), radial-gradient(80% 80% at 100% 0%, rgba(59,130,246,0.16) 0%, transparent 60%), linear-gradient(160deg, #11253b 0%, #0a1024 100%)',
    accent: '#34d399',
    border: 'rgba(52,211,153,0.18)',
  },
}

export default function HeroBanner({ eyebrow, title, subtitle, cta, rightSlot, variant = 'sun', minHeight = 'min-h-[320px] lg:min-h-[420px]' }: Props) {
  const v = VARIANTS[variant]
  return (
    <section className={`relative overflow-hidden rounded-3xl ${minHeight} mb-10 lg:mb-14`}
             style={{ background: v.bg, border: `1px solid ${v.border}` }}>
      {/* Decorative orbs */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30 blur-3xl pointer-events-none"
           style={{ background: v.accent }} />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
           style={{ background: v.accent }} />
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
           style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 px-6 sm:px-10 lg:px-14 py-10 lg:py-16 h-full">
        <div className="flex flex-col justify-center">
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] mb-4"
               style={{ color: v.accent }}>{eyebrow}</p>
          )}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold leading-[1.02] tracking-tight"
              style={{ color: '#f8fafc' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-5 text-base lg:text-lg max-w-xl" style={{ color: 'rgba(241,245,249,0.7)' }}>
              {subtitle}
            </p>
          )}
          {cta && <div className="mt-7 flex flex-wrap gap-3">{cta}</div>}
        </div>
        {rightSlot && (
          <div className="flex items-center justify-center lg:justify-end">
            {rightSlot}
          </div>
        )}
      </div>
    </section>
  )
}
