export default function SunBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>

      {/* Couche 1 : grand halo doré en haut */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 45% at 50% -8%, rgba(251,191,36,0.22), transparent 70%)',
      }} />

      {/* Couche 2 : halo ambré secondaire */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 50% 30% at 50% -2%, rgba(245,158,11,0.14), transparent 60%)',
      }} />

      {/* Couche 3 : lueur bleutée en bas pour contraste */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 40% at 50% 110%, rgba(15,22,40,0.9), transparent 70%)',
      }} />

      {/* Couche 4 : rayons solaires SVG */}
      <svg
        viewBox="0 0 1000 700"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute', top: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: '100%', maxWidth: 1000, height: 700,
          opacity: 0.07,
        }}
      >
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 15 * Math.PI) / 180
          const x2 = 500 + Math.cos(angle) * 900
          const y2 = -30 + Math.sin(angle) * 900
          return (
            <line key={i} x1="500" y1="-30" x2={x2} y2={y2}
              stroke="#fbbf24" strokeWidth="30" strokeLinecap="round" />
          )
        })}
      </svg>

      {/* Couche 5 : grain/noise subtil */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.025 }}>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

    </div>
  )
}
