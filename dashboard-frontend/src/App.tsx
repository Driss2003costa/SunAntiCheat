import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Console from './pages/Console'
import Analytics from './pages/Analytics'
import Economy from './pages/Economy'
import ShopTracking from './pages/ShopTracking'
import Sanctions from './pages/Sanctions'
import Reports from './pages/Reports'
import Players from './pages/Players'
import Worlds from './pages/Worlds'
import Config from './pages/Config'
import Tasks from './pages/Tasks'
import Plugins from './pages/Plugins'
import ConfigEditor from './pages/ConfigEditor'
import Reboot from './pages/Reboot'
import Backups from './pages/Backups'
import Events from './pages/Events'
import Quests from './pages/Quests'
import Experiments from './pages/Experiments'
import ToxicChat from './pages/ToxicChat'
import Honeypot from './pages/Honeypot'
import Panic from './pages/Panic'
import Assistant from './pages/Assistant'
import Users from './pages/Users'
import Crates from './pages/Crates'
import DailyRewards from './pages/DailyRewards'
import Announcements from './pages/Announcements'
import Ranks from './pages/Ranks'
import Shops from './pages/Shops'
import Vip from './pages/Vip'
import Buy from './pages/Buy'
import PermissionsPage from './pages/Permissions'
import { useEffect } from 'react'
import { applyTheme, useThemeStore } from './stores/themeStore'

function Protected({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated())
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const theme = useThemeStore(s => s.theme)
  useEffect(() => { applyTheme(theme) }, [theme])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/buy"   element={<Buy />} />
        <Route path="/*" element={
          <Protected>
            <Layout>
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
                <Route path="/config"        element={<Config />} />
              </Routes>
            </Layout>
          </Protected>
        } />
      </Routes>
    </BrowserRouter>
  )
}
