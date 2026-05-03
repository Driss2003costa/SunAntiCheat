import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type ActiveSanction } from '../api/client'

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    PLAYER:    'bg-gray-700 text-gray-300',
    VIP:       'bg-yellow-500/20 text-yellow-400',
    MODERATOR: 'bg-blue-500/20 text-blue-400',
    ADMIN:     'bg-red-500/20 text-red-400',
  }
  return map[role] ?? 'bg-gray-700 text-gray-300'
}

function sanctionBadge(type: string) {
  const map: Record<string, string> = {
    BAN:  'bg-red-500/20 text-red-400 border-red-500/30',
    MUTE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    WARN: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    KICK: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }
  return map[type] ?? 'bg-gray-700 text-gray-300 border-gray-600'
}

function fmtBalance(balance: number) {
  return balance.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
}

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Bio editing state
  const [bio, setBio]           = useState('')
  const [bioEditing, setBioEditing] = useState(false)
  const [bioSaving, setBioSaving]   = useState(false)
  const [bioError, setBioError]     = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    api.me(token)
      .then(p => { setProfile(p); setBio((p as any).bio ?? '') })
      .catch(e => {
        if (e.status === 401) { clearToken(); navigate('/login', { replace: true }) }
        else setError(e.message || 'Erreur de chargement.')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  function logout() { clearToken(); navigate('/login', { replace: true }) }

  async function saveBio() {
    const token = getToken()
    if (!token) return
    setBioSaving(true)
    setBioError('')
    try {
      const res = await fetch('/api/public/player/me/bio', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setBio(data.bio ?? bio)
      setBioEditing(false)
    } catch (e: any) {
      setBioError(e.message || 'Erreur de sauvegarde')
    } finally {
      setBioSaving(false)
    }
  }

  if (loading) return (
    <Screen>
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Screen>
  )

  if (error) return (
    <Screen>
      <p className="text-red-400 text-center">{error}</p>
    </Screen>
  )

  if (!profile) return null

  const sanctions = profile.active_sanctions ?? []

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☀️</span>
            <span className="font-bold text-white">SunAntiCheat</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400 text-sm">Portail Joueur</span>
          </div>
          <button onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Déconnexion
          </button>
        </div>

        {/* Profile card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="bg-gradient-to-r from-brand-600/20 to-orange-600/10 px-6 py-5 flex items-center gap-4">
            <img
              src={`https://mc-heads.net/avatar/${profile.username}/64`}
              alt={profile.username}
              className="w-16 h-16 rounded-xl border-2 border-gray-700 bg-gray-800"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white truncate">{profile.username}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(profile.role)}`}>
                  {profile.role}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${profile.online ? 'bg-green-500' : 'bg-gray-600'}`} />
                <span className={`text-xs ${profile.online ? 'text-green-400' : 'text-gray-500'}`}>
                  {profile.online ? 'En ligne' : 'Hors ligne'}
                </span>
              </div>
            </div>
          </div>

          {/* Bio section */}
          <div className="px-6 py-4 border-t border-gray-800">
            {bioEditing ? (
              <div className="space-y-2">
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value.slice(0, 160))}
                  rows={2}
                  placeholder="Présente-toi en quelques mots…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-brand-500"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-600">{bio.length}/160</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setBioEditing(false); setBioError('') }}
                      className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1 rounded-lg border border-gray-700">
                      Annuler
                    </button>
                    <button onClick={saveBio} disabled={bioSaving}
                      className="text-xs text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-3 py-1 rounded-lg transition-colors">
                      {bioSaving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
                {bioError && <p className="text-xs text-red-400">{bioError}</p>}
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <p className={`text-sm ${bio ? 'text-gray-300 italic' : 'text-gray-600'}`}>
                  {bio ? `"${bio}"` : 'Aucune biographie. Clique pour en ajouter une !'}
                </p>
                <button onClick={() => setBioEditing(true)}
                  className="text-xs text-gray-500 hover:text-gray-300 shrink-0 transition-colors">
                  ✏️ Modifier
                </button>
              </div>
            )}
          </div>

          <div className="divide-y divide-gray-800">
            <Row label="UUID" value={<span className="font-mono text-xs text-gray-400 break-all">{profile.uuid}</span>} />
            <Row label="Inscrit le"           value={fmtDate(profile.created_at)} />
            <Row label="Dernière connexion"    value={fmtDate(profile.last_login)} />
          </div>

          {/* Link to public profile */}
          <div className="px-6 py-3 border-t border-gray-800">
            <a
              href={`/portal/player/${profile.username}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
            >
              🔗 Voir mon profil public
            </a>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Temps de jeu"
            value={profile.playtime_formatted ?? '—'}
            icon="⏱️"
          />
          <StatCard
            label="Solde"
            value={profile.balance != null ? fmtBalance(profile.balance) : '—'}
            icon="💰"
          />
        </div>

        {/* Active sanctions */}
        {sanctions.length > 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Sanctions actives</h3>
            </div>
            <div className="divide-y divide-gray-800">
              {sanctions.map(s => <SanctionRow key={s.id} s={s} />)}
            </div>
          </div>
        )}

        {sanctions.length === 0 && (
          <p className="text-center text-xs text-gray-600 py-2">
            Aucune sanction active. Continue comme ça !
          </p>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-white truncate">{value}</p>
      </div>
    </div>
  )
}

function SanctionRow({ s }: { s: ActiveSanction }) {
  function fmtExpiry(ts: number | null) {
    if (!ts) return 'Permanent'
    const d = new Date(ts)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="px-5 py-3 flex items-start gap-3">
      <span className={`text-xs font-bold px-2 py-1 rounded border shrink-0 ${sanctionBadge(s.type)}`}>
        {s.type}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{s.reason || 'Aucune raison'}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Par {s.issued_by} · Expire : {fmtExpiry(s.expires_at)}
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-3 gap-4">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className="text-sm text-white text-right">{value}</span>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 p-6">
        {children}
        <Link to="/login" className="block text-center text-sm text-brand-400 hover:text-brand-300 mt-4">
          Retour à la connexion
        </Link>
      </div>
    </div>
  )
}
