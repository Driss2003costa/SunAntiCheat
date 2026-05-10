import { useTranslation } from 'react-i18next'
import { useState, useRef, useEffect } from 'react'

const LANGS: { code: 'fr' | 'en'; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
]

interface Props {
  /** Variante d'affichage : "compact" pour la barre de nav, "inline" pour ailleurs. */
  variant?: 'compact' | 'inline'
}

/**
 * Sélecteur de langue FR | EN. Persiste le choix en localStorage
 * (clé "sun-portal-lang", gérée par i18next-browser-languagedetector).
 */
export default function LanguageSwitcher({ variant = 'compact' }: Props) {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'en').slice(0, 2) as 'fr' | 'en'
  const currentLang = LANGS.find(l => l.code === current) ?? LANGS[1]

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const change = (code: 'fr' | 'en') => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title={t('navbar.language') as string}
        aria-label={t('navbar.language') as string}
        className={
          variant === 'compact'
            ? 'flex flex-col items-center justify-center gap-0.5 py-2.5 px-3 transition-all'
            : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold'
        }
        style={{
          color: '#cbd5e1',
          background: variant === 'inline' ? 'rgba(255,255,255,0.05)' : undefined,
          border: variant === 'inline' ? '1px solid rgba(255,255,255,0.1)' : undefined,
        }}>
        <span className="text-lg leading-none">{currentLang.flag}</span>
        <span className={variant === 'compact' ? 'text-[9px] font-semibold tracking-wide uppercase' : ''}>
          {currentLang.code.toUpperCase()}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 rounded-xl overflow-hidden"
          style={{
            bottom: variant === 'compact' ? 'calc(100% + 8px)' : 'auto',
            top:    variant === 'inline'  ? 'calc(100% + 8px)' : 'auto',
            minWidth: 160,
            background: 'rgba(15,22,40,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
          }}>
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => change(l.code)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition hover:bg-white/5"
              style={{
                color: l.code === current ? '#fbbf24' : '#f1f5f9',
                background: l.code === current ? 'rgba(251,191,36,0.08)' : 'transparent',
              }}>
              <span className="text-lg">{l.flag}</span>
              <span className="flex-1">{l.label}</span>
              {l.code === current && <span className="text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
