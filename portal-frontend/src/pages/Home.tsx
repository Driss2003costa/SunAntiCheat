import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type DailyStatus } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import { GridShell, HeroBanner, StatCard, SectionDivider, Card, Button, Tag } from '../components/ui'
import ServerStatusCard from '../components/ServerStatusCard'

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
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: '#FFB347' }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const hour = new Date().getHours()
  const greeting = hour < 6 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  const quickLinks = [
    { to: '/inventory', emoji: '🎒', label: 'Inventaire', desc: 'Tes objets, clés et cosmétiques',  accent: 'violet' as const },
    { to: '/minigames', emoji: '🎮', label: 'Mini-jeux',  desc: 'Arènes, classements & rewards',    accent: 'sky'    as const },
    { to: '/career',    emoji: '⚡', label: 'Carrière',   desc: 'Métiers, XP et progression',       accent: 'jade'   as const },
    { to: '/shop',      emoji: '🛒', label: 'Boutique',   desc: 'VIP, ranks & avantages',           accent: 'gold'   as const },
    { to: '/quests',    emoji: '🎯', label: 'Quêtes',     desc: 'Défis quotidiens & jalons',        accent: 'rose'   as const },
    { to: '/leaderboard', emoji: '🏆', label: 'Classement', desc: 'Top joueurs du serveur',         accent: 'gold'   as const },
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
          eyebrow={greeting}
          variant="sun"
          title={<>Bienvenue, <span className="text-sun-300">{profile.username}</span></>}
          subtitle="Ton tableau de bord SunGuard. Gère ton compte, suis ta progression et plonge dans l'aventure."
          cta={
            <>
              <Button to="/profile" size="lg">Mon profil →</Button>
              <Button to="/leaderboard" variant="secondary" size="lg">Voir le classement</Button>
            </>
          }
          rightSlot={
            <div className="relative">
              <div className="absolute -inset-6 rounded-full blur-3xl opacity-50"
                   style={{ background: 'radial-gradient(circle, rgba(255,179,71,0.5) 0%, transparent 70%)' }} />
              <div className="relative">
                <img src={`https://mc-heads.net/body/${profile.username}/240`}
                     alt={profile.username}
                     className="w-44 lg:w-56 drop-shadow-2xl" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2">
                  <Tag tone={profile.online ? 'jade' : 'neutral'} size="sm">
                    <span className={`w-1.5 h-1.5 rounded-full ${profile.online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    {profile.online ? 'En ligne' : 'Hors ligne'}
                  </Tag>
                </div>
              </div>
            </div>
          }
        />

        {/* ─── STATS GRID ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-12 lg:mb-16">
          <StatCard
            label="Solde" accent="gold" icon="💰" size="md"
            value={profile.balance != null ? fmtBalance(profile.balance) : '—'}
            hint="Économie serveur"
          />
          <StatCard
            label="Temps de jeu" accent="jade" icon="⏱" size="md"
            value={profile.playtime_formatted ?? '—'}
            hint="Total cumulé"
          />
          <StatCard
            label="Classement" accent="violet" icon="🏆" size="md"
            value={rank != null ? `#${rank}` : '—'}
            hint="Top playtime"
          />
          <StatCard
            label="Rôle" accent="sky" icon="✦" size="md"
            value={profile.role}
            hint="Statut compte"
          />
        </div>

        {/* ─── DAILY REWARD (full width banner) ─────────────────────────── */}
        {daily?.config?.enabled && (
          <div className="mb-12 lg:mb-16">
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
                      Récompense quotidienne
                    </p>
                    <h3 className="font-display text-2xl lg:text-3xl font-semibold mb-1" style={{ color: '#f8fafc' }}>
                      {daily.canClaim ? 'Ta récompense est prête' : 'Reviens demain'}
                    </h3>
                    <p className="text-sm" style={{ color: 'rgba(241,245,249,0.6)' }}>
                      {daily.streak > 0 ? `Série de ${daily.streak} jour${daily.streak > 1 ? 's' : ''} 🔥` : 'Commence ta série dès maintenant !'}
                    </p>
                  </div>
                  {daily.canClaim
                    ? <Button to="/profile" size="lg">Réclamer →</Button>
                    : <Tag tone="jade" size="sm">✓ Réclamée</Tag>}
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* ─── STATUT DES SERVICES ──────────────────────────────────────── */}
        <ServerStatusCard />

        {/* ─── NAVIGATION GRID ──────────────────────────────────────────── */}
        <SectionDivider label="Explorer" hint="Toutes les sections du serveur" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 mb-12 lg:mb-16">
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

        {/* ─── ACCOUNT STATUS (2 columns) ───────────────────────────────── */}
        <SectionDivider label="Statut du compte" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mb-8">
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(241,245,249,0.55)' }}>
                Connexion
              </p>
              <Tag tone={profile.online ? 'jade' : 'neutral'}>
                <span className={`w-1.5 h-1.5 rounded-full ${profile.online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {profile.online ? 'En ligne' : 'Hors ligne'}
              </Tag>
            </div>
            <p className="font-display text-2xl font-semibold" style={{ color: '#f8fafc' }}>
              {profile.online ? 'Active maintenant' : 'Dernière session'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>
              {profile.online ? 'Tu es actuellement connecté au serveur.' : 'Connecte-toi en jeu pour mettre à jour ton statut.'}
            </p>
          </Card>

          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(241,245,249,0.55)' }}>
                Sanctions
              </p>
              {(profile.active_sanctions?.length ?? 0) > 0
                ? <Tag tone="danger">{profile.active_sanctions!.length} active(s)</Tag>
                : <Tag tone="jade">✓ Compte clean</Tag>}
            </div>
            <p className="font-display text-2xl font-semibold" style={{ color: '#f8fafc' }}>
              {(profile.active_sanctions?.length ?? 0) > 0 ? 'Sanctions en cours' : 'Aucune sanction active'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>
              {(profile.active_sanctions?.length ?? 0) > 0
                ? 'Consulte ton profil pour voir les détails.'
                : 'Continue comme ça, joueur exemplaire !'}
            </p>
          </Card>
        </div>
      </GridShell>

      <Navbar />
    </div>
  )
}
