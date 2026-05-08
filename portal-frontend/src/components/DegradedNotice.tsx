import { useSections } from '../App'
import Countdown from './Countdown'

/**
 * Encart inline à insérer en haut d'une page de feature : si la section est
 * DEGRADED, affiche un warning jaune avec le message de l'incident. Sinon rien.
 *
 * Usage : <DegradedNotice sectionKey="shop"/>
 */
export default function DegradedNotice({ sectionKey }: { sectionKey: string }) {
  const ctx = useSections()
  const detail = ctx.details[sectionKey]
  if (!detail || detail.status !== 'DEGRADED') return null

  return (
    <div role="status"
         className="mb-6 rounded-xl px-4 py-3 flex items-start gap-3"
         style={{
           background: 'rgba(251,191,36,0.10)',
           border: '1px solid rgba(251,191,36,0.30)',
         }}>
      <span className="text-xl shrink-0">⚠️</span>
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-semibold mb-0.5" style={{ color: '#fbbf24' }}>
          Service dégradé
        </div>
        <div style={{ color: 'rgba(254,243,199,0.85)' }}>
          {detail.message || 'Cette section fonctionne actuellement avec un problème connu.'}
        </div>
        {detail.endsAt > 0 && detail.endsAt > Date.now() && (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span style={{ color: 'rgba(254,243,199,0.6)' }}>Retour normal estimé dans</span>
            <Countdown endsAt={detail.endsAt} variant="compact" color="#fbbf24"/>
          </div>
        )}
      </div>
    </div>
  )
}
