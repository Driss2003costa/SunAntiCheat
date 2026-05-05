import { ReactNode, useMemo } from 'react'

export type SkyVariant = 'dawn' | 'noon' | 'dusk'

export type SkyTwist = {
  sunOffset?:    { right?: string; bottom?: string }
  cloudLayer?:   boolean
  fogIntensity?: 'none' | 'light' | 'heavy'
  starDensity?:  'normal' | 'sparse' | 'dense'
  mountainMood?: 'default' | 'snowy' | 'volcanic'
}

const PALETTES: Record<SkyVariant, {
  bg:  string
  glow: string
  far:  string
  mid:  string
  near: string
  haze: string
  sun:  { top: string; mid: string; bottom: string }
  showStars: boolean
}> = {
  dawn: {
    bg:   'linear-gradient(180deg, #07091A 0%, #131A3E 25%, #3D2547 55%, #B05A45 82%, #E69559 100%)',
    glow: 'radial-gradient(ellipse 60% 40% at 75% 78%, rgba(255,179,71,0.42) 0%, rgba(255,140,80,0.18) 35%, transparent 70%)',
    far:  '#7A4D5A',
    mid:  '#3A2540',
    near: '#0B0E22',
    haze: 'linear-gradient(180deg, transparent 0%, rgba(255,179,71,0.08) 60%, rgba(255,179,71,0.18) 100%)',
    sun:  { top: '#FFF1C2', mid: '#FFB347', bottom: '#E07F1A' },
    showStars: true,
  },
  noon: {
    bg:   'linear-gradient(180deg, #0E1F45 0%, #1F4280 35%, #4A86C8 65%, #93BCE3 90%, #F4D8A8 100%)',
    glow: 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(255,236,180,0.35) 0%, transparent 65%)',
    far:  '#5878AC',
    mid:  '#2D416A',
    near: '#0E1A38',
    haze: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.08) 70%, rgba(255,232,180,0.12) 100%)',
    sun:  { top: '#FFFCEE', mid: '#FFE08A', bottom: '#F0B454' },
    showStars: false,
  },
  dusk: {
    bg:   'linear-gradient(180deg, #060819 0%, #1F1845 22%, #5B2A56 50%, #B53F40 78%, #E07F2A 100%)',
    glow: 'radial-gradient(ellipse 65% 45% at 80% 80%, rgba(224,113,42,0.45) 0%, rgba(180,60,80,0.18) 40%, transparent 75%)',
    far:  '#7E3D44',
    mid:  '#3F1F35',
    near: '#080610',
    haze: 'linear-gradient(180deg, transparent 0%, rgba(224,113,42,0.1) 65%, rgba(224,113,42,0.22) 100%)',
    sun:  { top: '#FFE3B0', mid: '#F08A36', bottom: '#B83E32' },
    showStars: true,
  },
}

const SUN_POS: Record<SkyVariant, { right: string; bottom: string; size: string }> = {
  dawn: { right: '12%', bottom: '24%', size: '380px' },
  noon: { right: '50%', bottom: '70%', size: '300px' },
  dusk: { right: '8%',  bottom: '20%', size: '420px' },
}

// Mountain color overrides for moods
const MOOD_FAR:  Record<string, string> = {
  snowy:    '#7BA3C8',
  volcanic: '#6B2020',
}
const MOOD_MID:  Record<string, string> = {
  snowy:    '#3A5A80',
  volcanic: '#3D1010',
}

