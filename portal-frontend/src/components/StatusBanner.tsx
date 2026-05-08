import { useEffect, useMemo, useState } from 'react'
import { useSections } from '../App'
import { Link, useLocation } from 'react-router-dom'
import Countdown from './Countdown'

/**
 * Bandeau sticky global affiché en haut du portail :
 *  - quand au moins une section est en MAINTENANCE/DEGRADED/DISABLED
 *  - OU quand le mode maintenance globale est activé (visible aux OP qui passent à travers)
 *
 * Cliquable → /home (carte statut détaillée). Auto-dismiss session-based.
 * Inclut un compte à rebours sous le bandeau si une fin estimée est définie.
 */
export default function StatusBanner() {
  const ctx = useSections()
  const location = useLocation()
  const [dismissed, setDismissed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('portal_status_dismissed') || '{}') }
    catch { return {} }
  })

  const incidents = useMemo(() => {
    return Object.values(ctx.details).filter(s =>
      s.status === 'MAINTENANCE' || s.status === 'DEGRADED' || s.status === 'DISABLED'
    )
  }, [ctx.details])

  useEffect(() => {
    localStorage.setItem('portal_status_dismissed', JSON.stringify(dismissed))
  }, [dismissed])

  if (!ctx.loaded) return null

  // Cache sur les pages d'auth pour ne pas polluer
  if (location.pathname === '/login' || location.pathname === '/' || location.pathname === '/forgot') {
    return null
  }

  // Cas 1 : maintenance globale active (l'utilisateur est forcément OP sinon il serait sur le lockdown)
  if (ctx.maintenance.enabled) {
    return (
      <div role="alert"
           className="sticky top-0 z-40 backdrop-blur-md"
           style={{
             background: 'linear-gradient(180deg, rgba(239,68,68,0.20), rgba(239,68,68,0.06))',
             borderBottom: '1px solid rgba(239,68,68,0.45)',
           }}>
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-base">🚧</span>
          <span className="font-semibold tracking-wide" style={{ color: '#fca5a5' }}>
            MAINTENANCE GLOBALE EN COURS
          </span>
          <span className="hidden md:inline text-white/70">·</span>
          <span className="hidden md:inline truncate text-white/80">
            {ctx.maintenance.message || 'Portail verrouillé pour les non-OP'}
          </span>
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest"
                style={{ background: 'rgba(251,191,36,0.18)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
            ★ Mode OP — accès accordé
          </span>
        </div>
        {ctx.maintenance.endsAt > 0 && (
          <div className="max-w-6xl mx-auto px-4 pb-2 flex items-center gap-2 text-xs"
               style={{ color: '#fca5a5' }}>
            <span>Retour estimé dans</span>
            <Countdown endsAt={ctx.maintenance.endsAt} variant="inline" color="#fca5a5"/>
          </div>
        )}
      </div>
    )
  }

  // Cas 2 : incidents par section
  const visibleIncidents = incidents.filter(s =>
    dismissed[`${s.key}:${s.updatedAt}`] !== true
  )
  if (visibleIncidents.length === 0) return null

  const hasBlocking = visibleIncidents.some(s => s.status === 'MAINTENANCE' || s.status === 'DISABLED')
  const color  = hasBlocking ? '#ef4444' : '#f59e0b'
  const bgFrom = hasBlocking ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'
  const bgTo   = hasBlocking ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)'

  // Plus proche endsAt parmi les incidents visibles
  const earliestEndsAt = visibleIncidents
    .map(s => s.endsAt)
    .filter(t => t > Date.now())
    .sort((a, b) => a - b)[0] ?? 0

  const dismissAll = () => {
    const next = { ...dismissed }
    visibleIncidents.forEach(s => { next[`${s.key}:${s.updatedAt}`] = true })
    setDismissed(next)
  }

  const summary = visibleIncidents.length === 1
    ? `${visibleIncidents[0].icon} ${visibleIncidents[0].label}`
    : `${visibleIncidents.length} services impactés`

  return (
    <div role="alert"
         className="sticky top-0 z-40 backdrop-blur-md"
         style={{
           background: `linear-gradient(180deg, ${bgFrom}, ${bgTo})`,
           borderBottom: `1px solid ${color}66`,
         }}>
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <span className="text-base" style={{ color }}>
          {hasBlocking ? '🛠️' : '⚠️'}
        </span>
        <span className="font-semibold tracking-wide" style={{ color }}>
          {hasBlocking ? 'MAINTENANCE EN COURS' : 'INCIDENT EN COURS'}
        </span>
        <span className="hidden md:inline text-white/70">·</span>
        <span className="hidden md:inline truncate text-white/80">
          {summary}
          {visibleIncidents.length === 1 && visibleIncidents[0].message
            ? ` — ${visibleIncidents[0].message}`
            : ''}
        </span>
        <Link to="/home"
              className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full hover:opacity-80 transition"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: `1px solid ${color}66` }}>
          Voir détails →
        </Link>
        <button
          aria-label="Masquer"
          onClick={dismissAll}
          className="text-white/60 hover:text-white text-lg leading-none px-1">
          ×
        </button>
      </div>
      {earliestEndsAt > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-2 flex items-center gap-2 text-xs" style={{ color }}>
          <span>Retour estimé dans</span>
          <Countdown endsAt={earliestEndsAt} variant="inline" color={color}/>
        </div>
      )}
    </div>
  )
}
