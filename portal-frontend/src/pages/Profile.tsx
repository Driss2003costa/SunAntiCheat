import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type ActiveSanction, type DailyStatus, type DailyClaimResult } from '../api/client'
import Navbar from '../components/Navbar'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    PLAYER:    'bg-gray-700/60 text-gray-300 border-gray-600',
    VIP:       'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    MODERATOR: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    ADMIN:     'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return map[role] ?? 'bg-gray-700/60 text-gray-300 border-gray-600'
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

function fmtBalance(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [bio, setBio]               = useState('')
  const [bioEditing, setBioEditing] = useState(false)
  const [bioSaving, setBioSaving]   = useState(false)
  const [bioError, setBioError]     = useState('')

  const [daily, setDaily]                   = useState<DailyStatus | null>(null)
  const [dailyClaiming, setDailyClaiming]   = useState(false)
  const [dailyResult, setDailyResult]       = useState<DailyClaimResult | null>(null)
  const [dailyError, setDailyError]         = useState('')
  const [cooldownLabel, setCooldownLabel]   = useState('')

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
    api.dailyStatus(token).then(setDaily).catch(() => {})
  }, [navigate])

  useEffect(() => {
    if (!daily || daily.canClaim || daily.cooldownMs <= 0) { setCooldownLabel(''); return }
    const loadedAt = Date.now()
    const update = () => {
      const ms = daily.cooldownMs - (Date.now() - loadedAt)
      if (ms <= 0) { setCooldownLabel('Disponible !'); return }
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setCooldownLabel(`${h}h ${m}m ${s}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [daily])

  function logout() { clearToken(); navigate('/login', { replace: true }) }

  async function saveBio() {
    const token = getToken()
    if (!token) return
    setBioSaving(true); setBioError('')
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

  async function claimDaily() {
    const token = getToken()
    if (!token) return
    setDailyClaiming(true); setDailyError(''); setDailyResult(null)
    try {
      const res = await api.dailyClaim(token)
      setDailyResult(res)
      api.dailyStatus(token).then(setDaily).catch(() => {})
    } catch (e: any) {
      setDailyError(e.error || e.message || 'Erreur')
    } finally {
      setDailyClaiming(false)
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center pb-20">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      <Navbar />
    </div>
  )

  if (error || !profile) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 p-8 pb-28">
      <p className="text-red-400 text-center">{error || 'Profil introuvable.'}</p>
      <Link to="/login" className="text-sm text-brand-400 hover:text-brand-300">Retour à la connexion</Link>
      <Navbar />
    </div>
  )

  const sanctions = profile.active_sanctions ?? []

  return (
    <div className="min-h-screen bg-gray-950 pb-24">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/25 via-orange-600/10 to-gray-950" />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative px-5 pt-12 pb-6">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <span className="text-xl">☀️</span>
              <span className="text-sm font-bold text-white">SunAntiCheat</span>
            </div>
            <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg border border-gray-800 hover:border-gray-700">
              Déconnexion
            </button>
          </div>

          {/* Identity row */}
          <div className="flex items-end gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <img
                src={`https://mc-heads.net/body/${profile.username}/100`}
                alt={profile.username}
                className="h-28 w-auto object-contain drop-shadow-2xl"
                onError={e => {
                  const img = e.target as HTMLImageElement
                  img.src = `https://mc-heads.net/avatar/${profile.username}/80`
                  img.className = 'w-20 h-20 rounded-2xl border-2 border-gray-700'
                }}
              />
              <span className={`absolute bottom-1 right-0 w-3.5 h-3.5 rounded-full border-2 border-gray-950 ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`} />
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0 mb-2">
              <h1 className="text-3xl font-black text-white leading-none mb-2 truncate">{profile.username}</h1>
              <div className="flex items-center flex-wrap gap-2 mb-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${roleBadge(profile.role)}`}>
                  {profile.role}
                </span>
                <span className={`text-xs flex items-center gap-1 ${profile.online ? 'text-green-400' : 'text-gray-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`} />
                  {profile.online ? 'En ligne' : 'Hors ligne'}
                </span>
              </div>
              {/* Bio inline */}
              {!bioEditing && (
                <p className={`text-sm italic leading-relaxed ${bio ? 'text-gray-300' : 'text-gray-600'}`}>
                  {bio ? `"${bio}"` : 'Aucune biographie…'}
                </p>
              )}
            </div>
          </div>

          {/* Bio editor */}
          {bioEditing && (
            <div className="mt-4 space-y-2">
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 160))}
                rows={2}
                placeholder="Présente-toi en quelques mots…"
                className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-brand-500 backdrop-blur"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-600">{bio.length}/160</span>
                <div className="flex gap-2">
                  <button onClick={() => { setBioEditing(false); setBioError('') }}
                    className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700">
                    Annuler
                  </button>
                  <button onClick={saveBio} disabled={bioSaving}
                    className="text-xs text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors">
                    {bioSaving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
              {bioError && <p className="text-xs text-red-400">{bioError}</p>}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {!bioEditing && (
              <button onClick={() => setBioEditing(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-800/70 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors backdrop-blur">
                ✏️ Modifier la bio
              </button>
            )}
            <a
              href={`/portal/player/${profile.username}`}
              target="_blank" rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800/70 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors backdrop-blur"
            >
              🔗 Profil public
            </a>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px bg-gray-800/50 mx-0 border-y border-gray-800">
        <StatCell icon="⏱️" label="Temps de jeu" value={profile.playtime_formatted ?? '—'} />
        <StatCell icon="💰" label="Solde"         value={profile.balance != null ? fmtBalance(profile.balance) : '—'} />
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 space-y-3 max-w-screen-sm mx-auto">

        {/* Daily reward */}
        {daily && daily.config?.enabled && (
          <section className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🎁</span>
                <span className="text-sm font-semibold text-white">Récompense quotidienne</span>
              </div>
              <span className="text-xs text-gray-500">
                Série : <span className="text-yellow-400 font-bold">{daily.streak}</span>j
              </span>
            </div>

            <div className="p-4 grid grid-cols-7 gap-1.5">
              {daily.config.days.slice(0, daily.config.cycleDays).map(d => {
                const isCurrent = d.day === daily.nextDay
                const isDone    = d.day < daily.nextDay || (!daily.canClaim && d.day === daily.nextDay)
                return (
                  <div key={d.day}
                    className={`flex flex-col items-center gap-1 rounded-xl p-1.5 border transition-all
                      ${isCurrent && daily.canClaim
                        ? 'border-yellow-500/60 bg-yellow-500/10 ring-1 ring-yellow-500/30'
                        : isDone ? 'border-gray-700/50 bg-gray-800/30 opacity-50'
                        : 'border-gray-700/50 bg-gray-800/30'}`}
                  >
                    <span className="text-sm leading-none">{d.icon ?? '🎁'}</span>
                    <span className="text-[10px] text-gray-500 font-medium">J{d.day}</span>
                    {d.bonusCoins > 0 && <span className="text-[10px] text-yellow-400 font-bold leading-none">{d.bonusCoins}$</span>}
                    {isDone && <span className="text-green-400 text-[10px] leading-none">✓</span>}
                  </div>
                )
              })}
            </div>

            <div className="px-4 pb-4">
              {dailyResult ? (
                <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3 text-center space-y-1">
                  <p className="text-sm font-semibold text-green-400">
                    {dailyResult.icon ?? '🎁'} {dailyResult.displayName ?? `Jour ${dailyResult.day}`}
                  </p>
                  {dailyResult.bonusCoins > 0 && <p className="text-xs text-yellow-400">+{dailyResult.bonusCoins} coins</p>}
                  {dailyResult.itemsLabel && <p className="text-xs text-gray-400">{dailyResult.itemsLabel}</p>}
                  <p className="text-xs text-gray-500">{dailyResult.message}</p>
                </div>
              ) : daily.canClaim ? (
                <button onClick={claimDaily} disabled={dailyClaiming}
                  className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-gray-900 font-bold text-sm transition-colors">
                  {dailyClaiming ? 'Réclamation…' : '🎁 Réclamer ma récompense'}
                </button>
              ) : (
                <div className="text-center py-1">
                  <p className="text-xs text-gray-600">Prochaine dans</p>
                  <p className="text-sm font-semibold text-gray-300 font-mono">{cooldownLabel}</p>
                </div>
              )}
              {dailyError && <p className="text-xs text-red-400 text-center mt-2">{dailyError}</p>}
            </div>
          </section>
        )}

        {/* Account info */}
        <section className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">Informations du compte</span>
          </div>
          <div className="divide-y divide-gray-800/60">
            <InfoRow label="UUID"              value={<span className="font-mono text-xs text-gray-400 break-all">{profile.uuid}</span>} />
            <InfoRow label="Inscrit le"        value={fmtDate(profile.created_at)} />
            <InfoRow label="Dernière connexion" value={fmtDate(profile.last_login)} />
          </div>
        </section>

        {/* Sanctions */}
        {sanctions.length > 0 && (
          <section className="bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-red-500/20">
              <span className="text-sm font-semibold text-red-400">Sanctions actives</span>
            </div>
            <div className="divide-y divide-red-500/10">
              {sanctions.map(s => <SanctionRow key={s.id} s={s} />)}
            </div>
          </section>
        )}

        {sanctions.length === 0 && (
          <p className="text-center text-xs text-gray-700 py-3">✓ Aucune sanction active</p>
        )}
      </div>

      <Navbar />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-gray-900 flex items-center gap-3 px-5 py-4">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-base font-bold text-white">{value}</p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-white text-right">{value}</span>
    </div>
  )
}

function SanctionRow({ s }: { s: ActiveSanction }) {
  const fmtExpiry = (ts: number | null) =>
    ts ? new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Permanent'

  function sanctionBadge(type: string) {
    const map: Record<string, string> = {
      BAN:  'bg-red-500/20 text-red-400 border-red-500/30',
      MUTE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      WARN: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      KICK: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    }
    return map[type] ?? 'bg-gray-700 text-gray-300 border-gray-600'
  }

  return (
    <div className="px-5 py-3 flex items-start gap-3">
      <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 ${sanctionBadge(s.type)}`}>{s.type}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{s.reason || 'Aucune raison'}</p>
        <p className="text-xs text-gray-500 mt-0.5">Par {s.issued_by} · Expire : {fmtExpiry(s.expires_at)}</p>
      </div>
    </div>
  )
}