export default function SunSky({
  variant = 'dawn',
  twist,
  children,
  className = '',
}: { variant?: SkyVariant; twist?: SkyTwist; children?: ReactNode; className?: string }) {
  const p   = PALETTES[variant]
  const pos = SUN_POS[variant]

  const mood = twist?.mountainMood ?? 'default'
  const far  = mood !== 'default' ? (MOOD_FAR[mood]  ?? p.far)  : p.far
  const mid  = mood !== 'default' ? (MOOD_MID[mood]  ?? p.mid)  : p.mid
  const near = p.near

  const sunRight  = twist?.sunOffset?.right  ?? pos.right
  const sunBottom = twist?.sunOffset?.bottom ?? pos.bottom

  const fogOpacity = twist?.fogIntensity === 'heavy' ? 0.14
    : twist?.fogIntensity === 'light' ? 0.07
    : 0

  return (
    <div className={`relative min-h-screen overflow-hidden ${className}`} style={{ background: p.bg }}>

      {/* Star field */}
      {p.showStars && (
        <div className="absolute inset-x-0 top-0 h-[55%] pointer-events-none">
          <Stars density={twist?.starDensity ?? 'normal'} />
        </div>
      )}

      {/* Atmospheric warm glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: p.glow }} />

      {/* Sun orb */}
      <SunOrb colors={p.sun} size={pos.size} right={sunRight} bottom={sunBottom} />

      {/* Cloud layer */}
      {twist?.cloudLayer && <Clouds variant={variant} />}

      {/* Horizon haze */}
      <div className="absolute inset-x-0 bottom-0 h-[38%] pointer-events-none" style={{ background: p.haze }} />

      {/* Mountain layers */}
      <div className="absolute inset-x-0 bottom-[14%] pointer-events-none opacity-[0.85]">
        <MountainsFar fill={far} snowy={mood === 'snowy'} />
      </div>
      <div className="absolute inset-x-0 bottom-[6%] pointer-events-none">
        <MountainsMid fill={mid} snowy={mood === 'snowy'} />
      </div>
      <div className="absolute inset-x-0 bottom-0 pointer-events-none">
        <MountainsNear fill={near} />
      </div>

      {/* Volcanic particles */}
      {mood === 'volcanic' && <VolcanicParticles />}

      {/* Ground fog */}
      {fogOpacity > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-[28%] pointer-events-none"
          style={{ background: `linear-gradient(180deg, transparent 0%, rgba(200,220,255,${fogOpacity}) 100%)` }} />
      )}

      {/* Floating voxel island */}
      {variant !== 'noon' && (
        <div className="absolute inset-x-0 bottom-[2%] flex justify-center pointer-events-none opacity-[0.18]">
          <FloatingIsland fill={near} />
        </div>
      )}

      {/* Film grain */}
      <div className="absolute inset-0 pointer-events-none grain opacity-[0.35]" />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.45) 100%)' }} />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

// ── Stars ────────────────────────────────────────────────────────────────────────

const STAR_SEED = [
  [4.2, 3.1, 0.8], [11.6, 7.3, 0.4], [18.7, 2.4, 0.9], [25.9, 9.1, 0.3], [33.3, 4.6, 0.7],
  [41.2, 1.8, 0.5], [48.7, 6.9, 0.9], [55.1, 3.2, 0.4], [63.8, 8.7, 0.6], [71.6, 2.7, 0.8],
  [78.9, 7.5, 0.5], [85.3, 4.1, 0.9], [93.4, 2.8, 0.6], [7.8, 14.6, 0.4], [15.2, 18.4, 0.7],
  [22.6, 12.3, 0.9], [29.9, 16.8, 0.3], [37.4, 13.5, 0.6], [45.1, 19.2, 0.4], [52.7, 11.8, 0.8],
  [59.4, 17.6, 0.7], [66.8, 14.2, 0.5], [73.5, 19.7, 0.9], [81.1, 13.9, 0.4], [88.6, 18.5, 0.7],
  [96.2, 15.3, 0.6], [3.1, 24.7, 0.5], [9.7, 28.9, 0.9], [16.4, 22.1, 0.4], [23.8, 27.6, 0.8],
  [30.5, 21.8, 0.6], [38.2, 26.3, 0.3], [44.6, 23.7, 0.9], [51.8, 28.5, 0.5], [58.3, 22.4, 0.7],
  [65.7, 27.1, 0.4], [72.1, 24.6, 0.8], [79.4, 28.9, 0.6], [86.2, 23.8, 0.9], [92.7, 27.2, 0.5],
  [5.8, 35.4, 0.3], [12.9, 39.1, 0.7], [19.7, 33.8, 0.5], [27.3, 38.6, 0.8], [34.1, 34.2, 0.4],
  [42.6, 39.9, 0.6], [49.2, 33.5, 0.9], [56.8, 38.1, 0.3], [63.1, 35.7, 0.7], [70.5, 39.4, 0.5],
  [77.3, 33.9, 0.8], [84.7, 38.2, 0.4], [91.3, 35.6, 0.7], [98.5, 39.8, 0.5], [2.4, 45.2, 0.6],
  [10.1, 49.3, 0.4], [17.6, 43.8, 0.7], [24.5, 48.5, 0.9], [31.8, 43.1, 0.5], [39.4, 49.7, 0.3],
  [46.7, 44.6, 0.8], [54.2, 49.2, 0.6], [60.9, 43.4, 0.7], [68.3, 48.9, 0.4], [75.6, 44.5, 0.9],
  [82.9, 49.6, 0.5], [89.4, 43.7, 0.7], [95.8, 48.3, 0.4],
]

