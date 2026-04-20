import { useEffect, useState, useMemo } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

type Plugin = {
  name: string; version: string; authors: string[]; description: string
  website: string | null; apiVersion: string | null; enabled: boolean
  depend: string[]; softDepend: string[]; dataFolder: string | null; commands: string[]
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const isAdmin = useAuthStore(s => s.isAdmin())

  const load = async () => { try { setPlugins(await api.pluginsList()) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return plugins.filter(p => {
      if (filter === 'enabled'  && !p.enabled) return false
      if (filter === 'disabled' &&  p.enabled) return false
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [plugins, q, filter])

  const stats = useMemo(() => ({
    total: plugins.length,
    enabled: plugins.filter(p => p.enabled).length,
    disabled: plugins.filter(p => !p.enabled).length,
  }), [plugins])

  const action = async (name: string, fn: () => Promise<any>) => {
    setBusy(name)
    try { await fn(); await load() }
    catch (e: any) { alert('Erreur: ' + e.message) }
    finally { setBusy(null) }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span>🧩</span> Plugins
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {stats.total} plugins — <span style={{ color: '#10B981' }}>{stats.enabled} actifs</span> — {stats.disabled} désactivés
          </p>
        </div>
      </div>

      <div className="card flex flex-wrap gap-3 items-center">
        <input
          className="input flex-1 min-w-[200px]"
          placeholder="Rechercher un plugin..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className="flex gap-1" style={{ background: 'var(--surface-2)', padding: '3px', borderRadius: '8px' }}>
          {(['all', 'enabled', 'disabled'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1 rounded text-sm transition"
              style={{
                background: filter === f ? 'var(--primary)' : 'transparent',
                color: filter === f ? 'white' : 'var(--text-muted)',
              }}
            >
              {f === 'all' ? 'Tous' : f === 'enabled' ? 'Actifs' : 'Désactivés'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(p => (
            <div key={p.name} className="card relative overflow-hidden" style={{ opacity: p.enabled ? 1 : 0.7 }}>
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: p.enabled ? '#10B981' : '#64748b' }}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-lg truncate">{p.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      v{p.version}
                    </span>
                    {p.apiVersion && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                        API {p.apiVersion}
                      </span>
                    )}
                  </div>
                  {p.authors?.length > 0 && (
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      par {p.authors.join(', ')}
                    </div>
                  )}
                  {p.description && (
                    <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{p.description}</div>
                  )}
                </div>
                <div
                  className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: p.enabled ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.2)',
                    color: p.enabled ? '#10B981' : '#94a3b8',
                  }}
                >
                  {p.enabled ? '● ACTIF' : '○ OFF'}
                </div>
              </div>

              {(p.depend?.length > 0 || p.softDepend?.length > 0 || p.commands?.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
                  {p.depend?.map(d => (
                    <span key={d} className="px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                      req: {d}
                    </span>
                  ))}
                  {p.softDepend?.map(d => (
                    <span key={d} className="px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>
                      opt: {d}
                    </span>
                  ))}
                  {p.commands?.slice(0, 5).map(c => (
                    <span key={c} className="px-1.5 py-0.5 rounded font-mono"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      /{c}
                    </span>
                  ))}
                </div>
              )}

              {isAdmin && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  <button
                    className="btn-ghost text-xs"
                    disabled={busy === p.name}
                    onClick={() => action(p.name, () => api.togglePlugin(p.name))}
                  >
                    {p.enabled ? '⏸ Désactiver' : '▶ Activer'}
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    disabled={busy === p.name || !p.enabled}
                    onClick={() => action(p.name, () => api.reloadPlugin(p.name))}
                  >
                    🔄 Reload
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    disabled={busy === p.name || !p.enabled}
                    onClick={() => action(p.name, () => api.reloadPluginCfg(p.name))}
                  >
                    📄 reloadConfig()
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
