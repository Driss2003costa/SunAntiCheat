import { useState } from 'react'

function isMaterial(s: string): boolean {
  return /^[A-Z][A-Z0-9_]{1,}$/.test(s)
}

const CDNS = [
  (name: string) => `https://mc-heads.net/item/${name}`,
  (name: string) => `https://mc.nerothe.com/img/1.21.1/${name.toLowerCase()}.png`,
]

export default function MinecraftIcon({
  icon,
  size = 32,
  className = '',
  fallback = '💼',
}: {
  icon?: string | null
  size?: number
  className?: string
  fallback?: string
}) {
  const [cdnIdx, setCdnIdx] = useState(0)

  if (!icon || !isMaterial(icon) || cdnIdx >= CDNS.length) {
    if (icon && !isMaterial(icon)) {
      return <span className={className} style={{ fontSize: size * 0.75, lineHeight: 1 }}>{icon}</span>
    }
    return <span className={className} style={{ fontSize: size * 0.75 }}>{fallback}</span>
  }

  return (
    <img
      src={CDNS[cdnIdx](icon)}
      alt={icon}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: 'pixelated', width: size, height: size, objectFit: 'contain' }}
      onError={() => setCdnIdx(i => i + 1)}
    />
  )
}
