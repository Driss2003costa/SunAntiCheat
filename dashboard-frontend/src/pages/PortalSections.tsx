import { useEffect, useState } from 'react'
import { api } from '../api/client'

type Section = {
  key: string
  label: string
  description: string
  icon: string
  enabled: boolean
}

export default function PortalSections() {
  const [sections, setSections] = useState<Section[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const data = await api.portalSectionsList()
      setSections(data.sections)
    } catch (e: any) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [])

  const toggle = async (section: Section) => {
    setSaving(section.key)
    setError('')
    try {
      await api.portalSectionsUpdate({ [section.key]: !section.enabled })
      setSections(prev => prev.map(s => s.key === section.key ? { ...s, enabled: !s.enabled } : s))
      setSaved(section.key)
      setTimeout(() => setSaved(null), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(null)
    }
  }

  const enabledCount = sections.filter(s => s.enabled).length

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            🌐 Sections du portail joueur
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Activez ou désactivez les sections visibles sur le portail public.
            Les joueurs verront une page « Bientôt disponible » pour les sections désactivées.
          </p>
        </div>
        <div className="shrink-0 text-center px-4 py-2 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{enabledCount}/{sections.length}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>activées</div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Sections list */}
      <div className="space-y-2">
        {sections.length === 0 && (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Chargement…
          </div>
        )}
        {sections.map(section => {
          const isSaving = saving === section.key
          const isSaved  = saved === section.key
          return (
            <div key={section.key}
                 className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl transition-opacity"
                 style={{
                   background: 'var(--card)',
                   border: `1px solid ${section.enabled ? 'var(--border)' : 'var(--border)'}`,
                   opacity: section.enabled ? 1 : 0.6,
                 }}>

              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0">{section.icon}</span>
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                    {section.label}
                    {!section.enabled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                        DÉSACTIVÉ
                      </span>
                    )}
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
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggle(section)}
                disabled={isSaving}
                className="shrink-0 relative w-12 h-6 rounded-full transition-colors focus:outline-none disabled:opacity-50"
                style={{
                  background: section.enabled ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.2s',
                }}
                aria-label={section.enabled ? 'Désactiver' : 'Activer'}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: section.enabled ? 'translateX(24px)' : 'translateX(0)', transition: 'transform 0.2s' }}
                />
                {isSaving && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-3 h-3 rounded-full border border-white/40 border-t-white animate-spin" />
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Info box */}
      <div className="px-4 py-3 rounded-lg text-xs" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text)' }}>Comportement :</strong> Les changements sont immédiats.
        Une section désactivée redirige les joueurs vers une page « En construction » sans exposer le contenu.
        Les routes d'API sous-jacentes restent actives (elles sont gérées côté serveur indépendamment).
      </div>
    </div>
  )
}
