import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore, type Theme } from '../stores/themeStore'
import CommandPalette from './CommandPalette'
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'

// ── Nav structure ────────────────────────────────────────────────────────────
const NAV_CATEGORIES = [
  {
    id: 'server',
    label: 'Serveur',
    icon: '🖥️',
    items: [
      { to: '/',             label: 'Vue d\'ensemble', icon: '🏠' },
      { to: '/console',      label: 'Console',         icon: '⌨️' },
      { to: '/players',      label: 'Joueurs',         icon: '👥' },
      { to: '/worlds',       label: 'Mondes',          icon: '🌍' },
    ],
  },
  {
    id: 'security',
    label: 'Sécurité',
    icon: '🛡️',
    items: [
      { to: '/sanctions',    label: 'Sanctions (legacy)', icon: '⚖️' },
      { to: '/moderation',   label: 'Modération',      icon: '⚒️' },
      { to: '/reports',      label: 'Reports',         icon: '🚨' },
      { to: '/xray',         label: 'Anti X-Ray',      icon: '⛏️' },
      { to: '/honeypot',     label: 'Honeypot',        icon: '🍯' },
      { to: '/toxic-chat',   label: 'Chat toxique',    icon: '🗯️' },
    ],
  },
  {
    id: 'economy',
    label: 'Économie',
    icon: '💰',
    items: [
      { to: '/economy',      label: 'Économie',        icon: '💵' },
      { to: '/economy/shop', label: 'Shop Tracking',   icon: '📈' },
      { to: '/shops',        label: 'Shops (éditeur)', icon: '🛒' },
      { to: '/jobs',         label: 'Jobs (Reborn)',   icon: '💼' },
      { to: '/vip',          label: 'VIP & Subs',      icon: '👑' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: '📊',
    items: [
      { to: '/analytics',    label: 'Statistiques',    icon: '📈' },
      { to: '/experiments',  label: 'A/B Testing',     icon: '🧪' },
    ],
  },
  {
    id: 'gameplay',
    label: 'Gameplay',
    icon: '🎮',
    items: [
      { to: '/events',       label: 'Events',          icon: '📅' },
      { to: '/quests',       label: 'Quêtes',          icon: '🎯' },
      { to: '/games',        label: 'Mini-jeux',       icon: '🎮' },
      { to: '/crates',       label: 'Lootboxes',       icon: '📦' },
      { to: '/daily-rewards',label: 'Daily Rewards',    icon: '🎁' },
      { to: '/announcements',label: 'Annonces',         icon: '📢' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: '⚙️',
    items: [
      { to: '/tasks',        label: 'Tâches planif.',  icon: '⏰' },
      { to: '/plugins',      label: 'Plugins',         icon: '🧩' },
      { to: '/configs',      label: 'Config Editor',   icon: '📝' },
      { to: '/reboot',       label: 'Reboot',          icon: '🔄' },
      { to: '/backups',      label: 'Sauvegardes',     icon: '💾' },
      { to: '/users',        label: 'Comptes & Rôles', icon: '👤' },
      { to: '/permissions',  label: 'Permissions',     icon: '🔐' },
      { to: '/2fa',          label: '2FA (TOTP)',      icon: '🔒' },
      { to: '/audit',        label: 'Audit Log',       icon: '📋' },
      { to: '/ranks',        label: 'Rangs LuckPerms', icon: '🎖️' },
      { to: '/config',       label: 'Paramètres',      icon: '🔧' },
    ],
  },
  {
    id: 'portal',
    label: 'Portail joueur',
    icon: '🌐',
    items: [
      { to: '/portal-sections', label: 'Sections',  icon: '🔀' },
      { to: '/portal-activity', label: 'Activité',  icon: '📊' },
      { to: '/portal-accounts', label: 'Comptes',   icon: '🛡️' },
    ],
  },
  {
    id: 'tools',
    label: 'Outils',
    icon: '🤖',
    items: [
      { to: '/assistant',    label: 'Assistant IA',    icon: '🤖' },
      { to: '/roadmap',      label: 'Roadmap',         icon: '📍' },
    ],
  },
]

const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark',      label: 'Dark',      icon: '🌙' },
  { value: 'light',     label: 'Light',     icon: '☀️' },
  { value: 'minecraft', label: 'Minecraft', icon: '⛏️' },
]

// ── Layout ────────────────────────────────────────────────────────────────────
export default function Layout({ children }: { children: React.ReactNode }) {
  const { username, role, logout } = useAuthStore()
  const { isViewer } = usePermission()
  const { theme, setTheme } = useThemeStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [serverStatus, setServerStatus] = useState<any>(null)
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => {
    // auto-ouvre la catégorie active
    const init: Record<string, boolean> = {}
    NAV_CATEGORIES.forEach(cat => {
      init[cat.id] = cat.items.some(i => location.pathname === i.to || location.pathname.startsWith(i.to + '/'))
    })
    return init
  })

  useEffect(() => {
    api.serverStatus().then(setServerStatus).catch(() => {})
    const t = setInterval(() => api.serverStatus().then(setServerStatus).catch(() => {}), 8000)
    return () => clearInterval(t)
  }, [])

  // Auto-ouvre la cat de la route active
  useEffect(() => {
    setOpenCats(prev => {
      const next = { ...prev }
      NAV_CATEGORIES.forEach(cat => {
        if (cat.items.some(i => location.pathname === i.to || location.pathname.startsWith(i.to + '/'))) {
          next[cat.id] = true
        }
      })
      return next
    })
  }, [location.pathname])

  const tpsOk = serverStatus?.tps1m >= 18
  const tpsWarn = serverStatus?.tps1m >= 15

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 flex flex-col shrink-0 overflow-hidden"
             style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
               style={{ background: 'var(--primary)' }}>☀️</div>
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>SunGuard</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Dashboard</div>
          </div>
        </div>

        {/* Server quick-status */}
        <div className="mx-3 my-2 px-3 py-2 rounded-lg flex items-center gap-2"
             style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className={`w-2 h-2 rounded-full ${serverStatus ? 'animate-pulse' : ''}`}
               style={{ background: serverStatus ? (tpsOk ? '#10b981' : tpsWarn ? '#f59e0b' : '#ef4444') : '#64748b' }}/>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
              {serverStatus ? `${serverStatus.playersOnline}/${serverStatus.playersMax} joueurs` : 'Connexion...'}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {serverStatus ? `TPS ${serverStatus.tps1m}` : ''}
            </div>
          </div>
        </div>

        {/* ⌘K */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
          className="mx-3 mb-1 flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <span>🔎 Recherche rapide</span>
          <span className="flex gap-0.5"><span className="kbd">⌘</span><span className="kbd">K</span></span>
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-1">
          {NAV_CATEGORIES.map(cat => (
            <div key={cat.id}>
              {/* Category header */}
              <button
                onClick={() => setOpenCats(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-white/5 transition"
                style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-2">{cat.icon} {cat.label}</span>
                <span style={{ opacity: 0.5, fontSize: 10 }}>{openCats[cat.id] ? '▲' : '▼'}</span>
              </button>

              {/* Items */}
              {openCats[cat.id] && (
                <div className="pb-1">
                  {cat.items.map(({ to, label, icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      className="flex items-center gap-2 px-4 pl-8 py-1.5 text-sm transition"
                      style={({ isActive }) => isActive ? {
                        background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                        color: 'var(--primary)',
                        borderRight: '2px solid var(--primary)',
                      } : { color: 'var(--text-muted)' }}>
                      <span className="text-base leading-none">{icon}</span>
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Panic + footer */}
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <NavLink to="/panic"
            className="flex items-center gap-2 mx-3 my-2 px-3 py-2 rounded-lg text-sm font-semibold transition"
            style={({ isActive }) => ({
              background: isActive ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.3)',
            })}>
            🚨 Panic Mode
          </NavLink>

          {/* Theme */}
          <div className="flex gap-1 px-3 pb-2">
            {THEMES.map(t => (
              <button key={t.value} onClick={() => setTheme(t.value)} title={t.label}
                      className="flex-1 py-1 rounded text-xs transition"
                      style={{
                        background: theme === t.value ? 'var(--primary)' : 'var(--surface-2)',
                        color: theme === t.value ? 'white' : 'var(--text-muted)',
                      }}>
                {t.icon}
              </button>
            ))}
          </div>

          <div className="px-3 pb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{username}</div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{role}</span>
                {isViewer && (
                  <span className="px-1 rounded text-xs font-semibold"
                        style={{ background: 'rgba(251,191,36,0.2)', color: '#f59e0b' }}>
                    lecture seule
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => { logout(); navigate('/login') }}
                    className="text-xs px-2 py-1 rounded hover:bg-white/10 transition"
                    style={{ color: 'var(--text-muted)' }}>
              Déco
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="shrink-0 flex items-center justify-between px-6 py-3"
                style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <Breadcrumb />
          <div className="flex items-center gap-4">
            {serverStatus && (
              <>
                <Chip label={`${serverStatus.playersOnline} joueurs`} icon="👥" />
                <Chip label={`TPS ${serverStatus.tps1m}`}
                      icon="⚡"
                      color={tpsOk ? '#10b981' : tpsWarn ? '#f59e0b' : '#ef4444'} />
                <Chip label={`RAM ${serverStatus.ramUsedMb}MB`} icon="🧠" />
              </>
            )}
          </div>
        </header>

        {/* Bannière VIEWER */}
        {isViewer && (
          <div className="shrink-0 flex items-center gap-2 px-5 py-2 text-xs font-medium"
               style={{ background: 'rgba(251,191,36,0.12)', borderBottom: '1px solid rgba(251,191,36,0.3)', color: '#f59e0b' }}>
            <span>👁️</span>
            <span>Mode lecture seule — votre compte VIEWER ne peut pas effectuer d'actions. Contactez un administrateur.</span>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          {children}
        </main>
      </div>

      <CommandPalette />
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────
function Breadcrumb() {
  const location = useLocation()
  const allItems = NAV_CATEGORIES.flatMap(c => c.items.map(i => ({ ...i, cat: c.label })))
  const match = allItems.find(i => location.pathname === i.to || (i.to !== '/' && location.pathname.startsWith(i.to)))
  if (!match) return <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>SunGuard</span>
  return (
    <div className="flex items-center gap-2 text-sm">
      <span style={{ color: 'var(--text-muted)' }}>{match.cat}</span>
      <span style={{ color: 'var(--border)' }}>/</span>
      <span className="font-semibold" style={{ color: 'var(--text)' }}>{match.icon} {match.label}</span>
    </div>
  )
}

function Chip({ label, icon, color }: { label: string; icon: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
         style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: color ?? 'var(--text-muted)' }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  )
}
