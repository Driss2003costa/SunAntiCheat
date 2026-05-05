type Color = 'red' | 'gold' | 'silver' | 'bronze' | 'jade'

type Props = {
  color?: Color
  label: string | number
  size?: number
  rotate?: number
  className?: string
}

export default function WaxSeal({
  color = 'red',
  label,
  size = 44,
  rotate = -3,
  className = '',
}: Props) {
  const seal = {
    red:    'codex-seal',
    gold:   'codex-seal codex-seal-gold',
    silver: 'codex-seal codex-seal-silver',
    bronze: 'codex-seal codex-seal-bronze',
    jade:   'codex-seal codex-seal-jade',
  }[color]

  const fontSize = typeof label === 'string' && label.length > 2
    ? size * 0.32
    : size * 0.42

  return (
    <span
      className={`${seal} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize,
        transform: `rotate(${rotate}deg)`,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}
