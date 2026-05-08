import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SunGuardBg from '../components/SunGuardBg'
import { GridShell, HeroBanner, SectionDivider, Card, Button, Tag } from '../components/ui'

type Entry = {
  rank: number
  username: string
  uuid: string
  playtime_seconds: number
  playtime_formatted: string
  balance?: number
}

type LeaderboardData = {
  playtime: Entry[]
  economy: Entry[]
  updatedAt: number
}

type Tab = 'playtime' | 'economy'

const PODIUM_STYLE: Record<1 | 2 | 3, { bg: string; border: string; badge: string; glow: string; emoji: string; tone: 'gold' | 'neutral' | 'rose' }> = {
  1: { bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.40)', badge: '#fbbf24', glow: 'rgba(251,191,36,0.45)', emoji: '🥇', tone: 'gold' },
  2: { bg: 'rgba(192,197,204,0.06)', border: 'rgba(192,197,204,0.30)', badge: '#c0c5cc', glow: 'rgba(192,197,204,0.30)', emoji: '🥈', tone: 'neutral' },
  3: { bg: 'rgba(184,92,14,0.08)',   border: 'rgba(212,132,62,0.35)',  badge: '#d4843e', glow: 'rgba(212,132,62,0.35)',  emoji: '🥉', tone: 'rose' },
}

function fmtBalance(n?: number) {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' $'
}

export default function Leaderboard() {
  const [data,    setData]    = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [tab,     setTab]     = useState<Tab>('playtime')

  useEffect(() => {
    fetch('/api/public/leaderboard')
      .then(async r => { const d = await r.json(); if (!r.ok) throw d; setData(d) })
      .catch(e => setError(e.message || 'Erreur de chargement.'))
      .finally(() => setLoading(false))
  }, [])

  const entries = data ? (tab === 'playtime' ? data.playtime : data.economy) : []
  const top3    = entries.slice(0, 3)
  const rest    = entries.slice(3)

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'playtime', label: 'Temps de jeu', icon: '⏱' },
    { key: 'economy',  label: 'Économie',     icon: '💰' },
  ]

  return (
    <SunGuardBg glow="amber">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(6,9,15,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-[1600px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group no-underline">
            <div className="relative w-6 h-6 shrink-0">
              <div className="absolute inset-0 rounded-full"
                   style={{ background: 'radial-gradient(circle at 35% 35%, #fef9c3, #f59e0b)', boxShadow: '0 0 12px rgba(251,191,36,0.5)' }} />
              <div className="absolute inset-[30%] rounded-full" style={{ background: 'rgba(255,255,255,0.7)' }} />
            </div>
            <span className="font-bold text-sm tracking-wide text-white">SunGuard</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Tag tone="gold">Classement</Tag>
            <Button to="/login" variant="ghost" size="sm">Connexion</Button>
            <Button to="/register" variant="secondary" size="sm">S'inscrire</Button>
          </nav>
        </div>
      </header>

      <GridShell>
        {/* HERO */}
        <HeroBanner
          eyebrow="SunGuard Network"
          variant="sun"
          title="Classement"
          subtitle={
            data
              ? `Les meilleurs joueurs du serveur — Mis à jour à ${new Date(data.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Les meilleurs joueurs du serveur, mis à jour en temps réel.'
          }
          cta={
            <>
              <Button to="/register" size="lg">Rejoindre le serveur</Button>
              <Button to="/login" variant="secondary" size="lg">Connexion</Button>
            </>
          }
        />

        {/* TABS */}
        <div className="flex justify-center mb-10 lg:mb-12">
          <div className="inline-flex gap-1 p-1 rounded-2xl"
               style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {tabs.map(t => {
              const active = tab === t.key
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: active ? 'rgba(251,191,36,0.12)' : 'transparent',
                    color: active ? '#fbbf24' : 'rgba(241,245,249,0.55)',
                    border: `1px solid ${active ? 'rgba(251,191,36,0.3)' : 'transparent'}`,
                  }}>
                  <span className="mr-2">{t.icon}</span>{t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-24">
            <div className="w-10 h-10 rounded-full border-2 animate-spin"
                 style={{ borderColor: 'rgba(251,191,36,0.15)', borderTopColor: '#fbbf24' }} />
            <p className="text-sm" style={{ color: 'rgba(241,245,249,0.45)' }}>Chargement du classement…</p>
          </div>
        )}

        {/* ERROR */}
        {error && !loading && (
          <Card padding="lg" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-red-400 font-semibold text-center">{error}</p>
          </Card>
        )}

        {/* PODIUM */}
        {!loading && !error && entries.length >= 3 && (
          <section className="mb-12 lg:mb-16">
            <SectionDivider label="Podium" hint="Top 3 du classement" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-7 items-end max-w-5xl mx-auto">
              <PodiumCard entry={top3[1]} place={2} tab={tab} />
              <PodiumCard entry={top3[0]} place={1} tab={tab} />
              <PodiumCard entry={top3[2]} place={3} tab={tab} />
            </div>
          </section>
        )}

        {/* TABLE */}
        {!loading && !error && rest.length > 0 && (
          <section className="mb-12">
            <SectionDivider label="Classement complet" hint={`${entries.length} joueurs`}
              action={<Tag tone="neutral">Live</Tag>} />
            <Card padding="none" className="overflow-hidden">
              <div className="grid grid-cols-[60px_1fr_140px_140px] sm:grid-cols-[80px_1fr_180px_180px] gap-4 px-5 lg:px-7 py-4 border-b"
                   style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(241,245,249,0.4)' }}>Rang</span>
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(241,245,249,0.4)' }}>Joueur</span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-right" style={{ color: 'rgba(241,245,249,0.4)' }}>
                  {tab === 'playtime' ? 'Temps de jeu' : 'Solde'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-right hidden sm:block" style={{ color: 'rgba(241,245,249,0.4)' }}>
                  {tab === 'playtime' ? 'Solde' : 'Temps de jeu'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-right sm:hidden" />
              </div>
              {rest.map(entry => (
                <a key={entry.uuid} href={`/portal/player/${entry.username}`}
                  className="grid grid-cols-[60px_1fr_140px_140px] sm:grid-cols-[80px_1fr_180px_180px] gap-4 px-5 lg:px-7 py-3.5 border-b items-center transition-colors group no-underline"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span className="font-display text-lg font-semibold tabular-nums" style={{ color: 'rgba(241,245,249,0.4)' }}>
                    #{entry.rank}
                  </span>
                  <span className="flex items-center gap-3 min-w-0">
                    <img src={`https://mc-heads.net/avatar/${entry.username}/40`} alt={entry.username}
                         className="w-9 h-9 rounded-lg shrink-0"
                         style={{ imageRendering: 'pixelated', border: '1px solid rgba(255,255,255,0.1)' }}
                         onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <span className="text-sm font-semibold truncate transition-colors group-hover:text-white"
                          style={{ color: 'rgba(241,245,249,0.85)' }}>
                      {entry.username}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-right tabular-nums" style={{ color: '#f8fafc' }}>
                    {tab === 'playtime' ? entry.playtime_formatted : fmtBalance(entry.balance)}
                  </span>
                  <span className="text-xs text-right tabular-nums hidden sm:block" style={{ color: 'rgba(241,245,249,0.4)' }}>
                    {tab === 'playtime' ? fmtBalance(entry.balance) : entry.playtime_formatted}
                  </span>
                </a>
              ))}
            </Card>
          </section>
        )}

        {!loading && !error && entries.length === 0 && (
          <Card padding="lg" className="text-center">
            <p className="text-5xl mb-4">🏆</p>
            <p className="font-display text-2xl font-semibold mb-2" style={{ color: '#f8fafc' }}>Le classement est vide</p>
            <p className="text-sm" style={{ color: 'rgba(241,245,249,0.45)' }}>Les premiers joueurs n'ont pas encore joué.</p>
          </Card>
        )}

        {/* CTA */}
        <Card variant="glass-warm" padding="lg" className="text-center">
          <p className="font-display text-2xl lg:text-3xl font-semibold mb-2" style={{ color: '#f8fafc' }}>
            Rejoins le serveur
          </p>
          <p className="text-sm mb-5" style={{ color: 'rgba(241,245,249,0.5)' }}>
            Connecte-toi et commence à accumuler des heures pour apparaître dans le classement.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button to="/register" size="lg">Créer un compte</Button>
            <Button to="/login" variant="secondary" size="lg">Connexion</Button>
          </div>
        </Card>
      </GridShell>
    </SunGuardBg>
  )
}

