import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

const MATERIALS = [
  'DEEPSLATE_DIAMOND_ORE', 'DIAMOND_ORE', 'DEEPSLATE_GOLD_ORE',
  'DEEPSLATE_EMERALD_ORE', 'ANCIENT_DEBRIS', 'DIAMOND_BLOCK',
  'GOLD_BLOCK', 'EMERALD_BLOCK', 'NETHERITE_BLOCK', 'CHEST',
]

function solidFacesLabel(n: number) {
  if (n >= 6) return { text: 'CERTAIN',       color: '#dc2626' }
  if (n >= 5) return { text: 'QUASI-CERTAIN', color: '#ef4444' }
  if (n >= 4) return { text: 'TRÈS SUSPECT',  color: '#f97316' }
  return           { text: 'SUSPECT',         color: '#f59e0b' }
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Honeypot() {
  const { isAdmin } = usePermission()
  const [traps, setTraps] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [form, setForm] = useState({
    label: '', world: 'world', x: 0, y: -40, z: 0,
    material: 'DEEPSLATE_DIAMOND_ORE', place: true,
  })

  const refresh = async () => {
    setTraps(await api.honeypotTraps())
    setAlerts(await api.honeypotAlerts(50))
  }
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 10000)
    return () => clearInterval(t)
  }, [])

  const create = async () => {
    if (!form.label) { alert('Label requis'); return }
    await api.honeypotCreate(form)
    setForm({ ...form, label: '' })
    refresh()
  }
  const del = async (id: string) => {
    if (!confirm('Supprimer ce piège ?')) return
    await api.honeypotDelete(id)
    refresh()
  }

  const autoCount  = traps.filter(t => t.autoPlaced).length
  const manualCount = traps.filter(t => !t.autoPlaced).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🍯 Honeypot (anti X-Ray)</h1>
        <span className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ background: '#10b98120', color: '#10b981' }}>
          {autoCount} auto
        </span>
        <span className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          {manualCount} manuel
        </span>
      </div>

      {/* Légende */}
      <div className="rounded-xl p-4 text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Niveau de certitude (faces solides au moment du cassage)</div>
        <div className="flex flex-wrap gap-3">
          {[
            { n: 6, label: '6/6 — Impossible en vanilla', color: '#dc2626' },
            { n: 5, label: '5/6 — Beeline direct',        color: '#ef4444' },
            { n: 4, label: '4/6 — 2 blocs creusés',       color: '#f97316' },
            { n: 3, label: '≤3/6 — Tunnel possible',      color: '#f59e0b' },
          ].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }}/>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Formulaire création manuelle */}
      {isAdmin && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Nouveau piège manuel</h2>
          <div className="grid grid-cols-6 gap-2">
            <input placeholder="Label" value={form.label}
                   onChange={e => setForm({ ...form, label: e.target.value })}
                   className="col-span-2 px-3 py-2 rounded" style={inputStyle}/>
            <input placeholder="Monde" value={form.world}
                   onChange={e => setForm({ ...form, world: e.target.value })}
                   className="px-3 py-2 rounded" style={inputStyle}/>
            <input type="number" placeholder="X" value={form.x}
                   onChange={e => setForm({ ...form, x: +e.target.value })}
                   className="px-3 py-2 rounded" style={inputStyle}/>
            <input type="number" placeholder="Y" value={form.y}
                   onChange={e => setForm({ ...form, y: +e.target.value })}
                   className="px-3 py-2 rounded" style={inputStyle}/>
            <input type="number" placeholder="Z" value={form.z}
                   onChange={e => setForm({ ...form, z: +e.target.value })}
                   className="px-3 py-2 rounded" style={inputStyle}/>
            <select value={form.material}
                    onChange={e => setForm({ ...form, material: e.target.value })}
                    className="col-span-2 px-3 py-2 rounded" style={inputStyle}>
              {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={form.place}
                     onChange={e => setForm({ ...form, place: e.target.checked })}/>
              Placer le bloc
            </label>
            <button onClick={create}
                    className="col-span-3 px-3 py-2 rounded text-white font-medium"
                    style={{ background: 'var(--primary)' }}>
              + Créer piège
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Liste des pièges */}
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
            Pièges actifs ({traps.length})
          </h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {traps.map(t => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded"
                   style={{ background: 'var(--surface-2)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate" style={{ color: 'var(--text)' }}>{t.label}</span>
                    {t.autoPlaced && (
                      <span className="shrink-0 text-xs px-1.5 py-0.5 rounded font-bold"
                            style={{ background: '#10b98120', color: '#10b981' }}>AUTO</span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t.world} @ {t.x},{t.y},{t.z} · {t.material} · 🔔 {t.triggerCount}
                  </div>
                </div>
                {isAdmin && !t.autoPlaced && (
                  <button onClick={() => del(t.id)}
                          className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10 shrink-0">
                    Supprimer
                  </button>
                )}
              </div>
            ))}
            {traps.length === 0 && (
              <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                Aucun piège — les pièges auto apparaissent à l'exploration des nouveaux chunks
              </div>
            )}
          </div>
        </div>

        {/* Déclenchements récents */}
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
            Déclenchements récents ({alerts.length})
          </h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {alerts.map((a, i) => {
              const lvl = solidFacesLabel(a.solidFaces ?? 0)
              return (
                <div key={i} className="p-3 rounded text-sm"
                     style={{ background: 'var(--surface-2)', borderLeft: `3px solid ${lvl.color}` }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold" style={{ color: lvl.color }}>
                      ⚠ {a.player}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                          style={{ background: lvl.color + '20', color: lvl.color }}>
                      {lvl.text}
                    </span>
                  </div>
                  <div className="text-xs mt-1 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    <span>{a.label} @ {a.world} ({a.x},{a.y},{a.z})</span>
                    <span className="font-mono">{a.solidFaces ?? '?'}/6 faces</span>
                    {a.autoPlaced && (
                      <span className="px-1 rounded text-xs"
                            style={{ background: '#10b98115', color: '#10b981' }}>auto</span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {fmtDate(a.timestamp)}
                  </div>
                </div>
              )
            })}
            {alerts.length === 0 && (
              <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                Aucune alerte
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}
