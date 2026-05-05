import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getToken } from '../api/client'
import Navbar from '../components/Navbar'
import SunBackground from '../components/SunBackground'

const BG     = '#080d19'
const CARD   = 'rgba(15,22,40,0.85)'
const BORDER = 'rgba(251,191,36,0.12)'
const GOLD   = '#fbbf24'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'
const BASE   = '/api/public'

type Conversation = {
  id: string; participant1: string; participant2: string
  last_message_at: number; other_uuid: string; other_username: string
  last_msg: string | null; unread: number
}
type Message = {
  id: string; conversation_id: string; sender_uuid: string
  content: string; read_at: number | null; created_at: number
}

async function apiFetch(url: string, token: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  })
  const data = await res.json()
  if (!res.ok) throw data
  return data
}

function fmtTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ── Conversation list ─────────────────────────────────────────────────────────

function ConversationList({ onSelect }: { onSelect: (c: Conversation) => void }) {
  const token = getToken()
  const navigate = useNavigate()
  const [convs, setConvs]     = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const data = await apiFetch(`${BASE}/messages`, token)
      const mapped = data.conversations.map((c: any) => {
        return { ...c }
      })
      setConvs(mapped)
    } catch {} finally { setLoading(false) }
  }, [token])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  if (loading) return <Spinner />

  return (
    <div className="space-y-2">
      {convs.length === 0 && (
        <p className="text-center py-10 text-sm" style={{ color: MUTED }}>
          Aucune conversation. Ouvre-en une depuis la page <button onClick={() => navigate('/friends')} style={{ color: GOLD }}>Amis</button>.
        </p>
      )}
      {convs.map(c => (
        <button key={c.id} onClick={() => onSelect(c)} className="w-full text-left"
          style={{ display: 'block' }}>
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors"
               style={{ background: CARD, border: `1px solid ${c.unread > 0 ? 'rgba(251,191,36,0.3)' : BORDER}` }}>
            <div className="relative shrink-0">
              <img src={`https://mc-heads.net/avatar/${c.other_username}/40`} alt={c.other_username}
                   className="w-10 h-10 rounded-xl" />
              {c.unread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: GOLD, color: '#000' }}>{c.unread}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="font-bold text-sm truncate" style={{ color: TEXT }}>{c.other_username}</p>
                <p className="text-[10px] shrink-0 ml-2" style={{ color: MUTED }}>{fmtTime(c.last_message_at)}</p>
              </div>
              <p className="text-xs truncate" style={{ color: MUTED }}>{c.last_msg ?? 'Nouvelle conversation'}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Chat window ───────────────────────────────────────────────────────────────

function ChatWindow({ convId, onBack }: { convId: string; onBack: () => void }) {
  const token = getToken()
  const [messages, setMessages]     = useState<Message[]>([])
  const [myUuid, setMyUuid]         = useState('')
  const [otherName, setOtherName]   = useState('')
  const [draft, setDraft]           = useState('')
  const [sending, setSending]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const lastTs  = useRef<number>(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Charge les données initiales + identifie l'utilisateur courant
  useEffect(() => {
    if (!token) return
    fetch(`${BASE}/player/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setMyUuid(d.uuid)).catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    apiFetch(`${BASE}/messages/${convId}?limit=50`, token)
      .then(data => {
        setMessages(data.messages)
        if (data.messages.length > 0) {
          lastTs.current = data.messages[data.messages.length - 1].created_at
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Récupère le nom de l'interlocuteur depuis la liste
    apiFetch(`${BASE}/messages`, token)
      .then(data => {
        const conv = data.conversations.find((c: any) => c.id === convId)
        if (conv) setOtherName(conv.other_username ?? '')
      }).catch(() => {})
  }, [convId, token])

  // Polling léger pour les nouveaux messages
  useEffect(() => {
    if (!token) return
    const poll = async () => {
      try {
        const data = await apiFetch(`${BASE}/messages/${convId}/poll?after=${lastTs.current}`, token)
        if (data.messages.length > 0) {
          setMessages(prev => {
            const ids = new Set(prev.map((m: Message) => m.id))
            const news = data.messages.filter((m: Message) => !ids.has(m.id))
            if (news.length === 0) return prev
            const updated = [...prev, ...news]
            lastTs.current = updated[updated.length - 1].created_at
            return updated
          })
        }
      } catch {}
    }
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [convId, token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!draft.trim() || sending || !token) return
    setSending(true)
    try {
      const msg = await apiFetch(`${BASE}/messages/${convId}/send`, token, {
        method: 'POST',
        body: JSON.stringify({ content: draft.trim() }),
      })
      setMessages(prev => [...prev, msg])
      lastTs.current = msg.created_at
      setDraft('')
      inputRef.current?.focus()
    } catch {} finally { setSending(false) }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0"
           style={{ borderBottom: `1px solid ${BORDER}` }}>
        <button onClick={onBack} className="text-lg" style={{ color: MUTED }}>←</button>
        {otherName && (
          <img src={`https://mc-heads.net/avatar/${otherName}/32`} alt={otherName} className="w-8 h-8 rounded-lg" />
        )}
        <span className="font-bold" style={{ color: TEXT }}>{otherName || '…'}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? <Spinner /> : messages.map(m => {
          const mine = m.sender_uuid === myUuid
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%] px-3.5 py-2 rounded-2xl"
                   style={{
                     background: mine ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.07)',
                     border: mine ? `1px solid rgba(251,191,36,0.3)` : `1px solid ${BORDER}`,
                     borderBottomRightRadius: mine ? '4px' : undefined,
                     borderBottomLeftRadius:  mine ? undefined : '4px',
                   }}>
                <p className="text-sm leading-relaxed break-words" style={{ color: TEXT }}>{m.content}</p>
                <p className="text-[10px] mt-0.5 text-right" style={{ color: MUTED }}>
                  {fmtTime(m.created_at)}{mine && m.read_at ? ' · Lu' : ''}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 shrink-0" style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Écrire un message…"
            maxLength={1000}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
            style={{ background: 'rgba(15,22,40,0.9)', border: `1px solid rgba(251,191,36,0.25)`, color: TEXT }}
          />
          <button onClick={sendMessage} disabled={!draft.trim() || sending}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' }}>
            <span className="text-gray-900 font-bold text-sm">➤</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Messages() {
  const token    = getToken()
  const navigate = useNavigate()
  const { convId: paramConvId } = useParams<{ convId?: string }>()
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)

  useEffect(() => { if (!token) navigate('/login', { replace: true }) }, [token, navigate])

  // Si on arrive via /messages/:convId directement (ex: depuis la page Amis)
  useEffect(() => {
    if (paramConvId && !activeConv) {
      setActiveConv({ id: paramConvId } as Conversation)
    }
  }, [paramConvId, activeConv])

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: BG }}>
      <SunBackground />
      <div className="relative z-10 px-4 pt-10 max-w-screen-sm mx-auto">

        {!activeConv ? (
          <>
            <h1 className="text-2xl font-black mb-6" style={{ color: TEXT }}>💬 Messages</h1>
            <ConversationList onSelect={c => setActiveConv(c)} />
          </>
        ) : (
          <ChatWindow convId={activeConv.id} onBack={() => { setActiveConv(null); navigate('/messages') }} />
        )}

      </div>
      <Navbar />
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
    </div>
  )
}
