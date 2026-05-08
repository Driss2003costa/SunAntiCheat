import { useEffect, useMemo, useState } from 'react'
import { useSections } from '../App'
import { Link, useLocation } from 'react-router-dom'

/**
 * Bandeau sticky global affiché en haut du portail dès qu'au moins une section
 * est en MAINTENANCE ou DEGRADED. Cliquable → /home (carte statut détaillée).
 * Auto-dismiss session via localStorage (clé incident updatedAt).
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

  // Persiste les dismissals
  useEffect(() => {
    localStorage.setItem('portal_status_dismissed', JSON.stringify(dismissed))
  }, [dismissed])

  // Pas d'incidents ? rien à afficher.
  if (!ctx.loaded || incidents.length === 0) return null

  // On masque sur /login et / (Register) pour ne pas polluer le funnel d'inscription
  if (location.pathname === '/login' || location.pathname === '/' || location.pathname === '/forgot') {
    return null
  }

  // Si tous les incidents en cours ont été dismissés (sur la dernière updatedAt), on cache
  const visibleIncidents = incidents.filter(s =>
    dismissed[`${s.key}:${s.updatedAt}`] !== true
  )
  if (visibleIncidents.length === 0) return null

  // Couleur du bandeau : rouge si au moins 1 maintenance/disabled, sinon orange
  const hasBlocking = visibleIncidents.some(s => s.status === 'MAINTENANCE' || s.status === 'DISABLED')
  const color  = hasBlocking ? '#ef4444' : '#f59e0b'
  const bgFrom = hasBlocking ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'
  const bgTo   = hasBlocking ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)'

  const dismissAll = () => {
    const next = { ...dismissed }
    visibleIncidents.forEach(s => { next[`${s.key}:${s.updatedAt}`] = true })
    setDismissed(next)
  }

  const summary = visibleIncidents.length === 1
    ? `${visibleIncidents[0].icon} ${visibleIncidents[0].label}`
    : `${visibleIncidents.length} services impactés`

  return (
    <div
      role="alert"
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
    </div>
  )
}
