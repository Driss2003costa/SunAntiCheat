import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SunGuardBg from '../components/SunGuardBg'

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

const RANK_STYLE = {
  1: { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.35)', badge: '#fbbf24', label: '🥇' },
  2: { bg: 'rgba(192,197,204,0.08)', border: 'rgba(192,197,204,0.3)', badge: '#c0c5cc', label: '🥈' },
  3: { bg: 'rgba(184,92,14,0.1)',   border: 'rgba(184,92,14,0.35)',  badge: '#d4843e', label: '🥉' },
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

  return (
    <SunGuardBg glow="amber">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(6,9,15,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            {/* Sun mark */}
            <div className="relative w-6 h-6 shrink-0">
              <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #fef9c3, #f59e0b)', boxShadow: '0 0 12px rgba(251,191,36,0.5)' }} />
              <div className="absolute inset-[30%] rounded-full" style={{ background: 'rgba(255,255,255,0.7)' }} />
            </div>
            <span className="font-bold text-sm tracking-wide text-white">SunGuard</span>
          </Link>
          <nav className="flex items-center gap-1">
            <span className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
              Classement
            </span>
            <Link to="/login"
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
              Connexion
            </Link>
            <Link to="/register"
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none' }}>
              S'inscrire
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 pb-20">

        {/* ── Hero title ───────────────────────────────────────────────────── */}
        <div className="pt-14 pb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 text-xs font-semibold tracking-wider uppercase"
               style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)', color: '#fbbf24' }}>
            ☀ SunGuard Network
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-3">
            Classement
          </h1>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Les meilleurs joueurs du serveur, mis à jour en temps réel.
          </p>
          {data && (
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Dernière mise à jour : {new Date(data.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl mb-10 max-w-xs mx-auto"
             style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {([
            { key: 'playtime' as Tab, label: '⏱ Temps de jeu' },
            { key: 'economy'  as Tab, label: '💰 Économie' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: tab === t.key ? 'rgba(251,191,36,0.12)' : 'transparent',
                color: tab === t.key ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                border: tab === t.key ? '1px solid rgba(251,191,36,0.25)' : '1px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-24">
            <div className="w-10 h-10 rounded-full border-2 animate-spin"
                 style={{ borderColor: 'rgba(251,191,36,0.15)', borderTopColor: '#fbbf24' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Chargement du classement…</p>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-2xl p-10 text-center"
               style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-red-400 font-semibold">{error}</p>
          </div>
        )}

        {/* ── Podium Top 3 ─────────────────────────────────────────────────── */}
        {entries.length >= 3 && (
          <div className="mb-8">
            <div className="grid grid-cols-3 gap-3 sm:gap-5 items-end max-w-2xl mx-auto">
              {/* #2 */}
              <PodiumCard entry={top3[1]} place={2} tab={tab} />
              {/* #1 */}
              <PodiumCard entry={top3[0]} place={1} tab={tab} />
              {/* #3 */}
              <PodiumCard entry={top3[2]} place={3} tab={tab} />
            </div>
          </div>
        )}

        {/* ── Rest of leaderboard ──────────────────────────────────────────── */}
        {rest.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Table header */}
            <div className="grid grid-cols-[40px_1fr_auto] sm:grid-cols-[40px_40px_1fr_auto_auto] gap-4 px-5 py-3 border-b"
                 style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>#</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest hidden sm:block" style={{ color: 'rgba(255,255,255,0.3)' }}></span>
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Joueur</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {tab === 'playtime' ? 'Temps de jeu' : 'Solde'}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-right hidden sm:block" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {tab === 'playtime' ? 'Solde' : 'Temps de jeu'}
              </span>
            </div>

            {rest.map((entry, i) => (
              <a key={entry.uuid} href={`/portal/player/${entry.username}`}
                className="grid grid-cols-[40px_1fr_auto] sm:grid-cols-[40px_40px_1fr_auto_auto] gap-4 px-5 py-3.5 border-b items-center transition-colors group"
                style={{
                  borderColor: 'rgba(255,255,255,0.04)',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {/* Rank */}
                <span className="text-sm font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {entry.rank}
                </span>
                {/* Avatar */}
                <img src={`https://mc-heads.net/avatar/${entry.username}/32`} alt={entry.username}
                     className="w-8 h-8 rounded-lg hidden sm:block"
                     style={{ imageRendering: 'pixelated' }}
                     onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                {/* Name */}
                <span className="text-sm font-semibold truncate transition-colors group-hover:text-white"
                      style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {entry.username}
                </span>
                {/* Primary stat */}
                <span className="text-sm font-bold text-right tabular-nums" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {tab === 'playtime' ? entry.playtime_formatted : fmtBalance(entry.balance)}
                </span>
                {/* Secondary stat */}
                <span className="text-xs text-right tabular-nums hidden sm:block" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {tab === 'playtime' ? fmtBalance(entry.balance) : entry.playtime_formatted}
                </span>
              </a>
            ))}
          </div>
        )}

        {entries.length === 0 && !loading && !error && (
          <div className="rounded-2xl p-16 text-center"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-4xl mb-4">🏆</p>
            <p className="font-semibold text-white mb-2">Le classement est vide</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Les premiers joueurs n'ont pas encore joué.</p>
          </div>
        )}

        {/* ── Footer CTA ────────────────────────────────────────────────────── */}
        <div className="mt-12 rounded-2xl p-8 text-center"
             style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(184,92,14,0.04))', border: '1px solid rgba(251,191,36,0.12)' }}>
          <p className="text-lg font-bold text-white mb-2">Rejoins le serveur</p>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Connecte-toi et commence à accumuler des heures pour apparaître dans le classement.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/register"
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-900 transition-all"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', textDecoration: 'none' }}>
              Créer un compte
            </Link>
            <Link to="/login"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
              Connexion
            </Link>
          </div>
        </div>
      </main>
    </SunGuardBg>
  )
}

function PodiumCard({ entry, place, tab }: { entry: Entry; place: 1 | 2 | 3; tab: Tab }) {
  const s = RANK_STYLE[place]
  const heights = { 1: 'pt-8', 2: 'pt-4', 3: 'pt-2' }
  const avatarSizes = { 1: 72, 2: 56, 3: 48 }

  return (
    <a href={`/portal/player/${entry.username}`}
       className={`block rounded-2xl overflow-hidden transition-transform hover:-translate-y-1 ${heights[place]}`}
       style={{ background: s.bg, border: `1px solid ${s.border}`, textDecoration: 'none' }}>
      {/* Rank badge */}
      <div className="flex justify-center pt-5 pb-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
             style={{ background: s.badge, color: '#06090F', boxShadow: `0 4px 16px ${s.border}` }}>
          {place}
        </div>
      </div>
      {/* Avatar */}
      <div className="flex justify-center mb-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl blur-xl opacity-60"
               style={{ background: s.badge, transform: 'scale(1.3)' }} />
          <img src={`https://mc-heads.net/avatar/${entry.username}/${avatarSizes[place] * 2}`}
               alt={entry.username}
               style={{
                 width: avatarSizes[place], height: avatarSizes[place],
                 imageRendering: 'pixelated',
                 borderRadius: 10,
                 border: `2px solid ${s.border}`,
                 position: 'relative',
               }}
               onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>
      </div>
      {/* Info */}
      <div className="px-3 pb-5 text-center">
        <p className="font-bold text-sm text-white truncate mb-1">{entry.username}</p>
        <p className="text-xs font-semibold" style={{ color: s.badge }}>
          {tab === 'playtime' ? entry.playtime_formatted : fmtBalance(entry.balance)}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {tab === 'playtime' ? 'de jeu' : ''}
        </p>
      </div>
    </a>
  )
}
