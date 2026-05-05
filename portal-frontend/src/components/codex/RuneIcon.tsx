type Rune = 'sun' | 'eye' | 'star' | 'flame' | 'crown' | 'compass' | 'feather'

type Props = {
  rune: Rune
  size?: number
  color?: string
  className?: string
}

export default function RuneIcon({
  rune,
  size = 18,
  color = 'currentColor',
  className = '',
}: Props) {
  const props = {
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }

  switch (rune) {
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * 45 * Math.PI) / 180
            return (
              <line key={i}
                x1={12 + Math.cos(a) * 7}  y1={12 + Math.sin(a) * 7}
                x2={12 + Math.cos(a) * 10} y2={12 + Math.sin(a) * 10} />
            )
          })}
        </svg>
      )
    case 'eye':
      return (
        <svg {...props}>
          <path d="M 1 12 Q 12 4, 23 12 Q 12 20, 1 12 Z" />
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="0.8" fill={color} />
        </svg>
      )
    case 'star':
      return (
        <svg {...props}>
          <path d="M 12 2 L 14.5 9 L 22 9.5 L 16 14 L 18 21 L 12 17 L 6 21 L 8 14 L 2 9.5 L 9.5 9 Z" />
        </svg>
      )
    case 'flame':
      return (
        <svg {...props}>
          <path d="M 12 2 Q 8 8, 9 14 Q 4 12, 6 18 Q 8 22, 12 22 Q 16 22, 18 18 Q 20 12, 15 14 Q 16 8, 12 2 Z" />
        </svg>
      )
    case 'crown':
      return (
        <svg {...props}>
          <path d="M 3 18 L 5 8 L 9 12 L 12 5 L 15 12 L 19 8 L 21 18 Z" />
          <line x1="3" y1="20" x2="21" y2="20" />
        </svg>
      )
    case 'compass':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M 12 4 L 14 12 L 12 20 L 10 12 Z" fill={color} fillOpacity="0.3" />
          <path d="M 4 12 L 12 14 L 20 12 L 12 10 Z" fill={color} fillOpacity="0.3" />
          <circle cx="12" cy="12" r="1" fill={color} />
        </svg>
      )
    case 'feather':
      return (
        <svg {...props}>
          <path d="M 4 20 Q 4 8, 16 4 Q 22 8, 18 18 Q 12 22, 4 20 Z" />
          <line x1="4" y1="20" x2="16" y2="8" />
        </svg>
      )
  }
}
