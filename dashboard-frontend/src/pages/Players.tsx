import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

const PAGE_SIZE = 100

function fmtDate(ts: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type View = 'online' | 'all'

export default function Players() {
  const navigate  = useNavigate()
  const isAdmin   = useAuthStore(s => s.isAdmin())

  // Online players
  const [online, setOnline]   = useState<any[]>([])
  const [loadingOnline, setLoadingOnline] = useState(false)
  const [action, setAction]   = useState<{ type: string; player: any } | null>(null)
  const [reason, setReason]   = useState('')
  const [duration, setDuration] = useState('')

  // View toggle
  const [view, setView] = useState<View>('online')

  // All players
  const [allPlayers, setAllPlayers]   = useState<any[]>([])
  const [total, setTotal]             = useState(0)
  const [offset, setOffset]           = useState(0)
  const [loadingAll, setLoadingAll]   = useState(false)

  // Search
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [searching, setSearching]         = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Joueurs en ligne (polling) ─────────────────────────────────────────
  const loadOnline = async () => {
    setLoadingOnline(true)
    try { setOnline(await api.players()) } catch {}
    finally { setLoadingOnline(false) }
  }

  useEffect(() => {
    loadOnline()
    const i = setInterval(loadOnline, 5000)
    return () => clearInterval(i)
  }, [])

  // ── Tous les joueurs (chargé à la demande) ────────────────────────────
  const loadAll = async (off: number) => {
    setLoadingAll(true)
    try {
      const res = await api.playersAll(PAGE_SIZE, off)
      setAllPlayers(res.players)
      setTotal(res.total)
      setOffset(off)
    } catch {}
    finally { setLoadingAll(false) }
  }

  const switchToAll = () => {
    setView('all')
    if (allPlayers.length === 0) loadAll(0)
  }

  // ── Recherche ─────────────────────────────────────────────────────────
  const handleSearch = (q: string) => {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setSearchResults(null); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try { setSearchResults(await api.playersSearch(q.trim())) }
      catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 300)
  }

  async function doKick(uuid: string) {
    try { await api.kickPlayer(uuid, reason || 'Kicked by admin'); setAction(null); setReason('') }
    catch (e: any) { alert('Erreur: ' + e.message) }
  }
  async function doBan(uuid: string) {
    try {
      await api.banPlayer(uuid, reason || 'Banned by admin', duration ? parseInt(duration) * 3600000 : undefined)
      setAction(null); setReason(''); setDuration('')
    } catch (e: any) { alert('Erreur: ' + e.message) }
  }

  const totalPages  = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="p-6 space-y-6">

      {/* ── Barre de recherche ────────────────────────────────────────────── */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>🔍 Analyser un joueur</h2>
        <div className="flex gap-3">
          <input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && searchQuery.trim()) navigate(`/players/${encodeURIComponent(searchQuery.trim())}`) }}
            placeholder="Nom du joueur (en ligne ou hors-ligne)…"
            className="flex-1 px-3 py-2 rounded"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <button
            onClick={() => { if (searchQuery.trim()) navigate(`/players/${encodeURIComponent(searchQuery.trim())}`) }}
            disabled={!searchQuery.trim()}
            className="px-4 py-2 rounded text-white text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--primary)' }}>
            Voir le profil
          </button>
        </div>

        {searchQuery.trim().length >= 2 && (
          <div className="mt-3">
            {searching && <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Recherche…</div>}
            {!searching && searchResults !== null && searchResults.length === 0 && (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Aucun résultat dans l'historique. Essaie «&nbsp;Voir le profil&nbsp;» si tu connais le nom exact.
              </div>
            )}
            {!searching && searchResults && searchResults.length > 0 && (
              <div className="space-y-1 mt-1">
                {searchResults.map((p: any) => (
                  <button key={p.uuid} onClick={() => navigate(`/players/${encodeURIComponent(p.name)}`)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition text-left"
                          style={{ background: 'var(--surface-2)' }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.online ? '#10b981' : '#6b7280' }}/>
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{p.name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {p.online ? '● En ligne' : `Vu le ${fmtDate(p.lastSeen)}`}
                    </span>
                    <span className="ml-auto text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{p.uuid}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Toggle vue ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setView('online')}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition"
                  style={{
                    background: view === 'online' ? 'var(--primary)' : 'var(--surface)',
                    color: view === 'online' ? 'white' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}>
            🟢 En ligne ({online.length})
          </button>
          <button onClick={switchToAll}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition"
                  style={{
                    background: view === 'all' ? 'var(--primary)' : 'var(--surface)',
                    color: view === 'all' ? 'white' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}>
            👥 Tous les joueurs {total > 0 ? `(${total.toLocaleString()})` : ''}
          </button>
        </div>

        {view === 'all' && (
          <button onClick={() => loadAll(offset)}
                  className="text-xs px-3 py-1.5 rounded"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            ↻ Actualiser
          </button>
        )}
      </div>

      {/* ── Vue : joueurs en ligne ────────────────────────────────────────── */}
      {view === 'online' && (
        <div className="card overflow-x-auto">
          {loadingOnline && online.length === 0 && (
            <p className="text-center text-muted py-8">Chargement…</p>
          )}
          {!loadingOnline && online.length === 0 && (
            <p className="text-center text-muted py-8">Aucun joueur en ligne</p>
          )}
          {online.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left border-b border-border">
                  <th className="pb-2 pr-4">Joueur</th>
                  <th className="pb-2 pr-4">Monde</th>
                  <th className="pb-2 pr-4">Position</th>
                  <th className="pb-2 pr-4">Ping</th>
                  <th className="pb-2 pr-4">Mode</th>
                  {isAdmin && <th className="pb-2">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {online.map(p => (
                  <tr key={p.uuid} className="hover:bg-white/5 transition-colors">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"/>
                        <Link to={`/players/${encodeURIComponent(p.name)}`}
                              className="font-medium hover:underline" style={{ color: 'var(--primary)' }}>
                          {p.name}
                        </Link>
                      </div>
                      <div className="text-xs text-muted font-mono">{p.uuid}</div>
                    </td>
                    <td className="py-2 pr-4 text-muted">{p.world}</td>
                    <td className="py-2 pr-4 text-muted text-xs font-mono">
                      {Math.round(p.x)}, {Math.round(p.y)}, {Math.round(p.z)}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={p.ping < 80 ? 'text-success' : p.ping < 200 ? 'text-warning' : 'text-danger'}>
                        {p.ping}ms
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-muted">{p.gameMode}</td>
                    {isAdmin && (
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button className="btn-ghost text-xs px-2 py-1"
                                  onClick={() => { setAction({ type: 'kick', player: p }); setReason('') }}>
                            Kick
                          </button>
                          <button className="text-xs px-2 py-1 rounded bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
                                  onClick={() => { setAction({ type: 'ban', player: p }); setReason(''); setDuration('') }}>
                            Ban
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Vue : tous les joueurs ────────────────────────────────────────── */}
      {view === 'all' && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {loadingAll && allPlayers.length === 0 ? (
            <p className="text-center text-muted py-12">Chargement de tous les joueurs…</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left px-4 py-2 text-muted font-medium">Joueur</th>
                    <th className="text-left px-4 py-2 text-muted font-medium">Statut</th>
                    <th className="text-left px-4 py-2 text-muted font-medium">Dernière connexion</th>
                    <th className="text-left px-4 py-2 text-muted font-medium">UUID</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody style={{ background: 'var(--surface)' }}>
                  {allPlayers.map((p, i) => (
                    <tr key={p.uuid}
                        className="hover:bg-white/5 transition-colors"
                        style={{ borderBottom: i < allPlayers.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: p.online ? '#10b981' : '#4b5563' }}/>
                          <span className="font-medium" style={{ color: 'var(--text)' }}>{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {p.online
                          ? <span className="text-xs font-bold" style={{ color: '#10b981' }}>● En ligne</span>
                          : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>○ Hors-ligne</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {p.online ? 'Maintenant' : fmtDate(p.lastSeen)}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        {p.uuid}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => navigate(`/players/${encodeURIComponent(p.name)}`)}
                                className="text-xs px-3 py-1 rounded hover:opacity-80 transition"
                                style={{ background: 'var(--surface-2)', color: 'var(--primary)', border: '1px solid var(--border)' }}>
                          Profil →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3"
                     style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Page {currentPage} / {totalPages} · {total.toLocaleString()} joueurs au total
                  </span>
                  <div className="flex gap-2">
                    <button disabled={offset === 0}
                            onClick={() => loadAll(Math.max(0, offset - PAGE_SIZE))}
                            className="text-xs px-3 py-1.5 rounded disabled:opacity-30"
                            style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      ← Précédent
                    </button>
                    <button disabled={offset + PAGE_SIZE >= total}
                            onClick={() => loadAll(offset + PAGE_SIZE)}
                            className="text-xs px-3 py-1.5 rounded disabled:opacity-30"
                            style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      Suivant →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modal kick / ban ─────────────────────────────────────────────── */}
      {action && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setAction(null)}>
          <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">
              {action.type === 'kick' ? '👢 Kick' : '🔨 Ban'} — {action.player.name}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Raison</label>
                <input className="input w-full" value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison…"/>
              </div>
              {action.type === 'ban' && (
                <div>
                  <label className="block text-xs text-muted mb-1">Durée (heures, vide = permanent)</label>
                  <input className="input w-full" type="number" value={duration}
                         onChange={e => setDuration(e.target.value)} placeholder="Ex: 24"/>
                </div>
              )}
              <div className="flex gap-3 justify-end mt-4">
                <button className="btn-ghost" onClick={() => setAction(null)}>Annuler</button>
                <button
                  className={action.type === 'ban'
                    ? 'px-4 py-2 rounded-lg bg-danger text-white font-medium hover:bg-danger/80 transition-colors'
                    : 'btn-primary px-4'}
                  onClick={() => action.type === 'kick' ? doKick(action.player.uuid) : doBan(action.player.uuid)}>
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
