import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type ActiveSanction, type DailyStatus, type DailyClaimResult, type ReferralInfo } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import CompassRose from '../components/codex/CompassRose'
import WaxSeal from '../components/codex/WaxSeal'
import RuneIcon from '../components/codex/RuneIcon'
import Flourish from '../components/codex/Flourish'

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function roleSeal(role: string): { color: 'gold' | 'silver' | 'red' | 'bronze' | 'jade' } {
  const map: Record<string, 'gold' | 'silver' | 'red' | 'bronze' | 'jade'> = {
    VIP: 'gold', MODERATOR: 'silver', ADMIN: 'red', PLAYER: 'bronze',
  }
  return { color: map[role] ?? 'bronze' }
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

  const [friendCount, setFriendCount]   = useState<number | null>(null)
  const [referral, setReferral]         = useState<ReferralInfo | null>(null)
  const [refCopied, setRefCopied]       = useState(false)

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
    fetch('/api/public/friends', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setFriendCount(d.friends?.length ?? 0)).catch(() => {})
    fetch('/api/public/referral/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setReferral(d)).catch(() => {})
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
    <div className="min-h-screen flex items-center justify-center pb-20" style={{ background: '#080d19' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(240,169,59,0.2)', borderTopColor: '#F0A93B' }} />
      <Navbar />
    </div>
  )

  if (error || !profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 pb-28" style={{ background: '#080d19' }}>
      <p className="text-red-400 text-center">{error || 'Profil introuvable.'}</p>
      <Link to="/login" className="text-sm" style={{ color: 'var(--gold)' }}>Retour à la connexion</Link>
      <Navbar />
    </div>
  )

  const sanctions = profile.active_sanctions ?? []
  const sealColor = roleSeal(profile.role).color

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: '#080d19' }}>
      <PageAura theme="profile" />
      <CompassRose size={360} opacity={0.03} className="absolute top-0 left-[-80px] pointer-events-none z-0" />

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <div className="relative z-10">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(139,92,246,0.12),transparent)' }} />

        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8 codex-reveal codex-reveal-1">
            <div className="flex items-center gap-2">
              <RuneIcon rune="sun" size={18} color="var(--gold)" />
              <span className="text-sm font-bold font-codex-display" style={{ color: 'var(--ivory)' }}>SunAntiCheat</span>
            </div>
            <button onClick={logout}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors font-codex-body"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(240,169,59,0.15)', color: 'var(--parchment-shade)' }}>
              Déconnexion
            </button>
          </div>

          {/* Avatar + name */}
          <div className="flex items-end gap-5 codex-reveal codex-reveal-2">
            <div className="relative shrink-0">
              <div className="absolute inset-0 blur-2xl pointer-events-none rounded-2xl"
                   style={{ background: 'radial-gradient(circle,rgba(139,92,246,0.3),transparent)', transform: 'scale(1.4)' }} />
              <img
                src={`https://mc-heads.net/body/${profile.username}/100`}
                alt={profile.username}
                className="relative h-28 w-auto object-contain drop-shadow-2xl"
                onError={e => {
                  const img = e.target as HTMLImageElement
                  img.src = `https://mc-heads.net/avatar/${profile.username}/80`
                  img.className = 'relative w-20 h-20 rounded-2xl'
                  img.style.cssText = `border: 2px solid rgba(240,169,59,0.3)`
                }}
              />
              <span className={`absolute bottom-1 right-0 w-3.5 h-3.5 rounded-full border-2 ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`}
                    style={{ borderColor: '#080d19' }} />
            </div>

            <div className="flex-1 min-w-0 mb-2">
              <h1 className="text-3xl font-black leading-none mb-2 truncate font-codex-display" style={{ color: 'var(--ivory)' }}>
                {profile.username}
              </h1>
              <div className="flex items-center flex-wrap gap-2 mb-3">
                <WaxSeal color={sealColor} label={profile.role.slice(0, 3)} size={32} rotate={-2} />
                <span className={`text-xs flex items-center gap-1`}
                      style={{ color: profile.online ? '#4ade80' : 'var(--parchment-shade)' }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`} />
                  {profile.online ? 'En ligne' : 'Hors ligne'}
                </span>
              </div>
              {!bioEditing && (
                <p className="text-sm italic leading-relaxed font-codex-lyric"
                   style={{ color: bio ? 'var(--ivory-dim)' : 'var(--parchment-shade)' }}>
                  {bio ? `« ${bio} »` : 'Nulle biographie…'}
                </p>
              )}
            </div>
          </div>

          {/* Bio editor */}
          {bioEditing && (
            <div className="mt-4 space-y-2 codex-reveal codex-reveal-1">
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 160))}
                rows={2}
                placeholder="Présente-toi en quelques mots…"
                className="w-full rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none font-codex-body"
                style={{ background: 'rgba(15,22,40,0.9)', border: '1px solid rgba(240,169,59,0.3)', color: 'var(--ivory)' }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-codex-rune" style={{ color: 'var(--parchment-shade)' }}>{bio.length}/160</span>
                <div className="flex gap-2">
                  <button onClick={() => { setBioEditing(false); setBioError('') }}
                    className="text-xs px-3 py-1.5 rounded-lg border font-codex-body"
                    style={{ borderColor: 'rgba(240,169,59,0.2)', color: 'var(--parchment-shade)' }}>
                    Annuler
                  </button>
                  <button onClick={saveBio} disabled={bioSaving}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 font-codex-display"
                    style={{ background: 'linear-gradient(135deg,var(--amber),var(--ember))', color: 'var(--ink-deep)' }}>
                    {bioSaving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
              {bioError && <p className="text-xs text-red-400">{bioError}</p>}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4 codex-reveal codex-reveal-3">
            {!bioEditing && (
              <button onClick={() => setBioEditing(true)}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors font-codex-body codex-underline"
                style={{ background: 'rgba(240,169,59,0.06)', border: '1px solid rgba(240,169,59,0.18)', color: 'var(--parchment-shade)' }}>
                ✎ Modifier la bio
              </button>
            )}
            <a href={`/portal/player/${profile.username}`} target="_blank" rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg transition-colors font-codex-body codex-underline"
              style={{ background: 'rgba(240,169,59,0.06)', border: '1px solid rgba(240,169,59,0.18)', color: 'var(--parchment-shade)' }}>
              ✦ Profil public
            </a>
          </div>
        </div>
      </div>

      {/* Flourish separator */}
      <div className="flex justify-center mb-1 relative z-10">
        <Flourish variant="simple" color="rgba(240,169,59,0.3)" width={160} />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 mx-0 relative z-10 codex-reveal codex-reveal-3"
           style={{ borderTop: '1px solid rgba(240,169,59,0.12)', borderBottom: '1px solid rgba(240,169,59,0.12)' }}>
        <StatCell icon={<RuneIcon rune="compass" size={20} color="var(--gold)" />} label="Temps de jeu" value={profile.playtime_formatted ?? '—'} />
        <StatCell icon={<RuneIcon rune="star"    size={20} color="var(--gold)" />} label="Solde"         value={profile.balance != null ? fmtBalance(profile.balance) : '—'} />
        <StatCell icon={<RuneIcon rune="feather" size={20} color="var(--gold)" />} label="Amis"          value={friendCount != null ? String(friendCount) : '—'} />
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-3 max-w-screen-sm mx-auto relative z-10">

        {/* Daily reward */}
        {daily && daily.config?.enabled && (
          <section className="codex-cartouche rounded-2xl overflow-hidden codex-reveal codex-reveal-3">
            <div className="px-5 py-3.5 flex items-center justify-between"
                 style={{ borderBottom: '1px solid rgba(240,169,59,0.12)' }}>
              <div className="flex items-center gap-2">
                <RuneIcon rune="sun" size={16} color="var(--gold)" />
                <span className="text-sm font-semibold font-codex-display" style={{ color: 'var(--ivory)' }}>Récompense quotidienne</span>
              </div>
              <span className="text-xs font-codex-rune" style={{ color: 'var(--parchment-shade)' }}>
                Série : <span className="font-bold" style={{ color: 'var(--gold)' }}>{daily.streak}</span>j
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
                        ? 'rgba(240,169,59,0.6)'
                        : 'rgba(255,255,255,0.06)',
                      background: isCurrent && daily.canClaim
                        ? 'rgba(240,169,59,0.1)'
                        : 'rgba(255,255,255,0.03)',
                      opacity: isDone && !isCurrent ? 0.5 : 1,
                    }}>
                    <span className="text-sm leading-none">{d.icon ?? '✦'}</span>
                    <span className="text-[10px] font-medium font-codex-rune" style={{ color: 'var(--parchment-shade)' }}>J{d.day}</span>
                    {d.bonusCoins > 0 && <span className="text-[10px] font-bold leading-none font-codex-display" style={{ color: 'var(--gold)' }}>{d.bonusCoins}$</span>}
                    {isDone && <span className="text-green-400 text-[10px] leading-none">✓</span>}
                  </div>
                )
              })}
            </div>

            <div className="px-4 pb-4">
              {dailyResult ? (
                <div className="rounded-xl p-3 text-center space-y-1"
                     style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <p className="text-sm font-semibold text-green-400 font-codex-display">
                    {dailyResult.icon ?? '✦'} {dailyResult.displayName ?? `Jour ${dailyResult.day}`}
                  </p>
                  {dailyResult.bonusCoins > 0 && <p className="text-xs font-codex-rune" style={{ color: 'var(--gold)' }}>+{dailyResult.bonusCoins} coins</p>}
                  {dailyResult.itemsLabel && <p className="text-xs font-codex-body" style={{ color: 'var(--parchment-shade)' }}>{dailyResult.itemsLabel}</p>}
                  <p className="text-xs font-codex-body" style={{ color: 'var(--parchment-shade)' }}>{dailyResult.message}</p>
                </div>
              ) : daily.canClaim ? (
                <button onClick={claimDaily} disabled={dailyClaiming}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 font-codex-display"
                  style={{ background: 'linear-gradient(135deg,var(--amber),var(--ember))', color: 'var(--ink-deep)', boxShadow: '0 4px 20px rgba(240,169,59,0.25)' }}>
                  {dailyClaiming ? 'Réclamation…' : '✦ Réclamer ma récompense'}
                </button>
              ) : (
                <div className="text-center py-1">
                  <p className="text-xs font-codex-body" style={{ color: 'var(--parchment-shade)' }}>Prochaine dans</p>
                  <p className="text-sm font-semibold font-codex-rune" style={{ color: 'var(--ivory)' }}>{cooldownLabel}</p>
                </div>
              )}
              {dailyError && <p className="text-xs text-red-400 text-center mt-2">{dailyError}</p>}
            </div>
          </section>
        )}

        {/* Account info */}
        <section className="codex-cartouche rounded-2xl overflow-hidden codex-reveal codex-reveal-4">
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(240,169,59,0.12)' }}>
            <span className="text-sm font-semibold font-codex-display" style={{ color: 'var(--ivory)' }}>Informations du compte</span>
          </div>
          <div>
            <InfoRow label="UUID"               value={<span className="font-mono text-xs break-all" style={{ color: 'var(--parchment-shade)' }}>{profile.uuid}</span>} />
            <InfoRow label="Inscrit le"         value={fmtDate(profile.created_at)} />
            <InfoRow label="Dernière connexion" value={fmtDate(profile.last_login)} />
          </div>
        </section>

        {/* Sanctions */}
        {sanctions.length > 0 && (
          <section className="rounded-2xl overflow-hidden codex-reveal codex-reveal-4"
                   style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
              <span className="text-sm font-semibold text-red-400 font-codex-display">Sanctions actives</span>
            </div>
            <div>
              {sanctions.map(s => <SanctionRow key={s.id} s={s} />)}
            </div>
          </section>
        )}

        {sanctions.length === 0 && (
          <p className="text-center text-xs py-3 font-codex-body codex-reveal codex-reveal-4" style={{ color: 'rgba(71,85,105,1)' }}>
            ✓ Aucune sanction active
          </p>
        )}

        {/* Referral */}
        {referral && (
          <section className="codex-cartouche rounded-2xl overflow-hidden codex-reveal codex-reveal-5">
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(240,169,59,0.12)' }}>
              <span className="text-sm font-semibold font-codex-display" style={{ color: 'var(--ivory)' }}>✦ Parchemin de parrainage</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold tracking-widest text-center font-codex-rune"
                      style={{ background: 'rgba(240,169,59,0.08)', border: '1px solid rgba(240,169,59,0.25)', color: 'var(--gold)' }}>
                  {referral.code}
                </code>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/portal?ref=${referral.code}`
                    navigator.clipboard.writeText(link).then(() => { setRefCopied(true); setTimeout(() => setRefCopied(false), 2000) })
                  }}
                  className="text-xs px-3 py-2.5 rounded-xl font-semibold shrink-0 transition-all font-codex-display"
                  style={{
                    background: refCopied ? 'rgba(16,185,129,0.15)' : 'rgba(240,169,59,0.12)',
                    color: refCopied ? '#34d399' : 'var(--gold)',
                    border: `1px solid ${refCopied ? 'rgba(16,185,129,0.3)' : 'rgba(240,169,59,0.3)'}`,
                  }}>
                  {refCopied ? '✓ Copié !' : '✎ Copier'}
                </button>
              </div>
              <div className="flex gap-4 text-center">
                <div className="flex-1 rounded-xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-xl font-black font-codex-display" style={{ color: 'var(--ivory)' }}>{referral.total}</p>
                  <p className="text-xs font-codex-body" style={{ color: 'var(--parchment-shade)' }}>Inscrits</p>
                </div>
                <div className="flex-1 rounded-xl py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-xl font-black font-codex-display" style={{ color: 'var(--gold)' }}>{referral.validated}</p>
                  <p className="text-xs font-codex-body" style={{ color: 'var(--parchment-shade)' }}>Validés</p>
                </div>
              </div>
              <p className="text-xs text-center font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>
                Partage ton lien — les parrainages sont validés après 24h d'activité du filleul.
              </p>
            </div>
          </section>
        )}
      </div>

      <Navbar />
    </div>
  )
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4" style={{ background: 'rgba(15,22,40,0.6)' }}>
      {icon}
      <div>
        <p className="text-xs font-codex-body" style={{ color: 'var(--parchment-shade)' }}>{label}</p>
        <p className="text-base font-bold font-codex-display" style={{ color: 'var(--ivory)' }}>{value}</p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="codex-row flex items-center justify-between px-5 py-3 gap-4"
         style={{ borderBottom: '1px solid rgba(240,169,59,0.05)' }}>
      <span className="text-sm shrink-0 font-codex-body" style={{ color: 'var(--parchment-shade)' }}>{label}</span>
      <span className="text-sm text-right font-codex-body" style={{ color: 'var(--ivory)' }}>{value}</span>
    </div>
  )
}

function SanctionRow({ s }: { s: ActiveSanction }) {
  const fmtExpiry = (ts: number | null) =>
    ts ? new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Permanent'
  const color = { BAN: '#f87171', MUTE: '#fb923c', WARN: '#fbbf24', KICK: '#60a5fa' }[s.type] ?? '#94a3b8'

  return (
    <div className="px-5 py-3 flex items-start gap-3"
         style={{ borderBottom: '1px solid rgba(239,68,68,0.08)' }}>
      <span className="text-xs font-bold px-2 py-0.5 rounded border shrink-0 font-codex-rune"
            style={{ background: `${color}20`, color, borderColor: `${color}40` }}>
        {s.type}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate font-codex-body" style={{ color: 'var(--ivory)' }}>{s.reason || 'Aucune raison'}</p>
        <p className="text-xs mt-0.5 font-codex-body" style={{ color: 'var(--parchment-shade)' }}>
          Par {s.issued_by} · Expire : {fmtExpiry(s.expires_at)}
        </p>
      </div>
    </div>
  )
}
