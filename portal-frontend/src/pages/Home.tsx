import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type DailyStatus } from '../api/client'
import Navbar from '../components/Navbar'

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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center pb-20">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
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
    { to: '/inventory', icon: '🎒', label: 'Inventaire', desc: 'Objets & clés',      accent: 'from-purple-600/20 border-purple-500/20 hover:border-purple-400/40' },
    { to: '/minigames', icon: '🎮', label: 'Mini-jeux',  desc: 'Arènes disponibles', accent: 'from-blue-600/20 border-blue-500/20 hover:border-blue-400/40'       },
    { to: '/career',    icon: '📈', label: 'Carrière',   desc: 'Métiers & XP',       accent: 'from-emerald-600/20 border-emerald-500/20 hover:border-emerald-400/40'},
    { to: '/shop',      icon: '🛒', label: 'Boutique',   desc: 'VIP & avantages',    accent: 'from-yellow-600/20 border-yellow-500/20 hover:border-yellow-400/40'  },
  ]

  return (
    <div className="min-h-screen bg-gray-950 pb-24">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/30 via-orange-600/10 to-gray-950" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-gray-400">{greeting},</p>
              <h1 className="text-2xl font-black text-white leading-tight">{profile.username}</h1>
            </div>
            <div className="relative shrink-0">
              <img
                src={`https://mc-heads.net/avatar/${profile.username}/56`}
                alt={profile.username}
                className="w-14 h-14 rounded-xl border-2 border-brand-500/40 object-cover"
              />
              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-950 ${profile.online ? 'bg-green-400' : 'bg-gray-600'}`} />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <MiniStat icon="💰" label="Solde"        value={profile.balance != null ? fmtBalance(profile.balance) : '—'} />
            <MiniStat icon="⏱️" label="Temps de jeu" value={profile.playtime_formatted ?? '—'} />
            <MiniStat icon="🏆" label="Classement"   value={rank != null ? `#${rank}` : '—'} />
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-sm mx-auto">

        {/* Daily reward teaser */}
        {daily && daily.config?.enabled && (
          <Link to="/profile"
            className="flex items-center gap-4 bg-gray-900 rounded-2xl border border-gray-800 hover:border-gray-700 p-4 transition-colors active:scale-[0.98]">
            <div className="w-11 h-11 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
              <span className="text-2xl">🎁</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Récompense quotidienne</p>
              <p className="text-xs text-gray-500">
                {daily.streak > 0
                  ? `Série de ${daily.streak} jour${daily.streak > 1 ? 's' : ''}`
                  : 'Commence ta série !'}
              </p>
            </div>
            {daily.canClaim
              ? <span className="shrink-0 text-xs font-bold text-yellow-900 bg-yellow-400 px-3 py-1.5 rounded-full animate-pulse">Réclamer !</span>
              : <span className="shrink-0 text-green-500 text-sm">✓</span>}
          </Link>
        )}

        {/* Quick navigation */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 px-0.5">Sections</p>
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map(q => (
              <Link key={q.to} to={q.to}
                className={`bg-gradient-to-br ${q.accent} border rounded-2xl p-4 transition-all active:scale-[0.97]`}>
                <span className="text-2xl block mb-2">{q.icon}</span>
                <p className="text-sm font-bold text-white">{q.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{q.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Account status */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
            <span>👤</span>
            <span className="text-sm font-semibold text-white">Statut du compte</span>
          </div>
          <div className="divide-y divide-gray-800/50">
            <InfoRow label="Rôle" value={
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-200">{profile.role}</span>
            } />
            <InfoRow label="Connexion" value={
              <span className={`flex items-center gap-1.5 text-xs font-medium ${profile.online ? 'text-green-400' : 'text-gray-500'}`}>
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
            className="flex-1 text-center text-xs py-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition-colors">
            🏆 Classement
          </Link>
          <Link to="/profile"
            className="flex-1 text-center text-xs py-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition-colors">
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
    <div className="bg-black/30 border border-gray-800/80 rounded-xl p-3 text-center backdrop-blur">
      <span className="text-xl leading-none">{icon}</span>
      <p className="text-[10px] text-gray-500 mt-1 leading-none">{label}</p>
      <p className="text-xs font-bold text-white mt-1 leading-none truncate">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <div className="text-sm text-white text-right">{value}</div>
    </div>
  )
}
