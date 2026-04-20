import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

const MATERIALS = ['DIAMOND_BLOCK', 'GOLD_BLOCK', 'EMERALD_BLOCK', 'NETHERITE_BLOCK', 'ANCIENT_DEBRIS', 'CHEST']

export default function Honeypot() {
  const { isAdmin } = usePermission()
  const [traps, setTraps] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [form, setForm] = useState({ label: '', world: 'world', x: 0, y: 64, z: 0, material: 'DIAMOND_BLOCK', place: true })

  const refresh = async () => {
    setTraps(await api.honeypotTraps())
    setAlerts(await api.honeypotAlerts(50))
  }
  useEffect(() => { refresh(); const t = setInterval(refresh, 10000); return () => clearInterval(t) }, [])

  const create = async () => {
    if (!form.label) { alert('Label requis'); return }
    await api.honeypotCreate(form)
    setForm({ ...form, label: '' })
    refresh()
  }
  const del = async (id: string) => { if (!confirm('Supprimer ?')) return; await api.honeypotDelete(id); refresh() }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🍯 Honeypot (anti X-Ray)</h1>

      {isAdmin && <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Nouveau piège</h2>
        <div className="grid grid-cols-6 gap-2">
          <input placeholder="Label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                 className="col-span-2 px-3 py-2 rounded" style={inputStyle}/>
          <input placeholder="Monde" value={form.world} onChange={e => setForm({ ...form, world: e.target.value })}
                 className="px-3 py-2 rounded" style={inputStyle}/>
          <input type="number" placeholder="X" value={form.x} onChange={e => setForm({ ...form, x: +e.target.value })}
                 className="px-3 py-2 rounded" style={inputStyle}/>
          <input type="number" placeholder="Y" value={form.y} onChange={e => setForm({ ...form, y: +e.target.value })}
                 className="px-3 py-2 rounded" style={inputStyle}/>
          <input type="number" placeholder="Z" value={form.z} onChange={e => setForm({ ...form, z: +e.target.value })}
                 className="px-3 py-2 rounded" style={inputStyle}/>
          <select value={form.material} onChange={e => setForm({ ...form, material: e.target.value })}
                  className="col-span-2 px-3 py-2 rounded" style={inputStyle}>
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={form.place} onChange={e => setForm({ ...form, place: e.target.checked })}/>
            Placer automatiquement
          </label>
          <button onClick={create} className="col-span-3 px-3 py-2 rounded text-white font-medium"
                  style={{ background: 'var(--primary)' }}>+ Créer piège</button>
        </div>
      </div>}

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Pièges ({traps.length})</h2>
          <div className="space-y-2">
            {traps.map(t => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded"
                   style={{ background: 'var(--surface-2)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text)' }}>{t.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t.world} @ {t.x},{t.y},{t.z} · {t.material} · 🔔 {t.triggerCount}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => del(t.id)} className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">
                    Supprimer
                  </button>
                )}
              </div>
            ))}
            {traps.length === 0 && <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun piège</div>}
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Déclenchements récents</h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {alerts.map((a, i) => (
              <div key={i} className="p-2 rounded text-sm" style={{ background: 'var(--surface-2)' }}>
                <div style={{ color: '#ef4444' }} className="font-semibold">⚠ {a.player}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {a.trapLabel} @ {a.world} · {new Date(a.timestamp).toLocaleString('fr-FR')}
                </div>
              </div>
            ))}
            {alerts.length === 0 && <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucune alerte</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)',
}
