import { ReactNode, CSSProperties } from 'react'

interface Props {
  children: ReactNode
  className?: string
  variant?: 'glass' | 'glass-warm' | 'solid'
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
  style?: CSSProperties
  as?: 'div' | 'article' | 'section'
}

const PAD: Record<string, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-5 lg:p-6',
  lg:   'p-6 lg:p-8',
}

export default function Card({
  children, className = '', variant = 'glass', hover = false,
  padding = 'md', onClick, style, as: Tag = 'div',
}: Props) {
  const isGlass = variant === 'glass'
  const isWarm  = variant === 'glass-warm'
  const baseStyle: CSSProperties = isGlass
    ? {
        background: 'linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
      }
    : isWarm
    ? {
        background: 'linear-gradient(160deg, rgba(255,232,200,0.06) 0%, rgba(20,25,50,0.25) 100%)',
        border: '1px solid rgba(255,179,71,0.18)',
        backdropFilter: 'blur(16px)',
      }
    : {
        background: '#0e1730',
        border: '1px solid rgba(255,255,255,0.06)',
      }

  return (
    <Tag
      onClick={onClick}
      className={`rounded-2xl ${PAD[padding]} ${hover ? 'transition-all hover:-translate-y-0.5 hover:border-white/15 cursor-pointer' : ''} ${className}`}
      style={{ ...baseStyle, ...style }}>
      {children}
    </Tag>
  )
}
