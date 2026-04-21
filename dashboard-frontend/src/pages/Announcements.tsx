import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

/**
 * Éditeur d'annonces : preview live, A/B testing, planification, ciblage.
 * UX : wizard en 4 étapes + live preview du rendu in-game.
 */

const TEMPLATES: { name: string; icon: string; content: string; hover: string; click: string }[] = [
  {
    name: 'Promo Shop',
    icon: '🛒',
    content: '&6&l[EVENT] &e-50% sur tous les items aujourd\'hui ! &7(cliquez)',
    hover: '&fCliquez pour ouvrir le shop\n&7Offre valable 24h',
    click: 'shop',
  },
  {
    name: 'Discord',
    icon: '💬',
    content: '&9&l▶ &bRejoignez notre Discord pour rester informé !',
    hover: '&fCliquez pour copier le lien',
    click: '',
  },
  {
    name: 'Vote',
    icon: '🗳️',
    content: '&a&l[VOTE] &fSoutenez le serveur et obtenez des récompenses !',
    hover: '&fVotez sur les listes',
    click: 'vote',
  },
  {
    name: 'Nouveau',
    icon: '✨',
    content: '&d&l✨ NOUVEAU ! &fVenez découvrir nos nouvelles features.',
    hover: '',
    click: '',
  },
]

function blankVariant(name = 'Variante A') {
  return {
    id: crypto.randomUUID(),
    name,
    content: '&6&l[INFO] &fTexte de l\'annonce',
    hoverText: '',
    clickCommand: '',
    clickUrl: '',
    weight: 100,
    sentCount: 0,
    clickCount: 0,
  }
}

function blankAnnouncement() {
  return {
    name: 'Nouvelle annonce',
    description: '',
    enabled: false,
    scheduleType: 'INTERVAL',
    startAt: Date.now(),
    endAt: 0,
    intervalMinutes: 30,
    times: [] as string[],
    targetAll: true,
    targetWorlds: [] as string[],
    targetRanks: [] as string[],
    excludeRanks: [] as string[],
    variants: [blankVariant('Variante unique')],
    lastSentAt: 0,
    createdAt: Date.now(),
  }
}

export default function Announcements() {
  const { canEdit, isAdmin } = usePermission()
  const [list, setList] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [flash, setFlash] = useState<string | null>(null)
  const [groups, setGroups] = useState<any[]>([])
  const [worlds, setWorlds] = useState<string[]>([])

  const refresh = async () => {
    try {
      setList(await api.annList())
      setStats(await api.annStats())
      try {
        const lpStatus = await api.lpStatus()
        if (lpStatus.available) setGroups(await api.lpGroups())
      } catch {}
      try {
        const w = await api.worlds()
        setWorlds(w.map((x: any) => x.name))
      } catch {}
    } catch {}
  }

  useEffect(() => { refresh(); const t = setInterval(refresh, 10000); return () => clearInterval(t) }, [])

  const showFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 3500) }

  const save = async () => {
    if (!editing) return
    try {
      if (editing.id) await api.annUpdate(editing.id, editing)
      else await api.annCreate(editing)
      setEditing(null); setStep(1)
      showFlash('✓ Annonce enregistrée')
      refresh()
    } catch (e: any) { showFlash('✗ ' + e.message) }
  }

  const del = async (id: string) => {
    if (!confirm('Supprimer cette annonce ?')) return
    try { await api.annDelete(id); showFlash('✓ Supprimée'); refresh() }
    catch (e: any) { showFlash('✗ ' + e.message) }
  }

  const testSend = async (id: string) => {
    try { await api.annTestSend(id); showFlash('✓ Envoyée en test') }
    catch (e: any) { showFlash('✗ ' + e.message) }
  }

  const toggle = async (ann: any) => {
    try {
      await api.annUpdate(ann.id, { ...ann, enabled: !ann.enabled })
      showFlash(`✓ ${ann.enabled ? 'Désactivée' : 'Activée'}`)
      refresh()
    } catch (e: any) { showFlash('✗ ' + e.message) }
  }

  return (
    <div className="p-6 space-y-6">
      {flash && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-2 rounded-lg font-medium"
             style={{ background: flash.startsWith('✓') ? '#10b981' : '#ef4444', color: 'white' }}>
          {flash}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>📢 Annonces</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Envoie des messages personnalisés et cliquables aux joueurs
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(blankAnnouncement()); setStep(1) }}
                  className="px-4 py-2 rounded-lg text-white font-medium"
                  style={{ background: 'var(--primary)' }}>
            + Nouvelle annonce
          </button>
        )}
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Annonces" value={stats.totalAnnouncements || 0} color="#60a5fa"/>
          <Kpi label="Messages envoyés" value={stats.totalSent || 0} color="#34d399"/>
          <Kpi label="Clics" value={stats.totalClicks || 0} color="#f59e0b"/>
          <Kpi label="Taux de clic" value={`${(stats.clickRate || 0).toFixed(1)}%`} color="#a78bfa"/>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {list.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
          <div className="text-6xl mb-4">📢</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Aucune annonce pour le moment</h2>
          <p className="max-w-md mx-auto mb-6" style={{ color: 'var(--text-muted)' }}>
            Crée ta première annonce pour informer les joueurs des events, promos et news du serveur.
          </p>
          {canEdit && (
            <button onClick={() => { setEditing(blankAnnouncement()); setStep(1) }}
                    className="px-6 py-3 rounded-lg text-white font-medium"
                    style={{ background: 'var(--primary)' }}>
              🎉 Créer ma première annonce
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(a => (
            <AnnouncementCard key={a.id} ann={a}
                              onEdit={() => { setEditing({ ...a }); setStep(1) }}
                              onDelete={() => del(a.id)}
                              onTest={() => testSend(a.id)}
                              onToggle={() => toggle(a)}
                              groups={groups}
                              canEdit={canEdit} isAdmin={isAdmin}/>
          ))}
        </div>
      )}

      {/* ── Wizard d'édition ──────────────────────────────────────────────── */}
      {editing && (
        <Wizard
          ann={editing}
          setAnn={setEditing}
          step={step}
          setStep={setStep}
          templates={TEMPLATES}
          groups={groups}
          worlds={worlds}
          onSave={save}
          onClose={() => { setEditing(null); setStep(1) }}
        />
      )}
    </div>
  )
}

