import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type DailyStatus } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'

const BG = '#080d19'
const CARD_BG = 'rgba(15,22,40,0.8)'
const BORDER = 'rgba(251,191,36,0.12)'
const GOLD = '#fbbf24'
const TEXT = '#f1f5f9'
const MUTED = '#64748b'

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
    <div className="min-h-screen flex items-center justify-center pb-20" style={{ background: BG }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
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
    { to: '/inventory', icon: '🎒', label: 'Inventaire', desc: 'Objets & clés',      border: 'rgba(139,92,246,0.3)' },
    { to: '/minigames', icon: '🎮', label: 'Mini-jeux',  desc: 'Arènes disponibles', border: 'rgba(59,130,246,0.3)'  },
    { to: '/career',    icon: '📈', label: 'Carrière',   desc: 'Métiers & XP',       border: 'rgba(16,185,129,0.3)'  },
    { to: '/shop',      icon: '🛒', label: 'Boutique',   desc: 'VIP & avantages',    border: 'rgba(251,191,36,0.3)'  },
  ]

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: BG }}>
      <PageAura theme="home" />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden z-10">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(251,191,36,0.15),transparent)' }} />

        <div className="relative px-5 pt-12 pb-8 max-w-screen-sm mx-auto">
          {/* Avatar + greeting */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-4">
              {/* Sun halo */}
              <div className="absolute inset-0 rounded-full blur-xl"
                   style={{ background: 'radial-gradient(circle,rgba(251,191,36,0.3),transparent)', transform: 'scale(1.4)' }} />
              <img
                src={`https://mc-heads.net/avatar/${profile.username}/80`}
                alt={profile.username}
                className="relative w-20 h-20 rounded-2xl object-cover"
                style={{ border: '2px solid rgba(251,191,36,0.4)', boxShadow: '0 0 24px rgba(251,191,36,0.2)' }}
              />
              <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`}
                    style={{ borderColor: BG }} />
            </div>
            <p className="text-sm mb-0.5" style={{ color: MUTED }}>{greeting},</p>
            <h1 className="text-2xl font-black leading-tight" style={{ color: TEXT }}>{profile.username}</h1>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <MiniStat icon="💰" label="Solde"        value={profile.balance != null ? fmtBalance(profile.balance) : '—'} />
            <MiniStat icon="⏱️" label="Temps de jeu" value={profile.playtime_formatted ?? '—'} />
            <MiniStat icon="🏆" label="Classement"   value={rank != null ? `#${rank}` : '—'} />
          </div>
        </div>
      </div>

      <div className="px-4 pt-2 space-y-4 max-w-screen-sm mx-auto relative z-10">

        {/* Daily reward teaser */}
        {daily && daily.config?.enabled && (
          <Link to="/profile"
            className="flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]"
            style={{ background: CARD_BG, border: `1px solid ${daily.canClaim ? 'rgba(251,191,36,0.4)' : BORDER}`, backdropFilter: 'blur(12px)' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <span className="text-2xl">🎁</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: TEXT }}>Récompense quotidienne</p>
              <p className="text-xs" style={{ color: MUTED }}>
                {daily.streak > 0
                  ? `Série de ${daily.streak} jour${daily.streak > 1 ? 's' : ''}`
                  : 'Commence ta série !'}
              </p>
            </div>
            {daily.canClaim
              ? <span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#fb923c)', color: '#080d19' }}>
                  Réclamer !
                </span>
              : <span className="shrink-0 text-green-400 text-sm">✓</span>}
          </Link>
        )}

        {/* Quick navigation */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-0.5" style={{ color: MUTED }}>Sections</p>
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map(q => (
              <Link key={q.to} to={q.to}
                className="p-4 rounded-2xl transition-all active:scale-[0.97]"
                style={{ background: CARD_BG, border: `1px solid ${q.border}`, backdropFilter: 'blur(12px)' }}>
                <span className="text-2xl block mb-2">{q.icon}</span>
                <p className="text-sm font-bold" style={{ color: TEXT }}>{q.label}</p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>{q.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Account status */}
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <span>👤</span>
            <span className="text-sm font-semibold" style={{ color: TEXT }}>Statut du compte</span>
          </div>
          <div style={{ borderColor: BORDER }}>
            <InfoRow label="Rôle" value={
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: GOLD }}>
                {profile.role}
              </span>
            } />
            <InfoRow label="Connexion" value={
              <span className={`flex items-center gap-1.5 text-xs font-medium ${profile.online ? 'text-green-400' : ''}`}
                    style={{ color: profile.online ? '#4ade80' : MUTED }}>
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

        {/* Links */}
        <div className="flex gap-2 pb-2">
          <Link to="/leaderboard"
            className="flex-1 text-center text-xs py-3 rounded-xl transition-colors"
            style={{ background: CARD_BG, border: `1px solid ${BORDER}`, color: MUTED }}>
            🏆 Classement
          </Link>
          <Link to="/profile"
            className="flex-1 text-center text-xs py-3 rounded-xl transition-colors"
            style={{ background: CARD_BG, border: `1px solid ${BORDER}`, color: MUTED }}>
            👤 Mon profil
          </Link>
        </div>
      </div>

      <Navbar />
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 text-center backdrop-blur-sm"
         style={{ background: 'rgba(15,22,40,0.8)', border: 'rgba(251,191,36,0.12) 1px solid' }}>
      <span className="text-xl leading-none">{icon}</span>
      <p className="text-[10px] mt-1 leading-none" style={{ color: '#64748b' }}>{label}</p>
      <p className="text-xs font-black mt-1 leading-none truncate" style={{ color: '#fbbf24' }}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 gap-4"
         style={{ borderBottom: '1px solid rgba(251,191,36,0.06)' }}>
      <span className="text-sm shrink-0" style={{ color: '#64748b' }}>{label}</span>
      <div className="text-sm text-right" style={{ color: '#f1f5f9' }}>{value}</div>
    </div>
  )
}
