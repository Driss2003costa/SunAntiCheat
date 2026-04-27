import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'
import ConfirmModal from '../components/ConfirmModal'

export default function Worlds() {
  const [worlds, setWorlds]       = useState<any[]>([])
  const [loading, setLoading]     = useState(false)
  const [toggling, setToggling]   = useState<string | null>(null)
  const [scanning, setScanning]   = useState<string | null>(null)
  const [confirm, setConfirm]     = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<any | null>(null)
  const scanPollRef                 = useRef<ReturnType<typeof setInterval> | null>(null)
  const isAdmin = useAuthStore(s => s.isAdmin())

  const load = useCallback(async () => {
    setLoading(true)
    try { setWorlds(await api.worlds()) } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [load])

  // Poll le statut du scan jusqu'à ce qu'il soit terminé
  const startScanPoll = () => {
    if (scanPollRef.current) clearInterval(scanPollRef.current)
    scanPollRef.current = setInterval(async () => {
      try {
        const status = await api.chestscanStatus()
        if (!status.running && status.lastResult) {
          clearInterval(scanPollRef.current!)
          scanPollRef.current = null
          setScanResult(status.lastResult)
          setScanning(null)
        }
      } catch {}
    }, 2000)
  }

  useEffect(() => () => { if (scanPollRef.current) clearInterval(scanPollRef.current) }, [])

  const togglePvp = async (world: string) => {
    setToggling(world)
    try {
      const res = await api.togglePvp(world)
      setWorlds(ws => ws.map(w => w.name === world ? { ...w, pvp: res.pvp } : w))
    } catch (e: any) { alert('Erreur: ' + e.message) }
    finally { setToggling(null) }
  }

  const scan = async (world: string) => {
    setScanning(world)
    setConfirm(null)
    setScanResult(null)
    try {
      const res = await api.startChestScan(world)
      if (res.started) startScanPoll()
      else { setScanning(null); alert('Un scan est déjà en cours.') }
    } catch (e: any) { setScanning(null); alert('Erreur: ' + (e as any).message) }
  }

  const envIcon = (env: string) =>
    env === 'NETHER' ? '🔥' : env === 'THE_END' ? '🌑' : '🌍'

  const envColor = (env: string) =>
    env === 'NETHER' ? '#ef4444' : env === 'THE_END' ? '#8B5CF6' : '#10b981'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🌍 Mondes</h1>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {worlds.length} monde{worlds.length > 1 ? 's' : ''} chargé{worlds.length > 1 ? 's' : ''}
          {loading && ' · Actualisation...'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {worlds.map(w => {
          const pct = w.players / Math.max(1, worlds.reduce((a: number, x: any) => a + x.players, 0))
          return (
            <div key={w.name} className="rounded-xl overflow-hidden"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

              {/* Header bande colorée */}
              <div className="h-1.5" style={{ background: envColor(w.environment) }}/>

              <div className="p-5 space-y-4">
                {/* Titre */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{envIcon(w.environment)}</span>
                    <div>
                      <div className="font-bold" style={{ color: 'var(--text)' }}>{w.name}</div>
                      <div className="text-xs" style={{ color: envColor(w.environment) }}>{w.environment}</div>
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full"
                       style={{ background: `${envColor(w.environment)}15`, color: envColor(w.environment) }}>
                    {w.difficulty}
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Joueurs */}
                  <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Joueurs</div>
                    <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>👥 {w.players}</div>
                  </div>

                  {/* Chunks */}
                  <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Chunks chargés</div>
                    <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>📦 {w.loadedChunks.toLocaleString()}</div>
                  </div>

                  {/* Seed */}
                  <div className="col-span-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Seed : </span>
                    <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>{w.seed}</span>
                  </div>
                </div>

                {/* PvP toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg"
                     style={{ background: 'var(--surface-2)', border: `1px solid ${w.pvp ? '#ef444430' : 'var(--border)'}` }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>⚔️ PvP</div>
                    <div className="text-xs" style={{ color: w.pvp ? '#ef4444' : 'var(--text-muted)' }}>
                      {w.pvp ? 'Activé — les joueurs peuvent se blesser' : 'Désactivé — combat sécurisé'}
                    </div>
                  </div>
                  {isAdmin ? (
                    <button
                      onClick={() => togglePvp(w.name)}
                      disabled={toggling === w.name}
                      className="relative inline-flex items-center h-6 w-11 rounded-full transition-colors disabled:opacity-50 shrink-0"
                      style={{ background: w.pvp ? '#ef4444' : 'var(--border)' }}>
                      <span className="inline-block w-4 h-4 rounded-full bg-white transition-transform"
                            style={{ transform: w.pvp ? 'translateX(24px)' : 'translateX(4px)' }}/>
                    </button>
                  ) : (
                    <span className="text-sm">{w.pvp ? '✅' : '❌'}</span>
                  )}
                </div>

                {/* Actions */}
                {isAdmin && (
                  <button
                    onClick={() => setConfirm(w.name)}
                    disabled={scanning === w.name}
                    className="w-full py-2 rounded-lg text-sm font-medium transition hover:bg-white/5"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {scanning === w.name ? '⏳ Scan en cours...' : '🔍 Scanner les coffres'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirm scan */}
      {confirm && (
        <ConfirmModal
          title={`Scanner ${confirm} ?`}
          message="Cela va scanner tous les conteneurs du monde et supprimer les items WeaponMechanics détectés."
          danger
          onConfirm={() => scan(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Banner scan en cours */}
      {scanning && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
               style={{ borderColor: 'var(--primary)' }}/>
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>Scan en cours sur {scanning}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Les résultats apparaîtront automatiquement</div>
          </div>
        </div>
      )}

      {/* Popup résultats */}
      {scanResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
             onClick={() => setScanResult(null)}>
          <div className="rounded-xl w-[700px] max-h-[90vh] overflow-y-auto"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
               onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between p-5"
                 style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {scanResult.weaponItemsRemoved > 0 ? '🚨' : '✅'} Résultat du scan — {scanResult.worlds}
                </h2>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Terminé à {new Date(scanResult.finishedAt).toLocaleTimeString('fr-FR')} · durée {scanResult.durationMs}ms
                </div>
              </div>
              <button onClick={() => setScanResult(null)}
                      className="text-xl hover:opacity-70" style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            {/* Stats */}
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Chunks', value: scanResult.chunksScanned, icon: '📦' },
                { label: 'Conteneurs', value: scanResult.containersScanned, icon: '🗃️' },
                { label: 'Items supprimés', value: scanResult.weaponItemsRemoved, icon: '🗑️', alert: scanResult.weaponItemsRemoved > 0 },
                { label: 'Détections', value: scanResult.containersWithDetections, icon: '🎯', alert: scanResult.containersWithDetections > 0 },
                { label: 'Entités', value: scanResult.entityContainersScanned, icon: '🚂' },
                { label: 'Item Frames', value: scanResult.itemFramesScanned, icon: '🖼️' },
                { label: 'Enderchests', value: scanResult.enderChestsScanned, icon: '📮' },
                { label: 'Inv. joueurs', value: scanResult.playerInvsScanned, icon: '🎒' },
              ].map(s => (
                <div key={s.label} className="rounded-lg p-3 text-center"
                     style={{ background: s.alert ? 'rgba(239,68,68,0.1)' : 'var(--surface-2)', border: `1px solid ${s.alert ? '#ef444440' : 'var(--border)'}` }}>
                  <div className="text-xl">{s.icon}</div>
                  <div className="text-lg font-bold mt-1" style={{ color: s.alert ? '#ef4444' : 'var(--text)' }}>{s.value}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Suspect */}
            <div className="px-5 pb-3">
              <div className="rounded-lg px-4 py-3 flex items-center gap-3"
                   style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span>🕵️</span>
                <div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Suspect principal (blocklog)</div>
                  <div className="font-semibold" style={{ color: 'var(--text)' }}>{scanResult.topSuspect}</div>
                </div>
              </div>
            </div>

            {/* Détections */}
            {scanResult.detections?.length > 0 && (
              <div className="px-5 pb-5">
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                  📍 Emplacements détectés ({scanResult.detections.length})
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {scanResult.detections.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg"
                         style={{ background: 'var(--surface-2)' }}>
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          {d.enderChest ? `🎒 ${d.playerName}` : `📦 ${d.world}`}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {d.enderChest ? '' : `Suspect: ${d.suspect} · `}
                          {d.removed} item(s) supprimé(s)
                        </div>
                      </div>
                      <code className="text-xs px-2 py-1 rounded"
                            style={{ background: 'var(--bg)', color: 'var(--primary)' }}>
                        /tp @s {d.x} {d.y} {d.z}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scanResult.weaponItemsRemoved === 0 && (
              <div className="px-5 pb-5 text-center text-sm" style={{ color: '#10b981' }}>
                ✅ Aucune arme WeaponMechanics trouvée dans ce monde.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
