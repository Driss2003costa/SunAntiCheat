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
  updatedAt: number
  updatedBy: string
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

export default function PortalSections() {
  const [sections, setSections] = useState<Section[]>([])
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ key: string; status: Status; message: string } | null>(null)

  const load = async () => {
    try {
      const data = await api.portalSectionsList()
      setSections(data.sections as Section[])
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

  const setStatus = async (key: string, status: Status, message: string) => {
    setSavingKey(key); setError('')
    try {
      await api.portalSectionStatusUpdate(key, status, message)
      setSavedKey(key); setTimeout(() => setSavedKey(null), 1800)
      await load()
      setEditing(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingKey(null)
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
            Pilote l'état de chaque feature publique du portail. <strong>Le statut MAINTENANCE
            bloque l'accès aux non-OP côté serveur</strong> — seul un joueur OP peut continuer à utiliser
            la feature pendant que tu travailles dessus.
          </p>
        </div>
      </div>

      {/* KPI strip */}
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

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider"
                           style={{ color: 'var(--text-muted)' }}>
                      Message public (visible par les joueurs)
                    </label>
                    <input
                      value={editing.message}
                      onChange={e => setEditing({ ...editing, message: e.target.value })}
                      placeholder="ex: Reset hebdo en cours, retour estimé 14h00"
                      maxLength={140}
                      className="w-full mt-1 px-3 py-2 rounded text-sm"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}/>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {editing.message.length}/140 — visible dans le bandeau du portail joueur
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
                      onClick={() => setStatus(editing.key, editing.status, editing.message)}
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
          <li>✅ <strong>Opérationnel</strong> — accès normal, aucun bandeau côté joueur</li>
          <li>⚠️ <strong>Dégradé</strong> — accès libre, mais un bandeau jaune affiche le message d'incident</li>
          <li>🛠️ <strong>Maintenance</strong> — l'accès est <strong>bloqué côté serveur</strong> pour tout joueur non-OP. Les routes API renvoient 503. Les OP peuvent continuer à tester la feature.</li>
          <li>⛔ <strong>Désactivé</strong> — coupé pour tout le monde (équivalent legacy enabled=false)</li>
        </ul>
      </div>
    </div>
  )
}
