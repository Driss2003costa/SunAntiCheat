import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getToken } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import { GridShell, HeroBanner, SectionDivider, Card, Button, Tag } from '../components/ui'

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
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').startsWith('fr') ? 'fr-FR' : 'en-GB'
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
    } catch { setError(t('friends.errorLoading')) }
    finally { setLoading(false) }
  }, [token, t])

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
    if (!confirm(t('friends.confirmRemove'))) return
    try { await apiFetch(`${BASE}/friends/${uuid}`, token!, { method: 'DELETE' }); await load() } catch {}
  }
  async function openChat(uuid: string) {
    try {
      const data = await apiFetch(`${BASE}/messages/open`, token!, { method: 'POST', body: JSON.stringify({ target_uuid: uuid }) })
      navigate(`/messages/${data.id}`)
    } catch {}
  }

  const tabs: { key: Tab; label: string; icon: string; badge?: number }[] = [
    { key: 'friends',  label: t('friends.tabs.friends'),  icon: '👥', badge: friends.length  },
    { key: 'incoming', label: t('friends.tabs.incoming'), icon: '📥', badge: incoming.length },
    { key: 'outgoing', label: t('friends.tabs.outgoing'), icon: '📤', badge: outgoing.length },
    { key: 'search',   label: t('friends.tabs.search'),   icon: '🔍' },
  ]

  const heroSubtitle = `${t('friends.hero.subtitle', { count: friends.length })}${incoming.length > 0 ? ` · ${t('friends.hero.incoming', { count: incoming.length })}` : ''}.`

  return (
    <div className="min-h-screen" style={{ background: '#080d19' }}>
      <PageAura theme="friends" />
      <GridShell>
        <HeroBanner
          eyebrow={t('friends.eyebrow')}
          variant="aurora"
          title={<>{t('friends.heroTitleStart')}<span className="text-emerald-300">{t('friends.heroTitleHighlight')}</span>{t('friends.heroTitleEnd')}</>}
          subtitle={heroSubtitle}
          cta={
            <Button onClick={() => setTab('search')} size="lg">{t('friends.hero.buttonFind')}</Button>
          }
        />

        {error && (
          <Card padding="md" className="mb-6 text-center" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Card padding="sm">
              <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                {tabs.map(tb => (
                  <button key={tb.key} onClick={() => setTab(tb.key)}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 lg:w-full text-left"
                    style={{
                      background: tab === tb.key ? 'rgba(45,212,191,0.12)' : 'transparent',
                      color: tab === tb.key ? '#5eead4' : 'rgba(241,245,249,0.65)',
                      border: tab === tb.key ? '1px solid rgba(45,212,191,0.25)' : '1px solid transparent',
                    }}>
                    <span className="flex items-center gap-2">
                      <span>{tb.icon}</span>
                      <span>{tb.label}</span>
                    </span>
                    {tb.badge != null && tb.badge > 0 && (
                      <Tag tone={tab === tb.key ? 'jade' : 'neutral'} size="xs">{tb.badge}</Tag>
                    )}
                  </button>
                ))}
              </nav>
            </Card>
          </aside>

          {/* Main */}
          <section>
            {tab === 'friends' && (
              <>
                {loading ? <Spinner /> : friends.length === 0 ? (
                  <EmptyCard text={t('friends.empty.friends')} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {friends.map(f => (
                      <Card key={f.uuid} padding="md" hover>
                        <div className="flex items-center gap-3">
                          <img src={`https://mc-heads.net/avatar/${f.username}/48`} alt={f.username}
                               className="w-12 h-12 rounded-xl shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-display text-base font-semibold truncate" style={{ color: '#f8fafc' }}>{f.username}</p>
                            <p className="text-[11px]" style={{ color: 'rgba(241,245,249,0.5)' }}>
                              {t('friends.card.since', { date: new Date(f.since).toLocaleDateString(locale) })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button onClick={() => openChat(f.uuid)} variant="secondary" size="sm" fullWidth>{t('friends.card.messageButton')}</Button>
                          <Button onClick={() => remove(f.uuid)} variant="danger" size="sm">✕</Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'incoming' && (
              <>
                <SectionDivider label={t('friends.section.incomingCount', { count: incoming.length })} />
                {loading ? <Spinner /> : incoming.length === 0 ? (
                  <EmptyCard text={t('friends.empty.incoming')} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {incoming.map(r => (
                      <Card key={r.id} padding="md">
                        <div className="flex items-center gap-3">
                          <img src={`https://mc-heads.net/avatar/${r.username}/48`} alt={r.username}
                               className="w-12 h-12 rounded-xl shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-display text-base font-semibold truncate" style={{ color: '#f8fafc' }}>{r.username}</p>
                            <p className="text-xs" style={{ color: 'rgba(241,245,249,0.55)' }}>{t('friends.card.wantsToBe')}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button onClick={() => accept(r.id)} size="sm" fullWidth>{t('friends.card.accept')}</Button>
                          <Button onClick={() => decline(r.id)} variant="danger" size="sm">✕</Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'outgoing' && (
              <>
                <SectionDivider label={t('friends.section.outgoingCount', { count: outgoing.length })} />
                {loading ? <Spinner /> : outgoing.length === 0 ? (
                  <EmptyCard text={t('friends.empty.outgoing')} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {outgoing.map(r => (
                      <Card key={r.id} padding="md">
                        <div className="flex items-center gap-3">
                          <img src={`https://mc-heads.net/avatar/${r.username}/48`} alt={r.username}
                               className="w-12 h-12 rounded-xl shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-display text-base font-semibold truncate" style={{ color: '#f8fafc' }}>{r.username}</p>
                            <p className="text-xs" style={{ color: 'rgba(241,245,249,0.55)' }}>{t('friends.card.pending')}</p>
                          </div>
                          <Button onClick={() => cancel(r.id)} variant="danger" size="sm">{t('friends.card.cancelRequest')}</Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'search' && (
              <>
                <SectionDivider label={t('friends.section.search')} />
                <Card padding="md" className="mb-5">
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={t('friends.search.placeholder') as string}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                    style={{ background: 'rgba(15,22,40,0.9)', border: '1px solid rgba(45,212,191,0.2)', color: '#f1f5f9' }} />
                </Card>
                {searching && <Spinner />}
                {!searching && search.trim().length >= 2 && results.length === 0 && (
                  <EmptyCard text={t('friends.empty.search')} />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {results.map(u => (
                    <Card key={u.uuid} padding="md">
                      <div className="flex items-center gap-3">
                        <img src={`https://mc-heads.net/avatar/${u.username}/48`} alt={u.username}
                             className="w-12 h-12 rounded-xl shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-base font-semibold truncate" style={{ color: '#f8fafc' }}>{u.username}</p>
                        </div>
                        <RelationBtn relation={u.relation} onAdd={() => sendRequest(u.uuid)} />
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </GridShell>

      <Navbar />
    </div>
  )
}

function RelationBtn({ relation, onAdd }: { relation: string; onAdd: () => void }) {
  const { t } = useTranslation()
  if (relation === 'friends')         return <Tag tone="jade">{t('friends.relation.friend')}</Tag>
  if (relation === 'request_sent')    return <Tag tone="neutral">{t('friends.relation.sent')}</Tag>
  if (relation === 'request_received') return <Tag tone="gold">{t('friends.relation.received')}</Tag>
  return <Button onClick={onAdd} size="sm">{t('friends.relation.add')}</Button>
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(45,212,191,0.2)', borderTopColor: '#2dd4bf' }} />
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card padding="lg" className="text-center">
      <p className="text-sm" style={{ color: 'rgba(241,245,249,0.5)' }}>{text}</p>
    </Card>
  )
}
