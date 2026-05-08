import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useEffect, useState } from 'react'
import Register from './pages/Register'
import Login from './pages/Login'
import Profile from './pages/Profile'
import ForgotPassword from './pages/ForgotPassword'
import PublicProfile from './pages/PublicProfile'
import Leaderboard from './pages/Leaderboard'
import Home from './pages/Home'
import Inventory from './pages/Inventory'
import Minigames from './pages/Minigames'
import Career from './pages/Career'
import CareerJobDetail from './pages/CareerJobDetail'
import Shop from './pages/Shop'
import Quests from './pages/Quests'
import Friends from './pages/Friends'
import Messages from './pages/Messages'
import ComingSoon from './pages/ComingSoon'
import SunGuardBg from './components/SunGuardBg'
import Navbar from './components/Navbar'

// ── Sections context ──────────────────────────────────────────────────────────

import type { SectionDetail, FeatureStatus } from './api/client'
import { api, getToken } from './api/client'
import StatusBanner from './components/StatusBanner'

type SectionsCtx = {
  enabled: Record<string, boolean>
  details: Record<string, SectionDetail>
  isOp: boolean
  loaded: boolean
}

const SectionsContext = createContext<SectionsCtx>({
  enabled: {}, details: {}, isOp: false, loaded: false,
})

export function useSections() { return useContext(SectionsContext) }

/** Helper : status d'une section (OPERATIONAL par défaut). */
export function useSectionStatus(key: string): FeatureStatus {
  const ctx = useContext(SectionsContext)
  return ctx.details[key]?.status ?? 'OPERATIONAL'
}

function SectionsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [details, setDetails] = useState<Record<string, SectionDetail>>({})
  const [isOp, setIsOp]       = useState(false)
  const [loaded, setLoaded]   = useState(false)

  const refreshSections = () => {
    fetch('/api/public/sections')
      .then(r => r.json())
      .then(d => {
        if (d?.sections) setEnabled(d.sections)
        if (Array.isArray(d?.details)) {
          const map: Record<string, SectionDetail> = {}
          for (const s of d.details as SectionDetail[]) map[s.key] = s
          setDetails(map)
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }

  useEffect(() => {
    refreshSections()
    const t = setInterval(refreshSections, 30_000)
    return () => clearInterval(t)
  }, [])

  // isOp : on requête /api/public/player/me si on a un token
  useEffect(() => {
    const token = getToken()
    if (!token) return
    api.me(token).then(p => setIsOp(!!p.isOp)).catch(() => {})
  }, [])

  return (
    <SectionsContext.Provider value={{ enabled, details, isOp, loaded }}>
      <StatusBanner/>
      {children}
    </SectionsContext.Provider>
  )
}

// ── Section guard — bloque si section DISABLED ou (MAINTENANCE et non-OP) ────

function SectionGuard({ sectionKey, path, children }: { sectionKey: string; path: string; children: React.ReactNode }) {
  const ctx = useContext(SectionsContext)
  const detail = ctx.details[sectionKey]
  const enabled = ctx.enabled[sectionKey] !== false
  // Pas encore chargé : on autorise (évite un flash de "désactivé")
  if (!ctx.loaded) return <>{children}</>
  // DISABLED → écran "section désactivée" pour tout le monde (legacy)
  if (!enabled || detail?.status === 'DISABLED') return <SectionDisabled path={path} />
  // MAINTENANCE → bloque sauf OP
  if (detail?.status === 'MAINTENANCE' && !ctx.isOp) {
    return <SectionMaintenance path={path} message={detail.message}/>
  }
  return <>{children}</>
}

const SECTION_META: Record<string, { title: string; icon: string }> = {
  '/leaderboard':    { title: 'Classement',   icon: '🏆' },
  '/shop':          { title: 'Boutique',       icon: '🛍' },
  '/quests':        { title: 'Quêtes',         icon: '🎯' },
  '/career':        { title: 'Carrière',       icon: '💼' },
  '/friends':       { title: 'Amis',           icon: '🤝' },
  '/messages':      { title: 'Messages',       icon: '💬' },
  '/minigames':     { title: 'Mini-jeux',      icon: '🎮' },
}

function SectionDisabled({ path }: { path: string }) {
  const meta = SECTION_META[path] ?? { title: 'Section', icon: '🔒' }
  const GLASS = 'rgba(255,255,255,0.05)'
  const BORDER = 'rgba(255,255,255,0.08)'

  return (
    <SunGuardBg>
      <div className="relative min-h-screen flex flex-col pb-24">
        <main className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
               style={{ background: GLASS, border: `1px solid ${BORDER}` }}>
            {meta.icon}
          </div>
          <div>
            <h1 className="text-3xl font-black text-white mb-2">{meta.title}</h1>
            <p className="text-white/50 text-sm max-w-xs">
              Cette section est temporairement désactivée par l'équipe.
              Reviens bientôt !
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            Section désactivée
          </span>
        </main>
        <Navbar />
      </div>
    </SunGuardBg>
  )
}

function SectionMaintenance({ path, message }: { path: string; message: string }) {
  const meta = SECTION_META[path] ?? { title: 'Section', icon: '🛠️' }
  const GLASS  = 'rgba(255,255,255,0.05)'
  const BORDER = 'rgba(245,158,11,0.35)'
  return (
    <SunGuardBg>
      <div className="relative min-h-screen flex flex-col pb-24">
        <main className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl animate-pulse"
               style={{ background: 'rgba(245,158,11,0.12)', border: `1px solid ${BORDER}` }}>
            🛠️
          </div>
          <div className="max-w-md">
            <div className="text-xs uppercase tracking-widest font-bold mb-2"
                 style={{ color: '#fbbf24' }}>
              ⚠ MAINTENANCE EN COURS
            </div>
            <h1 className="text-3xl font-black text-white mb-2">{meta.icon} {meta.title}</h1>
            <p className="text-white/60 text-sm mb-3">
              Cette section est en maintenance. Notre équipe travaille dessus —
              reviens dans un instant.
            </p>
            {message && (
              <div className="rounded-xl px-4 py-3 text-sm text-left mt-4"
                   style={{ background: GLASS, border: `1px solid ${BORDER}`, color: '#fde68a' }}>
                💬 {message}
              </div>
            )}
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
                style={{ background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24' }}>
            Maintenance
          </span>
        </main>
        <Navbar />
      </div>
    </SunGuardBg>
  )
}

// ── Register guard — bloqué si register est désactivé ────────────────────────

function RegisterGuard({ children }: { children: React.ReactNode }) {
  const ctx = useSections()
  const enabled = ctx.enabled['register'] !== false
  if (!enabled) {
    const GLASS = 'rgba(255,255,255,0.05)'
    const BORDER = 'rgba(255,255,255,0.08)'
    return (
      <SunGuardBg>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-sm p-8 rounded-2xl space-y-4"
               style={{ background: GLASS, border: `1px solid ${BORDER}` }}>
            <div className="text-5xl">🔒</div>
            <h1 className="text-2xl font-black text-white">Inscriptions fermées</h1>
            <p className="text-white/50 text-sm">
              Les inscriptions sont temporairement suspendues. Reviens bientôt.
            </p>
          </div>
        </div>
      </SunGuardBg>
    )
  }
  return <>{children}</>
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter basename="/portal">
      <SectionsProvider>
        <Routes>
          <Route path="/" element={
            <RegisterGuard><Register /></RegisterGuard>
          } />
          <Route path="/login"                element={<Login />} />
          <Route path="/profile"              element={<Profile />} />
          <Route path="/forgot"               element={<ForgotPassword />} />
          <Route path="/player/:username"     element={
            <SectionGuard sectionKey="public_profiles" path="/player">
              <PublicProfile />
            </SectionGuard>
          } />
          <Route path="/leaderboard"          element={
            <SectionGuard sectionKey="leaderboard" path="/leaderboard">
              <Leaderboard />
            </SectionGuard>
          } />
          <Route path="/home"                 element={<Home />} />
          <Route path="/inventory"            element={<Inventory />} />
          <Route path="/minigames"            element={
            <SectionGuard sectionKey="minigames" path="/minigames">
              <Minigames />
            </SectionGuard>
          } />
          <Route path="/career"               element={
            <SectionGuard sectionKey="career" path="/career">
              <Career />
            </SectionGuard>
          } />
          <Route path="/career/job/:jobId"    element={
            <SectionGuard sectionKey="career" path="/career">
              <CareerJobDetail />
            </SectionGuard>
          } />
          <Route path="/shop"                 element={
            <SectionGuard sectionKey="shop" path="/shop">
              <Shop />
            </SectionGuard>
          } />
          <Route path="/quests"               element={
            <SectionGuard sectionKey="quests" path="/quests">
              <Quests />
            </SectionGuard>
          } />
          <Route path="/friends"              element={
            <SectionGuard sectionKey="friends" path="/friends">
              <Friends />
            </SectionGuard>
          } />
          <Route path="/messages"             element={
            <SectionGuard sectionKey="messages" path="/messages">
              <Messages />
            </SectionGuard>
          } />
          <Route path="/messages/:convId"     element={
            <SectionGuard sectionKey="messages" path="/messages">
              <Messages />
            </SectionGuard>
          } />
          <Route path="*"                     element={<Navigate to="/" replace />} />
        </Routes>
      </SectionsProvider>
    </BrowserRouter>
  )
}
