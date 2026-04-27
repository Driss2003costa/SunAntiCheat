import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

/**
 * Page Sanctions modernes — kick / ban / mute / warn avec stylized
 * disconnect screen et workflow complet.
 *
 * 4 onglets :
 *   - Actives  : sanctions actuellement en cours (avec bouton "Lever")
 *   - Tout     : historique complet (filtrable)
 *   - Templates: presets cliquables (Triche X-Ray, Insultes, Spam, ...)
 *   - Stats    : KPIs + graphes
 *
 * Action principale : bouton flottant "+ Sanctionner" qui ouvre une modale
 * full-screen avec :
 *   - Joueur (autocomplete)
 *   - Type (chips KICK/BAN/IP_BAN/MUTE/WARN)
 *   - Sévérité (slider 4 niveaux color-coded)
 *   - Catégorie (chips)
 *   - Templates (carrousel cliquables)
 *   - Durée (presets + custom)
 *   - Raison + Evidence URL + Notes
 *   - Silent toggle
 *   - **LIVE PREVIEW** du disconnect screen côté droit (rendu Minecraft-like)
 */

type Tab = 'active' | 'all' | 'templates' | 'stats'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'active',    label: 'Actives',    icon: '⚠️' },
  { id: 'all',       label: 'Historique', icon: '📜' },
  { id: 'templates', label: 'Templates',  icon: '⚡' },
  { id: 'stats',     label: 'Statistiques',icon: '📊' },
]

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  KICK:   { label: 'Kick',      icon: '👢', color: '#fbbf24' },
  BAN:    { label: 'Ban',       icon: '⛔', color: '#ef4444' },
  IP_BAN: { label: 'IP-Ban',    icon: '🚫', color: '#dc2626' },
  MUTE:   { label: 'Mute',      icon: '🔇', color: '#a855f7' },
  WARN:   { label: 'Warn',      icon: '⚠️',  color: '#fbbf24' },
}

const SEVERITY_META: { id: string; label: string; emoji: string; color: string }[] = [
  { id: 'LOW',      label: 'Léger',    emoji: '🟡', color: '#eab308' },
  { id: 'MEDIUM',   label: 'Modéré',   emoji: '🟠', color: '#f97316' },
  { id: 'HIGH',     label: 'Élevé',    emoji: '🔴', color: '#ef4444' },
  { id: 'CRITICAL', label: 'Critique', emoji: '⛔', color: '#7f1d1d' },
]

const CATEGORIES = [
  { id: 'CHEAT',    emoji: '⚔', label: 'Triche / hack' },
  { id: 'CHAT',     emoji: '💬', label: 'Chat (insultes, spam)' },
  { id: 'GRIEF',    emoji: '⚒', label: 'Grief / vol' },
  { id: 'EXPLOIT',  emoji: '🐛', label: 'Exploit / dupe' },
  { id: 'SPAM',     emoji: '📢', label: 'Spam / pub' },
  { id: 'STAFF',    emoji: '👮', label: 'Staff / faux staff' },
  { id: 'EVASION',  emoji: '🎭', label: 'Évasion ban / alt' },
  { id: 'OTHER',    emoji: '❓', label: 'Autre' },
]

const DURATION_PRESETS = [
  { ms: 0,                 label: 'Permanent' },
  { ms: 60 * 60_000,       label: '1 heure' },
  { ms: 6 * 3_600_000,     label: '6 heures' },
  { ms: 24 * 3_600_000,    label: '1 jour' },
  { ms: 3 * 86_400_000,    label: '3 jours' },
  { ms: 7 * 86_400_000,    label: '7 jours' },
  { ms: 14 * 86_400_000,   label: '14 jours' },
  { ms: 30 * 86_400_000,   label: '30 jours' },
  { ms: 90 * 86_400_000,   label: '90 jours' },
]

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}min`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}j`
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return 'PERMANENT'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d} j ${h} h`
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min`
  return `${s} s`
}

