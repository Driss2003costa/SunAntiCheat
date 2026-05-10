export type AuraTheme = 'home' | 'profile' | 'career' | 'shop' | 'friends' | 'messages' | 'quests'

// Per-theme visual identity
const THEMES: Record<AuraTheme, {
  bg: string
  primary: string   // main accent color (rgba)
  secondary: string // secondary accent (rgba)
  rays: boolean
  orbs: [string, string, string, string][] // [x%, y%, size, color]
  particles?: boolean
  grid?: boolean
  aurora?: boolean
}> = {
  home: {
    bg: '#050810',
    primary:   'rgba(56,189,248,0.10)',
    secondary: 'rgba(99,102,241,0.08)',
    rays: false,
    aurora: true,
    orbs: [
      ['15%', '5%',   '50% 35%', 'rgba(56,189,248,0.09)'],
      ['85%', '15%',  '40% 28%', 'rgba(99,102,241,0.08)'],
      ['50%', '80%',  '60% 30%', 'rgba(30,58,138,0.12)'],
    ],
  },
  profile: {
    bg: '#07091c',
    primary:   'rgba(139,92,246,0.18)',
    secondary: 'rgba(99,102,241,0.10)',
    rays: false,
    aurora: true,
    orbs: [
      ['20%', '10%',  '40% 30%', 'rgba(139,92,246,0.12)'],
      ['80%', '60%',  '35% 25%', 'rgba(99,102,241,0.10)'],
      ['50%', '-5%',  '60% 35%', 'rgba(139,92,246,0.14)'],
    ],
  },
  career: {
    bg: '#050d18',
    primary:   'rgba(6,182,212,0.16)',
    secondary: 'rgba(14,165,233,0.10)',
    rays: false,
    particles: true,
    orbs: [
      ['100%', '0%',   '55% 40%', 'rgba(6,182,212,0.12)'],
      ['0%',   '80%',  '40% 30%', 'rgba(14,165,233,0.08)'],
      ['50%',  '-5%',  '60% 30%', 'rgba(6,182,212,0.10)'],
    ],
  },
  shop: {
    bg: '#080c14',
    primary:   'rgba(251,191,36,0.18)',
    secondary: 'rgba(16,185,129,0.10)',
    rays: false,
    orbs: [
      ['100%', '-5%',  '50% 35%', 'rgba(251,191,36,0.16)'],
      ['0%',   '50%',  '40% 30%', 'rgba(16,185,129,0.10)'],
      ['50%',  '100%', '60% 30%', 'rgba(251,191,36,0.08)'],
    ],
  },
  friends: {
    bg: '#090810',
    primary:   'rgba(244,63,94,0.14)',
    secondary: 'rgba(167,139,250,0.10)',
    rays: false,
    aurora: true,
    orbs: [
      ['25%',  '-5%',  '50% 35%', 'rgba(244,63,94,0.12)'],
      ['75%',  '30%',  '40% 30%', 'rgba(167,139,250,0.10)'],
      ['50%',  '90%',  '55% 30%', 'rgba(244,63,94,0.08)'],
    ],
  },
  messages: {
    bg: '#060910',
    primary:   'rgba(99,102,241,0.15)',
    secondary: 'rgba(139,92,246,0.08)',
    rays: false,
    particles: true,
    orbs: [
      ['0%',  '0%',   '45% 35%', 'rgba(99,102,241,0.12)'],
      ['100%','70%',  '40% 30%', 'rgba(139,92,246,0.10)'],
    ],
  },
  quests: {
    bg: '#080610',
    primary:   'rgba(167,139,250,0.14)',
    secondary: 'rgba(251,146,60,0.10)',
    rays: false,
    particles: true,
    orbs: [
      ['50%',  '-5%',  '55% 35%', 'rgba(139,92,246,0.13)'],
      ['0%',   '60%',  '40% 28%', 'rgba(167,139,250,0.08)'],
      ['100%', '30%',  '38% 25%', 'rgba(251,146,60,0.09)'],
    ],
  },
}

// Deterministic floating particle positions per theme
const PARTICLE_POSITIONS: Record<string, [number, number, number, number][]> = {
  career: [
    [12, 75, 2, 6], [28, 45, 1.5, 8], [45, 82, 2.5, 5], [62, 55, 1.5, 7],
    [78, 30, 2, 9],  [88, 68, 1.5, 6], [5,  35, 2, 8],  [55, 20, 1.5, 5],
  ],
  messages: [
    [15, 60, 1.5, 5], [35, 80, 2, 7], [55, 40, 1.5, 9], [72, 65, 2, 6],
    [90, 25, 1.5, 8], [8,  50, 2, 5], [42, 15, 1.5, 7], [68, 88, 2, 6],
  ],
  quests: [
    [20, 80, 2,   6], [38, 65, 1.5, 9], [55, 85, 2.5, 5], [70, 70, 1.5, 8],
    [85, 55, 2,   7], [10, 50, 1.5, 6], [45, 40, 2,   9], [75, 88, 1.5, 5],
  ],
}

