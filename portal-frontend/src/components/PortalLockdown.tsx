import SunGuardBg from './SunGuardBg'
import Countdown from './Countdown'
import type { GlobalMaintenance } from '../api/client'

/**
 * Écran lockdown plein page affiché aux non-OP quand la maintenance globale
 * du portail est activée. Compte à rebours, message d'incident, et invitation
 * à revenir plus tard.
 */
export default function PortalLockdown({ maintenance }: { maintenance: GlobalMaintenance }) {
  const COLOR = '#f87171' // rouge maintenance
  const GLASS  = 'rgba(255,255,255,0.05)'
  const BORDER = 'rgba(248,113,113,0.35)'

  return (
    <SunGuardBg>
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center pb-12">

        {/* Halo d'avertissement */}
        <div className="absolute inset-0 pointer-events-none"
             style={{
               background: 'radial-gradient(circle at 50% 30%, rgba(248,113,113,0.15) 0%, transparent 50%)',
             }}/>

        <div className="relative max-w-md w-full space-y-6">
          {/* Pictogramme animé */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl blur-2xl animate-pulse"
                   style={{ background: 'rgba(248,113,113,0.4)' }}/>
              <div className="relative w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
                   style={{ background: 'rgba(248,113,113,0.15)', border: `1px solid ${BORDER}` }}>
                🚧
              </div>
            </div>
          </div>

          {/* Titre */}
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] mb-3"
                 style={{ color: COLOR }}>
              ⚠ Portail en maintenance
            </div>
            <h1 className="text-4xl font-black text-white">
              Nous revenons<br/>très bientôt
            </h1>
            <p className="mt-3 text-sm text-white/60 max-w-sm mx-auto">
              Notre équipe travaille sur le portail. Toutes les fonctionnalités
              sont temporairement indisponibles.
            </p>
          </div>

          {/* Compte à rebours (gros, visible) */}
          {maintenance.endsAt > 0 && (
            <div className="rounded-2xl px-4 py-5"
                 style={{ background: GLASS, border: `1px solid ${BORDER}` }}>
              <Countdown endsAt={maintenance.endsAt}
                         variant="boxes"
                         color={COLOR}
                         label="Retour estimé dans"/>
            </div>
          )}

          {/* Message d'incident */}
          {maintenance.message && (
            <div className="rounded-xl px-4 py-3 text-sm text-left"
                 style={{ background: GLASS, border: `1px solid ${BORDER}`, color: '#fecaca' }}>
              💬 {maintenance.message}
            </div>
          )}

          {/* Astuce / signature */}
          <div className="text-xs text-white/40 pt-4">
            ☀ SunGuard · Portail joueur
            {maintenance.startedAt > 0 && (
              <> · Maintenance démarrée à {new Date(maintenance.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>
            )}
          </div>
        </div>
      </div>
    </SunGuardBg>
  )
}
