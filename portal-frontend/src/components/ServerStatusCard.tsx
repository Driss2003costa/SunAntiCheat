import { useMemo } from 'react'
import { useSections } from '../App'
import { Card, SectionDivider, Tag } from './ui'
import type { FeatureStatus, SectionDetail } from '../api/client'

const STATUS_META: Record<FeatureStatus, { label: string; color: string; bg: string; border: string; icon: string; subtitle: string }> = {
  OPERATIONAL: { label: 'Opérationnel', color: '#34d399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.30)', icon: '✅', subtitle: 'Tout fonctionne'         },
  DEGRADED:    { label: 'Dégradé',      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.30)', icon: '⚠️',  subtitle: 'Problème connu'         },
  MAINTENANCE: { label: 'Maintenance',  color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)',icon: '🛠️', subtitle: 'Travaux en cours'       },
  DISABLED:    { label: 'Indisponible', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.20)',icon: '⛔', subtitle: 'Coupé temporairement'   },
}

/** Sections que les joueurs voient comme "features" (pas register / public_profiles techniques). */
const VISIBLE_KEYS = ['shop', 'career', 'quests', 'minigames', 'leaderboard', 'friends', 'messages']

function fmtAgo(ts: number) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `il y a ${s}s`
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`
  return `il y a ${Math.floor(s / 86400)}j`
}

export default function ServerStatusCard() {
  const ctx = useSections()

  const items: SectionDetail[] = useMemo(() => {
    return VISIBLE_KEYS
      .map(k => ctx.details[k])
      .filter((s): s is SectionDetail => !!s)
  }, [ctx.details])

  // Score global : pire status visible
  const overall: FeatureStatus = useMemo(() => {
    if (items.some(s => s.status === 'MAINTENANCE')) return 'MAINTENANCE'
    if (items.some(s => s.status === 'DISABLED'))    return 'DISABLED'
    if (items.some(s => s.status === 'DEGRADED'))    return 'DEGRADED'
    return 'OPERATIONAL'
  }, [items])

  if (!ctx.loaded || items.length === 0) return null
  const meta = STATUS_META[overall]

  return (
    <div className="mb-12 lg:mb-16">
      <SectionDivider
        label="Statut des services"
        hint="État opérationnel des features du serveur"/>

      <Card padding="lg" className="overflow-hidden relative">
        {/* Halo coloré selon le statut global */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none"
             style={{ background: meta.bg }}/>

        <div className="relative">
          {/* Header global */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                 style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
              {meta.icon}
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-[0.2em]"
                   style={{ color: meta.color }}>
                {overall === 'OPERATIONAL' ? 'Tous les services sont en service' : 'Incidents en cours'}
              </div>
              <div className="font-display text-xl font-semibold mt-0.5"
                   style={{ color: '#f8fafc' }}>
                {meta.label}
              </div>
            </div>
            {ctx.isOp && (
              <Tag tone="gold" size="sm">★ Mode OP — accès maintenance</Tag>
            )}
          </div>

          {/* Liste des sections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {items.map(s => {
              const m = STATUS_META[s.status]
              return (
                <div key={s.key}
                     className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors"
                     style={{
                       background: 'rgba(255,255,255,0.03)',
                       border: `1px solid ${s.status === 'OPERATIONAL' ? 'rgba(255,255,255,0.06)' : m.border}`,
                     }}>
                  <span className="text-2xl shrink-0">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm"
                            style={{ color: '#f1f5f9' }}>{s.label}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: m.bg, color: m.color }}>
                        {m.icon} {m.label}
                      </span>
                    </div>
                    {s.message
                      ? <div className="text-xs italic mt-0.5"
                             style={{ color: m.color }}>💬 {s.message}</div>
                      : <div className="text-xs mt-0.5"
                             style={{ color: 'rgba(241,245,249,0.45)' }}>{m.subtitle}</div>}
                    {s.updatedAt > 0 && s.status !== 'OPERATIONAL' && (
                      <div className="text-[10px] mt-0.5"
                           style={{ color: 'rgba(241,245,249,0.35)' }}>
                        Maj {fmtAgo(s.updatedAt)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Disclaimer */}
          <div className="mt-4 text-[11px]"
               style={{ color: 'rgba(241,245,249,0.40)' }}>
            Les sections en maintenance sont indisponibles le temps des travaux.
            L'état est mis à jour en temps réel par l'équipe technique.
          </div>
        </div>
      </Card>
    </div>
  )
}
