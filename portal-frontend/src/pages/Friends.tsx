import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'

const GLASS  = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const TEAL   = '#2dd4bf'
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
  const navigate = useNavigate()
  const token    = getToken()
  const [tab,      setTab]      = useState<Tab>('friends')
  const [friends,  setFriends]  = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<FriendReq[]>([])
  const [outgoing, setOutgoing] = useState<FriendReq[]>([])
  const [search,   setSearch]   = useState('')
  const [results,  setResults]  = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

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
    } catch { setError('Erreur de chargement.') }
    finally { setLoading(false) }
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

  async function sendRequest(uuid: string) {
    try {
      await apiFetch(`${BASE}/friends/request/${uuid}`, token!, { method: 'POST' })
      setResults(r => r.map(u => u.uuid === uuid ? { ...u, relation: 'request_sent' } : u))
    } catch {}
  }
  async function accept(id: string)  { try { await apiFetch(`${BASE}/friends/accept/${id}`,  token!, { method: 'POST' }); await load() } catch {} }
  async function decline(id: string) { try { await apiFetch(`${BASE}/friends/decline/${id}`, token!, { method: 'POST' }); await load() } catch {} }
  async function cancel(id: string)  { try { await apiFetch(`${BASE}/friends/cancel/${id}`,  token!, { method: 'POST' }); await load() } catch {} }
  async function remove(uuid: string) {
    if (!confirm('Supprimer cet ami ?')) return
    try { await apiFetch(`${BASE}/friends/${uuid}`, token!, { method: 'DELETE' }); await load() } catch {}
  }
  async function openChat(uuid: string) {
    try {
      const data = await apiFetch(`${BASE}/messages/open`, token!, { method: 'POST', body: JSON.stringify({ target_uuid: uuid }) })
      navigate(`/messages/${data.id}`)
    } catch {}
  }

  const tabs = [
    { key: 'friends'  as Tab, label: 'Amis',       badge: friends.length  },
    { key: 'incoming' as Tab, label: 'Reçues',      badge: incoming.length },
    { key: 'outgoing' as Tab, label: 'Envoyées',    badge: outgoing.length },
    { key: 'search'   as Tab, label: 'Rechercher' },
  ]

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080d19' }}>
      <PageAura theme="friends" />

      <div className="relative z-10 px-4 pt-12 max-w-screen-sm mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: TEXT }}>Amis</h1>
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>
            {friends.length} ami{friends.length !== 1 ? 's' : ''}
            {incoming.length > 0 && <span className="ml-2 text-amber-400">· {incoming.length} demande{incoming.length > 1 ? 's' : ''} en attente</span>}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-5"
             style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              style={{
                background: tab === t.key ? 'rgba(45,212,191,0.12)' : 'transparent',
                color: tab === t.key ? TEAL : MUTED,
                border: tab === t.key ? '1px solid rgba(45,212,191,0.25)' : '1px solid transparent',
              }}>
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        background: tab === t.key ? 'rgba(45,212,191,0.2)' : 'rgba(255,255,255,0.08)',
                        color: tab === t.key ? TEAL : MUTED,
                      }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

        {/* Friends */}
        {tab === 'friends' && (
          <div className="space-y-2">
            {loading ? <Spinner color={TEAL} /> : friends.length === 0
              ? <Empty text="Aucun ami pour l'instant. Utilise la recherche !" />
              : friends.map(f => (
                <div key={f.uuid} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                     style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
                  <img src={`https://mc-heads.net/avatar/${f.username}/40`} alt={f.username}
                       className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: TEXT }}>{f.username}</p>
                    <p className="text-xs" style={{ color: MUTED }}>
                      Ami depuis {new Date(f.since).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openChat(f.uuid)}
                      className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                      style={{ background: 'rgba(45,212,191,0.1)', color: TEAL, border: '1px solid rgba(45,212,191,0.25)' }}>
                      💬
                    </button>
                    <button onClick={() => remove(f.uuid)}
                      className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Incoming */}
        {tab === 'incoming' && (
          <div className="space-y-2">
            {loading ? <Spinner color={TEAL} /> : incoming.length === 0
              ? <Empty text="Aucune demande reçue." />
              : incoming.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                     style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
                  <img src={`https://mc-heads.net/avatar/${r.username}/40`} alt={r.username}
                       className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: TEXT }}>{r.username}</p>
                    <p className="text-xs" style={{ color: MUTED }}>veut être votre ami</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => accept(r.id)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                      ✓
                    </button>
                    <button onClick={() => decline(r.id)}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Outgoing */}
        {tab === 'outgoing' && (
          <div className="space-y-2">
            {loading ? <Spinner color={TEAL} /> : outgoing.length === 0
              ? <Empty text="Aucune demande envoyée." />
              : outgoing.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                     style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
                  <img src={`https://mc-heads.net/avatar/${r.username}/40`} alt={r.username}
                       className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: TEXT }}>{r.username}</p>
                    <p className="text-xs" style={{ color: MUTED }}>demande en attente</p>
                  </div>
                  <button onClick={() => cancel(r.id)}
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
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un joueur…"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ background: 'rgba(15,22,40,0.9)', border: '1px solid rgba(45,212,191,0.2)', color: TEXT }} />
            {searching && <Spinner color={TEAL} />}
            {!searching && search.trim().length >= 2 && results.length === 0 && (
              <Empty text="Aucun joueur trouvé." />
            )}
            <div className="space-y-2">
              {results.map(u => (
                <div key={u.uuid} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                     style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
                  <img src={`https://mc-heads.net/avatar/${u.username}/40`} alt={u.username}
                       className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: TEXT }}>{u.username}</p>
                  </div>
                  <RelationBtn relation={u.relation} onAdd={() => sendRequest(u.uuid)} teal={TEAL} />
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

function RelationBtn({ relation, onAdd, teal }: { relation: string; onAdd: () => void; teal: string }) {
  if (relation === 'friends')
    return <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>✓ Ami</span>
  if (relation === 'request_sent')
    return <span className="text-xs px-2.5 py-1 rounded-lg" style={{ color: MUTED, border: `1px solid rgba(255,255,255,0.08)` }}>Envoyée</span>
  if (relation === 'request_received')
    return <span className="text-xs px-2.5 py-1 rounded-lg" style={{ color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>Reçue</span>
  return (
    <button onClick={onAdd}
      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
      style={{ background: 'rgba(45,212,191,0.1)', color: teal, border: '1px solid rgba(45,212,191,0.25)' }}>
      + Ajouter
    </button>
  )
}

function Spinner({ color }: { color: string }) {
  return (
    <div className="flex justify-center py-10">
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
           style={{ borderColor: `${color}30`, borderTopColor: color }} />
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-center py-10 text-sm" style={{ color: MUTED }}>{text}</p>
}