const EXTRA_STARS = [
  [6.5, 8.2, 0.6], [14.3, 5.1, 0.8], [21.1, 11.7, 0.5], [28.4, 6.8, 0.9], [35.7, 3.5, 0.4],
  [43.9, 9.4, 0.7], [50.6, 2.1, 0.6], [57.2, 7.8, 0.9], [64.5, 4.3, 0.5], [71.8, 10.6, 0.8],
  [79.1, 1.9, 0.4], [86.4, 6.2, 0.7], [93.7, 3.8, 0.9], [1.8, 19.5, 0.6], [8.6, 22.8, 0.4],
  [18.3, 16.9, 0.8], [26.1, 20.4, 0.5], [33.5, 25.1, 0.7], [41.2, 17.6, 0.9], [48.9, 23.3, 0.3],
]

function Stars({ density }: { density: 'normal' | 'sparse' | 'dense' }) {
  const stars = useMemo(() => {
    let seed = density === 'sparse'
      ? STAR_SEED.filter((_, i) => i % 3 === 0)
      : density === 'dense'
      ? [...STAR_SEED, ...EXTRA_STARS]
      : STAR_SEED

    return seed.map(([x, y, brightness], i) => ({
      x, y, brightness,
      size: brightness > 0.7 ? 1.5 : 1,
      opacity: brightness * (1 - y / 100) * 1.3,
      delay: (i % 8) * 0.5,
    }))
  }, [density])

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.size * 0.05}
          fill="white"
          style={{ animation: `twinkle 4s ease-in-out infinite`, animationDelay: `${s.delay}s` }}
          opacity={Math.min(0.9, s.opacity)}
        />
      ))}
    </svg>
  )
}

// ── Sun orb ───────────────────────────────────────────────────────────────────────

function SunOrb({ colors, size, right, bottom }: {
  colors: { top: string; mid: string; bottom: string }
  size: string; right: string; bottom: string
}) {
  return (
    <div className="absolute pointer-events-none animate-shimmer"
      style={{ right, bottom, width: size, height: size }}>
      <div className="absolute -inset-[40%] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.mid}66 0%, ${colors.bottom}33 30%, transparent 65%)`,
          filter: 'blur(40px)',
        }} />
      <div className="absolute -inset-[15%] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.top}99 0%, ${colors.mid}66 40%, transparent 75%)`,
          filter: 'blur(20px)',
        }} />
      <div className="absolute inset-[28%] rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${colors.top} 0%, ${colors.mid} 60%, ${colors.bottom} 100%)`,
          boxShadow: `0 0 80px 20px ${colors.mid}55, inset 0 -8px 24px ${colors.bottom}88`,
        }} />
    </div>
  )
}

// ── Clouds ────────────────────────────────────────────────────────────────────────

const CLOUD_SHAPES = [
  'M10,30 Q20,10 40,20 Q50,5 70,18 Q90,8 100,25 Q110,15 130,22 Q140,30 130,38 Q110,45 90,40 Q80,50 60,42 Q40,50 20,42 Q5,38 10,30 Z',
  'M5,25 Q15,8 35,16 Q48,2 65,14 Q80,4 95,18 Q108,10 120,22 Q115,35 100,32 Q85,42 70,36 Q55,46 38,38 Q20,44 8,35 Q0,30 5,25 Z',
  'M0,28 Q12,12 30,20 Q44,6 62,18 Q78,8 92,22 Q102,14 115,26 Q110,38 95,34 Q80,44 64,38 Q48,48 30,40 Q12,46 2,36 Q-4,32 0,28 Z',
]

