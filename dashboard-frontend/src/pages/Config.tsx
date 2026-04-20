import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

type Section = 'security' | 'commands'

export default function Config() {
  const [config, setConfig]   = useState<any>(null)
  const [section, setSection] = useState<Section>('security')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [newCmd, setNewCmd]   = useState('')
  const isAdmin = useAuthStore(s => s.isAdmin())

  useEffect(() => {
    api.securityConfig().then(setConfig).catch(() => {})
  }, [])

  async function save() {
    if (!config) return
    setSaving(true)
    try {
      await api.updateSecurityConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) { alert('Erreur: ' + e.message) }
    finally { setSaving(false) }
  }

  function addCmd() {
    if (!newCmd.trim()) return
    setConfig((c: any) => ({ ...c, allowedCommands: [...(c.allowedCommands ?? []), newCmd.trim()] }))
    setNewCmd('')
  }

  function removeCmd(cmd: string) {
    setConfig((c: any) => ({ ...c, allowedCommands: (c.allowedCommands ?? []).filter((x: string) => x !== cmd) }))
  }

  function setBool(key: string, val: boolean) {
    setConfig((c: any) => ({ ...c, [key]: val }))
  }

  function setNum(key: string, val: string) {
    setConfig((c: any) => ({ ...c, [key]: parseInt(val) || 0 }))
  }

  if (!config) return <div className="p-6 text-muted">Chargement...</div>

  if (!isAdmin) return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Configuration</h1>
      <div className="card text-center py-12 text-muted">
        Accès réservé aux administrateurs.
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <button className="btn-primary px-6" onClick={save} disabled={saving}>
          {saved ? '✓ Sauvegardé' : saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Nav */}
      <div className="flex gap-2 border-b border-border pb-3">
        {(['security', 'commands'] as Section[]).map(s => (
          <button key={s} onClick={() => setSection(s)}
            className={s === section ? 'btn-primary px-4 py-1.5 text-sm' : 'btn-ghost px-4 py-1.5 text-sm'}>
            {s === 'security' ? '🛡️ Sécurité' : '💻 Commandes autorisées'}
          </button>
        ))}
      </div>

      {section === 'security' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-sm mb-4">Anticheat général</h3>
            <div className="space-y-3">
              {[
                { key: 'alertsEnabled',   label: 'Alertes anticheat activées' },
                { key: 'autoKickEnabled', label: 'Kick automatique au seuil d\'alertes' },
                { key: 'logToConsole',    label: 'Journaliser dans la console' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0 cursor-pointer">
                  <span className="text-sm">{label}</span>
                  <input type="checkbox" className="accent-primary w-4 h-4"
                    checked={config[key] ?? false}
                    onChange={e => setBool(key, e.target.checked)} />
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-sm mb-4">Seuils et limites</h3>
            <div className="space-y-3">
              {[
                { key: 'alertKickThreshold', label: 'Nombre d\'alertes avant kick auto', min: 1, max: 100 },
                { key: 'maxViolationsStored', label: 'Violations stockées par joueur', min: 10, max: 1000 },
              ].map(({ key, label, min, max }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <label className="text-sm">{label}</label>
                  <input type="number" min={min} max={max}
                    className="input w-24 text-right"
                    value={config[key] ?? ''}
                    onChange={e => setNum(key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-sm mb-4">WeaponMechanics</h3>
            <div className="space-y-3">
              {[
                { key: 'wmScanEnabled',       label: 'Scan de coffres activé' },
                { key: 'wmDeleteOnFind',       label: 'Supprimer les items trouvés' },
                { key: 'wmScanPlayerInv',      label: 'Scanner les inventaires joueurs' },
                { key: 'wmScanEntityContainers', label: 'Scanner les conteneurs entités (minecarts, bateaux)' },
                { key: 'wmScanItemFrames',     label: 'Scanner les cadres d\'item' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0 cursor-pointer">
                  <span className="text-sm">{label}</span>
                  <input type="checkbox" className="accent-primary w-4 h-4"
                    checked={config[key] ?? false}
                    onChange={e => setBool(key, e.target.checked)} />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'commands' && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-1">Commandes autorisées via le dashboard</h3>
          <p className="text-xs text-muted mb-4">Les commandes sont filtrées par préfixe. Ex: "ban " autorise "ban Player".</p>

          <div className="flex gap-2 mb-4">
            <input className="input flex-1" value={newCmd} onChange={e => setNewCmd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCmd()}
              placeholder="Ajouter une commande..." />
            <button className="btn-primary px-4" onClick={addCmd}>Ajouter</button>
          </div>

          <div className="space-y-2">
            {(config.allowedCommands ?? []).length === 0 && (
              <p className="text-muted text-sm text-center py-4">Aucune commande autorisée</p>
            )}
            {(config.allowedCommands ?? []).map((cmd: string) => (
              <div key={cmd} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface border border-border">
                <code className="text-sm font-mono text-slate-300">{cmd}</code>
                <button className="text-danger hover:text-danger/80 text-sm transition-colors"
                  onClick={() => removeCmd(cmd)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
