import { Link } from 'react-router-dom'

export default function SunWordmark({ size = 'md', tagline, href = '/' }: {
  size?: 'sm' | 'md' | 'lg'
  tagline?: string
  href?: string
}) {
  const cls = {
    sm: { mark: 'text-2xl', sub: 'text-[11px]', dot: 'w-6 h-6' },
    md: { mark: 'text-3xl', sub: 'text-xs',     dot: 'w-8 h-8' },
    lg: { mark: 'text-5xl', sub: 'text-sm',     dot: 'w-10 h-10' },
  }[size]

  return (
    <Link to={href} className="inline-flex flex-col items-center gap-1.5 group">
      <div className="flex items-center gap-3">
        {/* Sun mark */}
        <div className={`relative ${cls.dot} shrink-0`}>
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sun-200 via-sun-300 to-sun-500 shadow-[0_0_24px_rgba(255,179,71,0.45)]" />
          <div className="absolute inset-[18%] rounded-full bg-gradient-to-br from-sun-50 to-sun-200 opacity-90" />
        </div>
        {/* Wordmark */}
        <span className={`font-display font-medium ${cls.mark} text-white tracking-tight leading-none`}>
          <span className="text-sun-200">Sun</span><span className="text-white">Network</span>
        </span>
      </div>
      {tagline && (
        <span className={`font-display italic ${cls.sub} text-sand-300/80 tracking-wide`}>
          {tagline}
        </span>
      )}
    </Link>
  )
}
