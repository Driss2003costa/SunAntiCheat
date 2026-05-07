import { ReactNode } from 'react'

type Tone = 'gold' | 'jade' | 'violet' | 'rose' | 'sky' | 'neutral' | 'danger'

const TONES: Record<Tone, { bg: string; border: string; text: string }> = {
  gold:    { bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.30)', text: '#fcd34d' },
  jade:    { bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.30)', text: '#6ee7b7' },
  violet:  { bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.30)', text: '#c4b5fd' },
  rose:    { bg: 'rgba(244,114,182,0.10)', border: 'rgba(244,114,182,0.30)', text: '#f9a8d4' },
  sky:     { bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.30)', text: '#7dd3fc' },
  neutral: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)', text: 'rgba(241,245,249,0.85)' },
  danger:  { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.35)', text: '#fca5a5' },
}

export default function Tag({ children, tone = 'neutral', size = 'sm' }: { children: ReactNode; tone?: Tone; size?: 'xs' | 'sm' }) {
  const t = TONES[tone]
  const sz = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${sz}`}
          style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.text }}>
      {children}
    </span>
  )
}