// Aurora SVG blobs (profile + friends)
function Aurora({ colors }: { colors: [string, string] }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ filter: 'blur(28px)', opacity: 0.6 }}
    >
      <defs>
        <radialGradient id="a1" cx="30%" cy="25%" r="40%">
          <stop offset="0%" stopColor={colors[0]} stopOpacity="0.6" />
          <stop offset="100%" stopColor={colors[0]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="a2" cx="70%" cy="65%" r="45%">
          <stop offset="0%" stopColor={colors[1]} stopOpacity="0.5" />
          <stop offset="100%" stopColor={colors[1]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="a3" cx="55%" cy="10%" r="35%">
          <stop offset="0%" stopColor={colors[0]} stopOpacity="0.4" />
          <stop offset="100%" stopColor={colors[0]} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="25" rx="42" ry="30" fill="url(#a1)"
        style={{ animation: 'auroraA 18s ease-in-out infinite', transformOrigin: '30% 25%' }} />
      <ellipse cx="70" cy="65" rx="45" ry="32" fill="url(#a2)"
        style={{ animation: 'auroraB 22s ease-in-out infinite', transformOrigin: '70% 65%' }} />
      <ellipse cx="55" cy="10" rx="38" ry="22" fill="url(#a3)"
        style={{ animation: 'auroraC 15s ease-in-out infinite', transformOrigin: '55% 10%' }} />
    </svg>
  )
}

export default function PageAura({ theme }: { theme: AuraTheme }) {
  const t = THEMES[theme]

  return (
    <>
      {/* CSS for aurora + particle keyframes — injected once */}
      <style>{`
        @keyframes auroraA { 0%,100%{transform:scale(1) translate(0,0)} 33%{transform:scale(1.08) translate(3%,2%)} 66%{transform:scale(0.95) translate(-2%,3%)} }
        @keyframes auroraB { 0%,100%{transform:scale(1) translate(0,0)} 40%{transform:scale(1.06) translate(-4%,-2%)} 75%{transform:scale(1.02) translate(2%,2%)} }
        @keyframes auroraC { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.1) translate(2%,4%)} }
        @keyframes floatUp { 0%{transform:translateY(0);opacity:0} 10%{opacity:0.7} 90%{opacity:0.3} 100%{transform:translateY(-60px);opacity:0} }
      `}</style>

      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden
           style={{ background: t.bg }}>

        {/* Aurora blobs */}
        {t.aurora && theme === 'home'     && <Aurora colors={['#0ea5e9', '#6366f1']} />}
        {t.aurora && theme === 'profile'  && <Aurora colors={['#7c3aed', '#4f46e5']} />}
        {t.aurora && theme === 'friends'  && <Aurora colors={['#e11d48', '#7c3aed']} />}

        {/* Radial glow orbs */}
        {t.orbs.map(([x, y, size, color], i) => (
          <div key={i} style={{
            position: 'absolute',
            background: `radial-gradient(ellipse ${size} at ${x} ${y}, ${color}, transparent 70%)`,
            inset: 0,
          }} />
        ))}

        {/* Sun rays (home + quests) */}
        {t.rays && (
          <svg
            viewBox="0 0 1000 700"
            preserveAspectRatio="xMidYMid slice"
            style={{
              position: 'absolute', top: 0, left: '50%',
              transform: 'translateX(-50%)',
              width: '100%', maxWidth: 1000, height: 700,
              opacity: 0.06,
            }}
          >
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i * 15 * Math.PI) / 180
              return (
                <line key={i} x1="500" y1="-30"
                  x2={500 + Math.cos(angle) * 900}
                  y2={-30 + Math.sin(angle) * 900}
                  stroke="#fbbf24" strokeWidth="30" strokeLinecap="round" />
              )
            })}
          </svg>
        )}

        {/* Floating particles */}
        {t.particles && (PARTICLE_POSITIONS[theme] ?? []).map(([x, y, r, dur], i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${x}%`, top: `${y}%`,
            width: r * 2, height: r * 2,
            borderRadius: '50%',
            background: theme === 'quests'
              ? `rgba(251,146,60,${0.4 + (i % 3) * 0.1})`
              : t.primary.replace(/[\d.]+\)$/, '0.5)'),
            animation: `floatUp ${dur}s ease-in-out infinite`,
            animationDelay: `${i * 1.1}s`,
          }} />
        ))}

        {/* Career: diagonal energy grid lines */}
        {theme === 'career' && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}>
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#06b6d4" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        )}

        {/* Shop: corner gem accents */}
        {theme === 'shop' && (
          <>
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 200, height: 200,
              background: 'conic-gradient(from 45deg, rgba(251,191,36,0.12), rgba(16,185,129,0.06), transparent 60%)',
              borderRadius: '0 0 0 100%',
            }} />
            <div style={{
              position: 'absolute', bottom: -40, left: -40,
              width: 160, height: 160,
              background: 'conic-gradient(from 225deg, rgba(16,185,129,0.10), rgba(251,191,36,0.05), transparent 60%)',
              borderRadius: '0 100% 0 0',
            }} />
          </>
        )}

        {/* Noise grain */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.025 }}>
          <filter id="pg-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
          </filter>
          <rect width="100%" height="100%" filter="url(#pg-noise)" />
        </svg>

        {/* Bottom vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 90% 50% at 50% 110%, ${t.bg}cc, transparent 60%)`,
        }} />
      </div>
    </>
  )
}