// ── Card annonce ─────────────────────────────────────────────────────────────
function AnnouncementCard({ ann, onEdit, onDelete, onTest, onToggle, groups, canEdit, isAdmin }: any) {
  const totalSent = (ann.variants || []).reduce((s: number, v: any) => s + (v.sentCount || 0), 0)
  const totalClicks = (ann.variants || []).reduce((s: number, v: any) => s + (v.clickCount || 0), 0)
  const ctr = totalSent > 0 ? (totalClicks / totalSent * 100).toFixed(1) : '0.0'

  const scheduleLabel = () => {
    if (ann.scheduleType === 'ONCE') return `📅 Une fois · ${new Date(ann.startAt).toLocaleString('fr-FR')}`
    if (ann.scheduleType === 'INTERVAL') return `🔁 Toutes les ${ann.intervalMinutes} min`
    if (ann.scheduleType === 'TIMES') return `⏰ À heures fixes : ${ann.times.join(', ')}`
    return ann.scheduleType
  }

  return (
    <div className="rounded-xl p-5"
         style={{
           background: 'var(--surface)',
           border: `1px solid ${ann.enabled ? 'var(--primary)' : 'var(--border)'}`,
         }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${ann.enabled ? 'animate-pulse' : ''}`}
                 style={{ background: ann.enabled ? '#10b981' : '#6b7280' }}/>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{ann.name}</h3>
            {ann.variants?.length > 1 && (
              <span className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
                A/B ({ann.variants.length} variantes)
              </span>
            )}
            {!ann.targetAll && (
              <span className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
                🎯 Ciblé
              </span>
            )}
          </div>

          {ann.description && (
            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{ann.description}</p>
          )}

          {/* Preview message */}
          {ann.variants?.[0] && (
            <div className="mt-2 p-3 rounded-lg font-mono text-sm"
                 style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div dangerouslySetInnerHTML={{ __html: renderMcMessage(ann.variants[0].content) }}/>
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{scheduleLabel()}</span>
            <span>📬 {totalSent} envois</span>
            <span>👆 {totalClicks} clics</span>
            <span>📊 CTR {ctr}%</span>
            {ann.lastSentAt > 0 && <span>⏱ dernier envoi il y a {timeAgo(ann.lastSentAt)}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          {canEdit && (
            <>
              <button onClick={onToggle}
                      className="text-xs px-3 py-1.5 rounded font-medium"
                      style={{
                        background: ann.enabled ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                        color: ann.enabled ? '#ef4444' : '#10b981',
                      }}>
                {ann.enabled ? '⏸ Pause' : '▶ Activer'}
              </button>
              <button onClick={onTest}
                      title="Envoyer maintenant (test)"
                      className="text-xs px-3 py-1.5 rounded hover:bg-white/10"
                      style={{ color: 'var(--text-muted)' }}>
                🚀 Test
              </button>
              <button onClick={onEdit}
                      className="text-xs px-3 py-1.5 rounded hover:bg-white/10"
                      style={{ color: 'var(--text-muted)' }}>
                ✏️ Éditer
              </button>
            </>
          )}
          {isAdmin && (
            <button onClick={onDelete}
                    className="text-xs px-3 py-1.5 rounded text-red-400 hover:bg-red-500/10">
              🗑 Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Wizard d'édition ───────────────────────────────────────────────────────
function Wizard({ ann, setAnn, step, setStep, templates, groups, worlds, onSave, onClose }: any) {
  const steps = [
    { n: 1, label: 'Contenu', icon: '✏️' },
    { n: 2, label: 'Apparence', icon: '🎨' },
    { n: 3, label: 'Planification', icon: '⏰' },
    { n: 4, label: 'Ciblage', icon: '🎯' },
  ]

  const canNext = () => {
    if (step === 1) return ann.name && ann.variants?.[0]?.content
    return true
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex" onClick={onClose}>
      <div className="ml-auto w-[900px] h-full overflow-y-auto"
           style={{ background: 'var(--surface)' }}
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4"
             style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                {ann.id ? 'Modifier' : 'Créer'} une annonce
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ann.name}</p>
            </div>
            <button onClick={onClose}
                    className="text-2xl leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 mt-4">
            {steps.map((s, i) => (
              <div key={s.n} className="flex-1 flex items-center gap-2">
                <button onClick={() => setStep(s.n)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition"
                        style={{
                          background: step === s.n ? 'var(--primary)' :
                                     step > s.n ? 'rgba(16,185,129,0.2)' : 'var(--surface-2)',
                          color: step === s.n ? 'white' :
                                 step > s.n ? '#10b981' : 'var(--text-muted)',
                        }}>
                  <span>{step > s.n ? '✓' : s.icon}</span>
                  <span>{s.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }}/>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {step === 1 && <StepContent ann={ann} setAnn={setAnn} templates={templates}/>}
          {step === 2 && <StepAppearance ann={ann} setAnn={setAnn}/>}
          {step === 3 && <StepSchedule ann={ann} setAnn={setAnn}/>}
          {step === 4 && <StepTargeting ann={ann} setAnn={setAnn} groups={groups} worlds={worlds}/>}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-4 flex items-center justify-between"
             style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose}
                  className="px-4 py-2 rounded"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            Annuler
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)}
                      className="px-4 py-2 rounded"
                      style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                ← Précédent
              </button>
            )}
            {step < 4 ? (
              <button onClick={() => setStep(step + 1)}
                      disabled={!canNext()}
                      className="px-4 py-2 rounded text-white font-medium"
                      style={{ background: 'var(--primary)', opacity: canNext() ? 1 : 0.5 }}>
                Suivant →
              </button>
            ) : (
              <button onClick={onSave}
                      className="px-6 py-2 rounded text-white font-medium"
                      style={{ background: '#10b981' }}>
                ✓ Enregistrer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 1 : Contenu ─────────────────────────────────────────────────────────
function StepContent({ ann, setAnn, templates }: any) {
  const addVariant = () => {
    const name = `Variante ${String.fromCharCode(65 + (ann.variants?.length || 0))}`
    setAnn({ ...ann, variants: [...(ann.variants || []), blankVariant(name)] })
  }

  const applyTemplate = (t: any) => {
    const variants = [...(ann.variants || [blankVariant()])]
    variants[0] = { ...variants[0], content: t.content, hoverText: t.hover, clickCommand: t.click }
    setAnn({ ...ann, variants })
  }

  return (
    <>
      <Field label="Nom interne (pour toi)">
        <input value={ann.name} onChange={e => setAnn({ ...ann, name: e.target.value })}
               placeholder="Promo Shop Halloween"
               style={inputStyle} className="w-full px-4 py-3 rounded-lg"/>
      </Field>

      <Field label="Description (optionnel)">
        <input value={ann.description || ''} onChange={e => setAnn({ ...ann, description: e.target.value })}
               placeholder="À quoi sert cette annonce ?"
               style={inputStyle} className="w-full px-3 py-2 rounded"/>
      </Field>

      {/* Templates */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
          🚀 Templates rapides (optionnel)
        </label>
        <div className="grid grid-cols-4 gap-2">
          {templates.map((t: any) => (
            <button key={t.name} onClick={() => applyTemplate(t)}
                    className="p-3 rounded-lg text-center transition hover:scale-105"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>{t.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Variantes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            📝 Messages {ann.variants?.length > 1 && `(A/B Test — ${ann.variants.length} variantes)`}
          </label>
          {(ann.variants?.length || 0) < 4 && (
            <button onClick={addVariant}
                    className="text-xs px-3 py-1.5 rounded"
                    style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
              + Variante A/B
            </button>
          )}
        </div>

        <div className="space-y-3">
          {(ann.variants || []).map((v: any, i: number) => (
            <VariantEditor key={v.id} variant={v}
                           onChange={(updated: any) => {
                             const variants = [...ann.variants]
                             variants[i] = updated
                             setAnn({ ...ann, variants })
                           }}
                           onDelete={ann.variants.length > 1 ? () => {
                             setAnn({ ...ann, variants: ann.variants.filter((_: any, j: number) => j !== i) })
                           } : null}/>
          ))}
        </div>
      </div>
    </>
  )
}

function VariantEditor({ variant, onChange, onDelete }: any) {
  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <input value={variant.name} onChange={e => onChange({ ...variant, name: e.target.value })}
               style={{ ...inputStyle, fontWeight: 'bold' }} className="px-2 py-1 rounded"/>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Poids</span>
          <input type="number" min={1} max={100} value={variant.weight}
                 onChange={e => onChange({ ...variant, weight: +e.target.value })}
                 style={inputStyle} className="w-16 px-2 py-1 rounded text-sm"/>
          {onDelete && (
            <button onClick={onDelete}
                    className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">🗑</button>
          )}
        </div>
      </div>

      {/* Éditeur contenu */}
      <ColorPicker value={variant.content}
                   onChange={(v: string) => onChange({ ...variant, content: v })}
                   placeholder="&6Votre message ici..."
                   rows={2}/>

      {/* Preview */}
      <div className="p-3 rounded font-mono text-sm"
           style={{ background: '#1a1a1a', border: '1px solid var(--border)', color: 'white' }}>
        <div dangerouslySetInnerHTML={{ __html: renderMcMessage(variant.content || '(vide)') }}/>
        {variant.hoverText && (
          <div className="mt-2 text-xs opacity-60">
            💭 Hover : <span dangerouslySetInnerHTML={{ __html: renderMcMessage(variant.hoverText) }}/>
          </div>
        )}
        {variant.clickCommand && (
          <div className="mt-1 text-xs opacity-60">
            👆 Clic : <code>/{variant.clickCommand}</code>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="💭 Texte au survol (optionnel)">
          <input value={variant.hoverText || ''}
                 onChange={e => onChange({ ...variant, hoverText: e.target.value })}
                 placeholder="&7Cliquez pour ouvrir..."
                 style={inputStyle} className="w-full px-3 py-2 rounded text-sm font-mono"/>
        </Field>
        <Field label="👆 Commande au clic (optionnel)">
          <input value={variant.clickCommand || ''}
                 onChange={e => onChange({ ...variant, clickCommand: e.target.value })}
                 placeholder="shop"
                 style={inputStyle} className="w-full px-3 py-2 rounded text-sm font-mono"/>
        </Field>
      </div>

      {/* Stats variant */}
      {(variant.sentCount > 0 || variant.clickCount > 0) && (
        <div className="flex gap-4 pt-2 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <span>📬 {variant.sentCount} envois</span>
          <span>👆 {variant.clickCount} clics</span>
          <span>📊 CTR {variant.sentCount > 0 ? (variant.clickCount / variant.sentCount * 100).toFixed(1) : '0.0'}%</span>
        </div>
      )}
    </div>
  )
}

// ── Step 2 : Apparence ──────────────────────────────────────────────────────
function StepAppearance({ ann, setAnn }: any) {
  return (
    <>
      <div className="p-4 rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
        <div className="flex items-start gap-3">
          <div className="text-2xl">🎨</div>
          <div className="text-sm" style={{ color: 'var(--text)' }}>
            Utilise les codes <b>&amp;</b> pour formater ton message. Exemples :
            <div className="grid grid-cols-4 gap-2 mt-2 font-mono text-xs">
              <code>&amp;a = vert</code>
              <code>&amp;c = rouge</code>
              <code>&amp;6 = or</code>
              <code>&amp;b = cyan</code>
              <code>&amp;l = gras</code>
              <code>&amp;o = italique</code>
              <code>&amp;n = souligné</code>
              <code>&amp;k = obfusqué</code>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>💬 Preview en jeu</h3>
        <div className="space-y-2">
          {(ann.variants || []).map((v: any) => (
            <div key={v.id} className="p-4 rounded-lg font-mono text-sm"
                 style={{ background: '#1e1e1e', border: '1px solid var(--border)' }}>
              <div className="text-xs mb-2 opacity-60" style={{ color: 'white' }}>
                🎮 Aperçu — {v.name}
              </div>
              <div dangerouslySetInnerHTML={{ __html: renderMcMessage(v.content) }} style={{ color: 'white' }}/>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Step 3 : Planification ──────────────────────────────────────────────────
function StepSchedule({ ann, setAnn }: any) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <ScheduleOption selected={ann.scheduleType === 'ONCE'}
                        onClick={() => setAnn({ ...ann, scheduleType: 'ONCE' })}
                        icon="📅" title="Une seule fois" desc="À une date précise"/>
        <ScheduleOption selected={ann.scheduleType === 'INTERVAL'}
                        onClick={() => setAnn({ ...ann, scheduleType: 'INTERVAL' })}
                        icon="🔁" title="Toutes les N minutes" desc="En boucle"/>
        <ScheduleOption selected={ann.scheduleType === 'TIMES'}
                        onClick={() => setAnn({ ...ann, scheduleType: 'TIMES' })}
                        icon="⏰" title="À heures fixes" desc="Ex : 12h, 18h"/>
      </div>

      {ann.scheduleType === 'ONCE' && (
        <Field label="Date d'envoi">
          <input type="datetime-local" value={toLocalDT(ann.startAt)}
                 onChange={e => setAnn({ ...ann, startAt: new Date(e.target.value).getTime() })}
                 style={inputStyle} className="w-full px-3 py-2 rounded"/>
        </Field>
      )}

      {ann.scheduleType === 'INTERVAL' && (
        <div className="space-y-3">
          <Field label="Intervalle (minutes)">
            <div className="flex gap-2">
              {[5, 15, 30, 60, 120].map(m => (
                <button key={m} onClick={() => setAnn({ ...ann, intervalMinutes: m })}
                        className="flex-1 py-2 rounded font-medium text-sm"
                        style={{
                          background: ann.intervalMinutes === m ? 'var(--primary)' : 'var(--surface-2)',
                          color: ann.intervalMinutes === m ? 'white' : 'var(--text-muted)',
                        }}>
                  {m} min
                </button>
              ))}
              <input type="number" min={1} value={ann.intervalMinutes}
                     onChange={e => setAnn({ ...ann, intervalMinutes: +e.target.value })}
                     className="w-24 px-3 py-2 rounded" style={inputStyle}/>
            </div>
          </Field>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            ⓘ L'annonce sera envoyée toutes les <b>{ann.intervalMinutes} minutes</b>.
          </p>
        </div>
      )}

      {ann.scheduleType === 'TIMES' && (
        <Field label="Heures d'envoi (format HH:MM)">
          <TimesList value={ann.times || []} onChange={(v: string[]) => setAnn({ ...ann, times: v })}/>
        </Field>
      )}

      <Field label="Date de fin (optionnel)" hint="Laisse vide pour infini">
        <div className="flex gap-2 items-center">
          <input type="datetime-local"
                 value={ann.endAt ? toLocalDT(ann.endAt) : ''}
                 onChange={e => setAnn({ ...ann, endAt: e.target.value ? new Date(e.target.value).getTime() : 0 })}
                 style={inputStyle} className="flex-1 px-3 py-2 rounded"/>
          {ann.endAt > 0 && (
            <button onClick={() => setAnn({ ...ann, endAt: 0 })}
                    className="text-xs px-3 py-2 rounded"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              Infini
            </button>
          )}
        </div>
      </Field>

      <div className="flex items-center gap-3">
        <Toggle checked={ann.enabled} onChange={(v: boolean) => setAnn({ ...ann, enabled: v })}/>
        <span style={{ color: 'var(--text)' }}>
          {ann.enabled ? '🟢 Active — sera envoyée automatiquement' : '⏸ Inactive — pas d\'envoi automatique'}
        </span>
      </div>
    </>
  )
}

function TimesList({ value, onChange }: any) {
  const add = () => onChange([...value, '12:00'])
  const update = (i: number, v: string) => onChange(value.map((t: string, j: number) => j === i ? v : t))
  const remove = (i: number) => onChange(value.filter((_: any, j: number) => j !== i))

  return (
    <div className="space-y-2">
      {value.map((t: string, i: number) => (
        <div key={i} className="flex gap-2">
          <input type="time" value={t} onChange={e => update(i, e.target.value)}
                 style={inputStyle} className="flex-1 px-3 py-2 rounded"/>
          <button onClick={() => remove(i)}
                  className="px-3 py-2 rounded text-red-400 hover:bg-red-500/10">×</button>
        </div>
      ))}
      <button onClick={add}
              className="w-full py-2 rounded text-sm"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
        + Ajouter une heure
      </button>
      {value.length === 0 && (
        <div className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
          Aucune heure définie — ajoute au moins une heure (ex: 12:00)
        </div>
      )}
    </div>
  )
}

function ScheduleOption({ selected, onClick, icon, title, desc }: any) {
  return (
    <button onClick={onClick}
            className="p-4 rounded-lg text-left transition"
            style={{
              background: selected ? 'rgba(59,130,246,0.15)' : 'var(--surface-2)',
              border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
            }}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-bold mb-1" style={{ color: 'var(--text)' }}>{title}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</div>
    </button>
  )
}

// ── Step 4 : Ciblage ────────────────────────────────────────────────────────
function StepTargeting({ ann, setAnn, groups, worlds }: any) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <ScheduleOption selected={ann.targetAll}
                        onClick={() => setAnn({ ...ann, targetAll: true })}
                        icon="🌍" title="Tous les joueurs" desc="Aucun filtre"/>
        <ScheduleOption selected={!ann.targetAll}
                        onClick={() => setAnn({ ...ann, targetAll: false })}
                        icon="🎯" title="Joueurs ciblés" desc="Par monde ou rang"/>
      </div>

      {!ann.targetAll && (
        <>
          <Field label="🌍 Mondes (laisse vide = tous)">
            <MultiSelect
              options={worlds}
              selected={ann.targetWorlds || []}
              onChange={(v: string[]) => setAnn({ ...ann, targetWorlds: v })}
              placeholder="Aucun monde sélectionné → tous"
            />
          </Field>

          <Field label="🎖️ Rangs LuckPerms inclus (laisse vide = tous)">
            <MultiSelect
              options={groups.map((g: any) => g.name)}
              selected={ann.targetRanks || []}
              onChange={(v: string[]) => setAnn({ ...ann, targetRanks: v })}
              placeholder="Aucun rang → tous"
              colored
              colorMap={Object.fromEntries(groups.map((g: any) => [g.name, g.color]))}
            />
          </Field>

          <Field label="❌ Rangs exclus" hint="Les joueurs avec ces rangs ne recevront PAS l'annonce">
            <MultiSelect
              options={groups.map((g: any) => g.name)}
              selected={ann.excludeRanks || []}
              onChange={(v: string[]) => setAnn({ ...ann, excludeRanks: v })}
              placeholder="Aucun rang exclu"
              colored
              colorMap={Object.fromEntries(groups.map((g: any) => [g.name, g.color]))}
            />
          </Field>
        </>
      )}
    </>
  )
}

function MultiSelect({ options, selected, onChange, placeholder, colored, colorMap }: any) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((s: string) => s !== opt))
    else onChange([...selected, opt])
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded"
           style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {selected.length === 0 && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{placeholder}</span>}
        {selected.map((s: string) => (
          <span key={s} className="px-2 py-1 rounded text-xs flex items-center gap-1"
                style={{
                  background: colored && colorMap?.[s] || 'var(--primary)',
                  color: 'white',
                }}>
            {s}
            <button onClick={() => toggle(s)}>×</button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {options.filter((o: string) => !selected.includes(o)).map((o: string) => (
          <button key={o} onClick={() => toggle(o)}
                  className="px-2 py-1 rounded text-xs"
                  style={{
                    background: colored && colorMap?.[o] || 'var(--surface-2)',
                    color: colored && colorMap?.[o] ? 'white' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}>
            + {o}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Color picker intuitif ────────────────────────────────────────────────────
function ColorPicker({ value, onChange, placeholder, rows = 1 }: any) {
  const codes = [
    { code: '0', color: '#000' }, { code: '1', color: '#0000AA' }, { code: '2', color: '#00AA00' },
    { code: '3', color: '#00AAAA' }, { code: '4', color: '#AA0000' }, { code: '5', color: '#AA00AA' },
    { code: '6', color: '#FFAA00' }, { code: '7', color: '#AAAAAA' }, { code: '8', color: '#555555' },
    { code: '9', color: '#5555FF' }, { code: 'a', color: '#55FF55' }, { code: 'b', color: '#55FFFF' },
    { code: 'c', color: '#FF5555' }, { code: 'd', color: '#FF55FF' }, { code: 'e', color: '#FFFF55' },
    { code: 'f', color: '#FFFFFF' },
  ]
  const formats = [{ code: 'l', label: 'Gras' }, { code: 'o', label: 'Italic' }, { code: 'n', label: 'Soulig.' }, { code: 'r', label: 'Reset' }]

  const insert = (code: string) => onChange((value || '') + '&' + code)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {codes.map(c => (
          <button key={c.code} onClick={() => insert(c.code)}
                  title={`&${c.code}`}
                  className="w-6 h-6 rounded border border-white/20"
                  style={{ background: c.color }}/>
        ))}
        <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }}/>
        {formats.map(f => (
          <button key={f.code} onClick={() => insert(f.code)}
                  className="px-2 py-0.5 rounded text-xs"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            {f.label}
          </button>
        ))}
      </div>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)}
                placeholder={placeholder} rows={rows}
                style={inputStyle} className="w-full px-3 py-2 rounded font-mono text-sm"/>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, color }: any) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-3xl font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  )
}

function Field({ label, hint, children }: any) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>{label}</label>
      {children}
      {hint && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  )
}

function Toggle({ checked, onChange }: any) {
  return (
    <button onClick={() => onChange(!checked)}
            className="relative w-10 h-6 rounded-full transition"
            style={{ background: checked ? 'var(--primary)' : 'var(--surface-2)' }}>
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
           style={{ left: checked ? '1.125rem' : '0.125rem' }}/>
    </button>
  )
}

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
} as const

const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
}

function renderMcMessage(text: string): string {
  if (!text) return ''
  const input = text.replace(/§/g, '&')
  let out = ''
  let i = 0
  let color = '#FFFFFF'
  let bold = false, italic = false, underline = false
  while (i < input.length) {
    const c = input[i]
    if (c === '&' && i + 1 < input.length) {
      const code = input[i + 1].toLowerCase()
      if (MC_COLORS[code]) { color = MC_COLORS[code]; bold = italic = underline = false }
      else if (code === 'l') bold = true
      else if (code === 'o') italic = true
      else if (code === 'n') underline = true
      else if (code === 'r') { color = '#FFFFFF'; bold = italic = underline = false }
      i += 2
      continue
    }
    if (c === '\n') { out += '<br/>'; i++; continue }
    const style = `color:${color};${bold ? 'font-weight:bold;' : ''}${italic ? 'font-style:italic;' : ''}${underline ? 'text-decoration:underline;' : ''}`
    out += `<span style="${style}">${escapeHtml(c)}</span>`
    i++
  }
  return out
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function toLocalDT(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function timeAgo(ts: number) {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}min`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}j`
}