export default function Sanctions() {
  const [tab, setTab] = useState<Tab>('active')
  const [data, setData] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [presetTemplate, setPresetTemplate] = useState<any>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      if (tab === 'active' || tab === 'all') {
        const params: any = { limit: 200 }
        if (tab === 'active') params.activeOnly = 'true'
        setData(await api.sanctionsList(params))
      } else if (tab === 'stats') {
        setStats(await api.sanctionsStats(30))
      }
      setTemplates(await api.sanctionsTemplates())
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [tab])

  const openModal = (preset?: any) => {
    setPresetTemplate(preset || null)
    setShowModal(true)
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            ⚖️ Sanctions
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Système de modération moderne — kick / ban / mute / warn avec écran de déconnexion stylisé
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={loading}
                  className="px-3 py-2 rounded text-sm"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {loading ? '⏳' : '↻'}
          </button>
          <button onClick={() => openModal()}
                  className="px-4 py-2 rounded font-semibold text-white text-sm shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            + Sanctionner
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className="px-4 py-2 text-sm font-medium border-b-2 transition"
                  style={{
                    color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                    borderColor: tab === t.id ? 'var(--primary)' : 'transparent',
                  }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {(tab === 'active' || tab === 'all') && (
        <SanctionList data={data} onRevoke={refresh} onClickPlayer={(name) => {
          openModal({ target: name })
        }}/>
      )}
      {tab === 'templates' && (
        <TemplatesGrid templates={templates} onUse={(t) => openModal(t)}/>
      )}
      {tab === 'stats' && <StatsTab data={stats}/>}

      {showModal && (
        <SanctionModal
          templates={templates}
          preset={presetTemplate}
          onClose={() => setShowModal(false)}
          onSubmitted={() => { setShowModal(false); refresh() }}
        />
      )}
    </div>
  )
}

// ── Sanction list ──────────────────────────────────────────────────────────
function SanctionList({ data, onRevoke, onClickPlayer }: { data: any; onRevoke: () => void; onClickPlayer: (n: string) => void }) {
  if (!data) return <Loading/>
  const entries: any[] = data.entries || []
  if (entries.length === 0) {
    return <div className="rounded-xl p-12 text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
      <div className="text-4xl mb-2">✨</div>
      Aucune sanction
    </div>
  }
  return (
    <div className="space-y-2">
      {entries.map(e => <SanctionCard key={e.id} entry={e} onRevoke={onRevoke} onClickPlayer={onClickPlayer}/>)}
    </div>
  )
}

