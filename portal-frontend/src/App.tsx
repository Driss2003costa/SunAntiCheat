import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Register from './pages/Register'
import Login from './pages/Login'
import Profile from './pages/Profile'
import ForgotPassword from './pages/ForgotPassword'
import PublicProfile from './pages/PublicProfile'
import Leaderboard from './pages/Leaderboard'
import ComingSoon from './pages/ComingSoon'

export default function App() {
  return (
    <BrowserRouter basename="/portal">
      <Routes>
        <Route path="/"                  element={<Register />} />
        <Route path="/login"             element={<Login />} />
        <Route path="/profile"           element={<Profile />} />
        <Route path="/forgot"            element={<ForgotPassword />} />
        <Route path="/player/:username"  element={<PublicProfile />} />
        <Route path="/leaderboard"       element={<Leaderboard />} />
        <Route path="/home"              element={<ComingSoon path="/home" />} />
        <Route path="/inventory"         element={<ComingSoon path="/inventory" />} />
        <Route path="/minigames"         element={<ComingSoon path="/minigames" />} />
        <Route path="/career"            element={<ComingSoon path="/career" />} />
        <Route path="/shop"              element={<ComingSoon path="/shop" />} />
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
