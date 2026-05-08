import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

type Status = 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE' | 'DISABLED'

type Section = {
  key: string
  label: string
  description: string
  icon: string
  enabled: boolean
  status: Status
  message: string
  endsAt: number
  updatedAt: number
  updatedBy: string
}

type GlobalMaint = {
  enabled: boolean; message: string; endsAt: number;
  startedAt: number; startedBy: string; updatedAt: number; updatedBy: string;
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string; icon: string; help: string }> = {
  OPERATIONAL: { label: 'Opérationnel',  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: '✅', help: 'Tout fonctionne, accès libre' },
  DEGRADED:    { label: 'Dégradé',       color: '#f59e0b', bg: 'rgba(245,158,11,0.14)',  icon: '⚠️', help: 'Accessible mais avec un problème connu — bandeau d\'avertissement affiché' },
  MAINTENANCE: { label: 'Maintenance',   color: '#ef4444', bg: 'rgba(239,68,68,0.14)',   icon: '🛠️', help: 'BLOQUÉ pour les non-OP. Les OP serveur ont accès' },
  DISABLED:    { label: 'Désactivé',     color: '#64748b', bg: 'rgba(100,116,139,0.14)', icon: '⛔', help: 'Coupé pour tout le monde' },
}

function fmtAgo(ts: number) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `il y a ${s}s`
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`
  return `il y a ${Math.floor(s / 86400)}j`
}

function fmtRemaining(endsAt: number) {
  if (!endsAt) return null
  const ms = endsAt - Date.now()
  if (ms <= 0) return 'expiré'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`
  return `${sec}s`
}

