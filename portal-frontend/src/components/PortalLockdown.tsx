import { useTranslation } from 'react-i18next'
import SunGuardBg from './SunGuardBg'
import Countdown from './Countdown'
import type { GlobalMaintenance } from '../api/client'

/**
 * Écran lockdown plein page affiché aux non-OP quand la maintenance globale
 * du portail est activée. Compte à rebours, message d'incident, et invitation
 * à revenir plus tard.
 */
export default function PortalLockdown({ maintenance }: { maintenance: GlobalMaintenance }) {
  const { t, i18n } = useTranslation()
  const COLOR = '#f87171' // rouge maintenance
  const localeTag = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').startsWith('fr') ? 'fr-FR' : 'en-GB'
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
              {t('portalLockdown.badge')}
            </div>
            <h1 className="text-4xl font-black text-white">
              {t('portalLockdown.title')}
            </h1>
            <p className="mt-3 text-sm text-white/60 max-w-sm mx-auto">
              {t('portalLockdown.message')}
            </p>
          </div>

          {/* Compte à rebours (gros, visible) */}
          {maintenance.endsAt > 0 && (
            <div className="rounded-2xl px-4 py-5"
                 style={{ background: GLASS, border: `1px solid ${BORDER}` }}>
              <Countdown endsAt={maintenance.endsAt}
                         variant="boxes"
                         color={COLOR}
                         label={t('portalLockdown.countdown')}/>
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
            {t('portalLockdown.footer')}
            {maintenance.startedAt > 0 && (
              <> · {t('portalLockdown.footerStarted', {
                time: new Date(maintenance.startedAt).toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' }),
              })}</>
            )}
          </div>
        </div>
      </div>
    </SunGuardBg>
  )
}