function PodiumCard({ entry, place, tab }: { entry: Entry; place: 1 | 2 | 3; tab: Tab }) {
  const s = PODIUM_STYLE[place]
  const isFirst = place === 1
  const avatarSize = isFirst ? 112 : 88

  return (
    <a href={`/portal/player/${entry.username}`}
       className={`block rounded-3xl overflow-hidden transition-transform hover:-translate-y-1 no-underline relative ${isFirst ? 'lg:scale-110 lg:-translate-y-2' : ''}`}
       style={{
         background: `linear-gradient(160deg, ${s.bg} 0%, rgba(15,22,40,0.4) 100%)`,
         border: `1px solid ${s.border}`,
         boxShadow: `0 20px 60px ${s.glow}`,
       }}>
      {/* Halo */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-60"
           style={{ background: s.glow }} />

      <div className="relative p-6 lg:p-8 text-center">
        {/* Rank badge */}
        <div className="flex justify-center mb-5">
          <div className="relative w-12 h-12 rounded-full flex items-center justify-center font-display text-xl font-bold"
               style={{ background: s.badge, color: '#06090F', boxShadow: `0 8px 24px ${s.glow}` }}>
            {place}
          </div>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-5">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl blur-2xl opacity-70"
                 style={{ background: s.badge, transform: 'scale(1.4)' }} />
            <img src={`https://mc-heads.net/avatar/${entry.username}/${avatarSize * 2}`}
                 alt={entry.username}
                 className="relative rounded-2xl"
                 style={{
                   width: avatarSize, height: avatarSize,
                   imageRendering: 'pixelated',
                   border: `2px solid ${s.border}`,
                 }}
                 onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
        </div>

        {/* Name */}
        <p className="font-display text-2xl lg:text-3xl font-semibold truncate mb-2"
           style={{ color: '#f8fafc' }}>
          {entry.username}
        </p>

        {/* Value */}
        <p className="font-display text-3xl lg:text-4xl font-semibold tabular-nums mb-3"
           style={{ color: s.badge }}>
          {tab === 'playtime' ? entry.playtime_formatted : fmtBalance(entry.balance)}
        </p>

        {/* Tag */}
        <div className="flex justify-center">
          <Tag tone={s.tone}>{s.emoji} {tab === 'playtime' ? 'Temps de jeu' : 'Économie'}</Tag>
        </div>
      </div>
    </a>
  )
}
