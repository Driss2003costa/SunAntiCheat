type Props = {
  variant?: 'simple' | 'double' | 'royal'
  width?: number
  className?: string
  color?: string
}

export default function Flourish({
  variant = 'simple',
  width = 200,
  className = '',
  color = 'rgba(240,169,59,0.5)',
}: Props) {
  return (
    <div className={`flex items-center justify-center pointer-events-none ${className}`}>
      <svg width={width} height={24} viewBox="0 0 200 24"
           fill="none" stroke={color} strokeWidth="1" strokeLinecap="round">
        {variant === 'simple' && (
          <>
            <line x1="0"  y1="12" x2="80" y2="12" />
            <line x1="120" y1="12" x2="200" y2="12" />
            <circle cx="100" cy="12" r="2.5" fill={color} stroke="none" />
            <line x1="92" y1="12" x2="108" y2="12" strokeWidth="0.5" />
          </>
        )}
        {variant === 'double' && (
          <>
            <line x1="0"  y1="10" x2="70" y2="10" />
            <line x1="0"  y1="14" x2="70" y2="14" strokeWidth="0.5" />
            <line x1="130" y1="10" x2="200" y2="10" />
            <line x1="130" y1="14" x2="200" y2="14" strokeWidth="0.5" />
            <path d="M 75 12 Q 88 4, 100 12 Q 112 20, 125 12" fill="none" />
            <circle cx="100" cy="12" r="1.8" fill={color} stroke="none" />
          </>
        )}
        {variant === 'royal' && (
          <>
            <line x1="0"  y1="12" x2="60" y2="12" strokeWidth="0.6" />
            <line x1="140" y1="12" x2="200" y2="12" strokeWidth="0.6" />
            <path d="M 60 12 L 75 6  L 90 12 L 100 4 L 110 12 L 125 6 L 140 12"
                  fill="none" strokeLinejoin="round" />
            <path d="M 60 12 L 75 18 L 90 12 L 100 20 L 110 12 L 125 18 L 140 12"
                  fill="none" strokeLinejoin="round" strokeWidth="0.5" />
            <circle cx="100" cy="12" r="3" fill={color} stroke="none" />
            <circle cx="100" cy="12" r="5" fill="none" strokeWidth="0.5" />
          </>
        )}
      </svg>
    </div>
  )
}
