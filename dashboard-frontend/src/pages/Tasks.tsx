import { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

type Task = {
  id: string
  name: string
  command: string
  times: string[]
  enabled: boolean
  color: string
  icon: string
  lastRun: number
  createdAt: number
}

const PALETTE = ['#7C3AED', '#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#F97316']
const ICONS = ['⚡', '🔥', '💎', '🛡️', '💾', '📢', '🎯', '🌙', '☀️', '🔁', '🧹', '🎉', '⚠️', '🏰', '🛒', '🎁']

// ─── Utils ──────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')
const hmToMinutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}
const minutesToHm = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`
const fmtDate = (ts: number) =>
  ts ? new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [now, setNow] = useState(new Date())
  const isAdmin = useAuthStore(s => s.isAdmin())

  const load = useCallback(async () => {
    try { setTasks(await api.tasksList()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  // Stats
  const totalRuns = useMemo(() => tasks.filter(t => t.enabled).reduce((s, t) => s + t.times.length, 0), [tasks])
  const nextTask = useMemo(() => {
    let best: { task: Task; time: string; mins: number } | null = null
    for (const t of tasks) {
      if (!t.enabled) continue
      for (const time of t.times) {
        const mins = hmToMinutes(time)
        const delta = mins >= nowMinutes ? mins - nowMinutes : mins + 1440 - nowMinutes
        if (!best || delta < (best.mins >= nowMinutes ? best.mins - nowMinutes : best.mins + 1440 - nowMinutes)) {
          best = { task: t, time, mins }
        }
      }
    }
    return best
  }, [tasks, nowMinutes])

  const handleSave = async (data: Partial<Task>) => {
    if (editing) await api.updateTask(editing.id, data)
    else await api.createTask(data)
    setEditing(null); setCreating(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette tâche planifiée ?')) return
    await api.deleteTask(id)
    load()
  }

  const handleToggle = async (t: Task) => {
    await api.updateTask(t.id, { enabled: !t.enabled })
    load()
  }

  const handleRun = async (id: string) => {
    await api.runTask(id)
    load()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="text-4xl">⏰</span>
            Tâches planifiées
          </h1>
          <p className="text-muted mt-1">Orchestrez des commandes console à des heures précises de la journée</p>
        </div>
        {isAdmin && (
          <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2">
            <span className="text-lg">+</span> Nouvelle tâche
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Tâches actives" value={tasks.filter(t => t.enabled).length} total={tasks.length} color="#7C3AED" icon="⚡" />
        <StatCard label="Exécutions/jour" value={totalRuns} color="#10B981" icon="🔁" />
        <StatCard
          label="Prochaine exécution"
          value={nextTask ? nextTask.time : '—'}
          subtitle={nextTask ? nextTask.task.name : 'Aucune'}
          color="#F59E0B"
          icon="🕐"
        />
        <StatCard label="Heure serveur" value={`${pad(now.getHours())}:${pad(now.getMinutes())}`} color="#3B82F6" icon="🌐" />
      </div>

      {/* Timeline 24h */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Vue linéaire — 24h</h2>
          <div className="text-xs text-muted">Chaque marqueur = une exécution programmée</div>
        </div>
        <Timeline tasks={tasks} nowMinutes={nowMinutes} />
      </div>

      {/* Cartes des tâches */}
      {loading ? (
        <div className="text-muted text-center py-12">Chargement...</div>
      ) : tasks.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} canCreate={isAdmin} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              isAdmin={isAdmin}
              onEdit={() => setEditing(t)}
              onDelete={() => handleDelete(t.id)}
              onToggle={() => handleToggle(t)}
              onRun={() => handleRun(t.id)}
            />
          ))}
        </div>
      )}

      {(editing || creating) && (
        <TaskModal
          task={editing}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// ─── StatCard ───────────────────────────────────────────────────────────────
function StatCard({ label, value, subtitle, total, color, icon }: {
  label: string; value: any; subtitle?: string; total?: number; color: string; icon: string
}) {
  return (
    <div className="card relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-24 h-24 opacity-10 blur-2xl rounded-full"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between relative">
        <div>
          <div className="text-xs text-muted uppercase tracking-wider">{label}</div>
          <div className="text-3xl font-bold text-white mt-1" style={{ color }}>
            {value}
            {total !== undefined && <span className="text-muted text-lg font-normal">/{total}</span>}
          </div>
          {subtitle && <div className="text-sm text-slate-400 mt-1 truncate max-w-[150px]">{subtitle}</div>}
        </div>
        <div className="text-3xl opacity-60">{icon}</div>
      </div>
    </div>
  )
}

// ─── Timeline ───────────────────────────────────────────────────────────────
function Timeline({ tasks, nowMinutes }: { tasks: Task[]; nowMinutes: number }) {
  const nowPct = (nowMinutes / 1440) * 100
  const activeTasks = tasks.filter(t => t.enabled)

  return (
    <div className="space-y-3">
      {/* Ligne graduée des heures */}
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-5 h-0.5 bg-border" />
        {Array.from({ length: 25 }, (_, i) => (
          <div
            key={i}
            className="absolute top-3 flex flex-col items-center"
            style={{ left: `${(i / 24) * 100}%`, transform: 'translateX(-50%)' }}
          >
            <div className={`h-2 w-px ${i % 6 === 0 ? 'bg-slate-400' : 'bg-border'}`} />
            {i % 3 === 0 && (
              <div className="text-[10px] text-muted mt-1 font-mono">{pad(i)}:00</div>
            )}
          </div>
        ))}
      </div>

      {/* Ligne "maintenant" */}
      <div className="relative h-0">
        <div
          className="absolute -top-8 h-[calc(100%+48px)] w-0.5 bg-primary shadow-[0_0_10px_#7C3AED] z-10 pointer-events-none"
          style={{ left: `${nowPct}%` }}
        >
          <div className="absolute -top-5 -translate-x-1/2 px-1.5 py-0.5 bg-primary text-white text-[10px] rounded font-bold whitespace-nowrap">
            NOW
          </div>
        </div>
      </div>

      {/* Rails par tâche */}
      <div className="space-y-2">
        {activeTasks.length === 0 ? (
          <div className="text-center text-muted text-sm py-6">Aucune tâche active à afficher</div>
        ) : activeTasks.map(t => (
          <div key={t.id} className="relative h-10 group">
            {/* Background rail */}
            <div
              className="absolute inset-0 rounded-lg border transition-all"
              style={{
                borderColor: t.color + '40',
                background: `linear-gradient(90deg, ${t.color}08, ${t.color}15, ${t.color}08)`,
              }}
            />
            {/* Label gauche */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-2 z-[2] bg-surface/80 backdrop-blur-sm px-2 py-0.5 rounded text-xs">
              <span>{t.icon}</span>
              <span className="text-slate-200 font-medium truncate max-w-[100px]">{t.name}</span>
            </div>
            {/* Marqueurs */}
            {t.times.map(time => {
              const pct = (hmToMinutes(time) / 1440) * 100
              return (
                <div
                  key={time}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-[3]"
                  style={{ left: `${pct}%` }}
                  title={`${t.name} — ${time}`}
                >
                  <div
                    className="w-3 h-3 rounded-full border-2 border-surface shadow-lg transition-transform hover:scale-150 cursor-pointer"
                    style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TaskCard ───────────────────────────────────────────────────────────────
function TaskCard({ task, isAdmin, onEdit, onDelete, onToggle, onRun }: {
  task: Task; isAdmin: boolean
  onEdit: () => void; onDelete: () => void; onToggle: () => void; onRun: () => void
}) {
  return (
    <div
      className="card relative overflow-hidden transition-all hover:border-primary/50"
      style={{ borderColor: task.enabled ? task.color + '40' : undefined }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: task.color, opacity: task.enabled ? 1 : 0.3 }}
      />
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: task.color }}
      />

      <div className="flex items-start justify-between gap-2 relative">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="text-2xl w-12 h-12 flex items-center justify-center rounded-xl shrink-0"
            style={{ background: task.color + '20', border: `1px solid ${task.color}40` }}
          >
            {task.icon}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-white truncate">{task.name}</div>
            <div className="text-xs text-muted font-mono truncate">{task.command || '—'}</div>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={onToggle}
            className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${task.enabled ? 'bg-primary' : 'bg-border'}`}
            aria-label="Activer/désactiver"
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${task.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        )}
      </div>

      {/* Heures */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {task.times.length === 0 ? (
          <span className="text-xs text-muted italic">Aucune heure</span>
        ) : task.times.map(time => (
          <span
            key={time}
            className="px-2 py-1 rounded-md text-xs font-mono font-medium"
            style={{ background: task.color + '20', color: task.color, border: `1px solid ${task.color}40` }}
          >
            {time}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
        <span>Dernière exéc : <span className="text-slate-300">{fmtDate(task.lastRun)}</span></span>
        <span>{task.times.length}×/j</span>
      </div>

      {isAdmin && (
        <div className="mt-3 flex gap-2">
          <button onClick={onRun} className="btn-ghost text-xs flex-1">▶ Lancer</button>
          <button onClick={onEdit} className="btn-ghost text-xs flex-1">✎ Éditer</button>
          <button onClick={onDelete} className="btn-ghost text-xs hover:!border-danger hover:!text-danger">🗑</button>
        </div>
      )}
    </div>
  )
}

// ─── EmptyState ─────────────────────────────────────────────────────────────
function EmptyState({ onCreate, canCreate }: { onCreate: () => void; canCreate: boolean }) {
  return (
    <div className="card text-center py-16">
      <div className="text-6xl mb-4">⏰</div>
      <div className="text-white font-semibold text-lg mb-1">Aucune tâche planifiée</div>
      <p className="text-muted text-sm mb-5">Créez votre première tâche pour automatiser des commandes à heures fixes</p>
      {canCreate && (
        <button onClick={onCreate} className="btn-primary">+ Créer une tâche</button>
      )}
    </div>
  )
}

// ─── Modal ──────────────────────────────────────────────────────────────────
function TaskModal({ task, onClose, onSave }: {
  task: Task | null
  onClose: () => void
  onSave: (data: Partial<Task>) => Promise<void>
}) {
  const [name, setName] = useState(task?.name ?? '')
  const [command, setCommand] = useState(task?.command ?? '')
  const [times, setTimes] = useState<string[]>(task?.times ?? ['12:00'])
  const [enabled, setEnabled] = useState(task?.enabled ?? true)
  const [color, setColor] = useState(task?.color ?? PALETTE[0])
  const [icon, setIcon] = useState(task?.icon ?? '⚡')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addTime = () => setTimes([...times, '12:00'])
  const rmTime = (i: number) => setTimes(times.filter((_, idx) => idx !== i))
  const setTime = (i: number, v: string) => {
    const copy = [...times]; copy[i] = v; setTimes(copy)
  }

  const shiftTime = (i: number, deltaMin: number) => {
    const m = Math.max(0, Math.min(1439, hmToMinutes(times[i]) + deltaMin))
    setTime(i, minutesToHm(m))
  }

  const save = async () => {
    if (!name.trim()) { setError('Nom obligatoire'); return }
    if (!command.trim()) { setError('Commande obligatoire'); return }
    setSaving(true); setError('')
    try {
      await onSave({ name: name.trim(), command: command.trim(), times, enabled, color, icon })
    } catch (e: any) {
      setError(e.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header avec gradient */}
        <div
          className="p-5 border-b border-border relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${color}20, transparent)` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="text-3xl w-14 h-14 flex items-center justify-center rounded-xl"
              style={{ background: color + '30', border: `1px solid ${color}60` }}
            >
              {icon}
            </div>
            <div>
              <div className="text-xl font-bold text-white">{task ? 'Éditer la tâche' : 'Nouvelle tâche planifiée'}</div>
              <div className="text-xs text-muted">{times.length} exécution{times.length > 1 ? 's' : ''} par jour</div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Nom + commande */}
          <div>
            <label className="text-xs text-muted uppercase tracking-wider">Nom</label>
            <input className="input mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Annonce serveur du soir" />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wider">Commande console</label>
            <input
              className="input mt-1 font-mono"
              value={command}
              onChange={e => setCommand(e.target.value)}
              placeholder="broadcast Bonne soirée !"
            />
            <div className="text-[11px] text-muted mt-1">Sans le <code className="text-slate-300">/</code> initial (optionnel). Exécutée comme la console.</div>
          </div>

          {/* Horaires */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted uppercase tracking-wider">Horaires d'exécution</label>
              <button onClick={addTime} className="text-xs text-primary hover:underline">+ Ajouter un horaire</button>
            </div>
            <div className="space-y-2">
              {times.map((t, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-bg border border-border">
                  <button onClick={() => shiftTime(i, -60)} className="px-2 py-1 rounded hover:bg-border text-slate-400" title="-1h">‹‹</button>
                  <button onClick={() => shiftTime(i, -5)} className="px-2 py-1 rounded hover:bg-border text-slate-400" title="-5min">‹</button>
                  <input
                    type="time"
                    value={t}
                    onChange={e => setTime(i, e.target.value)}
                    className="input flex-1 text-center font-mono text-lg !py-1"
                  />
                  <button onClick={() => shiftTime(i, 5)} className="px-2 py-1 rounded hover:bg-border text-slate-400" title="+5min">›</button>
                  <button onClick={() => shiftTime(i, 60)} className="px-2 py-1 rounded hover:bg-border text-slate-400" title="+1h">››</button>
                  {times.length > 1 && (
                    <button onClick={() => rmTime(i)} className="px-2 py-1 rounded hover:bg-red-900/40 text-danger">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preview mini-timeline */}
          <div>
            <label className="text-xs text-muted uppercase tracking-wider">Aperçu sur 24h</label>
            <div className="mt-2 relative h-8 rounded-lg border border-border overflow-hidden"
                 style={{ background: `linear-gradient(90deg, ${color}08, ${color}15, ${color}08)` }}>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="absolute top-0 bottom-0 w-px bg-border/50" style={{ left: `${(i / 4) * 100}%` }} />
              ))}
              {times.map((t, i) => (
                <div key={i} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                     style={{ left: `${(hmToMinutes(t) / 1440) * 100}%` }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted mt-1 font-mono">
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
            </div>
          </div>

          {/* Couleur + Icon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wider">Couleur</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wider">Icône</label>
              <div className="mt-2 flex flex-wrap gap-1">
                {ICONS.map(i => (
                  <button
                    key={i}
                    onClick={() => setIcon(i)}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors ${icon === i ? 'bg-primary/30 ring-2 ring-primary' : 'bg-bg border border-border hover:border-primary'}`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Enabled */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-bg border border-border">
            <div>
              <div className="text-sm text-slate-200 font-medium">Tâche active</div>
              <div className="text-xs text-muted">Si désactivée, les exécutions programmées sont ignorées</div>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-border'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {error && <div className="text-danger text-sm">{error}</div>}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? 'Enregistrement...' : (task ? 'Mettre à jour' : 'Créer')}
          </button>
        </div>
      </div>
    </div>
  )
}
