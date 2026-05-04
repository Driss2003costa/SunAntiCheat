export default function SunBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
      {/* Radial golden glow at top */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 40% at 50% -5%, rgba(251,191,36,0.12), transparent)',
      }} />
      {/* SVG sun rays */}
      <svg
        viewBox="0 0 800 600"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 800, height: 600, opacity: 0.03 }}
      >
        {Array.from({ length: 18 }).map((_, i) => {
          const angle = (i * 20 * Math.PI) / 180
          const x2 = 400 + Math.cos(angle) * 700
          const y2 = 0 + Math.sin(angle) * 700
          return (
            <line key={i} x1="400" y1="-50" x2={x2} y2={y2}
              stroke="#fbbf24" strokeWidth="40" strokeLinecap="round" />
          )
        })}
      </svg>
    </div>
  )
}
