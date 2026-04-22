import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'
import PatchCards, { parseAiPatches } from '../components/PatchCards'

type Msg = { role: 'user' | 'assistant'; content: string; patches?: any[] }
type ModelInfo = { id: string; name: string; desc: string; tier: string }

export default function Assistant() {
  const { isAdmin } = usePermission()
  const [status, setStatus] = useState<{
    configured: boolean
    model: string
    provider: string
    availableModels: ModelInfo[]
  } | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [diagnosing, setDiagnosing] = useState(false)
  const [showContext, setShowContext] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const refreshStatus = () => api.aiStatus().then(setStatus).catch(() => {})

  useEffect(() => { refreshStatus() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    const history = [...messages, userMsg]
    setMessages(history); setInput(''); setLoading(true)
    try {
      const res = await api.aiChat(history)
      // Format normalisé (compatible Anthropic) : { content: [ { type: 'text', text: '...' } ] }
      const text = res?.content?.[0]?.text ?? JSON.stringify(res)
      setMessages([...history, { role: 'assistant', content: text }])
    } catch (e: any) {
      setMessages([...history, { role: 'assistant', content: '⚠ Erreur : ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  const runDiagnostic = async (focus: 'full' | 'tps' | 'ram' | 'plugins' = 'full') => {
    if (diagnosing) return
    const focusLabel = { full: 'complet', tps: 'TPS', ram: 'RAM', plugins: 'plugins' }[focus]
    const userMsg: Msg = { role: 'user', content: `🔍 Diagnostic ${focusLabel} du serveur` }
    setMessages(prev => [...prev, userMsg])
    setDiagnosing(true)
    try {
      const res = await api.aiDiagnose(focus)
      const { cleanedText, patches } = parseAiPatches(res.analysis)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanedText + '\n\n---\n_Analysé avec ' + res.model + '_',
        patches: patches.length > 0 ? patches : undefined,
      }])
      setShowContext(res.context)
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Erreur diagnostic : ' + e.message }])
    } finally {
      setDiagnosing(false)
    }
  }

  const switchModel = async (id: string) => {
    setSwitching(id)
    try {
      await api.aiSetConfig({ model: id })
      await refreshStatus()
      setShowModelPicker(false)
    } catch (e: any) {
      alert('Erreur : ' + e.message)
    } finally {
      setSwitching(null)
    }
  }

  const currentModelInfo = status?.availableModels?.find(m => m.id === status.model)

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🤖 Assistant IA</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Propulsé par Google Gemini</p>
        </div>

        {/* Sélecteur de modèle */}
        {status && status.configured && (
          <div className="relative">
            <button onClick={() => isAdmin && setShowModelPicker(!showModelPicker)}
                    disabled={!isAdmin}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      cursor: isAdmin ? 'pointer' : 'default',
                    }}
                    title={isAdmin ? 'Changer de modèle' : 'Seul un ADMIN peut changer'}>
              <span>✨</span>
              <div className="text-left">
                <div className="font-medium">{currentModelInfo?.name ?? status.model}</div>
                {currentModelInfo && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {currentModelInfo.tier === 'free' ? '🆓 Gratuit' : '💳 Payant'}
                  </div>
                )}
              </div>
              {isAdmin && <span style={{ color: 'var(--text-muted)' }}>▼</span>}
            </button>

            {showModelPicker && isAdmin && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)}/>
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
                     style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="p-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      Choisir un modèle Gemini
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Les modèles <b>🆓 gratuits</b> ont un quota généreux (1M tokens/jour).
                    </div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {(status.availableModels || []).map(m => (
                      <button key={m.id}
                              onClick={() => switchModel(m.id)}
                              disabled={switching !== null}
                              className="w-full text-left px-4 py-3 transition hover:bg-white/5"
                              style={{
                                background: status.model === m.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                                borderLeft: status.model === m.id ? '3px solid var(--primary)' : '3px solid transparent',
                              }}>
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                            {m.name}
                          </div>
                          <div className="flex items-center gap-2">
                            {m.tier === 'free' && (
                              <span className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                                🆓
                              </span>
                            )}
                            {m.tier === 'paid' && (
                              <span className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ background: 'rgba(251,191,36,0.15)', color: '#f59e0b' }}>
                                💳
                              </span>
                            )}
                            {status.model === m.id && (
                              <span style={{ color: 'var(--primary)' }}>✓</span>
                            )}
                            {switching === m.id && <span>⏳</span>}
                          </div>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {m.desc}
                        </div>
                        <div className="text-xs mt-0.5 font-mono opacity-50" style={{ color: 'var(--text-muted)' }}>
                          {m.id}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="p-3 text-xs"
                       style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    💡 Le changement est instantané pour le prochain message.
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Banner d'erreur si pas configuré */}
      {status && !status.configured && (
        <div className="rounded-xl p-4 mb-4 text-sm"
             style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444' }}>
          <div className="font-semibold mb-2">⚠ Clé API Gemini non configurée</div>
          <div>
            Ajoutez votre clé <b>Google Gemini</b> dans <code>config.yml</code> :
          </div>
          <pre className="mt-2 text-xs opacity-80" style={{ color: 'var(--text)' }}>dashboard:
  ai:
    api-key: AIzaSy...
    model: gemini-2.0-flash</pre>
          <div className="mt-2 text-xs" style={{ color: 'var(--text)' }}>
            🔑 Clé <b>gratuite</b> sur{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
               className="underline" style={{ color: 'var(--primary)' }}>
              aistudio.google.com/apikey
            </a>
            &nbsp;— 1M tokens/jour offerts
          </div>
        </div>
      )}

      {/* Zone chat */}
      <div className="flex-1 rounded-xl overflow-y-auto p-4 space-y-3 mb-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {messages.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
            <div className="mb-6">
              <div className="text-4xl mb-2">🤖</div>
              <div className="font-semibold" style={{ color: 'var(--text)' }}>Posez une question ou lancez un diagnostic</div>
            </div>

            {/* Boutons diagnostic automatique */}
            <div className="mb-4">
              <div className="text-xs mb-2 uppercase tracking-wider opacity-60">Diagnostic auto</div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={() => runDiagnostic('full')} disabled={!status?.configured || diagnosing}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
                        style={{ background: '#8b5cf6' }}>
                  🔍 {diagnosing ? 'Analyse en cours...' : 'Diagnostiquer le serveur'}
                </button>
                <button onClick={() => runDiagnostic('tps')} disabled={!status?.configured || diagnosing}
                        className="px-3 py-2 rounded-lg text-xs disabled:opacity-50"
                        style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                  ⚡ TPS/Lag
                </button>
                <button onClick={() => runDiagnostic('ram')} disabled={!status?.configured || diagnosing}
                        className="px-3 py-2 rounded-lg text-xs disabled:opacity-50"
                        style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                  🧠 RAM
                </button>
                <button onClick={() => runDiagnostic('plugins')} disabled={!status?.configured || diagnosing}
                        className="px-3 py-2 rounded-lg text-xs disabled:opacity-50"
                        style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                  🧩 Plugins
                </button>
              </div>
            </div>

            {/* Suggestions questions */}
            <div>
              <div className="text-xs mb-2 uppercase tracking-wider opacity-60">Questions rapides</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'Pourquoi mon serveur ralentit ?',
                  'Qui est en ligne ?',
                  'Quels plugins consomment le plus ?',
                  'Résumé des alertes récentes',
                ].map(q => (
                  <button key={q} onClick={() => setInput(q)}
                          className="px-3 py-1.5 rounded-full text-xs"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%]"
                 style={{
                   background: m.role === 'user' ? 'var(--primary)' : 'var(--surface-2)',
                   color: m.role === 'user' ? 'white' : 'var(--text)',
                   borderRadius: '12px',
                   padding: '8px 16px',
                 }}>
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.patches && m.patches.length > 0 && (
                <PatchCards patches={m.patches}/>
              )}
            </div>
          </div>
        ))}
        {(loading || diagnosing) && (
          <div className="text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <span className="animate-pulse">⏳</span>
            <span>{diagnosing ? 'Collecte des métriques + analyse IA...' : 'Gemini réfléchit...'}</span>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Bouton diagnostic rapide (visible dans les messages) */}
      {messages.length > 0 && status?.configured && (
        <div className="mb-2 flex flex-wrap gap-2">
          <button onClick={() => runDiagnostic('full')} disabled={diagnosing}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: '#8b5cf6' }}>
            🔍 Diagnostic complet
          </button>
          {showContext && (
            <button onClick={() => alert(showContext)}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                    title="Voir les métriques brutes envoyées à l'IA">
              📊 Voir contexte
            </button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
               disabled={!status?.configured || loading}
               placeholder="Posez votre question..."
               className="flex-1 px-4 py-3 rounded-xl"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
        <button onClick={send} disabled={!status?.configured || loading}
                className="px-6 py-3 rounded-xl text-white font-medium disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
          Envoyer
        </button>
      </div>
    </div>
  )
}