function Clouds({ variant }: { variant: SkyVariant }) {
  const color = variant === 'noon' ? 'rgba(255,255,255,0.18)' : 'rgba(255,200,160,0.12)'
  const clouds = useMemo(() => [
    { x: -5,  y: 28, scale: 1.4, opacity: 0.9, duration: 80 },
    { x: 25,  y: 18, scale: 1.0, opacity: 0.6, duration: 65 },
    { x: 55,  y: 32, scale: 1.6, opacity: 0.7, duration: 90 },
    { x: 75,  y: 22, scale: 0.9, opacity: 0.5, duration: 70 },
    { x: 100, y: 26, scale: 1.2, opacity: 0.8, duration: 75 },
  ], [])

  return (
    <div className="absolute inset-x-0 pointer-events-none" style={{ top: '15%', height: '30%' }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="xMidYMid slice">
        {clouds.map((c, i) => (
          <g key={i}
            transform={`translate(${c.x}, ${c.y}) scale(${c.scale})`}
            opacity={c.opacity}
            style={{ animation: `drift ${c.duration}s linear infinite`, animationDelay: `${-i * 12}s` }}
          >
            <path d={CLOUD_SHAPES[i % CLOUD_SHAPES.length]} fill={color} />
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Volcanic particles ────────────────────────────────────────────────────────────

function VolcanicParticles() {
  const particles = [
    { x: '18%', delay: '0s',   duration: '6s' },
    { x: '22%', delay: '1.5s', duration: '8s' },
    { x: '15%', delay: '3s',   duration: '7s' },
    { x: '25%', delay: '4.5s', duration: '5s' },
  ]
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: p.x,
            bottom: '22%',
            background: 'rgba(239,68,68,0.6)',
            animation: `riseUp ${p.duration} ease-out infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  )
}

// ── Mountains ─────────────────────────────────────────────────────────────────────

function MountainsFar({ fill, snowy }: { fill: string; snowy?: boolean }) {
  return (
    <svg viewBox="0 0 1920 220" className="w-full h-[16vh] min-h-[120px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mtnFarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={fill} stopOpacity="0.65" />
          <stop offset="100%" stopColor={fill} stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <path
        fill="url(#mtnFarGrad)"
        d="M0,220 L0,140 L90,120 L150,140 L240,80 L320,100 L420,60 L500,90 L590,40 L680,70 L760,55 L860,90 L950,50 L1040,80 L1130,40 L1220,70 L1310,55 L1400,90 L1500,60 L1600,80 L1690,45 L1790,75 L1870,55 L1920,80 L1920,220 Z"
      />
      {snowy && (
        <>
          <rect x="415"  y="58"  width="12" height="4" fill="white" opacity="0.3" />
          <rect x="585"  y="38"  width="14" height="4" fill="white" opacity="0.35" />
          <rect x="945"  y="48"  width="16" height="4" fill="white" opacity="0.3" />
          <rect x="1125" y="38"  width="12" height="4" fill="white" opacity="0.35" />
          <rect x="1685" y="43"  width="14" height="4" fill="white" opacity="0.3" />
        </>
      )}
    </svg>
  )
}

function MountainsMid({ fill, snowy }: { fill: string; snowy?: boolean }) {
  return (
    <svg viewBox="0 0 1920 280" className="w-full h-[20vh] min-h-[160px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mtnMidGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={fill} stopOpacity="0.85" />
          <stop offset="100%" stopColor={fill} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path
        fill="url(#mtnMidGrad)"
        d="M0,280 L0,180 L60,160 L60,140 L130,140 L130,120 L200,120 L260,160 L320,90 L380,90 L380,70 L450,70 L450,90 L520,90 L580,150 L660,80 L740,80 L740,60 L820,60 L820,80 L900,80 L960,140 L1040,70 L1120,70 L1120,50 L1200,50 L1200,70 L1280,70 L1340,130 L1420,70 L1500,70 L1560,120 L1640,90 L1720,140 L1800,100 L1880,140 L1920,120 L1920,280 Z"
      />
      {snowy && (
        <>
          <rect x="375"  y="68"  width="18" height="5" fill="white" opacity="0.35" />
          <rect x="736"  y="58"  width="22" height="5" fill="white" opacity="0.4" />
          <rect x="1116" y="48"  width="20" height="5" fill="white" opacity="0.35" />
          <rect x="1416" y="68"  width="16" height="5" fill="white" opacity="0.3" />
        </>
      )}
    </svg>
  )
}

function MountainsNear({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 1920 320" className="w-full h-[22vh] min-h-[180px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mtnNearGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={fill} stopOpacity="0.95" />
          <stop offset="100%" stopColor={fill} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path
        fill="url(#mtnNearGrad)"
        d="M0,320 L0,240 L40,220 L40,200 L100,200 L100,180 L170,180 L170,200 L240,200 L240,160 L310,160 L310,140 L380,140 L380,170 L450,170 L450,210 L520,210 L520,180 L590,180 L590,150 L660,150 L660,130 L740,130 L740,170 L810,170 L810,200 L880,200 L880,170 L950,170 L950,140 L1020,140 L1020,120 L1100,120 L1100,160 L1170,160 L1170,190 L1240,190 L1240,160 L1310,160 L1310,130 L1380,130 L1380,170 L1450,170 L1450,210 L1530,210 L1530,180 L1610,180 L1610,150 L1690,150 L1690,180 L1770,180 L1770,210 L1850,210 L1850,180 L1920,180 L1920,320 Z"
      />
    </svg>
  )
}

// ── Floating voxel island ─────────────────────────────────────────────────────────

function FloatingIsland({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 240 80" className="w-[220px] h-[60px] animate-float" preserveAspectRatio="xMidYMax meet">
      <g fill={fill}>
        <rect x="20"  y="20" width="200" height="20" />
        <rect x="40"  y="40" width="160" height="14" />
        <rect x="60"  y="54" width="120" height="10" />
        <rect x="80"  y="64" width="80"  height="8"  />
        <rect x="100" y="72" width="14"  height="8" opacity="0.7" />
        <rect x="130" y="72" width="10"  height="6" opacity="0.5" />
      </g>
      <rect x="20" y="16" width="200" height="4" fill={fill} opacity="0.6" />
    </svg>
  )
}
