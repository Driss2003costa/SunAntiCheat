import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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

type Friend     = { uuid: string; username: string; since: number }
type FriendReq  = { id: string; uuid: string; username: string; sender_uuid: string; receiver_uuid: string; created_at: number }
type UserResult = { uuid: string; username: string; relation: string; request_id?: string }

type Tab = 'friends' | 'incoming' | 'outgoing' | 'search'

async function apiFetch(url: string, token: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  })
  const data = await res.json()
  if (!res.ok) throw data
  return data
}

export default function Friends() {
  const navigate  = useNavigate()
  const token     = getToken()
  const [tab, setTab]           = useState<Tab>('friends')
  const [friends, setFriends]   = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<FriendReq[]>([])
  const [outgoing, setOutgoing] = useState<FriendReq[]>([])
  const [search, setSearch]     = useState('')
  const [results, setResults]   = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return }
  }, [token, navigate])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [f, inc, out] = await Promise.all([
        apiFetch(`${BASE}/friends`, token),
        apiFetch(`${BASE}/friends/requests/incoming`, token),
        apiFetch(`${BASE}/friends/requests/outgoing`, token),
      ])
      setFriends(f.friends)
      setIncoming(inc.requests)
      setOutgoing(out.requests)
    } catch {
      setError('Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (tab !== 'search' || search.trim().length < 2) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const data = await apiFetch(`${BASE}/friends/search?q=${encodeURIComponent(search.trim())}`, token!)
        setResults(data.users)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [search, tab, token])

  async function sendRequest(targetUuid: string) {
    try {
      await apiFetch(`${BASE}/friends/request/${targetUuid}`, token!, { method: 'POST' })
      setResults(r => r.map(u => u.uuid === targetUuid ? { ...u, relation: 'request_sent' } : u))
    } catch {}
  }

  async function acceptRequest(reqId: string) {
    try {
      await apiFetch(`${BASE}/friends/accept/${reqId}`, token!, { method: 'POST' })
      await load()
    } catch {}
  }

  async function declineRequest(reqId: string) {
    try {
      await apiFetch(`${BASE}/friends/decline/${reqId}`, token!, { method: 'POST' })
      await load()
    } catch {}
  }

  async function cancelRequest(reqId: string) {
    try {
      await apiFetch(`${BASE}/friends/cancel/${reqId}`, token!, { method: 'POST' })
      await load()
    } catch {}
  }

  async function removeFriend(friendUuid: string) {
    if (!confirm('Supprimer cet ami ?')) return
    try {
      await apiFetch(`${BASE}/friends/${friendUuid}`, token!, { method: 'DELETE' })
      await load()
    } catch {}
  }

  async function openChat(friendUuid: string) {
    try {
      const data = await apiFetch(`${BASE}/messages/open`, token!, {
        method: 'POST',
        body: JSON.stringify({ target_uuid: friendUuid }),
      })
      navigate(`/messages/${data.id}`)
    } catch {}
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'friends',  label: 'Amis',       badge: friends.length },
    { key: 'incoming', label: 'Reçues',      badge: incoming.length },
    { key: 'outgoing', label: 'Envoyées',    badge: outgoing.length },
    { key: 'search',   label: 'Rechercher' },
  ]

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: BG }}>
      <SunBackground />

      <div className="relative z-10 px-4 pt-10 max-w-screen-sm mx-auto">
        <h1 className="text-2xl font-black mb-6" style={{ color: TEXT }}>👥 Amis</h1>

        {/* Tab bar */}
        <div className="flex gap-1 mb-4 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}` }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1"
              style={{
                background: tab === t.key ? 'rgba(251,191,36,0.15)' : 'transparent',
                color: tab === t.key ? GOLD : MUTED,
                border: tab === t.key ? `1px solid rgba(251,191,36,0.3)` : '1px solid transparent',
              }}>
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: tab === t.key ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)', color: tab === t.key ? GOLD : MUTED }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

        {/* Friends list */}
        {tab === 'friends' && (
          <div className="space-y-2">
            {loading ? <Spinner /> : friends.length === 0 ? (
              <Empty text="Aucun ami pour l'instant. Recherche des joueurs !" />
            ) : friends.map(f => (
              <div key={f.uuid} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                   style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <img src={`https://mc-heads.net/avatar/${f.username}/40`} alt={f.username}
                     className="w-10 h-10 rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: TEXT }}>{f.username}</p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    Ami depuis {new Date(f.since).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openChat(f.uuid)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                    style={{ background: 'rgba(251,191,36,0.15)', color: GOLD, border: `1px solid rgba(251,191,36,0.3)` }}>
                    💬
                  </button>
                  <button onClick={() => removeFriend(f.uuid)}
                    className="text-xs px-2.5 py-1.5 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Incoming requests */}
        {tab === 'incoming' && (
          <div className="space-y-2">
            {loading ? <Spinner /> : incoming.length === 0 ? (
              <Empty text="Aucune demande reçue." />
            ) : incoming.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                   style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <img src={`https://mc-heads.net/avatar/${r.username}/40`} alt={r.username}
                     className="w-10 h-10 rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: TEXT }}>{r.username}</p>
                  <p className="text-xs" style={{ color: MUTED }}>veut être votre ami</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => acceptRequest(r.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                    ✓
                  </button>
                  <button onClick={() => declineRequest(r.id)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Outgoing requests */}
        {tab === 'outgoing' && (
          <div className="space-y-2">
            {loading ? <Spinner /> : outgoing.length === 0 ? (
              <Empty text="Aucune demande envoyée." />
            ) : outgoing.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                   style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <img src={`https://mc-heads.net/avatar/${r.username}/40`} alt={r.username}
                     className="w-10 h-10 rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: TEXT }}>{r.username}</p>
                  <p className="text-xs" style={{ color: MUTED }}>demande en attente</p>
                </div>
                <button onClick={() => cancelRequest(r.id)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Annuler
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {tab === 'search' && (
          <div className="space-y-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un joueur…"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ background: 'rgba(15,22,40,0.9)', border: `1px solid rgba(251,191,36,0.25)`, color: TEXT }}
            />
            {searching && <Spinner />}
            {!searching && search.trim().length >= 2 && results.length === 0 && (
              <Empty text="Aucun joueur trouvé." />
            )}
            <div className="space-y-2">
              {results.map(u => (
                <div key={u.uuid} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                     style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <img src={`https://mc-heads.net/avatar/${u.username}/40`} alt={u.username}
                       className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: TEXT }}>{u.username}</p>
                  </div>
                  <RelationBtn relation={u.relation} onAdd={() => sendRequest(u.uuid)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Navbar />
    </div>
  )
}

function RelationBtn({ relation, onAdd }: { relation: string; onAdd: () => void }) {
  if (relation === 'friends')          return <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>✓ Ami</span>
  if (relation === 'request_sent')     return <span className="text-xs px-2.5 py-1 rounded-lg" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>Envoyée</span>
  if (relation === 'request_received') return <span className="text-xs px-2.5 py-1 rounded-lg" style={{ color: GOLD,  border: `1px solid rgba(251,191,36,0.3)` }}>Reçue</span>
  return (
    <button onClick={onAdd}
      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
      style={{ background: 'rgba(251,191,36,0.15)', color: GOLD, border: `1px solid rgba(251,191,36,0.3)` }}>
      + Ajouter
    </button>
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

function Empty({ text }: { text: string }) {
  return <p className="text-center py-10 text-sm" style={{ color: MUTED }}>{text}</p>
}
