import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'
import PatchCards, { parseAiPatches } from '../components/PatchCards'

type Msg = { role: 'user' | 'assistant'; content: string; patches?: any[] }
type ModelInfo = { id: string; name: string; desc: string; tier: string }
type ProviderInfo = { id: string; name: string; keyUrl: string }

export default function Assistant() {
  const { isAdmin } = usePermission()
  const [status, setStatus] = useState<{
    configured: boolean
    model: string
    provider: string
    availableModels: ModelInfo[]
    availableProviders: ProviderInfo[]
  } | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [diagnosing, setDiagnosing] = useState(false)
  const [showContext, setShowContext] = useState<string | null>(null)
  const [usage, setUsage] = useState<any>(null)
  const [showUsage, setShowUsage] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const refreshStatus = () => api.aiStatus().then(setStatus).catch(() => {})
  const refreshUsage  = () => api.aiUsage().then(setUsage).catch(() => {})

  useEffect(() => { refreshStatus(); refreshUsage() }, [])
  useEffect(() => {
    // Refresh usage après chaque nouveau message ou diagnostic
    if (messages.length > 0) refreshUsage()
  }, [messages.length])
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

  const switchProvider = async (providerId: string) => {
    if (!confirm(`Passer à ${providerId.toUpperCase()} ?\n\nTu devras fournir la clé API correspondante dans config.yml (dashboard.ai.api-key).`)) return
    try {
      await api.aiSetConfig({ provider: providerId })
      await refreshStatus()
      alert(`Provider changé pour ${providerId}. N'oublie pas de mettre à jour dashboard.ai.api-key dans config.yml.`)
    } catch (e: any) {
      alert('Erreur : ' + e.message)
    }
  }

  const currentModelInfo = status?.availableModels?.find(m => m.id === status.model)

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🤖 Assistant IA</h1>
            <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <span>Propulsé par</span>
              {isAdmin && status?.availableProviders ? (
                <select value={status.provider}
                        onChange={e => switchProvider(e.target.value)}
                        className="bg-transparent cursor-pointer font-semibold"
                        style={{ color: 'var(--text)' }}>
                  {status.availableProviders.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <span className="font-semibold" style={{ color: 'var(--text)' }}>
                  {status?.provider === 'openai' ? 'OpenAI (GPT)' : 'Google Gemini'}
                </span>
              )}
            </div>
          </div>
          {usage && status?.configured && <UsageBadge usage={usage} onOpen={() => setShowUsage(true)}/>}
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
                      Choisir un modèle {status.provider === 'openai' ? 'OpenAI' : 'Gemini'}
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {status.provider === 'gemini'
                        ? <>Les modèles <b>🆓 gratuits</b> ont un quota généreux (1M tokens/jour).</>
                        : <>Tous les modèles OpenAI sont <b>payants</b>. Le moins cher : <code>gpt-4o-mini</code>.</>}
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

      {/* Banner d'erreur si pas configuré — adapté au provider */}
      {status && !status.configured && (() => {
        const isOpenAi = status.provider === 'openai'
        const providerInfo = status.availableProviders?.find(p => p.id === status.provider)
        const keyUrl = providerInfo?.keyUrl || 'https://aistudio.google.com/apikey'
        const keyPrefix = isOpenAi ? 'sk-...' : 'AIzaSy...'
        const modelExample = isOpenAi ? 'gpt-4o-mini' : 'gemini-2.0-flash'
        return (
          <div className="rounded-xl p-4 mb-4 text-sm"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444' }}>
            <div className="font-semibold mb-2">⚠ Clé API {providerInfo?.name || status.provider} non configurée</div>
            <div>
              Ajoutez votre clé dans <code>config.yml</code> :
            </div>
            <pre className="mt-2 text-xs opacity-80" style={{ color: 'var(--text)' }}>dashboard:
  ai:
    provider: {status.provider}
    api-key: {keyPrefix}
    model: {modelExample}</pre>
            <div className="mt-2 text-xs" style={{ color: 'var(--text)' }}>
              🔑 Obtenez votre clé sur{' '}
              <a href={keyUrl} target="_blank" rel="noreferrer"
                 className="underline" style={{ color: 'var(--primary)' }}>
                {keyUrl.replace('https://', '')}
              </a>
              {!isOpenAi && <> &nbsp;— <b>1M tokens/jour offerts</b></>}
            </div>
          </div>
        )
      })()}

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
            <span>{diagnosing ? 'Collecte des métriques + analyse IA...' : 'L\'IA réfléchit...'}</span>
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

      {/* Modal détail consommation */}
      {showUsage && usage && (
        <UsageModal usage={usage} onClose={() => setShowUsage(false)}/>
      )}
    </div>
  )
}

