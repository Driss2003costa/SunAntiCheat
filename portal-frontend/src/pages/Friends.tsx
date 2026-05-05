import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import RuneIcon from '../components/codex/RuneIcon'
import CompassRose from '../components/codex/CompassRose'

const BASE = '/api/public'

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
    try { await apiFetch(`${BASE}/friends/accept/${reqId}`, token!, { method: 'POST' }); await load() } catch {}
  }

  async function declineRequest(reqId: string) {
    try { await apiFetch(`${BASE}/friends/decline/${reqId}`, token!, { method: 'POST' }); await load() } catch {}
  }

  async function cancelRequest(reqId: string) {
    try { await apiFetch(`${BASE}/friends/cancel/${reqId}`, token!, { method: 'POST' }); await load() } catch {}
  }

  async function removeFriend(friendUuid: string) {
    if (!confirm('Supprimer cet ami ?')) return
    try { await apiFetch(`${BASE}/friends/${friendUuid}`, token!, { method: 'DELETE' }); await load() } catch {}
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

  const tabs: { key: Tab; label: string; rune: 'feather' | 'star' | 'eye' | 'compass'; badge?: number }[] = [
    { key: 'friends',  label: 'Confrérie', rune: 'feather',  badge: friends.length },
    { key: 'incoming', label: 'Reçues',    rune: 'star',     badge: incoming.length },
    { key: 'outgoing', label: 'Envoyées',  rune: 'eye',      badge: outgoing.length },
    { key: 'search',   label: 'Chercher',  rune: 'compass' },
  ]

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: '#080d19' }}>
      <PageAura theme="friends" />
      <CompassRose size={380} opacity={0.04} color="var(--rune-jade)"
                   className="absolute top-[-40px] right-[-60px] pointer-events-none z-0" />

      <div className="relative z-10 px-4 pt-10 max-w-screen-sm mx-auto">
        {/* Header */}
        <div className="mb-6 codex-reveal codex-reveal-1">
          <div className="flex items-center gap-3 mb-1">
            <RuneIcon rune="feather" size={22} color="var(--rune-jade)" />
            <h1 className="text-2xl font-bold font-codex-display" style={{ color: 'var(--ivory)' }}>
              Confrérie des Voyageurs
            </h1>
          </div>
          <div className="w-48 h-px ml-9" style={{ background: 'linear-gradient(90deg,var(--rune-jade),transparent)' }} />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-5 p-1 rounded-2xl codex-reveal codex-reveal-2"
             style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(93,212,200,0.12)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center gap-1"
              style={{
                background: tab === t.key ? 'rgba(93,212,200,0.12)' : 'transparent',
                color: tab === t.key ? 'var(--rune-jade)' : 'var(--parchment-shade)',
                border: tab === t.key ? '1px solid rgba(93,212,200,0.3)' : '1px solid transparent',
              }}>
              <RuneIcon rune={t.rune} size={14} color={tab === t.key ? 'var(--rune-jade)' : 'var(--parchment-shade)'} />
              <span className="font-codex-display text-[10px]">{t.label}</span>
              {t.badge != null && t.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold font-codex-rune"
                      style={{
                        background: tab === t.key ? 'rgba(93,212,200,0.25)' : 'rgba(255,255,255,0.08)',
                        color: tab === t.key ? 'var(--rune-jade)' : 'var(--parchment-shade)',
                      }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-4 font-codex-body">{error}</p>}

        {/* Friends list */}
        {tab === 'friends' && (
          <div className="space-y-2 codex-reveal codex-reveal-3">
            {loading ? <Spinner /> : friends.length === 0 ? (
              <Empty text="Nul compagnon de route pour l'instant — pars à la recherche de voyageurs !" />
            ) : friends.map(f => (
              <div key={f.uuid} className="codex-cartouche codex-row flex items-center gap-3 rounded-2xl px-4 py-3">
                <div className="relative shrink-0">
                  <img src={`https://mc-heads.net/avatar/${f.username}/40`} alt={f.username}
                       className="w-10 h-10 rounded-xl" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
                       style={{ background: 'var(--rune-jade)', border: '2px solid #080d19' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate font-codex-display" style={{ color: 'var(--ivory)' }}>{f.username}</p>
                  <p className="text-xs font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>
                    compagnon depuis {new Date(f.since).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openChat(f.uuid)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all"
                    style={{ background: 'rgba(93,212,200,0.12)', color: 'var(--rune-jade)', border: '1px solid rgba(93,212,200,0.3)' }}>
                    ✉
                  </button>
                  <button onClick={() => removeFriend(f.uuid)}
                    className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
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
          <div className="space-y-2 codex-reveal codex-reveal-3">
            {loading ? <Spinner /> : incoming.length === 0 ? (
              <Empty text="Aucun voyageur n'a sollicité ton alliance." />
            ) : incoming.map(r => (
              <div key={r.id} className="codex-cartouche codex-row flex items-center gap-3 rounded-2xl px-4 py-3">
                <img src={`https://mc-heads.net/avatar/${r.username}/40`} alt={r.username}
                     className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate font-codex-display" style={{ color: 'var(--ivory)' }}>{r.username}</p>
                  <p className="text-xs font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>souhaite rejoindre ta confrérie</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => acceptRequest(r.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all font-codex-display"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                    ✓
                  </button>
                  <button onClick={() => declineRequest(r.id)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
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
          <div className="space-y-2 codex-reveal codex-reveal-3">
            {loading ? <Spinner /> : outgoing.length === 0 ? (
              <Empty text="Nulle invitation en attente de réponse." />
            ) : outgoing.map(r => (
              <div key={r.id} className="codex-cartouche codex-row flex items-center gap-3 rounded-2xl px-4 py-3">
                <img src={`https://mc-heads.net/avatar/${r.username}/40`} alt={r.username}
                     className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate font-codex-display" style={{ color: 'var(--ivory)' }}>{r.username}</p>
                  <p className="text-xs font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>invitation en suspens</p>
                </div>
                <button onClick={() => cancelRequest(r.id)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all font-codex-body"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Révoquer
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {tab === 'search' && (
          <div className="space-y-3 codex-reveal codex-reveal-3">
            <div className="relative">
              <RuneIcon rune="compass" size={16} color="var(--rune-jade)"
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Chercher un voyageur…"
                className="w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none font-codex-body"
                style={{ background: 'rgba(15,22,40,0.9)', border: '1px solid rgba(93,212,200,0.25)', color: 'var(--ivory)' }}
              />
            </div>
            {searching && <Spinner />}
            {!searching && search.trim().length >= 2 && results.length === 0 && (
              <Empty text="Nul voyageur de ce nom sous les étoiles." />
            )}
            <div className="space-y-2">
              {results.map(u => (
                <div key={u.uuid} className="codex-cartouche codex-row flex items-center gap-3 rounded-2xl px-4 py-3">
                  <img src={`https://mc-heads.net/avatar/${u.username}/40`} alt={u.username}
                       className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate font-codex-display" style={{ color: 'var(--ivory)' }}>{u.username}</p>
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
  if (relation === 'friends')
    return <span className="text-xs px-2.5 py-1 rounded-lg font-codex-display"
                 style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>✓ Allié</span>
  if (relation === 'request_sent')
    return <span className="text-xs px-2.5 py-1 rounded-lg font-codex-body"
                 style={{ color: 'var(--parchment-shade)', border: '1px solid rgba(240,169,59,0.15)' }}>Envoyée</span>
  if (relation === 'request_received')
    return <span className="text-xs px-2.5 py-1 rounded-lg font-codex-body"
                 style={{ color: 'var(--gold)', border: '1px solid rgba(240,169,59,0.3)' }}>Reçue</span>
  return (
    <button onClick={onAdd}
      className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all font-codex-display"
      style={{ background: 'rgba(93,212,200,0.12)', color: 'var(--rune-jade)', border: '1px solid rgba(93,212,200,0.3)' }}>
      + Inviter
    </button>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(93,212,200,0.2)', borderTopColor: 'var(--rune-jade)' }} />
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-12">
      <RuneIcon rune="compass" size={32} color="rgba(93,212,200,0.25)" className="mx-auto mb-3" />
      <p className="text-sm font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>{text}</p>
    </div>
  )
}
