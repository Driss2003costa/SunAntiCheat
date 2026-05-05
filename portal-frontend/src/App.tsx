import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

export default function App() {
  return (
    <BrowserRouter basename="/portal">
      <Routes>
        <Route path="/"                     element={<Register />} />
        <Route path="/login"                element={<Login />} />
        <Route path="/profile"              element={<Profile />} />
        <Route path="/forgot"               element={<ForgotPassword />} />
        <Route path="/player/:username"     element={<PublicProfile />} />
        <Route path="/leaderboard"          element={<Leaderboard />} />
        <Route path="/home"                 element={<Home />} />
        <Route path="/inventory"            element={<Inventory />} />
        <Route path="/minigames"            element={<Minigames />} />
        <Route path="/career"               element={<Career />} />
        <Route path="/career/job/:jobId"    element={<CareerJobDetail />} />
        <Route path="/shop"                 element={<Shop />} />
        <Route path="/quests"               element={<Quests />} />
        <Route path="/friends"              element={<Friends />} />
        <Route path="/messages"             element={<Messages />} />
        <Route path="/messages/:convId"     element={<Messages />} />
        <Route path="*"                     element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
