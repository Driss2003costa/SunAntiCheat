import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Register from './pages/Register'
import Login from './pages/Login'
import Profile from './pages/Profile'

export default function App() {
  return (
    <BrowserRouter basename="/portal">
      <Routes>
        <Route path="/"         element={<Register />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/profile"  element={<Profile />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
