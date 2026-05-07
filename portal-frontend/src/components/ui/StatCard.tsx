import { ReactNode } from 'react'

interface Props {
  label: string
  value: string | number | ReactNode
  hint?: string
  icon?: ReactNode
  accent?: 'gold' | 'jade' | 'violet' | 'rose' | 'sky'
  trend?: { value: string; positive?: boolean }
  size?: 'sm' | 'md' | 'lg'
}

const ACCENTS: Record<string, { glow: string; border: string; text: string }> = {
  gold:   { glow: 'rgba(251,191,36,0.20)', border: 'rgba(251,191,36,0.25)', text: '#fbbf24' },
  jade:   { glow: 'rgba(52,211,153,0.18)', border: 'rgba(52,211,153,0.25)', text: '#34d399' },
  violet: { glow: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.25)', text: '#a78bfa' },
  rose:   { glow: 'rgba(244,114,182,0.18)', border: 'rgba(244,114,182,0.25)', text: '#f472b6' },
  sky:    { glow: 'rgba(56,189,248,0.18)', border: 'rgba(56,189,248,0.25)', text: '#38bdf8' },
}

export default function StatCard({ label, value, hint, icon, accent = 'gold', trend, size = 'md' }: Props) {
  const a = ACCENTS[accent]
  const valueClass = size === 'lg' ? 'text-4xl lg:text-5xl' : size === 'sm' ? 'text-2xl' : 'text-3xl lg:text-4xl'
  return (
    <div className="group relative overflow-hidden rounded-2xl p-5 lg:p-6 transition-all hover:-translate-y-0.5"
         style={{
           background: 'linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)',
           border: '1px solid rgba(255,255,255,0.08)',
           backdropFilter: 'blur(16px)',
         }}>
      {/* Hover glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"
           style={{ background: a.glow }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest"
             style={{ color: 'rgba(241,245,249,0.55)' }}>{label}</p>
          {icon && (
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
                  style={{ background: a.glow, border: `1px solid ${a.border}`, color: a.text }}>
              {icon}
            </span>
          )}
        </div>
        <p className={`font-display ${valueClass} font-semibold leading-none tracking-tight truncate`}
           style={{ color: '#f8fafc' }}>{value}</p>
        {(hint || trend) && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            {trend && (
              <span className="font-semibold" style={{ color: trend.positive ? '#34d399' : '#f87171' }}>
                {trend.positive ? '↑' : '↓'} {trend.value}
              </span>
            )}
            {hint && <span style={{ color: 'rgba(241,245,249,0.45)' }}>{hint}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
