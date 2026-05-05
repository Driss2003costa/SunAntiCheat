type Props = {
  size?: number
  opacity?: number
  className?: string
  color?: string
}

export default function CompassRose({
  size = 320,
  opacity = 0.06,
  className = '',
  color = '#F0A93B',
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      style={{ opacity }}
      fill="none"
      stroke={color}
      strokeWidth="0.4"
    >
      {/* Cercles concentriques */}
      <circle cx="100" cy="100" r="95" />
      <circle cx="100" cy="100" r="80" strokeDasharray="2 2" />
      <circle cx="100" cy="100" r="55" strokeWidth="0.3" />
      <circle cx="100" cy="100" r="30" />
      <circle cx="100" cy="100" r="6" fill={color} fillOpacity="0.3" stroke="none" />

      {/* Pointes cardinales */}
      {[0, 90, 180, 270].map(angle => (
        <g key={angle} transform={`rotate(${angle} 100 100)`}>
          <path d="M 100 5 L 105 50 L 100 95 L 95 50 Z"
                fill={color} fillOpacity="0.15" />
          <line x1="100" y1="5" x2="100" y2="95" strokeWidth="0.5" />
        </g>
      ))}

      {/* Pointes intercardinales */}
      {[45, 135, 225, 315].map(angle => (
        <g key={angle} transform={`rotate(${angle} 100 100)`}>
          <path d="M 100 20 L 103 60 L 100 80 L 97 60 Z"
                fill={color} fillOpacity="0.08" />
        </g>
      ))}

      {/* Graduations fines tous les 15° */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i * 15 * Math.PI) / 180
        const x1 = 100 + Math.cos(a) * 92
        const y1 = 100 + Math.sin(a) * 92
        const x2 = 100 + Math.cos(a) * 95
        const y2 = 100 + Math.sin(a) * 95
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="0.3" />
        )
      })}

      {/* Lettres N S E O */}
      <text x="100" y="14" textAnchor="middle"
            fontSize="8" fontFamily="Cinzel, serif" fontWeight="600"
            fill={color} stroke="none" opacity="0.6">N</text>
      <text x="100" y="192" textAnchor="middle"
            fontSize="8" fontFamily="Cinzel, serif" fontWeight="600"
            fill={color} stroke="none" opacity="0.6">S</text>
      <text x="190" y="103" textAnchor="middle"
            fontSize="8" fontFamily="Cinzel, serif" fontWeight="600"
            fill={color} stroke="none" opacity="0.6">E</text>
      <text x="10" y="103" textAnchor="middle"
            fontSize="8" fontFamily="Cinzel, serif" fontWeight="600"
            fill={color} stroke="none" opacity="0.6">O</text>
    </svg>
  )
}
