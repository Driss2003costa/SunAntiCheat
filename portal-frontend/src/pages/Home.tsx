import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type DailyStatus } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import CompassRose from '../components/codex/CompassRose'
import RuneIcon from '../components/codex/RuneIcon'
import WaxSeal from '../components/codex/WaxSeal'
import DustParticles from '../components/codex/DustParticles'

function fmtBalance(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' $'
}

export default function Home() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [daily, setDaily]     = useState<DailyStatus | null>(null)
  const [rank, setRank]       = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

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
    <div className="min-h-screen flex items-center justify-center pb-20" style={{ background: '#080d19' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(240,169,59,0.2)', borderTopColor: '#F0A93B' }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const hour = new Date().getHours()
  const greeting =
    hour < 6  ? 'Bonne nuit' :
    hour < 12 ? 'Bonjour'    :
    hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  const quickLinks = [
    { to: '/inventory', rune: 'star'    as const, label: 'Inventaire', desc: 'Objets & clés',      accent: 'rgba(139,92,246,0.35)' },
    { to: '/minigames', rune: 'flame'   as const, label: 'Mini-jeux',  desc: 'Arènes disponibles', accent: 'rgba(59,130,246,0.35)'  },
    { to: '/career',    rune: 'compass' as const, label: 'Carrière',   desc: 'Métiers & XP',       accent: 'rgba(16,185,129,0.35)'  },
    { to: '/shop',      rune: 'crown'   as const, label: 'Boutique',   desc: 'VIP & avantages',    accent: 'rgba(240,169,59,0.4)'   },
  ]

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: '#080d19' }}>
      <PageAura theme="home" />

      {/* Compass rose watermark */}
      <CompassRose size={420} opacity={0.04} className="absolute top-[-60px] right-[-80px] pointer-events-none z-0" />
      <DustParticles />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <div className="relative z-10">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(240,169,59,0.12),transparent)' }} />

        <div className="relative px-5 pt-12 pb-8 max-w-screen-sm mx-auto">
          {/* Greeting + avatar */}
          <div className="flex flex-col items-center text-center mb-8 codex-reveal codex-reveal-1">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
                   style={{ background: 'radial-gradient(circle,rgba(240,169,59,0.35),transparent)', transform: 'scale(1.6)' }} />
              <div className="absolute inset-0 rounded-2xl pointer-events-none"
                   style={{ boxShadow: '0 0 0 2px rgba(240,169,59,0.4), 0 0 32px rgba(240,169,59,0.15)', borderRadius: '18px' }} />
              <img
                src={`https://mc-heads.net/avatar/${profile.username}/88`}
                alt={profile.username}
                className="relative w-[88px] h-[88px] rounded-[18px] object-cover"
              />
              <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`}
                    style={{ borderColor: '#080d19' }} />
            </div>
            <p className="text-sm mb-1 font-codex-body" style={{ color: 'var(--ivory-dim)' }}>{greeting},</p>
            <h1 className="text-3xl font-codex-display font-bold leading-tight" style={{ color: 'var(--ivory)' }}>
              {profile.username}
            </h1>
            <div className="mt-2 w-20 h-px" style={{ background: 'linear-gradient(90deg,transparent,var(--gold),transparent)' }} />
          </div>

          {/* Stats row — wax seals */}
          <div className="grid grid-cols-3 gap-3 codex-reveal codex-reveal-2">
            <SealStat seal="gold"   label="Solde"        value={profile.balance != null ? fmtBalance(profile.balance) : '—'} />
            <SealStat seal="silver" label="Temps de jeu" value={profile.playtime_formatted ?? '—'} />
            <SealStat seal="bronze" label="Classement"   value={rank != null ? `#${rank}` : '—'} />
          </div>
        </div>
      </div>

      <div className="px-4 pt-2 space-y-4 max-w-screen-sm mx-auto relative z-10">

        {/* Daily reward */}
        {daily && daily.config?.enabled && (
          <Link to="/profile"
            className="codex-cartouche codex-flare flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98] codex-reveal codex-reveal-3"
            style={{ textDecoration: 'none' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: 'rgba(240,169,59,0.1)', border: '1px solid rgba(240,169,59,0.3)' }}>
              <RuneIcon rune="sun" size={22} color="var(--gold)" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold font-codex-display" style={{ color: 'var(--ivory)' }}>Récompense quotidienne</p>
              <p className="text-xs font-codex-body" style={{ color: 'var(--ivory-dim)', opacity: 0.7 }}>
                {daily.streak > 0
                  ? `Série de ${daily.streak} jour${daily.streak > 1 ? 's' : ''}`
                  : 'Commence ta série !'}
              </p>
            </div>
            {daily.canClaim
              ? <span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse font-codex-display"
                      style={{ background: 'linear-gradient(135deg,var(--amber),var(--ember))', color: 'var(--ink-deep)' }}>
                  Réclamer
                </span>
              : <span className="shrink-0 text-green-400 text-sm">✓</span>}
          </Link>
        )}

        {/* Quick navigation */}
        <div className="codex-reveal codex-reveal-3">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-0.5 font-codex-rune"
             style={{ color: 'var(--parchment-shade)' }}>Sections</p>
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((q, i) => (
              <Link key={q.to} to={q.to}
                className="codex-cartouche codex-flare p-4 rounded-2xl transition-all active:scale-[0.97]"
                style={{ textDecoration: 'none', borderColor: q.accent }}>
                <div className="mb-3">
                  <RuneIcon rune={q.rune} size={24} color={q.accent.replace('0.35', '1').replace('0.4', '1')} />
                </div>
                <p className="text-sm font-bold font-codex-display" style={{ color: 'var(--ivory)' }}>{q.label}</p>
                <p className="text-xs mt-0.5 font-codex-body" style={{ color: 'var(--parchment-shade)' }}>{q.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Account status */}
        <div className="codex-cartouche rounded-2xl overflow-hidden codex-reveal codex-reveal-4">
          <div className="px-5 py-3.5 flex items-center gap-2"
               style={{ borderBottom: '1px solid rgba(240,169,59,0.15)' }}>
            <RuneIcon rune="eye" size={16} color="var(--gold)" />
            <span className="text-sm font-semibold font-codex-display" style={{ color: 'var(--ivory)' }}>Statut du compte</span>
          </div>
          <div>
            <InfoRow label="Rôle" value={
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full font-codex-rune"
                    style={{ background: 'rgba(240,169,59,0.12)', border: '1px solid rgba(240,169,59,0.3)', color: 'var(--gold)' }}>
                {profile.role}
              </span>
            } />
            <InfoRow label="Connexion" value={
              <span className={`flex items-center gap-1.5 text-xs font-medium`}
                    style={{ color: profile.online ? '#4ade80' : 'var(--parchment-shade)' }}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`} />
                {profile.online ? 'En ligne' : 'Hors ligne'}
              </span>
            } />
            <InfoRow label="Sanctions" value={
              (profile.active_sanctions?.length ?? 0) > 0
                ? <span className="text-xs font-semibold text-red-400">{profile.active_sanctions!.length} active(s)</span>
                : <span className="text-xs text-green-400 font-medium">✓ Aucune</span>
            } />
          </div>
        </div>

        {/* Nav links */}
        <div className="flex gap-2 pb-2 codex-reveal codex-reveal-5">
          <Link to="/leaderboard"
            className="codex-cartouche flex-1 text-center text-xs py-3 rounded-xl transition-colors codex-underline font-codex-body"
            style={{ textDecoration: 'none', color: 'var(--parchment-shade)' }}>
            ⚔ Classement
          </Link>
          <Link to="/profile"
            className="codex-cartouche flex-1 text-center text-xs py-3 rounded-xl transition-colors codex-underline font-codex-body"
            style={{ textDecoration: 'none', color: 'var(--parchment-shade)' }}>
            ✦ Mon profil
          </Link>
        </div>
      </div>

      <Navbar />
    </div>
  )
}

function SealStat({ seal, label, value }: { seal: 'gold' | 'silver' | 'bronze'; label: string; value: string }) {
  return (
    <div className="codex-cartouche rounded-xl p-3 text-center">
      <WaxSeal color={seal} label={value.length > 6 ? '?' : value} size={40} className="mx-auto mb-2" />
      <p className="text-[10px] leading-none font-codex-rune" style={{ color: 'var(--parchment-shade)' }}>{label}</p>
      <p className="text-xs font-black mt-1 leading-none truncate font-codex-display" style={{ color: 'var(--gold-soft)' }}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="codex-row flex items-center justify-between px-5 py-3 gap-4"
         style={{ borderBottom: '1px solid rgba(240,169,59,0.06)' }}>
      <span className="text-sm shrink-0 font-codex-body" style={{ color: 'var(--parchment-shade)' }}>{label}</span>
      <div className="text-sm text-right font-codex-body" style={{ color: 'var(--ivory)' }}>{value}</div>
    </div>
  )
}