function SanctionCard({ entry, onRevoke, onClickPlayer }: { entry: any; onRevoke: () => void; onClickPlayer: (n: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const t = TYPE_META[entry.type] || TYPE_META.WARN
  const sev = SEVERITY_META.find(s => s.id === entry.severity) || SEVERITY_META[0]
  const cat = CATEGORIES.find(c => c.id === entry.category)
  const active = !entry.revoked && (!entry.expiresAt || entry.expiresAt > Date.now())
  const remaining = entry.expiresAt ? Math.max(0, entry.expiresAt - Date.now()) : null

  const revoke = async () => {
    const reason = prompt('Raison de la levée ?')
    if (reason === null) return
    setRevoking(true)
    try {
      await api.sanctionsRevoke(entry.id, reason || '')
      onRevoke()
    } catch (e: any) {
      alert('Erreur : ' + e.message)
    } finally { setRevoking(false) }
  }

  return (
    <div className="rounded-xl overflow-hidden cursor-pointer transition hover:scale-[1.005]"
         style={{
           background: 'var(--surface)',
           border: `1px solid ${active ? t.color + '60' : 'var(--border)'}`,
           boxShadow: active ? `0 0 0 1px ${t.color}30` : undefined,
           opacity: active ? 1 : 0.6,
         }}
         onClick={() => setExpanded(!expanded)}>
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="text-2xl shrink-0" style={{ color: t.color }}>{t.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: t.color + '20', color: t.color }}>
              {t.label.toUpperCase()}
            </span>
            <span className="px-2 py-0.5 rounded text-xs" style={{ background: sev.color + '20', color: sev.color }}>
              {sev.emoji} {sev.label}
            </span>
            {cat && (
              <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                {cat.emoji} {cat.label}
              </span>
            )}
            {entry.silent && (
              <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                🔒 Silent
              </span>
            )}
            {!active && (
              <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                ✓ {entry.revoked ? 'Levée' : 'Expirée'}
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <button onClick={(e) => { e.stopPropagation(); onClickPlayer(entry.targetName) }}
                    className="font-bold hover:underline"
                    style={{ color: 'var(--text)' }}>
              {entry.targetName}
            </button>
            <span className="text-sm ml-2" style={{ color: 'var(--text-muted)' }}>
              — {entry.reason}
            </span>
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            par <b style={{ color: 'var(--text)' }}>{entry.issuedBy}</b> · il y a {timeAgo(entry.issuedAt)}
            {entry.expiresAt && active && (
              <> · <b style={{ color: '#10b981' }}>reste {fmtDuration(remaining || 0)}</b></>
            )}
            {!entry.expiresAt && active && (
              <> · <b style={{ color: '#ef4444' }}>permanent</b></>
            )}
          </div>
        </div>
        {active && (
          <button onClick={(e) => { e.stopPropagation(); revoke() }} disabled={revoking}
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
            {revoking ? '⏳' : '✓ Lever'}
          </button>
        )}
      </div>
      {expanded && (
        <div className="px-4 pb-3 ml-12 text-xs space-y-1"
             style={{ background: 'rgba(0,0,0,0.15)', color: 'var(--text-muted)' }}>
          <div>ID : <span className="font-mono">{entry.id}</span></div>
          <div>Émis : {new Date(entry.issuedAt).toLocaleString('fr-FR')}</div>
          {entry.expiresAt && <div>Expire : {new Date(entry.expiresAt).toLocaleString('fr-FR')}</div>}
          {entry.targetUuid && <div>UUID : <span className="font-mono">{entry.targetUuid}</span></div>}
          {entry.targetIp && <div>IP : <span className="font-mono">{entry.targetIp}</span></div>}
          {entry.evidenceUrl && (
            <div>Preuve : <a href={entry.evidenceUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--primary)' }}>{entry.evidenceUrl}</a></div>
          )}
          {entry.notes && <div>Notes : {entry.notes}</div>}
          {entry.revoked && (
            <div style={{ color: '#10b981' }}>
              ✓ Levée par {entry.revokedBy} le {entry.revokedAt && new Date(entry.revokedAt).toLocaleString('fr-FR')}
              {entry.revokeReason && <> — {entry.revokeReason}</>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Templates grid ─────────────────────────────────────────────────────────
function TemplatesGrid({ templates, onUse }: { templates: any[]; onUse: (t: any) => void }) {
  if (!templates.length) return <Loading/>
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {templates.map(t => {
        const meta = TYPE_META[t.type] || TYPE_META.WARN
        const sev = SEVERITY_META.find(s => s.id === t.severity) || SEVERITY_META[0]
        return (
          <button key={t.id} onClick={() => onUse(t)}
                  className="text-left rounded-xl p-4 cursor-pointer transition hover:scale-[1.02]"
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${meta.color}40`,
                    boxShadow: `0 0 0 1px ${meta.color}20`,
                  }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl">{t.emoji}</div>
              <span className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{ background: meta.color + '20', color: meta.color }}>
                {meta.label.toUpperCase()}
              </span>
            </div>
            <div className="font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>{t.label}</div>
            <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{t.description}</div>
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: sev.color }}>{sev.emoji} {sev.label}</span>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <span style={{ color: 'var(--text-muted)' }}>{fmtDuration(t.durationMs)}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Stats ──────────────────────────────────────────────────────────────────
function StatsTab({ data }: { data: any }) {
  if (!data) return <Loading/>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Kpi icon="⚖️" label="Sanctions actives" value={data.totalActive ?? 0} color="#ef4444"/>
        <Kpi icon="📊" label="Total enregistrées" value={data.totalAll ?? 0} color="#3b82f6"/>
        <Kpi icon="📅" label="30 derniers jours" value={(data.daily?.data ?? []).reduce((a: number, b: number) => a + b, 0)} color="#f59e0b"/>
        <Kpi icon="👮" label="Top staff" value={data.byAdmin?.[0]?.key || '—'} color="#8b5cf6"/>
      </div>

      <div className="rounded-xl p-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>📈 Sanctions / jour (30j)</h3>
        <SimpleBars data={data.daily}/>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>Par type</h3>
          <DistList items={data.byType} colors={Object.fromEntries(Object.entries(TYPE_META).map(([k, v]) => [k, v.color]))}/>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>Par sévérité</h3>
          <DistList items={data.bySeverity} colors={Object.fromEntries(SEVERITY_META.map(s => [s.id, s.color]))}/>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>Top staff (sanctions émises)</h3>
          <DistList items={data.byAdmin}/>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>Top raisons</h3>
          <DistList items={(data.topReasons || []).map((r: any) => ({ key: r.reason, count: r.count }))}/>
        </div>
      </div>
    </div>
  )
}

function DistList({ items, colors }: { items: any[]; colors?: Record<string, string> }) {
  if (!items?.length) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune donnée</div>
  const max = Math.max(...items.map(i => i.count))
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span style={{ color: 'var(--text)' }}>{item.key || '—'}</span>
            <span className="font-bold" style={{ color: 'var(--text-muted)' }}>{item.count}</span>
          </div>
          <div className="h-1 rounded" style={{ background: 'var(--surface-2)' }}>
            <div className="h-full rounded" style={{
              background: (colors && colors[item.key]) || 'var(--primary)',
              width: `${(item.count / max) * 100}%`,
            }}/>
          </div>
        </div>
      ))}
    </div>
  )
}

function SimpleBars({ data }: { data: { labels: string[]; data: number[] } }) {
  if (!data || !data.data?.length) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Pas de données</div>
  const max = Math.max(1, ...data.data)
  return (
    <div className="flex items-end gap-1 h-24">
      {data.data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${data.labels[i]} : ${v}`}>
          <div className="w-full rounded-t transition" style={{
            background: v > 0 ? 'var(--primary)' : 'var(--surface-2)',
            height: `${(v / max) * 100}%`,
            minHeight: '4px',
          }}/>
        </div>
      ))}
    </div>
  )
}

// ── MODAL : workflow de sanction avec live preview ──────────────────────────
function SanctionModal({ templates, preset, onClose, onSubmitted }: {
  templates: any[]; preset: any; onClose: () => void; onSubmitted: () => void
}) {
  const [target, setTarget] = useState<string>(preset?.target || '')
  const [type, setType] = useState<string>(preset?.type || 'BAN')
  const [severity, setSeverity] = useState<string>(preset?.severity || 'MEDIUM')
  const [category, setCategory] = useState<string>(preset?.category || 'OTHER')
  const [reason, setReason] = useState<string>(preset?.reason || '')
  const [durationMs, setDurationMs] = useState<number>(preset?.durationMs ?? 0)
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [silent, setSilent] = useState(false)
  const [templateId] = useState<string | undefined>(preset?.id)
  const [preview, setPreview] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Live preview (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await api.sanctionsPreview({
          type, severity, category,
          target: target || 'PlayerName',
          reason: reason || '...',
          durationMs,
        })
        setPreview(res.screen)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [type, severity, category, target, reason, durationMs])

  const submit = async () => {
    setError('')
    if (!target.trim()) { setError('Joueur requis'); return }
    if (!reason.trim()) { setError('Raison requise'); return }
    setSubmitting(true)
    try {
      await api.sanctionsIssue({
        type, severity, category,
        target: target.trim(),
        reason: reason.trim(),
        durationMs,
        evidenceUrl: evidenceUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        silent,
        templateId,
      })
      onSubmitted()
    } catch (e: any) {
      setError(e.message || 'Erreur')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
         onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl flex"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>

        {/* Form */}
        <div className="flex-1 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>⚖️ Émettre une sanction</h2>
            <button onClick={onClose} className="text-2xl" style={{ color: 'var(--text-muted)' }}>×</button>
          </div>

          {/* Joueur */}
          <Field label="Joueur" required>
            <input value={target} onChange={e => setTarget(e.target.value)}
                   placeholder="Nom du joueur" autoFocus
                   className="w-full px-3 py-2 rounded text-sm"
                   style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
          </Field>

          {/* Type */}
          <Field label="Type">
            <div className="flex gap-2 flex-wrap">
              {Object.entries(TYPE_META).map(([id, m]) => (
                <button key={id} onClick={() => setType(id)}
                        className="px-3 py-2 rounded text-sm font-medium transition"
                        style={{
                          background: type === id ? m.color + '30' : 'var(--surface-2)',
                          border: `1px solid ${type === id ? m.color : 'var(--border)'}`,
                          color: type === id ? m.color : 'var(--text)',
                        }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Sévérité */}
          <Field label="Sévérité">
            <div className="flex gap-2">
              {SEVERITY_META.map(s => (
                <button key={s.id} onClick={() => setSeverity(s.id)}
                        className="flex-1 py-2 rounded text-sm font-medium transition"
                        style={{
                          background: severity === s.id ? s.color + '30' : 'var(--surface-2)',
                          border: `1px solid ${severity === s.id ? s.color : 'var(--border)'}`,
                          color: severity === s.id ? s.color : 'var(--text)',
                        }}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Catégorie */}
          <Field label="Catégorie">
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setCategory(c.id)}
                        className="px-2.5 py-1 rounded text-xs transition"
                        style={{
                          background: category === c.id ? 'var(--primary)' : 'var(--surface-2)',
                          color: category === c.id ? 'white' : 'var(--text-muted)',
                          border: '1px solid var(--border)',
                        }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Durée */}
          {(type === 'BAN' || type === 'IP_BAN' || type === 'MUTE') && (
            <Field label="Durée">
              <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map(p => (
                  <button key={p.ms} onClick={() => setDurationMs(p.ms)}
                          className="px-2.5 py-1 rounded text-xs transition"
                          style={{
                            background: durationMs === p.ms ? '#ef4444' : 'var(--surface-2)',
                            color: durationMs === p.ms ? 'white' : 'var(--text-muted)',
                            border: '1px solid var(--border)',
                          }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {/* Raison */}
          <Field label="Raison" required>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
                      placeholder="Triche détectée, comportement toxique, ..." rows={2}
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
          </Field>

          {/* Templates */}
          {templates.length > 0 && (
            <Field label="Quick templates">
              <div className="flex gap-2 flex-wrap">
                {templates.slice(0, 8).map(t => (
                  <button key={t.id} onClick={() => {
                    setType(t.type); setSeverity(t.severity); setCategory(t.category);
                    setReason(t.reason); setDurationMs(t.durationMs);
                  }}
                          className="px-2.5 py-1 rounded text-xs"
                          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {/* Optional */}
          <details className="text-sm">
            <summary className="cursor-pointer" style={{ color: 'var(--text-muted)' }}>Options avancées</summary>
            <div className="mt-2 space-y-2">
              <Field label="URL de preuve (screenshot, vidéo)">
                <input value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)}
                       placeholder="https://imgur.com/..."
                       className="w-full px-3 py-2 rounded text-sm"
                       style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
              </Field>
              <Field label="Notes internes (visible staff uniquement)">
                <input value={notes} onChange={e => setNotes(e.target.value)}
                       className="w-full px-3 py-2 rounded text-sm"
                       style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
              </Field>
              <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text)' }}>
                <input type="checkbox" checked={silent} onChange={e => setSilent(e.target.checked)}/>
                Silencieux (ne pas broadcaster aux joueurs en jeu)
              </label>
            </div>
          </details>

          {error && (
            <div className="p-3 rounded text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded text-sm"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              Annuler
            </button>
            <button onClick={submit} disabled={submitting}
                    className="flex-1 py-2 rounded font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
              {submitting ? '⏳ Application...' : `⚖️ Sanctionner ${target || '…'}`}
            </button>
          </div>
        </div>

        {/* Live preview — Minecraft-like disconnect screen */}
        <div className="w-96 p-6"
             style={{ background: 'rgba(0,0,0,0.4)', borderLeft: '1px solid var(--border)' }}>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            🖥 Aperçu écran joueur
          </div>
          <div className="rounded-lg p-4 font-mono text-xs leading-relaxed"
               style={{
                 background: 'linear-gradient(180deg, rgba(20,20,20,0.95) 0%, rgba(40,40,40,0.95) 100%)',
                 border: '2px solid #555',
                 minHeight: 300,
                 color: '#ddd',
                 whiteSpace: 'pre-wrap',
                 wordBreak: 'break-word',
               }}>
            <McText raw={preview}/>
          </div>
          <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            Aperçu en temps réel — changements instantanés selon les options
          </div>
        </div>
      </div>
    </div>
  )
}

// Rendu Minecraft du texte avec codes § (couleurs + styles)
const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
}

function McText({ raw }: { raw: string }) {
  if (!raw) return <span style={{ color: '#888' }}>(en attente...)</span>
  const parts: { text: string; color: string; bold: boolean; underline: boolean; italic: boolean }[] = []
  let cur = { text: '', color: '#FFFFFF', bold: false, underline: false, italic: false }
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '§' && i + 1 < raw.length) {
      const code = raw[i + 1].toLowerCase()
      if (cur.text) parts.push({ ...cur })
      cur = { ...cur, text: '' }
      if (MC_COLORS[code]) { cur.color = MC_COLORS[code]; cur.bold = false; cur.underline = false; cur.italic = false }
      else if (code === 'l') cur.bold = true
      else if (code === 'n') cur.underline = true
      else if (code === 'o') cur.italic = true
      else if (code === 'r') { cur.color = '#FFFFFF'; cur.bold = false; cur.underline = false; cur.italic = false }
      i++
    } else {
      cur.text += c
    }
  }
  if (cur.text) parts.push({ ...cur })
  return <>{parts.map((p, i) => (
    <span key={i} style={{
      color: p.color,
      fontWeight: p.bold ? 'bold' : 'normal',
      textDecoration: p.underline ? 'underline' : 'none',
      fontStyle: p.italic ? 'italic' : 'normal',
    }}>{p.text}</span>
  ))}</>
}

// ── Helpers UI ─────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: any }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Loading() {
  return <div className="p-12 text-center" style={{ color: 'var(--text-muted)' }}>
    <div className="text-3xl animate-pulse">☀️</div>
    Chargement…
  </div>
}

function Kpi({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        {icon} {label}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}
