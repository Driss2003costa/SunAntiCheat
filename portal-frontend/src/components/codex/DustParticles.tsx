type Props = {
  count?: number
  color?: string
}

const POSITIONS: [number, number, number, number][] = [
  // [left%, bottom%, size, durationS]
  [10, 12, 2,   14], [22, 8,  1.5, 18], [38, 18, 2.5, 12], [52, 6,  1.5, 16],
  [68, 14, 2,   20], [84, 10, 1.5, 13], [92, 22, 2,   17], [16, 28, 1.5, 19],
  [44, 36, 2,   15], [62, 30, 1.5, 22], [78, 38, 2,   14], [30, 4,  1.8, 21],
]

export default function DustParticles({
  count = 12,
  color = 'rgba(248,210,103,0.7)',
}: Props) {
  const particles = POSITIONS.slice(0, count)
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(([x, y, r, dur], i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${x}%`, bottom: `${y}%`,
          width: r * 2, height: r * 2,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 ${r * 4}px ${color}`,
          animation: `codexFloatDust ${dur}s linear infinite`,
          animationDelay: `${i * 1.2}s`,
        }} />
      ))}
    </div>
  )
}
