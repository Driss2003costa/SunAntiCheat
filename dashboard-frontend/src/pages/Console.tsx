import { useEffect, useRef, useState } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuthStore } from '../stores/authStore'

const SHORTCUTS = ['tps', 'list', 'plugins', 'save-all', 'sunguard', 'sunplaytime top']

function stripMinecraftColors(s: string) {
  return s.replace(/§[0-9a-fklmnor]/g, '')
}

function lineColor(line: string) {
  if (line.includes('ERROR') || line.includes('SEVERE')) return 'text-red-400'
  if (line.includes('WARN'))  return 'text-amber-400'
  if (line.includes('INFO'))  return 'text-slate-300'
  return 'text-slate-400'
}

export default function Console() {
  const [lines, setLines]     = useState<string[]>([])
  const [input, setInput]     = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAdmin = useAuthStore(s => s.isAdmin())

  const { send } = useWebSocket(['console'], (msg) => {
    if (msg.channel === 'console' && msg.data) {
      setLines(prev => [...prev.slice(-500), stripMinecraftColors(msg.data)])
    }
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  function sendCommand(cmd: string) {
    if (!cmd.trim() || !isAdmin) return
    send({ type: 'console_input', command: cmd })
    setHistory(h => [cmd, ...h.slice(0, 49)])
    setHistIdx(-1)
    setInput('')
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { sendCommand(input); return }
    if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(idx); setInput(history[idx] ?? '')
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx); setInput(idx === -1 ? '' : history[idx])
    }
  }

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <h1 className="text-2xl font-bold shrink-0">Console serveur</h1>

      {/* Raccourcis */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2 shrink-0">
          {SHORTCUTS.map(s => (
            <button key={s} onClick={() => sendCommand(s)}
              className="btn-ghost text-xs px-3 py-1">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Output */}
      <div className="flex-1 card overflow-y-auto font-mono text-xs leading-5 min-h-0">
        {lines.length === 0 && (
          <p className="text-muted text-center mt-8">En attente de sortie console...</p>
        )}
        {lines.map((line, i) => (
          <div key={i} className={lineColor(line)}>{line}</div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isAdmin ? (
        <div className="flex gap-2 shrink-0">
          <input
            className="input font-mono text-sm"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Entrez une commande... (Entrée pour envoyer)"
          />
          <button className="btn-primary px-6" onClick={() => sendCommand(input)}>
            Envoyer
          </button>
        </div>
      ) : (
        <div className="text-muted text-sm text-center">Mode lecture seule (MOD)</div>
      )}
    </div>
  )
}
