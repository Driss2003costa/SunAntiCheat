import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type DailyStatus } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'

const GLASS  = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const GOLD   = '#fbbf24'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'

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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080d19' }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const hour = new Date().getHours()
  const greeting = hour < 6 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  const quickLinks = [
    { to: '/inventory', emoji: '🎒', label: 'Inventaire', desc: 'Objets & clés',      color: 'rgba(139,92,246,0.6)' },
    { to: '/minigames', emoji: '🎮', label: 'Mini-jeux',  desc: 'Arènes',             color: 'rgba(59,130,246,0.6)'  },
    { to: '/career',    emoji: '⚡', label: 'Carrière',   desc: 'Métiers & XP',       color: 'rgba(16,185,129,0.6)'  },
    { to: '/shop',      emoji: '🛒', label: 'Boutique',   desc: 'VIP & avantages',    color: 'rgba(251,191,36,0.6)'  },
  ]

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080d19' }}>
      <PageAura theme="home" />

      {/* Hero */}
      <div className="relative z-10 px-5 pt-14 pb-6 max-w-screen-sm mx-auto">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl"
                 style={{ boxShadow: '0 0 0 2px rgba(251,191,36,0.3)', borderRadius: 16 }} />
            <img
              src={`https://mc-heads.net/avatar/${profile.username}/56`}
              alt={profile.username}
              className="w-14 h-14 rounded-2xl object-cover"
            />
            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 ${profile.online ? 'bg-emerald-400' : 'bg-slate-600'}`}
                  style={{ borderColor: '#080d19' }} />
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: MUTED }}>{greeting},</p>
            <h1 className="text-xl font-bold leading-tight" style={{ color: TEXT }}>{profile.username}</h1>
            <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(251,191,36,0.12)', color: GOLD, border: '1px solid rgba(251,191,36,0.25)' }}>
              {profile.role}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: 'Solde',        value: profile.balance != null ? fmtBalance(profile.balance) : '—' },
            { label: 'Temps de jeu', value: profile.playtime_formatted ?? '—' },
            { label: 'Classement',   value: rank != null ? `#${rank}` : '—' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center"
                 style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
              <p className="text-sm font-bold truncate" style={{ color: TEXT }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Daily */}
        {daily?.config?.enabled && (
          <Link to="/profile"
            className="flex items-center gap-3 p-4 rounded-2xl mb-6 transition-all active:scale-[0.98]"
            style={{ background: daily.canClaim ? 'rgba(251,191,36,0.08)' : GLASS,
                     border: `1px solid ${daily.canClaim ? 'rgba(251,191,36,0.35)' : BORDER}`,
                     backdropFilter: 'blur(12px)', textDecoration: 'none' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
                 style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
              🎁
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: TEXT }}>Récompense quotidienne</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                {daily.streak > 0 ? `Série de ${daily.streak} jour${daily.streak > 1 ? 's' : ''}` : 'Commence ta série !'}
              </p>
            </div>
            {daily.canClaim
              ? <span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#fb923c)', color: '#080d19' }}>
                  Réclamer
                </span>
              : <span className="text-emerald-400 text-sm shrink-0">✓</span>}
          </Link>
        )}

        {/* Quick links */}
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: MUTED }}>Navigation</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {quickLinks.map(q => (
            <Link key={q.to} to={q.to}
              className="p-4 rounded-2xl transition-all active:scale-[0.97] group"
              style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)', textDecoration: 'none' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 text-lg"
                   style={{ background: `${q.color.replace('0.6', '0.12')}`, border: `1px solid ${q.color.replace('0.6', '0.25')}` }}>
                {q.emoji}
              </div>
              <p className="text-sm font-semibold" style={{ color: TEXT }}>{q.label}</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>{q.desc}</p>
            </Link>
          ))}
        </div>

        {/* Account status */}
        <div className="rounded-2xl overflow-hidden" style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-widest border-b"
             style={{ color: MUTED, borderColor: BORDER }}>Statut du compte</p>
          <div>
            {[
              { label: 'Connexion', value: (
                <span className={`flex items-center gap-1.5 text-xs ${profile.online ? 'text-emerald-400' : ''}`}
                      style={{ color: profile.online ? '#34d399' : MUTED }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profile.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  {profile.online ? 'En ligne' : 'Hors ligne'}
                </span>
              )},
              { label: 'Sanctions', value: (profile.active_sanctions?.length ?? 0) > 0
                ? <span className="text-xs font-semibold text-red-400">{profile.active_sanctions!.length} active(s)</span>
                : <span className="text-xs text-emerald-400">✓ Aucune</span>
              },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3"
                   style={{ borderBottom: i === 0 ? `1px solid ${BORDER}` : undefined }}>
                <span className="text-sm" style={{ color: MUTED }}>{row.label}</span>
                <div className="text-sm" style={{ color: TEXT }}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer links */}
        <div className="flex gap-2 mt-4">
          <Link to="/leaderboard"
            className="flex-1 text-center text-xs py-2.5 rounded-xl transition-colors"
            style={{ background: GLASS, border: `1px solid ${BORDER}`, color: MUTED, textDecoration: 'none' }}>
            🏆 Classement
          </Link>
          <Link to="/profile"
            className="flex-1 text-center text-xs py-2.5 rounded-xl transition-colors"
            style={{ background: GLASS, border: `1px solid ${BORDER}`, color: MUTED, textDecoration: 'none' }}>
            👤 Mon profil
          </Link>
        </div>
      </div>

      <Navbar />
    </div>
  )
}