/** datetime-local <input> → epoch ms (and inverse). */
function toLocalInputValue(epochMs: number): string {
  if (!epochMs) return ''
  const d = new Date(epochMs)
  // YYYY-MM-DDTHH:mm
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInputValue(v: string): number {
  if (!v) return 0
  const t = new Date(v).getTime()
  return isNaN(t) ? 0 : t
}

export default function PortalSections() {
  const [sections, setSections] = useState<Section[]>([])
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ key: string; status: Status; message: string; endsAt: number } | null>(null)

  const [global, setGlobal] = useState<GlobalMaint | null>(null)
  const [globalEdit, setGlobalEdit] = useState<{ message: string; endsAt: number } | null>(null)
  const [globalBusy, setGlobalBusy] = useState(false)

  // Tick pour rafraîchir les compteurs "fmtRemaining" toutes les secondes
  const [, setTick] = useState(0)
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(i) }, [])

  const load = async () => {
    try {
      const [data, g] = await Promise.all([
        api.portalSectionsList(),
        api.portalMaintenanceGet().catch(() => null),
      ])
      setSections(data.sections as Section[])
      if (g) setGlobal(g)
    } catch (e: any) {
      setError(e.message)
    }
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const c = { OPERATIONAL: 0, DEGRADED: 0, MAINTENANCE: 0, DISABLED: 0 } as Record<Status, number>
    sections.forEach(s => { c[s.status]++ })
    return c
  }, [sections])

  const setStatus = async (key: string, status: Status, message: string, endsAt: number) => {
    setSavingKey(key); setError('')
    try {
      await api.portalSectionStatusUpdate(key, status, message, endsAt)
      setSavedKey(key); setTimeout(() => setSavedKey(null), 1800)
      await load()
      setEditing(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingKey(null)
    }
  }

  const applyGlobal = async (enabled: boolean) => {
    if (enabled && !globalEdit) return
    if (enabled && !confirm(
      'Activer la MAINTENANCE GLOBALE ?\n\n' +
      'Toutes les sections du portail seront verrouillées pour les non-OP. ' +
      'Seuls les comptes OP du serveur Minecraft pourront accéder au portail.'
    )) return
    setGlobalBusy(true); setError('')
    try {
      await api.portalMaintenanceSet({
        enabled,
        message: enabled ? (globalEdit?.message ?? '') : '',
        endsAt:  enabled ? (globalEdit?.endsAt ?? 0)  : 0,
      })
      setGlobalEdit(null)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGlobalBusy(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            🌐 Sections du portail joueur
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Pilote l'état de chaque feature publique. Le statut <strong>MAINTENANCE bloque
            l'accès aux non-OP côté serveur</strong> ; le mode global ci-dessous verrouille
            <strong> tout le portail</strong> en une fois.
          </p>
        </div>
      </div>

      {/* ── MAINTENANCE GLOBALE ─────────────────────────────────────────── */}
      <div className="rounded-2xl p-5"
           style={{
             background: global?.enabled
               ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.05))'
               : 'var(--card, var(--surface))',
             border: `1px solid ${global?.enabled ? 'rgba(239,68,68,0.45)' : 'var(--border)'}`,
           }}>
        <div className="flex items-start gap-4">
          <div className="text-3xl">{global?.enabled ? '🚧' : '🛡️'}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base" style={{ color: 'var(--text)' }}>
                Mode maintenance globale
              </span>
              {global?.enabled ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider animate-pulse"
                      style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  ⚠ ACTIF — Portail verrouillé
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                      style={{ background: 'rgba(16,185,129,0.18)', color: '#10b981' }}>
                  ✅ INACTIF — Portail ouvert
                </span>
              )}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Verrouille <strong>l'intégralité</strong> du portail joueur. Les non-OP sont
              redirigés vers un écran lockdown plein écran avec compte à rebours. Les
              <strong> OP du serveur conservent l'accès</strong>.
            </div>
            {global?.enabled && (
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Message</div>
                  <div className="mt-0.5 italic" style={{ color: '#fca5a5' }}>
                    {global.message || '(aucun)'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Fin estimée</div>
                  <div className="mt-0.5 font-mono" style={{ color: '#fca5a5' }}>
                    {global.endsAt > 0
                      ? `${new Date(global.endsAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (${fmtRemaining(global.endsAt) ?? '—'})`
                      : 'Pas de minuteur'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Démarré par</div>
                  <div className="mt-0.5" style={{ color: '#fca5a5' }}>
                    {global.startedBy || '?'} · {fmtAgo(global.startedAt)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {!global?.enabled && (
            <button
              onClick={() => setGlobalEdit(globalEdit ? null : {
                message: 'Maintenance programmée — retour rapide',
                endsAt:  Date.now() + 30 * 60 * 1000,
              })}
              disabled={globalBusy}
              className="shrink-0 px-3 py-2 rounded text-xs font-bold transition disabled:opacity-50"
              style={{ background: '#ef4444', color: 'white' }}>
              {globalEdit ? 'Annuler' : '🔒 Activer la maintenance globale'}
            </button>
          )}
          {global?.enabled && (
            <button
              onClick={() => applyGlobal(false)}
              disabled={globalBusy}
              className="shrink-0 px-3 py-2 rounded text-xs font-bold transition disabled:opacity-50"
              style={{ background: '#10b981', color: 'white' }}>
              {globalBusy ? '...' : '✅ Désactiver maintenant'}
            </button>
          )}
        </div>

        {globalEdit && !global?.enabled && (
          <div className="mt-4 pt-4 grid grid-cols-3 gap-4"
               style={{ borderTop: '1px solid var(--border)' }}>
            <div className="col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider"
                     style={{ color: 'var(--text-muted)' }}>
                Message public (visible sur l'écran lockdown)
              </label>
              <input
                value={globalEdit.message}
                onChange={e => setGlobalEdit({ ...globalEdit, message: e.target.value })}
                placeholder="ex: Migration DB en cours, retour estimé 14h00"
                maxLength={200}
                className="w-full mt-1 px-3 py-2 rounded text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider"
                     style={{ color: 'var(--text-muted)' }}>
                Fin estimée (ETA)
              </label>
              <input type="datetime-local"
                value={toLocalInputValue(globalEdit.endsAt)}
                onChange={e => setGlobalEdit({ ...globalEdit, endsAt: fromLocalInputValue(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
              <div className="flex gap-1 mt-1.5">
                {[15, 30, 60, 120].map(min => (
                  <button key={min}
                          onClick={() => setGlobalEdit({ ...globalEdit, endsAt: Date.now() + min * 60_000 })}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    +{min}min
                  </button>
                ))}
                <button onClick={() => setGlobalEdit({ ...globalEdit, endsAt: 0 })}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  ✕ Aucune
                </button>
              </div>
            </div>
            <div className="col-span-3 flex justify-end">
              <button
                onClick={() => applyGlobal(true)}
                disabled={globalBusy}
                className="px-4 py-2 rounded text-sm font-bold text-white transition disabled:opacity-60"
                style={{ background: '#ef4444' }}>
                {globalBusy ? 'Activation…' : 'Verrouiller le portail'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI strip per-section */}
      <div className="grid grid-cols-4 gap-3">
        {(Object.keys(STATUS_META) as Status[]).map(st => {
          const meta = STATUS_META[st]
          return (
            <div key={st} className="rounded-xl px-4 py-3 flex items-center gap-3"
                 style={{ background: meta.bg, border: `1px solid ${meta.color}33` }}>
              <div className="text-2xl">{meta.icon}</div>
              <div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: meta.color }}>
                  {counts[st]}
                </div>
                <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: meta.color }}>
                  {meta.label}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm"
             style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-2">
        {sections.length === 0 && (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Chargement…
          </div>
        )}
        {sections.map(section => {
          const meta = STATUS_META[section.status]
          const isSaving = savingKey === section.key
          const isSaved  = savedKey === section.key
          const isEditing = editing?.key === section.key
          const remain = fmtRemaining(section.endsAt)
          return (
            <div key={section.key}
                 className="rounded-xl p-4 transition-opacity"
                 style={{
                   background: 'var(--card, var(--surface))',
                   border: `1px solid var(--border)`,
                   borderLeft: `3px solid ${meta.color}`,
                   opacity: section.status === 'DISABLED' ? 0.6 : 1,
                 }}>

              <div className="flex items-center gap-4">
                <span className="text-2xl shrink-0">{section.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2 flex-wrap" style={{ color: 'var(--text)' }}>
                    <span>{section.label}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ background: meta.bg, color: meta.color }}>
                      {meta.icon} {meta.label}
                    </span>
                    {remain && remain !== 'expiré' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
                            style={{ background: meta.bg, color: meta.color }}>
                        ⏱ {remain}
                      </span>
                    )}
                    {isSaved && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                        ✓ SAUVEGARDÉ
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {section.description}
                  </div>
                  {section.message && (
                    <div className="text-xs mt-1 italic" style={{ color: meta.color }}>
                      💬 {section.message}
                    </div>
                  )}
                  {section.updatedAt > 0 && (
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      MAJ {fmtAgo(section.updatedAt)} · par {section.updatedBy || '?'}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setEditing(isEditing ? null : {
                    key: section.key, status: section.status, message: section.message,
                    endsAt: section.endsAt,
                  })}
                  className="shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition"
                  style={{
                    background: isEditing ? meta.color : 'var(--surface-2)',
                    color: isEditing ? 'white' : 'var(--text)',
                    border: '1px solid var(--border)',
                  }}>
                  {isEditing ? 'Annuler' : 'Modifier le statut'}
                </button>
              </div>

              {isEditing && editing && (
                <div className="mt-4 pt-4 space-y-3"
                     style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(STATUS_META) as Status[]).map(st => {
                      const m = STATUS_META[st]
                      const active = editing.status === st
                      return (
                        <button
                          key={st}
                          onClick={() => setEditing({ ...editing, status: st })}
                          className="rounded-lg p-3 text-left transition"
                          style={{
                            background: active ? m.bg : 'var(--surface-2)',
                            border: `1px solid ${active ? m.color : 'var(--border)'}`,
                            color: active ? m.color : 'var(--text)',
                          }}>
                          <div className="font-semibold text-sm">{m.icon} {m.label}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: active ? m.color : 'var(--text-muted)' }}>
                            {m.help}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wider"
                             style={{ color: 'var(--text-muted)' }}>
                        Message public
                      </label>
                      <input
                        value={editing.message}
                        onChange={e => setEditing({ ...editing, message: e.target.value })}
                        placeholder="ex: Reset hebdo en cours, retour estimé 14h00"
                        maxLength={140}
                        className="w-full mt-1 px-3 py-2 rounded text-sm"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {editing.message.length}/140
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider"
                             style={{ color: 'var(--text-muted)' }}>
                        Fin estimée (ETA)
                      </label>
                      <input type="datetime-local"
                        value={toLocalInputValue(editing.endsAt)}
                        onChange={e => setEditing({ ...editing, endsAt: fromLocalInputValue(e.target.value) })}
                        disabled={editing.status === 'OPERATIONAL'}
                        className="w-full mt-1 px-3 py-2 rounded text-sm disabled:opacity-50"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {[15, 30, 60, 120].map(min => (
                          <button key={min}
                                  disabled={editing.status === 'OPERATIONAL'}
                                  onClick={() => setEditing({ ...editing, endsAt: Date.now() + min * 60_000 })}
                                  className="text-[10px] px-1.5 py-0.5 rounded disabled:opacity-50"
                                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                            +{min}min
                          </button>
                        ))}
                        <button disabled={editing.status === 'OPERATIONAL'}
                                onClick={() => setEditing({ ...editing, endsAt: 0 })}
                                className="text-[10px] px-1.5 py-0.5 rounded disabled:opacity-50"
                                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 rounded text-xs"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      Annuler
                    </button>
                    <button
                      onClick={() => setStatus(editing.key, editing.status, editing.message, editing.endsAt)}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded text-xs font-semibold text-white transition disabled:opacity-60"
                      style={{ background: STATUS_META[editing.status].color }}>
                      {isSaving ? 'Sauvegarde…' : 'Appliquer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Info box */}
      <div className="px-4 py-3 rounded-lg text-xs"
           style={{ background: 'var(--card, var(--surface))', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <div style={{ color: 'var(--text)' }} className="font-semibold mb-1">Comportement des statuts</div>
        <ul className="space-y-1">
          <li>🚧 <strong>Maintenance globale</strong> — verrouille TOUTES les routes <code>/api/public/*</code> pour les non-OP. Le portail affiche un écran lockdown avec compte à rebours. OP serveur exemptés.</li>
          <li>🛠️ <strong>Maintenance par section</strong> — bloque uniquement la section concernée côté API + UI</li>
          <li>⚠️ <strong>Dégradé</strong> — accès libre, bandeau jaune sur la page concernée</li>
          <li>✅ <strong>Opérationnel</strong> — accès normal, aucun bandeau</li>
          <li>⛔ <strong>Désactivé</strong> — coupé pour tout le monde</li>
        </ul>
      </div>
    </div>
  )
}
