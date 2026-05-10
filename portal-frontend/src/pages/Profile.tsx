import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, getToken, clearToken, type PlayerProfile, type ActiveSanction, type DailyStatus, type DailyClaimResult, type ReferralInfo } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import { GridShell, ProfileHero, StatCard, SectionDivider, Card, Button, Tag } from '../components/ui'

function fmtDate(ts: number | null | undefined, locale: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtBalance(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
}

const ROLE_TONE: Record<string, 'gold' | 'sky' | 'violet' | 'danger' | 'neutral'> = {
  PLAYER:    'neutral',
  VIP:       'gold',
  MODERATOR: 'sky',
  ADMIN:     'danger',
}

export default function Profile() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').startsWith('fr') ? 'fr-FR' : 'en-GB'
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
      if (!res.ok) throw new Error(data.error || t('common.error'))
      setBio(data.bio ?? bio); setBioEdit(false)
    } catch (e: any) {
      setBioError(e.message || t('profile.bioErrorSave'))
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
      setDailyError(e.error || e.message || t('common.error'))
    } finally { setDailyClaim(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080d19' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: '#FFB347' }} />
      <Navbar />
    </div>
  )
  if (error || !profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 pb-28" style={{ background: '#080d19' }}>
      <p className="text-red-400 text-center">{error || t('profile.errorNotFound')}</p>
      <Link to="/login" className="text-sm" style={{ color: '#fbbf24' }}>{t('profile.errorLink')}</Link>
      <Navbar />
    </div>
  )

  const sanctions = profile.active_sanctions ?? []

  return (
    <div className="min-h-screen" style={{ background: '#080d19' }}>
      <PageAura theme="profile" />
      <GridShell>
        {/* HERO — carte d'identité (différent de Home) */}
        <ProfileHero
          username={profile.username}
          role={profile.role}
          roleTone={ROLE_TONE[profile.role] ?? 'neutral'}
          bio={bio}
          online={profile.online}
          joinedAt={profile.created_at}
          lastLogin={profile.last_login}
          uuid={profile.uuid}
          actions={
            <>
              <Button onClick={() => setBioEdit(true)} variant="secondary" size="sm">{t('profile.hero.editBio')}</Button>
              <Button href={`/portal/player/${profile.username}`} target="_blank" variant="ghost" size="sm">{t('profile.hero.publicProfile')}</Button>
              <Button onClick={logout} variant="ghost" size="sm">{t('profile.hero.logout')}</Button>
            </>
          }
        />

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-12 lg:mb-16">
          <StatCard label={t('common.balance')} accent="gold" icon="💰"
                    value={profile.balance != null ? fmtBalance(profile.balance) : '—'} hint={t('common.serverEconomy')} />
          <StatCard label={t('common.playtime')} accent="jade" icon="⏱"
                    value={profile.playtime_formatted ?? '—'} hint={t('common.totalCumulative')} />
          <StatCard label={t('profile.stats.friends')} accent="violet" icon="👥"
                    value={friendCount != null ? String(friendCount) : '—'} hint={t('profile.stats.friendsHint')} />
          <StatCard label={t('common.role')} accent="sky" icon="✦" value={profile.role} hint={t('common.accountStatus')} />
        </div>

        {/* BIO EDITOR */}
        {bioEditing && (
          <div className="mb-10">
            <Card padding="lg">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-sun-300 mb-3">{t('profile.bioEdit.label')}</p>
              <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 160))} rows={3}
                placeholder={t('profile.bioEdit.placeholder') as string}
                className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
                style={{ background: 'rgba(15,22,40,0.9)', border: '1px solid rgba(139,92,246,0.4)', color: '#f1f5f9' }} />
              <div className="flex items-center justify-between gap-3 mt-3">
                <span className="text-xs" style={{ color: 'rgba(241,245,249,0.45)' }}>{bio.length}/160</span>
                <div className="flex gap-2">
                  <Button onClick={() => { setBioEdit(false); setBioError('') }} variant="ghost" size="sm">{t('common.cancel')}</Button>
                  <Button onClick={saveBio} size="sm" disabled={bioSaving}>{bioSaving ? t('common.saving') : t('common.save')}</Button>
                </div>
              </div>
              {bioError && <p className="text-xs text-red-400 mt-2">{bioError}</p>}
            </Card>
          </div>
        )}

        {/* MAIN GRID 3 cols */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
          {/* LEFT SIDEBAR */}
          <aside className="lg:col-span-3 space-y-5">
            <SectionDivider label={t('profile.section.identity')} />
            <Card padding="lg">
              <div className="flex flex-col items-center text-center">
                <img src={`https://mc-heads.net/avatar/${profile.username}/96`}
                     alt={profile.username}
                     className="w-20 h-20 rounded-2xl mb-3"
                     style={{ imageRendering: 'pixelated', border: '1px solid rgba(255,255,255,0.1)' }} />
                <h3 className="font-display text-xl font-semibold" style={{ color: '#f8fafc' }}>{profile.username}</h3>
                <div className="flex gap-2 mt-2 flex-wrap justify-center">
                  <Tag tone={ROLE_TONE[profile.role] ?? 'neutral'} size="xs">{profile.role}</Tag>
                  <Tag tone={profile.online ? 'jade' : 'neutral'} size="xs">{profile.online ? t('common.online') : t('common.offline')}</Tag>
                </div>
              </div>
              <div className="mt-5 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span style={{ color: 'rgba(241,245,249,0.5)' }}>{t('profile.identity.joinedOn')}</span>
                  <span style={{ color: '#f1f5f9' }}>{fmtDate(profile.created_at, locale)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span style={{ color: 'rgba(241,245,249,0.5)' }}>{t('profile.identity.lastLogin')}</span>
                  <span style={{ color: '#f1f5f9' }}>{fmtDate(profile.last_login, locale)}</span>
                </div>
                <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-widest block mb-1"
                        style={{ color: 'rgba(241,245,249,0.45)' }}>{t('profile.identity.uuid')}</span>
                  <span className="font-mono text-[10px] break-all" style={{ color: 'rgba(241,245,249,0.6)' }}>{profile.uuid}</span>
                </div>
              </div>
            </Card>
          </aside>

          {/* CENTER CONTENT */}
          <div className="lg:col-span-6 space-y-8">
            {/* DAILY */}
            {daily?.config?.enabled && (
              <section>
                <SectionDivider label={t('profile.daily.section')}
                  hint={t('profile.daily.streak', { count: daily.streak })}
                  action={daily.canClaim
                    ? <Tag tone="gold">{t('profile.daily.available')}</Tag>
                    : <Tag tone="neutral">{t('profile.daily.cooldown', { cooldown: cooldown || '—' })}</Tag>} />
                <Card variant={daily.canClaim ? 'glass-warm' : 'glass'} padding="lg">
                  <div className="grid grid-cols-7 gap-2 mb-5">
                    {daily.config.days.slice(0, daily.config.cycleDays).map(d => {
                      const isCurrent = d.day === daily.nextDay
                      const isDone    = d.day < daily.nextDay || (!daily.canClaim && d.day === daily.nextDay)
                      return (
                        <div key={d.day}
                          className="flex flex-col items-center gap-1 rounded-xl p-2 border transition-all"
                          style={{
                            borderColor: isCurrent && daily.canClaim ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.06)',
                            background:  isCurrent && daily.canClaim ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)',
                            opacity: isDone && !isCurrent ? 0.5 : 1,
                          }}>
                          <span className="text-lg leading-none">{d.icon ?? '🎁'}</span>
                          <span className="text-[10px]" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('profile.daily.day', { day: d.day })}</span>
                          {d.bonusCoins > 0 && <span className="text-[10px] font-bold" style={{ color: '#fbbf24' }}>{d.bonusCoins}$</span>}
                          {isDone && <span className="text-emerald-400 text-[10px]">✓</span>}
                        </div>
                      )
                    })}
                  </div>
                  {dailyResult ? (
                    <div className="rounded-xl p-4 text-center space-y-1"
                         style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                      <p className="text-sm font-semibold text-emerald-400">{dailyResult.icon ?? '🎁'} {dailyResult.displayName ?? t('profile.daily.day', { day: dailyResult.day })}</p>
                      {dailyResult.bonusCoins > 0 && <p className="text-xs" style={{ color: '#fbbf24' }}>+{dailyResult.bonusCoins} coins</p>}
                      <p className="text-xs" style={{ color: 'rgba(241,245,249,0.5)' }}>{dailyResult.message}</p>
                    </div>
                  ) : daily.canClaim ? (
                    <div className="space-y-2">
                      <Button onClick={claimDaily} disabled={dailyClaiming} fullWidth size="lg">
                        {dailyClaiming ? t('profile.daily.claiming') : t('profile.daily.claimButton')}
                      </Button>
                      <p className="text-center text-[11px]" style={{ color: 'rgba(241,245,249,0.45)' }}>
                        {t('profile.daily.ingameHint')}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-xs" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('profile.daily.nextIn')}</p>
                      <p className="text-xl font-semibold font-mono mt-1" style={{ color: '#f8fafc' }}>{cooldown}</p>
                    </div>
                  )}
                  {dailyError && <p className="text-xs text-red-400 text-center mt-2">{dailyError}</p>}
                </Card>
              </section>
            )}

            {/* SANCTIONS */}
            <section>
              <SectionDivider label={t('profile.sanctions.section')}
                action={sanctions.length > 0
                  ? <Tag tone="danger">{t('profile.sanctions.active', { count: sanctions.length })}</Tag>
                  : <Tag tone="jade">{t('profile.sanctions.clean')}</Tag>} />
              {sanctions.length > 0 ? (
                <Card padding="md" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="space-y-1">
                    {sanctions.map(s => <SanctionRow key={s.id} s={s} t={t} />)}
                  </div>
                </Card>
              ) : (
                <Card padding="lg">
                  <p className="text-center text-sm" style={{ color: 'rgba(241,245,249,0.5)' }}>
                    {t('profile.sanctions.empty')}
                  </p>
                </Card>
              )}
            </section>

            {/* REFERRAL */}
            {referral && (
              <section>
                <SectionDivider label={t('profile.referral.section')} hint={t('profile.referral.hint')} />
                <Card padding="lg">
                  <div className="flex items-center gap-3 mb-4">
                    <code className="flex-1 rounded-xl px-4 py-3 text-sm font-mono font-bold tracking-widest text-center"
                          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                      {referral.code}
                    </code>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/portal?ref=${referral.code}`)
                          .then(() => { setRefCopied(true); setTimeout(() => setRefCopied(false), 2000) })
                      }}
                      variant={refCopied ? 'secondary' : 'primary'} size="md">
                      {refCopied ? t('profile.referral.copied') : t('profile.referral.copy')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl py-3 text-center"
                         style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="font-display text-3xl font-semibold" style={{ color: '#f8fafc' }}>{referral.total}</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('profile.referral.registered')}</p>
                    </div>
                    <div className="rounded-xl py-3 text-center"
                         style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
                      <p className="font-display text-3xl font-semibold" style={{ color: '#fbbf24' }}>{referral.validated}</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('profile.referral.validated')}</p>
                    </div>
                  </div>
                </Card>
              </section>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="lg:col-span-3 space-y-5">
            <SectionDivider label={t('profile.sidebar.actions')} />
            <Card padding="md">
              <div className="space-y-2">
                <Button to="/inventory" variant="secondary" fullWidth size="md">{t('profile.actions.inventory')}</Button>
                <Button to="/leaderboard" variant="secondary" fullWidth size="md">{t('profile.actions.leaderboard')}</Button>
                <Button to="/quests" variant="secondary" fullWidth size="md">{t('profile.actions.quests')}</Button>
                <Button to="/career" variant="secondary" fullWidth size="md">{t('profile.actions.career')}</Button>
              </div>
            </Card>

            <SectionDivider label={t('profile.sidebar.activity')} />
            <Card padding="md">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: profile.online ? '#34d399' : '#64748b' }} />
                  <div className="min-w-0 flex-1">
                    <p style={{ color: '#f1f5f9' }}>{profile.online ? t('profile.activity.activeNow') : t('profile.activity.offline')}</p>
                    <p className="text-xs" style={{ color: 'rgba(241,245,249,0.5)' }}>{fmtDate(profile.last_login, locale)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#fbbf24' }} />
                  <div className="min-w-0 flex-1">
                    <p style={{ color: '#f1f5f9' }}>{t('profile.activity.accountCreated')}</p>
                    <p className="text-xs" style={{ color: 'rgba(241,245,249,0.5)' }}>{fmtDate(profile.created_at, locale)}</p>
                  </div>
                </div>
                {daily && (
                  <div className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#a78bfa' }} />
                    <div className="min-w-0 flex-1">
                      <p style={{ color: '#f1f5f9' }}>{t('profile.activity.dailyStreak', { count: daily.streak })}</p>
                      <p className="text-xs" style={{ color: 'rgba(241,245,249,0.5)' }}>{daily.canClaim ? t('profile.activity.rewardAvailable') : t('profile.activity.uptodate')}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </GridShell>
      <Navbar />
    </div>
  )
}

function SanctionRow({ s, t }: { s: ActiveSanction; t: (k: string, v?: any) => string }) {
  const fmtExpiry = (ts: number | null) =>
    ts ? new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : t('profile.sanctions.permanent')
  const tone: 'danger' | 'rose' | 'gold' | 'sky' | 'neutral' =
    s.type === 'BAN' ? 'danger' : s.type === 'MUTE' ? 'rose' : s.type === 'WARN' ? 'gold' : s.type === 'KICK' ? 'sky' : 'neutral'
  return (
    <div className="px-3 py-3 flex items-start gap-3 border-b last:border-b-0" style={{ borderColor: 'rgba(239,68,68,0.08)' }}>
      <Tag tone={tone} size="sm">{s.type}</Tag>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: '#f1f5f9' }}>{s.reason || t('profile.sanctions.noReason')}</p>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('profile.sanctions.by', { user: s.issued_by })} · {fmtExpiry(s.expires_at)}</p>
      </div>
    </div>
  )
}
