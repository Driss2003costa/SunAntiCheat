import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import { applyTheme, useThemeStore } from './stores/themeStore'

// Code-splitting : chaque page devient son propre chunk → bundle initial réduit.
// Login et Layout restent eager (critical path) ; tout le reste est lazy.
const Overview        = lazy(() => import('./pages/Overview'))
const Console         = lazy(() => import('./pages/Console'))
const Analytics       = lazy(() => import('./pages/Analytics'))
const Economy         = lazy(() => import('./pages/Economy'))
const ShopTracking    = lazy(() => import('./pages/ShopTracking'))
const Sanctions       = lazy(() => import('./pages/Sanctions'))
const Reports         = lazy(() => import('./pages/Reports'))
const Players         = lazy(() => import('./pages/Players'))
const Worlds          = lazy(() => import('./pages/Worlds'))
const Config          = lazy(() => import('./pages/Config'))
const Tasks           = lazy(() => import('./pages/Tasks'))
const Plugins         = lazy(() => import('./pages/Plugins'))
const ConfigEditor    = lazy(() => import('./pages/ConfigEditor'))
const Reboot          = lazy(() => import('./pages/Reboot'))
const Backups         = lazy(() => import('./pages/Backups'))
const Events          = lazy(() => import('./pages/Events'))
const Quests          = lazy(() => import('./pages/Quests'))
const Experiments     = lazy(() => import('./pages/Experiments'))
const ToxicChat       = lazy(() => import('./pages/ToxicChat'))
const Honeypot        = lazy(() => import('./pages/Honeypot'))
const Panic           = lazy(() => import('./pages/Panic'))
const Assistant       = lazy(() => import('./pages/Assistant'))
const Users           = lazy(() => import('./pages/Users'))
const Crates          = lazy(() => import('./pages/Crates'))
const DailyRewards    = lazy(() => import('./pages/DailyRewards'))
const Announcements   = lazy(() => import('./pages/Announcements'))
const Ranks           = lazy(() => import('./pages/Ranks'))
const Shops           = lazy(() => import('./pages/Shops'))
const Vip             = lazy(() => import('./pages/Vip'))
const Buy             = lazy(() => import('./pages/Buy'))
const PermissionsPage = lazy(() => import('./pages/Permissions'))
const Audit           = lazy(() => import('./pages/Audit'))
const PlayerProfile   = lazy(() => import('./pages/PlayerProfile'))
const TwoFactorSetup  = lazy(() => import('./pages/TwoFactorSetup'))
const Jobs            = lazy(() => import('./pages/Jobs'))
const SanctionsModern = lazy(() => import('./pages/SanctionsModern'))
const Games           = lazy(() => import('./pages/Games'))
const Roadmap         = lazy(() => import('./pages/Roadmap'))
const PortalSections  = lazy(() => import('./pages/PortalSections'))
const PortalActivity  = lazy(() => import('./pages/PortalActivity'))
const XRay            = lazy(() => import('./pages/XRay'))

function Protected({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated())
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full p-12">
      <div className="text-center">
        <div className="text-3xl mb-2 animate-pulse">☀️</div>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</div>
      </div>
    </div>
  )
}

export default function App() {
  const theme = useThemeStore(s => s.theme)
  useEffect(() => { applyTheme(theme) }, [theme])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/buy"   element={<Suspense fallback={<PageLoader/>}><Buy /></Suspense>} />
        <Route path="/*" element={
          <Protected>
            <Layout>
              <Suspense fallback={<PageLoader/>}>
                <Routes>
                  <Route path="/"              element={<Overview />} />
                  <Route path="/console"       element={<Console />} />
                  <Route path="/worlds"        element={<Worlds />} />
                  <Route path="/players"       element={<Players />} />
                  <Route path="/analytics"     element={<Analytics />} />
                  <Route path="/economy"       element={<Economy />} />
                  <Route path="/economy/shop"  element={<ShopTracking />} />
                  <Route path="/sanctions"     element={<Sanctions />} />
                  <Route path="/reports"       element={<Reports />} />
                  <Route path="/xray"          element={<XRay />} />
                  <Route path="/tasks"         element={<Tasks />} />
                  <Route path="/plugins"       element={<Plugins />} />
                  <Route path="/configs"       element={<ConfigEditor />} />
                  <Route path="/reboot"        element={<Reboot />} />
                  <Route path="/backups"       element={<Backups />} />
                  <Route path="/events"        element={<Events />} />
                  <Route path="/quests"        element={<Quests />} />
                  <Route path="/experiments"   element={<Experiments />} />
                  <Route path="/toxic-chat"    element={<ToxicChat />} />
                  <Route path="/honeypot"      element={<Honeypot />} />
                  <Route path="/panic"         element={<Panic />} />
                  <Route path="/assistant"     element={<Assistant />} />
                  <Route path="/users"         element={<Users />} />
                  <Route path="/crates"        element={<Crates />} />
                  <Route path="/daily-rewards" element={<DailyRewards />} />
                  <Route path="/announcements" element={<Announcements />} />
                  <Route path="/ranks"         element={<Ranks />} />
                  <Route path="/shops"         element={<Shops />} />
                  <Route path="/vip"           element={<Vip />} />
                  <Route path="/permissions"   element={<PermissionsPage />} />
                  <Route path="/audit"         element={<Audit />} />
                  <Route path="/players/:name" element={<PlayerProfile />} />
                  <Route path="/2fa"           element={<TwoFactorSetup />} />
                  <Route path="/jobs"          element={<Jobs />} />
                  <Route path="/jobs/roadmap"  element={<Navigate to="/roadmap?folder=jobs" replace />} />
                  <Route path="/roadmap"       element={<Roadmap />} />
                  <Route path="/moderation"    element={<SanctionsModern />} />
                  <Route path="/games"         element={<Games />} />
                  <Route path="/config"         element={<Config />} />
                  <Route path="/portal-sections"  element={<PortalSections />} />
                  <Route path="/portal-activity" element={<PortalActivity />} />
                  {/* Anciens chemins → redirige (les utilisateurs ayant l'URL en favoris) */}
                  <Route path="/portal/sections"  element={<Navigate to="/portal-sections" replace />} />
                  <Route path="/portal/activity" element={<Navigate to="/portal-activity" replace />} />
                </Routes>
              </Suspense>
            </Layout>
          </Protected>
        } />
      </Routes>
    </BrowserRouter>
  )
}
