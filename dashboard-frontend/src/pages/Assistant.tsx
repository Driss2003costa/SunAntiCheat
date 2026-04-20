import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

type Msg = { role: 'user' | 'assistant'; content: string }

export default function Assistant() {
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { api.aiStatus().then(setStatus).catch(() => {}) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    const history = [...messages, userMsg]
    setMessages(history); setInput(''); setLoading(true)
    try {
      const res = await api.aiChat(history)
      // Anthropic format: { content: [ { type: 'text', text: '...' } ] }
      const text = res?.content?.[0]?.text ?? JSON.stringify(res)
      setMessages([...history, { role: 'assistant', content: text }])
    } catch (e: any) {
      setMessages([...history, { role: 'assistant', content: '⚠ Erreur : ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🤖 Assistant IA</h1>
        {status && (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {status.configured ? `✅ ${status.model}` : '⚠ Clé API non configurée'}
          </div>
        )}
      </div>

      {!status?.configured && (
        <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444' }}>
          Ajoutez votre clé Claude dans <code>config.yml</code> :
          <pre className="mt-2 text-xs opacity-80">dashboard:
  ai:
    api-key: sk-ant-...
    model: claude-3-5-sonnet-20241022</pre>
        </div>
      )}

      <div className="flex-1 rounded-xl overflow-y-auto p-4 space-y-3 mb-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {messages.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
            Posez une question sur le serveur, les joueurs, la modération...
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {['Qui est en ligne ?', 'Analyse des alertes', 'Comment optimiser les TPS ?', 'Résumé du serveur'].map(q => (
                <button key={q} onClick={() => setInput(q)}
                        className="px-3 py-1 rounded-full text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-xl whitespace-pre-wrap`}
                 style={{
                   background: m.role === 'user' ? 'var(--primary)' : 'var(--surface-2)',
                   color: m.role === 'user' ? 'white' : 'var(--text)',
                 }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm" style={{ color: 'var(--text-muted)' }}>⏳ Claude réfléchit...</div>}
        <div ref={endRef}/>
      </div>

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
