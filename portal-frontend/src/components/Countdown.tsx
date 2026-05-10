import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Compte à rebours qui tick chaque seconde jusqu'à `endsAt` (epoch ms).
 *
 * Variantes :
 *  - `inline`  → format compact "1h 23m 45s" (pour bandeau sticky)
 *  - `boxes`   → grandes boîtes HH/MM/SS (pour la page lockdown)
 *  - `compact` → "1h23" (utile dans une carte)
 */
export default function Countdown({
  endsAt, variant = 'inline', color = '#fbbf24', label,
}: {
  endsAt: number
  variant?: 'inline' | 'boxes' | 'compact'
  color?: string
  label?: string
}) {
  const { t, i18n } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  if (!endsAt) return null
  const ms = endsAt - now
  const expired = ms <= 0
  const isFr = (i18n.resolvedLanguage ?? i18n.language ?? '').startsWith('fr')

  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const days  = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins  = Math.floor((totalSec % 3600) / 60)
  const secs  = totalSec % 60

  // Suffixes localisés (j/h/m/s vs d/h/m/s)
  const sfx = isFr ? { d: 'j', h: 'h', m: 'm', s: 's' } : { d: 'd', h: 'h', m: 'm', s: 's' }
  const boxLabels = isFr
    ? { d: 'jours', h: 'heures', m: 'min', s: 'sec' }
    : { d: 'days',  h: 'hours',  m: 'min', s: 'sec' }

  if (variant === 'boxes') {
    return (
      <div className="flex flex-col items-center gap-2">
        {label && (
          <div className="text-[11px] font-bold uppercase tracking-[0.25em]"
               style={{ color: expired ? '#94a3b8' : color }}>
            {expired ? t('countdown.endingSoon') : label}
          </div>
        )}
        <div className="flex items-end gap-2 sm:gap-3">
          {days > 0 && <Box value={days}  label={boxLabels.d} color={color} expired={expired}/>}
          <Box value={hours} label={boxLabels.h} color={color} expired={expired}/>
          <Sep color={color}/>
          <Box value={mins}  label={boxLabels.m} color={color} expired={expired}/>
          <Sep color={color}/>
          <Box value={secs}  label={boxLabels.s} color={color} expired={expired}/>
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <span className="font-mono tabular-nums" style={{ color: expired ? '#94a3b8' : color }}>
        {expired ? t('countdown.expiredCompact') :
          days > 0 ? `${days}${sfx.d} ${hours}${sfx.h}` :
          hours > 0 ? `${hours}${sfx.h}${mins.toString().padStart(2, '0')}` :
          `${mins}${sfx.m}${secs.toString().padStart(2, '0')}${sfx.s}`}
      </span>
    )
  }

  // variant === 'inline'
  return (
    <span className="font-mono tabular-nums text-sm" style={{ color: expired ? '#94a3b8' : color }}>
      {expired ? t('countdown.expiredInline') :
        <>
          ⏱{' '}
          {days > 0 && `${days}${sfx.d} `}
          {(hours > 0 || days > 0) && `${hours.toString().padStart(2, '0')}${sfx.h} `}
          {`${mins.toString().padStart(2, '0')}${sfx.m} `}
          {`${secs.toString().padStart(2, '0')}${sfx.s}`}
        </>}
    </span>
  )
}

function Box({ value, label, color, expired }: { value: number; label: string; color: string; expired: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-xl px-3 py-2 sm:px-4 sm:py-3 min-w-[64px] sm:min-w-[80px] text-center
                      font-mono font-bold text-3xl sm:text-4xl tabular-nums"
           style={{
             background: expired ? 'rgba(148,163,184,0.12)' : `${color}20`,
             border: `1px solid ${expired ? 'rgba(148,163,184,0.3)' : `${color}55`}`,
             color: expired ? '#94a3b8' : color,
             textShadow: expired ? 'none' : `0 0 14px ${color}55`,
           }}>
        {value.toString().padStart(2, '0')}
      </div>
      <div className="text-[10px] mt-1 uppercase tracking-widest"
           style={{ color: expired ? '#64748b' : 'rgba(241,245,249,0.5)' }}>
        {label}
      </div>
    </div>
  )
}

function Sep({ color }: { color: string }) {
  return (
    <div className="text-3xl sm:text-4xl font-bold pb-7"
         style={{ color, opacity: 0.4 }}>:</div>
  )
}
