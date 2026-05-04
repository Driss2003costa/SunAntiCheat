import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type ActiveSanction, type DailyStatus, type DailyClaimResult } from '../api/client'
import Navbar from '../components/Navbar'
import SunBackground from '../components/SunBackground'

const BG     = '#080d19'
const CARD   = 'rgba(15,22,40,0.8)'
const BORDER = 'rgba(251,191,36,0.12)'
const GOLD   = '#fbbf24'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function roleBadge(role: string) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    PLAYER:    { bg: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: 'rgba(255,255,255,0.1)' },
    VIP:       { bg: 'rgba(251,191,36,0.15)',  color: GOLD,      border: 'rgba(251,191,36,0.35)' },
    MODERATOR: { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', border: 'rgba(59,130,246,0.35)' },
    ADMIN:     { bg: 'rgba(239,68,68,0.15)',   color: '#f87171', border: 'rgba(239,68,68,0.35)' },
  }
  return map[role] ?? map.PLAYER
}

function sanctionColor(type: string) {
  const map: Record<string, string> = {
    BAN: '#f87171', MUTE: '#fb923c', WARN: GOLD, KICK: '#60a5fa',
  }
  return map[type] ?? '#94a3b8'
}

function fmtBalance(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
}

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [bio, setBio]               = useState('')
  const [bioEditing, setBioEditing] = useState(false)
  const [bioSaving, setBioSaving]   = useState(false)
  const [bioError, setBioError]     = useState('')

  const [daily, setDaily]                 = useState<DailyStatus | null>(null)
  const [dailyClaiming, setDailyClaiming] = useState(false)
  const [dailyResult, setDailyResult]     = useState<DailyClaimResult | null>(null)
  const [dailyError, setDailyError]       = useState('')
  const [cooldownLabel, setCooldownLabel] = useState('')

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center pb-20" style={{ background: BG }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
      <Navbar />
    </div>
  )

  if (error || !profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 pb-28" style={{ background: BG }}>
      <p className="text-red-400 text-center">{error || 'Profil introuvable.'}</p>
      <Link to="/login" className="text-sm" style={{ color: GOLD }}>Retour à la connexion</Link>
      <Navbar />
    </div>
  )

  const sanctions = profile.active_sanctions ?? []
  const rb = roleBadge(profile.role)

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: BG }}>
      <SunBackground />

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden z-10">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(251,191,36,0.18),transparent)' }} />

        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <span className="text-xl">☀️</span>
              <span className="text-sm font-bold" style={{ color: TEXT }}>SunAntiCheat</span>
            </div>
            <button onClick={logout}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: MUTED }}>
              Déconnexion
            </button>
          </div>

          {/* Avatar + name */}
          <div className="flex items-end gap-5">
            <div className="relative shrink-0">
              {/* Halo */}
              <div className="absolute inset-0 rounded-2xl blur-xl pointer-events-none"
                   style={{ background: 'radial-gradient(circle,rgba(251,191,36,0.25),transparent)', transform: 'scale(1.3)' }} />
              <img
                src={`https://mc-heads.net/body/${profile.username}/100`}
                alt={profile.username}
                className="relative h-28 w-auto object-contain drop-shadow-2xl"
                onError={e => {
                  const img = e.target as HTMLImageElement
                  img.src = `https://mc-heads.net/avatar/${profile.username}/80`
                  img.className = 'relative w-20 h-20 rounded-2xl'
                  img.style.cssText = `border: 2px solid rgba(251,191,36,0.3)`
                }}
              />
              <span className={`absolute bottom-1 right-0 w-3.5 h-3.5 rounded-full border-2 ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`}
                    style={{ borderColor: BG }} />
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0 mb-2">
              <h1 className="text-3xl font-black leading-none mb-2 truncate" style={{ color: TEXT }}>{profile.username}</h1>
              <div className="flex items-center flex-wrap gap-2 mb-2">
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold border"
                      style={{ background: rb.bg, color: rb.color, borderColor: rb.border }}>
                  {profile.role}
                </span>
                <span className={`text-xs flex items-center gap-1`}
                      style={{ color: profile.online ? '#4ade80' : MUTED }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`} />
                  {profile.online ? 'En ligne' : 'Hors ligne'}
                </span>
              </div>
              {!bioEditing && (
                <p className="text-sm italic leading-relaxed" style={{ color: bio ? '#cbd5e1' : MUTED }}>
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
                className="w-full rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none backdrop-blur"
                style={{ background: 'rgba(15,22,40,0.9)', border: `1px solid rgba(251,191,36,0.3)`, color: TEXT }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs" style={{ color: MUTED }}>{bio.length}/160</span>
                <div className="flex gap-2">
                  <button onClick={() => { setBioEditing(false); setBioError('') }}
                    className="text-xs px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: BORDER, color: MUTED }}>
                    Annuler
                  </button>
                  <button onClick={saveBio} disabled={bioSaving}
                    className="text-xs text-gray-900 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' }}>
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
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(251,191,36,0.08)', border: `1px solid ${BORDER}`, color: MUTED }}>
                ✏️ Modifier la bio
              </button>
            )}
            <a href={`/portal/player/${profile.username}`} target="_blank" rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(251,191,36,0.08)', border: `1px solid ${BORDER}`, color: MUTED }}>
              🔗 Profil public
            </a>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 mx-0"
           style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <StatCell icon="⏱️" label="Temps de jeu" value={profile.playtime_formatted ?? '—'} />
        <StatCell icon="💰" label="Solde"         value={profile.balance != null ? fmtBalance(profile.balance) : '—'} />
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-3 max-w-screen-sm mx-auto relative z-10">

        {/* Daily reward */}
        {daily && daily.config?.enabled && (
          <section className="rounded-2xl overflow-hidden backdrop-blur-sm"
                   style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="px-5 py-3.5 flex items-center justify-between"
                 style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2">
                <span>🎁</span>
                <span className="text-sm font-semibold" style={{ color: TEXT }}>Récompense quotidienne</span>
              </div>
              <span className="text-xs" style={{ color: MUTED }}>
                Série : <span className="font-bold" style={{ color: GOLD }}>{daily.streak}</span>j
              </span>
            </div>

            <div className="p-4 grid grid-cols-7 gap-1.5">
              {daily.config.days.slice(0, daily.config.cycleDays).map(d => {
                const isCurrent = d.day === daily.nextDay
                const isDone    = d.day < daily.nextDay || (!daily.canClaim && d.day === daily.nextDay)
                return (
                  <div key={d.day}
                    className="flex flex-col items-center gap-1 rounded-xl p-1.5 border transition-all"
                    style={{
                      borderColor: isCurrent && daily.canClaim
                        ? 'rgba(251,191,36,0.6)'
                        : isDone ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.06)',
                      background: isCurrent && daily.canClaim
                        ? 'rgba(251,191,36,0.1)'
                        : isDone ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.03)',
                      opacity: isDone && !isCurrent ? 0.5 : 1,
                    }}>
                    <span className="text-sm leading-none">{d.icon ?? '🎁'}</span>
                    <span className="text-[10px] font-medium" style={{ color: MUTED }}>J{d.day}</span>
                    {d.bonusCoins > 0 && <span className="text-[10px] font-bold leading-none" style={{ color: GOLD }}>{d.bonusCoins}$</span>}
                    {isDone && <span className="text-green-400 text-[10px] leading-none">✓</span>}
                  </div>
                )
              })}
            </div>

            <div className="px-4 pb-4">
              {dailyResult ? (
                <div className="rounded-xl p-3 text-center space-y-1"
                     style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <p className="text-sm font-semibold text-green-400">
                    {dailyResult.icon ?? '🎁'} {dailyResult.displayName ?? `Jour ${dailyResult.day}`}
                  </p>
                  {dailyResult.bonusCoins > 0 && <p className="text-xs" style={{ color: GOLD }}>+{dailyResult.bonusCoins} coins</p>}
                  {dailyResult.itemsLabel && <p className="text-xs" style={{ color: MUTED }}>{dailyResult.itemsLabel}</p>}
                  <p className="text-xs" style={{ color: MUTED }}>{dailyResult.message}</p>
                </div>
              ) : daily.canClaim ? (
                <button onClick={claimDaily} disabled={dailyClaiming}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 text-gray-900"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', boxShadow: '0 4px 20px rgba(251,191,36,0.25)' }}>
                  {dailyClaiming ? 'Réclamation…' : '🎁 Réclamer ma récompense'}
                </button>
              ) : (
                <div className="text-center py-1">
                  <p className="text-xs" style={{ color: MUTED }}>Prochaine dans</p>
                  <p className="text-sm font-semibold font-mono" style={{ color: TEXT }}>{cooldownLabel}</p>
                </div>
              )}
              {dailyError && <p className="text-xs text-red-400 text-center mt-2">{dailyError}</p>}
            </div>
          </section>
        )}

        {/* Account info */}
        <section className="rounded-2xl overflow-hidden backdrop-blur-sm"
                 style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <span className="text-sm font-semibold" style={{ color: TEXT }}>Informations du compte</span>
          </div>
          <div>
            <InfoRow label="UUID"              value={<span className="font-mono text-xs break-all" style={{ color: MUTED }}>{profile.uuid}</span>} />
            <InfoRow label="Inscrit le"        value={fmtDate(profile.created_at)} />
            <InfoRow label="Dernière connexion" value={fmtDate(profile.last_login)} />
          </div>
        </section>

        {/* Sanctions */}
        {sanctions.length > 0 && (
          <section className="rounded-2xl overflow-hidden backdrop-blur-sm"
                   style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
              <span className="text-sm font-semibold text-red-400">Sanctions actives</span>
            </div>
            <div>
              {sanctions.map(s => <SanctionRow key={s.id} s={s} />)}
            </div>
          </section>
        )}

        {sanctions.length === 0 && (
          <p className="text-center text-xs py-3" style={{ color: '#475569' }}>✓ Aucune sanction active</p>
        )}
      </div>

      <Navbar />
    </div>
  )
}

function StatCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'rgba(15,22,40,0.6)' }}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs" style={{ color: '#64748b' }}>{label}</p>
        <p className="text-base font-bold" style={{ color: '#f1f5f9' }}>{value}</p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 gap-4"
         style={{ borderBottom: '1px solid rgba(251,191,36,0.05)' }}>
      <span className="text-sm shrink-0" style={{ color: '#64748b' }}>{label}</span>
      <span className="text-sm text-right" style={{ color: '#f1f5f9' }}>{value}</span>
    </div>
  )
}

function SanctionRow({ s }: { s: ActiveSanction }) {
  const fmtExpiry = (ts: number | null) =>
    ts ? new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Permanent'
  const color = {
    BAN: '#f87171', MUTE: '#fb923c', WARN: '#fbbf24', KICK: '#60a5fa',
  }[s.type] ?? '#94a3b8'

  return (
    <div className="px-5 py-3 flex items-start gap-3"
         style={{ borderBottom: '1px solid rgba(239,68,68,0.08)' }}>
      <span className="text-xs font-bold px-2 py-0.5 rounded border shrink-0"
            style={{ background: `${color}20`, color, borderColor: `${color}40` }}>
        {s.type}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: '#f1f5f9' }}>{s.reason || 'Aucune raison'}</p>
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Par {s.issued_by} · Expire : {fmtExpiry(s.expires_at)}</p>
      </div>
    </div>
  )
}
