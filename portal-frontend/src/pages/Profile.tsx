import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type ActiveSanction, type DailyStatus, type DailyClaimResult, type ReferralInfo } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'

const GLASS  = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const GOLD   = '#fbbf24'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'
const BG     = '#080d19'

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtBalance(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
}

const ROLE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  PLAYER:    { bg: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: 'rgba(255,255,255,0.1)' },
  VIP:       { bg: 'rgba(251,191,36,0.12)',  color: GOLD,      border: 'rgba(251,191,36,0.3)'  },
  MODERATOR: { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa', border: 'rgba(59,130,246,0.3)'  },
  ADMIN:     { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', border: 'rgba(239,68,68,0.3)'   },
}

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [bio, setBio]             = useState('')
  const [bioEditing, setBioEdit]  = useState(false)
  const [bioSaving, setBioSaving] = useState(false)
  const [bioError,  setBioError]  = useState('')

  const [friendCount, setFriendCount] = useState<number | null>(null)
  const [referral, setReferral]       = useState<ReferralInfo | null>(null)
  const [refCopied, setRefCopied]     = useState(false)

  const [daily,         setDaily]        = useState<DailyStatus | null>(null)
  const [dailyClaiming, setDailyClaim]   = useState(false)
  const [dailyResult,   setDailyResult]  = useState<DailyClaimResult | null>(null)
  const [dailyError,    setDailyError]   = useState('')
  const [cooldown,      setCooldown]     = useState('')

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
    fetch('/api/public/friends', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setFriendCount(d.friends?.length ?? 0)).catch(() => {})
    fetch('/api/public/referral/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setReferral).catch(() => {})
  }, [navigate])

  useEffect(() => {
    if (!daily || daily.canClaim || daily.cooldownMs <= 0) { setCooldown(''); return }
    const loadedAt = Date.now()
    const tick = () => {
      const ms = daily.cooldownMs - (Date.now() - loadedAt)
      if (ms <= 0) { setCooldown('Disponible !'); return }
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setCooldown(`${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [daily])

  function logout() { clearToken(); navigate('/login', { replace: true }) }

  async function saveBio() {
    const token = getToken(); if (!token) return
    setBioSaving(true); setBioError('')
    try {
      const res = await fetch('/api/public/player/me/bio', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setBio(data.bio ?? bio); setBioEdit(false)
    } catch (e: any) {
      setBioError(e.message || 'Erreur de sauvegarde')
    } finally { setBioSaving(false) }
  }

  async function claimDaily() {
    const token = getToken(); if (!token) return
    setDailyClaim(true); setDailyError(''); setDailyResult(null)
    try {
      const res = await api.dailyClaim(token)
      setDailyResult(res)
      api.dailyStatus(token).then(setDaily).catch(() => {})
    } catch (e: any) {
      setDailyError(e.error || e.message || 'Erreur')
    } finally { setDailyClaim(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
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
  const rs = ROLE_STYLE[profile.role] ?? ROLE_STYLE.PLAYER

  return (
    <div className="min-h-screen pb-24" style={{ background: BG }}>
      <PageAura theme="profile" />

      {/* Hero */}
      <div className="relative z-10 px-5 pt-12 pb-0 max-w-screen-sm mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-sm font-semibold" style={{ color: TEXT }}>Mon profil</span>
          <button onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: GLASS, border: `1px solid ${BORDER}`, color: MUTED }}>
            Déconnexion
          </button>
        </div>

        {/* Avatar + info */}
        <div className="flex items-end gap-4 mb-5">
          <div className="relative shrink-0">
            <div className="absolute inset-0 blur-xl" style={{ background: 'rgba(139,92,246,0.3)', transform: 'scale(1.4)', borderRadius: 20 }} />
            <img
              src={`https://mc-heads.net/body/${profile.username}/100`}
              alt={profile.username}
              className="relative h-28 w-auto object-contain drop-shadow-xl"
              onError={e => {
                const img = e.target as HTMLImageElement
                img.src = `https://mc-heads.net/avatar/${profile.username}/80`
                img.className = 'relative w-20 h-20 rounded-2xl'
              }}
            />
            <span className={`absolute bottom-1 right-0 w-3.5 h-3.5 rounded-full border-2 ${profile.online ? 'bg-emerald-400' : 'bg-slate-600'}`}
                  style={{ borderColor: BG }} />
          </div>
          <div className="flex-1 min-w-0 mb-2">
            <h1 className="text-2xl font-bold leading-tight truncate" style={{ color: TEXT }}>{profile.username}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                    style={{ background: rs.bg, color: rs.color, borderColor: rs.border }}>
                {profile.role}
              </span>
              <span className="text-xs flex items-center gap-1"
                    style={{ color: profile.online ? '#34d399' : MUTED }}>
                <span className={`w-1.5 h-1.5 rounded-full ${profile.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                {profile.online ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
            {!bioEditing && (
              <p className="text-sm mt-2 italic leading-relaxed" style={{ color: bio ? '#cbd5e1' : MUTED }}>
                {bio ? `"${bio}"` : 'Aucune bio…'}
              </p>
            )}
          </div>
        </div>

        {/* Bio editor */}
        {bioEditing && (
          <div className="mb-4 space-y-2">
            <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 160))} rows={2}
              placeholder="Présente-toi en quelques mots…"
              className="w-full rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none"
              style={{ background: 'rgba(15,22,40,0.9)', border: '1px solid rgba(139,92,246,0.4)', color: TEXT }} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: MUTED }}>{bio.length}/160</span>
              <div className="flex gap-2">
                <button onClick={() => { setBioEdit(false); setBioError('') }}
                  className="text-xs px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: BORDER, color: MUTED }}>Annuler</button>
                <button onClick={saveBio} disabled={bioSaving}
                  className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 text-gray-900"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' }}>
                  {bioSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
            {bioError && <p className="text-xs text-red-400">{bioError}</p>}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mb-5">
          {!bioEditing && (
            <button onClick={() => setBioEdit(true)}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: GLASS, border: `1px solid ${BORDER}`, color: MUTED }}>
              ✏ Modifier la bio
            </button>
          )}
          <a href={`/portal/player/${profile.username}`} target="_blank" rel="noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: GLASS, border: `1px solid ${BORDER}`, color: MUTED, textDecoration: 'none' }}>
            ↗ Profil public
          </a>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 border-y relative z-10" style={{ borderColor: BORDER }}>
        {[
          { label: 'Temps de jeu', value: profile.playtime_formatted ?? '—' },
          { label: 'Solde',        value: profile.balance != null ? fmtBalance(profile.balance) : '—' },
          { label: 'Amis',         value: friendCount != null ? String(friendCount) : '—' },
        ].map((s, i) => (
          <div key={s.label} className="flex flex-col items-center justify-center py-4 gap-0.5"
               style={{ borderRight: i < 2 ? `1px solid ${BORDER}` : undefined, background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-base font-bold" style={{ color: TEXT }}>{s.value}</span>
            <span className="text-[10px]" style={{ color: MUTED }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-3 max-w-screen-sm mx-auto relative z-10">

        {/* Daily */}
        {daily?.config?.enabled && (
          <section className="rounded-2xl overflow-hidden" style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: BORDER }}>
              <span className="text-sm font-semibold" style={{ color: TEXT }}>Récompense quotidienne</span>
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
                    className="flex flex-col items-center gap-1 rounded-xl p-1.5 border"
                    style={{
                      borderColor: isCurrent && daily.canClaim ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.06)',
                      background:  isCurrent && daily.canClaim ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)',
                      opacity: isDone && !isCurrent ? 0.5 : 1,
                    }}>
                    <span className="text-sm leading-none">{d.icon ?? '🎁'}</span>
                    <span className="text-[9px]" style={{ color: MUTED }}>J{d.day}</span>
                    {d.bonusCoins > 0 && <span className="text-[9px] font-bold" style={{ color: GOLD }}>{d.bonusCoins}$</span>}
                    {isDone && <span className="text-emerald-400 text-[9px]">✓</span>}
                  </div>
                )
              })}
            </div>
            <div className="px-4 pb-4">
              {dailyResult ? (
                <div className="rounded-xl p-3 text-center space-y-1"
                     style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <p className="text-sm font-semibold text-emerald-400">{dailyResult.icon ?? '🎁'} {dailyResult.displayName ?? `Jour ${dailyResult.day}`}</p>
                  {dailyResult.bonusCoins > 0 && <p className="text-xs" style={{ color: GOLD }}>+{dailyResult.bonusCoins} coins</p>}
                  <p className="text-xs" style={{ color: MUTED }}>{dailyResult.message}</p>
                </div>
              ) : daily.canClaim ? (
                <div className="space-y-2">
                  <button onClick={claimDaily} disabled={dailyClaiming}
                    className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 text-gray-900"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', boxShadow: '0 4px 20px rgba(251,191,36,0.2)' }}>
                    {dailyClaiming ? 'Réclamation…' : '🎁 Réclamer ma récompense'}
                  </button>
                  <p className="text-center text-[10px]" style={{ color: MUTED }}>
                    🎮 Vous devez être connecté en jeu pour réclamer
                  </p>
                </div>
              ) : (
                <div className="text-center py-1">
                  <p className="text-xs" style={{ color: MUTED }}>Prochaine dans</p>
                  <p className="text-sm font-semibold font-mono" style={{ color: TEXT }}>{cooldown}</p>
                </div>
              )}
              {dailyError && <p className="text-xs text-red-400 text-center mt-2">{dailyError}</p>}
            </div>
          </section>
        )}

        {/* Account info */}
        <section className="rounded-2xl overflow-hidden" style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-widest border-b" style={{ color: MUTED, borderColor: BORDER }}>
            Informations du compte
          </p>
          {[
            { label: 'UUID',               value: <span className="font-mono text-xs break-all" style={{ color: MUTED }}>{profile.uuid}</span> },
            { label: 'Inscrit le',         value: fmtDate(profile.created_at) },
            { label: 'Dernière connexion', value: fmtDate(profile.last_login) },
          ].map((row, i, arr) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3 gap-4"
                 style={{ borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : undefined }}>
              <span className="text-sm shrink-0" style={{ color: MUTED }}>{row.label}</span>
              <span className="text-sm text-right" style={{ color: TEXT }}>{row.value}</span>
            </div>
          ))}
        </section>

        {/* Sanctions */}
        {sanctions.length > 0 && (
          <section className="rounded-2xl overflow-hidden"
                   style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="px-4 py-3 text-xs font-semibold uppercase tracking-widest border-b text-red-400"
               style={{ borderColor: 'rgba(239,68,68,0.15)' }}>Sanctions actives</p>
            {sanctions.map(s => <SanctionRow key={s.id} s={s} />)}
          </section>
        )}
        {sanctions.length === 0 && (
          <p className="text-center text-xs py-2" style={{ color: '#475569' }}>✓ Aucune sanction active</p>
        )}

        {/* Referral */}
        {referral && (
          <section className="rounded-2xl overflow-hidden" style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
            <p className="px-4 py-3 text-xs font-semibold uppercase tracking-widest border-b" style={{ color: MUTED, borderColor: BORDER }}>
              Code de parrainage
            </p>
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded-xl px-4 py-2.5 text-sm font-mono font-bold tracking-widest text-center"
                      style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: GOLD }}>
                  {referral.code}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/portal?ref=${referral.code}`)
                      .then(() => { setRefCopied(true); setTimeout(() => setRefCopied(false), 2000) })
                  }}
                  className="text-xs px-3 py-2.5 rounded-xl font-semibold shrink-0"
                  style={{
                    background: refCopied ? 'rgba(16,185,129,0.12)' : 'rgba(251,191,36,0.1)',
                    color: refCopied ? '#34d399' : GOLD,
                    border: `1px solid ${refCopied ? 'rgba(16,185,129,0.3)' : 'rgba(251,191,36,0.25)'}`,
                  }}>
                  {refCopied ? '✓ Copié' : 'Copier'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-lg font-bold" style={{ color: TEXT }}>{referral.total}</p>
                  <p className="text-xs" style={{ color: MUTED }}>Inscrits</p>
                </div>
                <div className="rounded-xl py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-lg font-bold" style={{ color: GOLD }}>{referral.validated}</p>
                  <p className="text-xs" style={{ color: MUTED }}>Validés</p>
                </div>
              </div>
              <p className="text-xs text-center" style={{ color: MUTED }}>
                Validés après 24h d'activité du filleul.
              </p>
            </div>
          </section>
        )}
      </div>

      <Navbar />
    </div>
  )
}

function SanctionRow({ s }: { s: ActiveSanction }) {
  const fmtExpiry = (ts: number | null) =>
    ts ? new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Permanent'
  const color = { BAN: '#f87171', MUTE: '#fb923c', WARN: '#fbbf24', KICK: '#60a5fa' }[s.type] ?? '#94a3b8'
  return (
    <div className="px-4 py-3 flex items-start gap-3 border-b" style={{ borderColor: 'rgba(239,68,68,0.08)' }}>
      <span className="text-xs font-bold px-2 py-0.5 rounded border shrink-0"
            style={{ background: `${color}20`, color, borderColor: `${color}40` }}>{s.type}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: '#f1f5f9' }}>{s.reason || 'Aucune raison'}</p>
        <p className="text-xs mt-0.5" style={{ color: MUTED }}>Par {s.issued_by} · {fmtExpiry(s.expires_at)}</p>
      </div>
    </div>
  )
}
