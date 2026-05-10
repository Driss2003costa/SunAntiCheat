import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getToken } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import { GridShell, PageHeader, Card, Button } from '../components/ui'

const BASE = '/api/public'

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

function fmtTime(ts: number, locale: string) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}

// ── Conversation list ─────────────────────────────────────────────────────────

function ConversationList({
  activeId, onSelect,
}: { activeId?: string; onSelect: (c: Conversation) => void }) {
  const token = getToken()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').startsWith('fr') ? 'fr-FR' : 'en-GB'
  const [convs, setConvs]     = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const data = await apiFetch(`${BASE}/messages`, token)
      setConvs(data.conversations.map((c: any) => ({ ...c })))
    } catch {} finally { setLoading(false) }
  }, [token])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  if (loading) return <Spinner />

  if (convs.length === 0) {
    return (
      <div className="text-center py-10 px-4">
        <p className="text-sm mb-3" style={{ color: 'rgba(241,245,249,0.55)' }}>{t('messages.empty')}</p>
        <Button onClick={() => navigate('/friends')} variant="secondary" size="sm">{t('messages.buttonFindFriends')}</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {convs.map(c => {
        const isActive = c.id === activeId
        return (
          <button key={c.id} onClick={() => onSelect(c)} className="text-left">
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                 style={{
                   background: isActive ? 'rgba(251,191,36,0.10)' : c.unread > 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
                   border: `1px solid ${isActive ? 'rgba(251,191,36,0.3)' : c.unread > 0 ? 'rgba(251,191,36,0.18)' : 'transparent'}`,
                 }}>
              <div className="relative shrink-0">
                <img src={`https://mc-heads.net/avatar/${c.other_username}/40`} alt={c.other_username}
                     className="w-10 h-10 rounded-xl" />
                {c.unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                        style={{ background: '#fbbf24', color: '#000' }}>{c.unread}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-semibold text-sm truncate" style={{ color: '#f8fafc' }}>{c.other_username}</p>
                  <p className="text-[10px] shrink-0 ml-2" style={{ color: 'rgba(241,245,249,0.4)' }}>{fmtTime(c.last_message_at, locale)}</p>
                </div>
                <p className="text-xs truncate" style={{ color: 'rgba(241,245,249,0.5)' }}>{c.last_msg ?? t('messages.newConv')}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Chat window ───────────────────────────────────────────────────────────────

function ChatWindow({ convId, onBack }: { convId: string; onBack: () => void }) {
  const token = getToken()
  const { t, i18n } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').startsWith('fr') ? 'fr-FR' : 'en-GB'
  const [messages, setMessages]     = useState<Message[]>([])
  const [myUuid, setMyUuid]         = useState('')
  const [otherName, setOtherName]   = useState('')
  const [draft, setDraft]           = useState('')
  const [sending, setSending]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const lastTs  = useRef<number>(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

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

    apiFetch(`${BASE}/messages`, token)
      .then(data => {
        const conv = data.conversations.find((c: any) => c.id === convId)
        if (conv) setOtherName(conv.other_username ?? '')
      }).catch(() => {})
  }, [convId, token])

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 shrink-0"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={onBack} className="lg:hidden text-lg" style={{ color: 'rgba(241,245,249,0.55)' }}>←</button>
        {otherName && (
          <img src={`https://mc-heads.net/avatar/${otherName}/40`} alt={otherName} className="w-10 h-10 rounded-xl" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-semibold truncate" style={{ color: '#f8fafc' }}>{otherName || '…'}</p>
          <p className="text-[11px]" style={{ color: 'rgba(241,245,249,0.45)' }}>{t('messages.private')}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {loading ? <Spinner /> : messages.map(m => {
          const mine = m.sender_uuid === myUuid
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} items-end gap-2`}>
              {!mine && otherName && (
                <img src={`https://mc-heads.net/avatar/${otherName}/24`} alt="" className="w-6 h-6 rounded-md shrink-0 mb-1" />
              )}
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl"
                   style={{
                     background: mine ? 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(251,191,36,0.10))' : 'rgba(255,255,255,0.06)',
                     border: mine ? '1px solid rgba(251,191,36,0.28)' : '1px solid rgba(255,255,255,0.08)',
                     borderBottomRightRadius: mine ? '6px' : undefined,
                     borderBottomLeftRadius:  mine ? undefined : '6px',
                   }}>
                <p className="text-sm leading-relaxed break-words" style={{ color: '#f1f5f9' }}>{m.content}</p>
                <p className="text-[10px] mt-1 text-right" style={{ color: 'rgba(241,245,249,0.4)' }}>
                  {fmtTime(m.created_at, locale)}{mine && m.read_at ? ` · ${t('messages.read')}` : ''}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('messages.placeholder') as string}
            maxLength={1000}
            className="flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none"
            style={{ background: 'rgba(15,22,40,0.9)', border: '1px solid rgba(251,191,36,0.25)', color: '#f1f5f9' }}
          />
          <button onClick={sendMessage} disabled={!draft.trim() || sending}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#FFB347,#F09A2E)' }}>
            <span className="text-gray-900 font-bold">➤</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Profile panel ────────────────────────────────────────────────────────────

function ProfilePanel({ conv }: { conv: Conversation }) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').startsWith('fr') ? 'fr-FR' : 'en-GB'
  return (
    <Card padding="lg" className="h-full">
      <div className="text-center mb-5">
        <img src={`https://mc-heads.net/body/${conv.other_username}/120`} alt={conv.other_username}
             className="w-28 mx-auto drop-shadow-lg" />
        <p className="font-display text-xl font-semibold mt-3" style={{ color: '#f8fafc' }}>{conv.other_username}</p>
        <p className="text-[11px] mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>
          {t('messages.lastMessage', { date: fmtTime(conv.last_message_at, locale) })}
        </p>
      </div>
      <div className="space-y-2">
        <Button to={`/u/${conv.other_username}`} variant="secondary" fullWidth size="sm">{t('messages.viewProfile')}</Button>
      </div>
    </Card>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Messages() {
  const token    = getToken()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { convId: paramConvId } = useParams<{ convId?: string }>()
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)

  useEffect(() => { if (!token) navigate('/login', { replace: true }) }, [token, navigate])

  useEffect(() => {
    if (paramConvId && (!activeConv || activeConv.id !== paramConvId)) {
      setActiveConv({ id: paramConvId } as Conversation)
    }
  }, [paramConvId, activeConv])

  return (
    <div className="min-h-screen" style={{ background: '#080d19' }}>
      <PageAura theme="messages" />
      <GridShell>
        <PageHeader
          eyebrow={t('messages.header')}
          title={t('messages.title')}
          subtitle={t('messages.headerSubtitle')}
        />

        <Card variant="glass" padding="none" className="overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] h-[calc(100vh-340px)] min-h-[560px]">
            {/* Conversations sidebar */}
            <div className={`${activeConv ? 'hidden lg:block' : 'block'} overflow-y-auto p-3`}
                 style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] px-2 py-2 mb-2" style={{ color: 'rgba(241,245,249,0.5)' }}>
                {t('messages.conversationsLabel')}
              </p>
              <ConversationList activeId={activeConv?.id} onSelect={c => { setActiveConv(c); navigate(`/messages/${c.id}`) }} />
            </div>

            {/* Chat */}
            <div className={`${!activeConv ? 'hidden lg:flex' : 'flex'} flex-col`}>
              {activeConv ? (
                <ChatWindow convId={activeConv.id} onBack={() => { setActiveConv(null); navigate('/messages') }} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-center px-6">
                  <div>
                    <span className="text-5xl block mb-4">💬</span>
                    <p className="font-display text-xl font-semibold mb-1" style={{ color: '#f8fafc' }}>{t('messages.noChatTitle')}</p>
                    <p className="text-sm" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('messages.noChatDesc')}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Profile panel */}
            <div className="hidden lg:block overflow-y-auto p-4"
                 style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
              {activeConv && activeConv.other_username
                ? <ProfilePanel conv={activeConv} />
                : <p className="text-xs text-center" style={{ color: 'rgba(241,245,249,0.4)' }}>{t('messages.noProfile')}</p>}
            </div>
          </div>
        </Card>
      </GridShell>
      <Navbar />
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: '#fbbf24' }} />
    </div>
  )
}
