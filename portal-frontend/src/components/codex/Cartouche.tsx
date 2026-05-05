import { ReactNode, CSSProperties } from 'react'

type Props = {
  tone?: 'night' | 'ivory' | 'ember'
  rotate?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export default function Cartouche({
  tone = 'night',
  rotate = 0,
  className = '',
  style,
  children,
}: Props) {
  const cls = tone === 'ivory'
    ? 'codex-cartouche codex-cartouche-ivory'
    : 'codex-cartouche'

  return (
    <div
      className={`relative rounded-sm ${cls} ${className}`}
      style={{
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        ...style,
      }}
    >
      {/* Filets latéraux décoratifs */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-12 pointer-events-none"
           style={{ background: 'linear-gradient(180deg, transparent, rgba(240,169,59,0.4), transparent)' }} />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-12 pointer-events-none"
           style={{ background: 'linear-gradient(180deg, transparent, rgba(240,169,59,0.4), transparent)' }} />

      {children}
    </div>
  )
}
