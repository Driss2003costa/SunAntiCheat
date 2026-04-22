import { useState } from 'react'
import { api } from '../api/client'

type Patch = {
  file: string
  description: string
  reason?: string
  changes: Array<{ path: string; value: any }>
}

/**
 * Parse une réponse IA et extrait les blocs ```patch {...} ``` structurés.
 * Retourne { cleanedText, patches } où cleanedText a les blocs retirés.
 */
export function parseAiPatches(text: string): { cleanedText: string; patches: Patch[] } {
  const patches: Patch[] = []
  // Match ```patch ... ``` ou ```json ... ``` contenant "patches"
  const regex = /```(?:patch|json)\s*\n([\s\S]*?)```/g
  let cleanedText = text
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.patches && Array.isArray(parsed.patches)) {
        for (const p of parsed.patches) {
          if (p.file && Array.isArray(p.changes) && p.changes.length > 0) {
            patches.push(p)
          }
        }
        // Retire le bloc de la réponse texte
        cleanedText = cleanedText.replace(match[0], '')
      }
    } catch {}
  }
  return { cleanedText: cleanedText.trim(), patches }
}

export default function PatchCards({ patches, onApplied }: {
  patches: Patch[]
  onApplied?: (file: string) => void
}) {
  if (!patches || patches.length === 0) return null
  return (
    <div className="mt-4 space-y-3">
      <div className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
        🔧 Patches proposés par l'IA
      </div>
      {patches.map((p, i) => (
        <PatchCard key={i} patch={p} onApplied={() => onApplied?.(p.file)}/>
      ))}
    </div>
  )
}

function PatchCard({ patch, onApplied }: { patch: Patch; onApplied?: () => void }) {
  const [state, setState] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [appliedResult, setAppliedResult] = useState<any>(null)
  const [expanded, setExpanded] = useState(false)

  const apply = async () => {
    if (!confirm(`Appliquer ${patch.changes.length} changement(s) à ${patch.file} ?\n\nUn backup sera créé automatiquement.`)) return
    setState('applying')
    setError(null)
    try {
      const res = await api.aiApplyPatch(patch.file, patch.changes)
      setState('applied')
      setAppliedResult(res)
      onApplied?.()
    } catch (e: any) {
      setState('error')
      setError(e.message)
    }
  }

  return (
    <div className="rounded-lg p-4"
         style={{
           background: 'var(--surface)',
           border: `1px solid ${state === 'applied' ? '#10b981' : state === 'error' ? '#ef4444' : 'var(--border)'}`,
         }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔧</span>
            <code className="text-sm font-mono font-bold" style={{ color: 'var(--text)' }}>{patch.file}</code>
            <span className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {patch.changes.length} changement{patch.changes.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-sm" style={{ color: 'var(--text)' }}>{patch.description}</div>
          {patch.reason && (
            <div className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)' }}>
              💡 {patch.reason}
            </div>
          )}

          <button onClick={() => setExpanded(!expanded)}
                  className="text-xs mt-2 underline"
                  style={{ color: 'var(--primary)' }}>
            {expanded ? '▼ Masquer' : '▶ Voir les changements'}
          </button>

          {expanded && (
            <div className="mt-2 space-y-1 font-mono text-xs" style={{ background: 'var(--surface-2)', padding: '8px', borderRadius: '4px' }}>
              {patch.changes.map((c, i) => (
                <div key={i}>
                  <span style={{ color: 'var(--text-muted)' }}>{c.path}:</span>{' '}
                  <span style={{ color: '#10b981' }}>{JSON.stringify(c.value)}</span>
                </div>
              ))}
            </div>
          )}

          {state === 'applied' && appliedResult && (
            <div className="mt-2 text-xs p-2 rounded"
                 style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
              ✓ Appliqué · Backup créé : <code>{appliedResult.backup}</code>
              <br/>⚠ {appliedResult.message}
            </div>
          )}
          {state === 'error' && (
            <div className="mt-2 text-xs p-2 rounded"
                 style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              ✗ {error}
            </div>
          )}
        </div>

        <div className="shrink-0">
          {state === 'applied' ? (
            <div className="px-3 py-1.5 rounded text-xs font-medium"
                 style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
              ✓ Appliqué
            </div>
          ) : (
            <button onClick={apply} disabled={state === 'applying'}
                    className="px-3 py-1.5 rounded text-sm text-white font-medium disabled:opacity-50"
                    style={{ background: state === 'error' ? '#ef4444' : 'var(--primary)' }}>
              {state === 'applying' ? '⏳ Patch...' : state === 'error' ? '↻ Réessayer' : '⚡ Appliquer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
