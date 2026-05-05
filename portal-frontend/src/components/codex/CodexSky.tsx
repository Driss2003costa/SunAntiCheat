import { ReactNode } from 'react'

export type CodexTime = 'dawn' | 'noon' | 'dusk' | 'night' | 'triumph'

type Props = {
  time?: CodexTime
  density?: 'light' | 'normal' | 'dense'
  children?: ReactNode
}

const TIME_PRESETS: Record<CodexTime, {
  bg: string
  sunColor: string
  haloColor: string
  sunPos: { x: string; y: string }
  rays: number
  rayOpacity: number
  topGlow: string
  bottomShadow: string
  ambient?: string
}> = {
  dawn: {
    bg: 'linear-gradient(180deg, #1A1226 0%, #2C1A2E 25%, #6B3422 55%, #C97B5C 80%, #F4B5A0 100%)',
    sunColor: '#FBE9C2',
    haloColor: 'rgba(244,181,160,0.6)',
    sunPos: { x: '78%', y: '70%' },
    rays: 18,
    rayOpacity: 0.06,
    topGlow:    'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(74,107,138,0.35), transparent 70%)',
    bottomShadow: 'radial-gradient(ellipse 100% 50% at 50% 110%, rgba(10,15,31,0.95), transparent 70%)',
    ambient:    'radial-gradient(ellipse 70% 50% at 78% 70%, rgba(244,181,160,0.25), transparent 65%)',
  },
  noon: {
    bg: 'linear-gradient(180deg, #1A1226 0%, #2A1B3D 30%, #6B3A1F 60%, #B85C0E 85%, #E07F1A 100%)',
    sunColor: '#FFEDC2',
    haloColor: 'rgba(240,169,59,0.7)',
    sunPos: { x: '50%', y: '15%' },
    rays: 28,
    rayOpacity: 0.08,
    topGlow:    'radial-gradient(ellipse 80% 50% at 50% 5%, rgba(240,169,59,0.4), transparent 70%)',
    bottomShadow: 'radial-gradient(ellipse 120% 60% at 50% 115%, rgba(10,15,31,0.95), transparent 70%)',
    ambient:    'radial-gradient(ellipse 100% 60% at 50% 30%, rgba(240,169,59,0.18), transparent 65%)',
  },
  dusk: {
    bg: 'linear-gradient(180deg, #0A0F1F 0%, #1A1226 35%, #4A1F2A 65%, #8C3F0A 85%, #B85C0E 100%)',
    sunColor: '#E07F1A',
    haloColor: 'rgba(184,92,14,0.55)',
    sunPos: { x: '15%', y: '78%' },
    rays: 12,
    rayOpacity: 0.05,
    topGlow:    'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(74,107,138,0.4), transparent 70%)',
    bottomShadow: 'radial-gradient(ellipse 100% 60% at 50% 120%, rgba(10,15,31,1), transparent 65%)',
    ambient:    'radial-gradient(ellipse 60% 40% at 15% 78%, rgba(224,127,26,0.25), transparent 65%)',
  },
  night: {
    bg: 'linear-gradient(180deg, #03050E 0%, #0A0F1F 40%, #1A1226 75%, #2A1B3D 100%)',
    sunColor: '#5DD4C8',
    haloColor: 'rgba(93,212,200,0.3)',
    sunPos: { x: '85%', y: '82%' },
    rays: 8,
    rayOpacity: 0.03,
    topGlow:    'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(74,107,138,0.25), transparent 70%)',
    bottomShadow: 'radial-gradient(ellipse 100% 50% at 50% 110%, rgba(0,0,0,0.95), transparent 70%)',
  },
  triumph: {
    bg: 'linear-gradient(180deg, #1A0E03 0%, #3D1F08 25%, #8C3F0A 55%, #E07F1A 80%, #F0A93B 100%)',
    sunColor: '#FFF6E5',
    haloColor: 'rgba(248,210,103,0.85)',
    sunPos: { x: '50%', y: '20%' },
    rays: 36,
    rayOpacity: 0.12,
    topGlow:    'radial-gradient(ellipse 100% 70% at 50% 10%, rgba(248,210,103,0.55), transparent 70%)',
    bottomShadow: 'radial-gradient(ellipse 120% 60% at 50% 120%, rgba(26,14,3,0.95), transparent 60%)',
    ambient:    'radial-gradient(ellipse 120% 80% at 50% 30%, rgba(240,169,59,0.3), transparent 70%)',
  },
}

export default function CodexSky({ time = 'noon', density = 'normal', children }: Props) {
  const p = TIME_PRESETS[time]
  const sunSize = time === 'triumph' ? 280 : time === 'noon' ? 220 : 190

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: p.bg }}>

      {/* Halo ambiant */}
      {p.ambient && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: p.ambient }} />
      )}

      {/* Top glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: p.topGlow }} />

      {/* Disque solaire */}
      <div className="absolute pointer-events-none" style={{
        left: p.sunPos.x, top: p.sunPos.y,
        width: sunSize, height: sunSize,
        marginLeft: -sunSize/2, marginTop: -sunSize/2,
        animation: 'codexRiseSun 1.8s cubic-bezier(.16,.84,.44,1) both',
      }}>
        {/* Halo extérieur */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `radial-gradient(circle, ${p.haloColor} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          transform: 'scale(2.4)',
          animation: 'codexHaloPulse 6s ease-in-out infinite',
        }} />
        {/* Disque */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `radial-gradient(circle at 30% 30%, ${p.sunColor}, ${p.haloColor})`,
          boxShadow: `0 0 80px ${p.haloColor}, inset -20px -20px 60px rgba(140,80,10,0.3)`,
        }} />
      </div>

      {/* Rayons SVG divergents */}
      <svg className="absolute pointer-events-none" style={{
        left: p.sunPos.x, top: p.sunPos.y,
        width: sunSize * 8, height: sunSize * 8,
        marginLeft: -(sunSize * 4), marginTop: -(sunSize * 4),
        opacity: p.rayOpacity,
      }} viewBox="0 0 1000 1000">
        {Array.from({ length: p.rays }).map((_, i) => {
          const angle = (i * (360 / p.rays) * Math.PI) / 180
          return (
            <line key={i} x1="500" y1="500"
              x2={500 + Math.cos(angle) * 520}
              y2={500 + Math.sin(angle) * 520}
              stroke={p.sunColor} strokeWidth="3" strokeLinecap="round"
              style={{ animation: `codexShimmer ${4 + (i % 5)}s ease-in-out infinite`,
                       animationDelay: `${i * 0.2}s` }} />
          )
        })}
      </svg>

      {/* Bottom shadow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: p.bottomShadow }} />

      {/* Grain texture */}
      <div className="codex-grain" />

      {/* Contenu */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
