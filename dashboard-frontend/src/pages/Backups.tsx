import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

type Backup = { filename: string; size: number; created: number }
type WorldBackups = { world: string; sizeMb: number; backups: Backup[] }

const fmtSize = (b: number) => b < 1048576 ? `${(b/1024).toFixed(1)} KB` : b < 1073741824 ? `${(b/1048576).toFixed(1)} MB` : `${(b/1073741824).toFixed(2)} GB`
const fmtAge = (ts: number) => {
  const ms = Date.now() - ts
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (d > 0) return `il y a ${d}j`
  if (h > 0) return `il y a ${h}h`
  if (m > 0) return `il y a ${m}min`
  return "à l'instant"
}
const fmtDate = (ts: number) => new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function BackupsPage() {
  const [data, setData] = useState<WorldBackups[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const isAdmin = useAuthStore(s => s.isAdmin())

  const load = () => api.backupsList().then(d => { setData(d); setLoading(false) })
  useEffect(() => { load() }, [])

  const create = async (world: string) => {
    if (!confirm(`Créer un backup du monde "${world}" ?\n\nLe serveur va save-all puis zipper le dossier — cela peut prendre plusieurs minutes pour les gros mondes.`)) return
    setBusy(world); setMsg(null)
    try {
      const res = await api.backupCreate(world)
      setMsg({ type: 'ok', text: `✓ Backup créé : ${res.filename} (${fmtSize(res.size)})` })
      load()
    } catch (e: any) {
      setMsg({ type: 'err', text: 'Erreur: ' + e.message })
    } finally { setBusy(null) }
  }

  const del = async (world: string, filename: string) => {
    if (!confirm(`Supprimer ${filename} ? Cette action est irréversible.`)) return
    try { await api.backupDelete(world, filename); load() }
    catch (e: any) { setMsg({ type: 'err', text: 'Erreur: ' + e.message }) }
  }

  const total = data.reduce((s, w) => s + w.backups.reduce((a, b) => a + b.size, 0), 0)
  const totalCount = data.reduce((s, w) => s + w.backups.length, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><span>💾</span> Backups</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {data.length} mondes — {totalCount} backups — {fmtSize(total)} au total
          </p>
        </div>
      </div>

      {msg && (
        <div className="card" style={{
          background: msg.type === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          borderColor: msg.type === 'ok' ? '#10B981' : '#EF4444',
          color: msg.type === 'ok' ? '#10B981' : '#EF4444',
        }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
      ) : (
        <div className="space-y-6">
          {data.map(w => (
            <div key={w.world} className="card">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="text-xl font-semibold flex items-center gap-2">
                    <span>🌍</span> {w.world}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Taille live : {w.sizeMb} MB • {w.backups.length} backup{w.backups.length > 1 ? 's' : ''}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => create(w.world)}
                    disabled={busy === w.world}
                    className="btn-primary text-sm"
                  >
                    {busy === w.world ? '⏳ Backup en cours...' : '+ Nouveau backup'}
                  </button>
                )}
              </div>

              {w.backups.length === 0 ? (
                <div className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>
                  Aucun backup pour ce monde.
                </div>
              ) : (
                <div className="space-y-1">
                  {w.backups.map(b => (
                    <div
                      key={b.filename}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">📦</span>
                        <div className="min-w-0">
                          <div className="font-mono text-sm truncate">{b.filename}</div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {fmtDate(b.created)} • {fmtAge(b.created)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-medium">{fmtSize(b.size)}</span>
                        {isAdmin && (
                          <button
                            onClick={() => del(w.world, b.filename)}
                            className="btn-ghost text-xs hover:!border-red-500 hover:!text-red-500"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card text-xs" style={{ color: 'var(--text-muted)' }}>
        💡 Les backups sont stockés dans <code>plugins/SunAntiCheat/dashboard/backups/&lt;monde&gt;/</code>.
        La restauration d'un backup nécessite d'arrêter le serveur manuellement puis de dézipper le fichier par-dessus le dossier du monde.
      </div>
    </div>
  )
}