// ── Badge de consommation (affiché dans le header) ────────────────────────
function UsageBadge({ usage, onOpen }: any) {
  const todayCost = usage.today?.costUsd || 0
  const todayCostEur = todayCost * (usage.usdToEur || 0.92)
  const todayRequests = usage.today?.requests || 0
  const freeQuotaPct = Math.min(100, (usage.today?.inputTokens || 0) / 10_000) // 1M tokens gratuits/j ≈ ~10k = 1%

  return (
    <button onClick={onOpen}
            title="Voir le détail de la consommation"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition hover:scale-105"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}>
      <div className="flex items-center gap-1.5">
        <span>📊</span>
        <span className="font-medium">{todayRequests}</span>
        <span style={{ color: 'var(--text-muted)' }}>req auj.</span>
      </div>
      <div className="w-px h-4" style={{ background: 'var(--border)' }}/>
      <div>
        {todayCost < 0.0001 ? (
          <span style={{ color: '#10b981' }}>🆓 Gratuit</span>
        ) : (
          <span>
            <b style={{ color: todayCostEur > 0.1 ? '#f59e0b' : 'var(--text)' }}>
              {todayCostEur.toFixed(4)} €
            </b>
          </span>
        )}
      </div>
    </button>
  )
}

// ── Modal détaillé de consommation ────────────────────────────────────────
function UsageModal({ usage, onClose }: any) {
  const today = usage.today || {}
  const all = usage.allTime || {}
  const usd2eur = usage.usdToEur || 0.92
  const last7 = usage.last7Days || []

  const maxReqsWeek = Math.max(1, ...last7.map((d: any) => d.requests || 0))

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-[600px] max-h-[85vh] overflow-y-auto rounded-xl p-6"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>📊 Consommation IA</h2>
          <button onClick={onClose} className="text-2xl leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        {/* Aujourd'hui */}
        <div className="rounded-lg p-4 mb-4" style={{ background: 'var(--surface-2)' }}>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Aujourd'hui ({today.date})
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Requêtes" value={today.requests || 0}/>
            <Stat label="Tokens input" value={fmt(today.inputTokens || 0)}/>
            <Stat label="Tokens output" value={fmt(today.outputTokens || 0)}/>
            <Stat label="Coût estimé" value={formatCost(today.costUsd || 0, usd2eur)} color="#10b981"/>
          </div>
          <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            💡 Quota gratuit Gemini 2.0 Flash : 1M tokens/jour · 1500 requêtes/jour
          </div>
          {/* Barre de progression free tier */}
          <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div className="h-full transition-all"
                 style={{
                   width: `${Math.min(100, ((today.inputTokens || 0) / 1_000_000) * 100)}%`,
                   background: '#10b981',
                 }}/>
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {((today.inputTokens || 0) / 1_000_000 * 100).toFixed(2)}% du quota gratuit utilisé
          </div>
        </div>

        {/* 7 derniers jours */}
        <div className="rounded-lg p-4 mb-4" style={{ background: 'var(--surface-2)' }}>
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            7 derniers jours
          </div>
          <div className="space-y-1">
            {last7.map((d: any) => (
              <div key={d.date} className="flex items-center gap-2 text-xs">
                <div className="w-20 font-mono" style={{ color: 'var(--text-muted)' }}>
                  {d.date.slice(5)}
                </div>
                <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full transition-all px-1.5 flex items-center"
                       style={{
                         width: `${((d.requests || 0) / maxReqsWeek) * 100}%`,
                         background: d.requests > 0 ? 'var(--primary)' : 'transparent',
                         minWidth: d.requests > 0 ? 24 : 0,
                       }}>
                    {d.requests > 0 && <span className="text-xs text-white font-semibold">{d.requests}</span>}
                  </div>
                </div>
                <div className="w-20 text-right" style={{ color: 'var(--text)' }}>
                  {formatCost(d.costUsd || 0, usd2eur)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="rounded-lg p-4 mb-4" style={{ background: 'var(--surface-2)' }}>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Total cumulé
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Requêtes totales" value={fmt(all.requests || 0)}/>
            <Stat label="Coût total" value={formatCost(all.costUsd || 0, usd2eur)}/>
            <Stat label="Tokens input" value={fmt(all.inputTokens || 0)}/>
            <Stat label="Tokens output" value={fmt(all.outputTokens || 0)}/>
          </div>
        </div>

        {/* Tarifs */}
        <details>
          <summary className="text-xs cursor-pointer mb-2" style={{ color: 'var(--text-muted)' }}>
            💳 Voir les tarifs (USD/M tokens)
          </summary>
          <div className="text-xs p-3 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            <table className="w-full">
              <thead style={{ color: 'var(--text-muted)' }}>
                <tr><th className="text-left">Modèle</th><th className="text-right">Input</th><th className="text-right">Output</th></tr>
              </thead>
              <tbody>
                {Object.entries(usage.pricing || {}).map(([m, rates]: any) => (
                  <tr key={m} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-1 font-mono">{m}</td>
                    <td className="text-right">${rates[0].toFixed(3)}</td>
                    <td className="text-right">${rates[1].toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-xs opacity-70">
              Conversion USD → EUR : × {usd2eur}. Tarifs approximatifs (vérifiez sur ai.google.dev).
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function formatCost(usd: number, usdToEur: number): string {
  if (usd < 0.0001) return '🆓 Gratuit'
  const eur = usd * usdToEur
  if (eur < 0.01) return eur.toFixed(4) + ' €'
  return eur.toFixed(3) + ' €'
}
