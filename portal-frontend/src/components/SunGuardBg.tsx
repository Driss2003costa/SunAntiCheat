import { ReactNode } from 'react'

type Props = {
  children: ReactNode
  glow?: 'amber' | 'blue' | 'none'
}

export default function SunGuardBg({ children, glow = 'amber' }: Props) {
  return (
    <div className="relative min-h-screen" style={{ background: '#06090F' }}>

      {/* Radial glow top-center */}
      {glow === 'amber' && (
        <div className="absolute inset-x-0 top-0 h-[380px] pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 90% 100% at 50% -10%, rgba(251,191,36,0.07) 0%, rgba(184,92,14,0.04) 45%, transparent 70%)' }} />
      )}
      {glow === 'blue' && (
        <div className="absolute inset-x-0 top-0 h-[380px] pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 90% 100% at 50% -10%, rgba(99,102,241,0.07) 0%, rgba(59,130,246,0.04) 45%, transparent 70%)' }} />
      )}

      {/* Thin amber hairline at horizon */}
      <div className="absolute inset-x-0 pointer-events-none" style={{ top: '200px', height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.12) 20%, rgba(251,191,36,0.18) 50%, rgba(251,191,36,0.12) 80%, transparent 100%)' }} />

      {/* Subtle dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      {/* Left edge glow */}
      <div className="absolute left-0 top-1/4 w-px h-1/2 pointer-events-none"
           style={{ background: 'linear-gradient(180deg, transparent, rgba(251,191,36,0.06), transparent)' }} />
      <div className="absolute right-0 top-1/4 w-px h-1/2 pointer-events-none"
           style={{ background: 'linear-gradient(180deg, transparent, rgba(251,191,36,0.06), transparent)' }} />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
