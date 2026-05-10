import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, getToken, clearToken, type PlayerProfile, type DailyStatus } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import { GridShell, HeroBanner, StatCard, SectionDivider, Card, Button, Tag } from '../components/ui'
import ServerStatusCard from '../components/ServerStatusCard'

function useLiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function fmtBalance(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
}

export default function Home() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [daily, setDaily]     = useState<DailyStatus | null>(null)
  const [rank, setRank]       = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const now = useLiveClock()
  const hour = now.getHours()
  const greetingKey =
    hour < 6  ? 'home.greeting.night' :
    hour < 12 ? 'home.greeting.morning' :
    hour < 18 ? 'home.greeting.afternoon' : 'home.greeting.evening'
  const greeting = t(greetingKey)
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').startsWith('fr') ? 'fr-FR' : 'en-GB'
  const timeStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    Promise.all([
      api.me(token),
      api.dailyStatus(token).catch(() => null),
    ]).then(([p, d]) => {
      setProfile(p)
      setDaily(d as DailyStatus | null)
      fetch('/api/public/leaderboard')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data.playtime)) {
            const entry = data.playtime.find((e: any) => e.uuid === p.uuid)
            if (entry) setRank(entry.rank)
          }
        })
        .catch(() => {})
    }).catch(e => {
      if (e.status === 401) { clearToken(); navigate('/login', { replace: true }) }
    }).finally(() => setLoading(false))
  }, [navigate])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080d19' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: '#FFB347' }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const quickLinks = [
    { to: '/inventory',   emoji: '🎒', label: t('home.quicklinks.inventory.label'),   desc: t('home.quicklinks.inventory.desc'),   accent: 'violet' as const },
    { to: '/minigames',   emoji: '🎮', label: t('home.quicklinks.minigames.label'),   desc: t('home.quicklinks.minigames.desc'),   accent: 'sky'    as const },
    { to: '/career',      emoji: '⚡', label: t('home.quicklinks.career.label'),      desc: t('home.quicklinks.career.desc'),      accent: 'jade'   as const },
    { to: '/shop',        emoji: '🛒', label: t('home.quicklinks.shop.label'),        desc: t('home.quicklinks.shop.desc'),        accent: 'gold'   as const },
    { to: '/quests',      emoji: '🎯', label: t('home.quicklinks.quests.label'),      desc: t('home.quicklinks.quests.desc'),      accent: 'rose'   as const },
    { to: '/leaderboard', emoji: '🏆', label: t('home.quicklinks.leaderboard.label'), desc: t('home.quicklinks.leaderboard.desc'), accent: 'gold'   as const },
  ]

  const accentBg: Record<string, string> = {
    violet: 'rgba(139,92,246,0.12)',
    sky:    'rgba(56,189,248,0.12)',
    jade:   'rgba(52,211,153,0.12)',
    gold:   'rgba(251,191,36,0.12)',
    rose:   'rgba(244,114,182,0.12)',
  }
  const accentBorder: Record<string, string> = {
    violet: 'rgba(139,92,246,0.30)',
    sky:    'rgba(56,189,248,0.30)',
    jade:   'rgba(52,211,153,0.30)',
    gold:   'rgba(251,191,36,0.30)',
    rose:   'rgba(244,114,182,0.30)',
  }

  return (
    <div className="min-h-screen" style={{ background: '#080d19' }}>
      <PageAura theme="home" />
      <GridShell>
        {/* ─── HERO ──────────────────────────────────────────────────────── */}
        <HeroBanner
          eyebrow={`${greeting} • ${dateStr}`}
          variant="sun"
          title={<>{t('home.hero.title')}<span className="text-sun-300">{profile.username}</span></>}
          subtitle={t('home.hero.subtitle')}
          cta={
            <>
              <Button to="/profile" size="lg">{t('home.hero.ctaProfile')}</Button>
              <Button to="/leaderboard" variant="secondary" size="lg">{t('home.hero.ctaLeaderboard')}</Button>
            </>
          }
          rightSlot={
            <div className="w-full max-w-sm rounded-3xl p-5 lg:p-6 backdrop-blur-md"
                 style={{
                   background: 'linear-gradient(155deg, rgba(255,179,71,0.10), rgba(15,22,40,0.55))',
                   border: '1px solid rgba(255,179,71,0.22)',
                   boxShadow: '0 20px 60px -25px rgba(0,0,0,0.6)',
                 }}>
              {/* Header du widget : avatar + identité */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <img src={`https://mc-heads.net/avatar/${profile.username}/64`}
                       alt={profile.username}
                       className="w-12 h-12 rounded-xl"
                       style={{ imageRendering: 'pixelated', border: '1px solid rgba(255,179,71,0.4)' }} />
                  <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2`}
                        style={{
                          background: profile.online ? '#34d399' : '#64748b',
                          borderColor: '#0a1024',
                        }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em]"
                     style={{ color: 'rgba(255,179,71,0.85)' }}>
                    {t('home.widget.session')}
                  </p>
                  <p className="font-semibold truncate" style={{ color: '#f8fafc' }}>
                    {profile.username}
                  </p>
                </div>
              </div>

              {/* Horloge live */}
              <div className="rounded-2xl p-4 mb-3 text-center"
                   style={{
                     background: 'rgba(15,22,40,0.55)',
                     border: '1px solid rgba(255,255,255,0.06)',
                   }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-1"
                   style={{ color: 'rgba(241,245,249,0.45)' }}>
                  {t('home.widget.time')}
                </p>
                <p className="font-display text-4xl lg:text-5xl font-semibold tabular-nums leading-none"
                   style={{ color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  {timeStr}
                </p>
              </div>

              {/* Mini-stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl px-3 py-2"
                     style={{ background: 'rgba(15,22,40,0.45)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest"
                     style={{ color: 'rgba(241,245,249,0.45)' }}>
                    {t('home.widget.status')}
                  </p>
                  <p className="text-sm font-semibold mt-0.5"
                     style={{ color: profile.online ? '#6ee7b7' : 'rgba(241,245,249,0.7)' }}>
                    {profile.online ? t('home.widget.online') : t('home.widget.offline')}
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2"
                     style={{ background: 'rgba(15,22,40,0.45)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest"
                     style={{ color: 'rgba(241,245,249,0.45)' }}>
                    {t('home.widget.daily')}
                  </p>
                  <p className="text-sm font-semibold mt-0.5"
                     style={{ color: daily?.canClaim ? '#fcd34d' : 'rgba(241,245,249,0.7)' }}>
                    {daily?.canClaim ? t('home.widget.dailyAvailable') : daily?.streak ? t('home.widget.dailyStreak', { count: daily.streak }) : t('home.widget.dailyNone')}
                  </p>
                </div>
              </div>
            </div>
          }
        />

        {/* Toutes les sections sont espacées uniformément via le container parent.
            Ne pas ajouter de `mb-*` sur les enfants directs : laisser space-y faire le rythme. */}
        <div className="space-y-12 lg:space-y-16 pb-8">

        {/* ─── STATS GRID ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          <StatCard
            label={t('common.balance')} accent="gold" icon="💰" size="md"
            value={profile.balance != null ? fmtBalance(profile.balance) : '—'}
            hint={t('common.serverEconomy')}
          />
          <StatCard
            label={t('common.playtime')} accent="jade" icon="⏱" size="md"
            value={profile.playtime_formatted ?? '—'}
            hint={t('common.totalCumulative')}
          />
          <StatCard
            label={t('home.stats.rank')} accent="violet" icon="🏆" size="md"
            value={rank != null ? `#${rank}` : '—'}
            hint={t('common.topPlaytime')}
          />
          <StatCard
            label={t('common.role')} accent="sky" icon="✦" size="md"
            value={profile.role}
            hint={t('common.accountStatus')}
          />
        </div>

        {/* ─── DAILY REWARD (full width banner) ─────────────────────────── */}
        {daily?.config?.enabled && (
          <div>
            <Link to="/profile" className="block group no-underline">
              <Card variant={daily.canClaim ? 'glass-warm' : 'glass'} hover padding="lg"
                    className="overflow-hidden relative">
                {daily.canClaim && (
                  <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl"
                       style={{ background: 'rgba(251,191,36,0.25)' }} />
                )}
                <div className="relative flex items-center gap-5 lg:gap-7">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center shrink-0 text-3xl lg:text-4xl"
                       style={{
                         background: daily.canClaim ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.05)',
                         border: `1px solid ${daily.canClaim ? 'rgba(251,191,36,0.40)' : 'rgba(255,255,255,0.10)'}`,
                       }}>
                    🎁
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-sun-300 mb-1">
                      {t('home.daily.section')}
                    </p>
                    <h3 className="font-display text-2xl lg:text-3xl font-semibold mb-1" style={{ color: '#f8fafc' }}>
                      {daily.canClaim ? t('home.daily.ready') : t('home.daily.later')}
                    </h3>
                    <p className="text-sm" style={{ color: 'rgba(241,245,249,0.6)' }}>
                      {daily.streak > 0 ? t('home.daily.streak', { count: daily.streak }) : t('home.daily.noStreak')}
                    </p>
                  </div>
                  {daily.canClaim
                    ? <Button to="/profile" size="lg">{t('home.daily.claim')}</Button>
                    : <Tag tone="jade" size="sm">{t('home.daily.claimed')}</Tag>}
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* ─── STATUT DES SERVICES ──────────────────────────────────────── */}
        <ServerStatusCard />

        {/* ─── NAVIGATION GRID ──────────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {quickLinks.map(q => (
              <Link key={q.to} to={q.to} className="no-underline">
                <Card hover padding="lg" className="h-full group">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl transition-transform group-hover:scale-110"
                         style={{ background: accentBg[q.accent], border: `1px solid ${accentBorder[q.accent]}` }}>
                      {q.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-xl font-semibold mb-1" style={{ color: '#f8fafc' }}>{q.label}</h3>
                      <p className="text-sm" style={{ color: 'rgba(241,245,249,0.55)' }}>{q.desc}</p>
                    </div>
                    <span className="text-sun-300 opacity-0 group-hover:opacity-100 transition-opacity self-center">→</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── ACCOUNT STATUS (2 columns) ───────────────────────────────── */}
        <section>
          <SectionDivider label={t('home.status.section')} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(241,245,249,0.55)' }}>
                {t('home.status.connection')}
              </p>
              <Tag tone={profile.online ? 'jade' : 'neutral'}>
                <span className={`w-1.5 h-1.5 rounded-full ${profile.online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {profile.online ? t('common.online') : t('common.offline')}
              </Tag>
            </div>
            <p className="font-display text-2xl font-semibold" style={{ color: '#f8fafc' }}>
              {profile.online ? t('home.status.activeNow') : t('home.status.lastSession')}
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>
              {profile.online ? t('home.status.onlineDesc') : t('home.status.offlineDesc')}
            </p>
          </Card>

          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(241,245,249,0.55)' }}>
                {t('home.status.sanctions')}
              </p>
              {(profile.active_sanctions?.length ?? 0) > 0
                ? <Tag tone="danger">{t('home.status.sanctionsActive', { count: profile.active_sanctions!.length })}</Tag>
                : <Tag tone="jade">{t('home.status.clean')}</Tag>}
            </div>
            <p className="font-display text-2xl font-semibold" style={{ color: '#f8fafc' }}>
              {(profile.active_sanctions?.length ?? 0) > 0 ? t('home.status.sanctionsTitle') : t('home.status.noSanctionsTitle')}
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>
              {(profile.active_sanctions?.length ?? 0) > 0
                ? t('home.status.sanctionsDesc')
                : t('home.status.noSanctionsDesc')}
            </p>
          </Card>
          </div>
        </section>
        </div>
      </GridShell>

      <Navbar />
    </div>
  )
}
