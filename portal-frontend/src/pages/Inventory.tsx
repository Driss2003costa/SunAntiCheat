import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile } from '../api/client'
import Navbar from '../components/Navbar'

function fmtBalance(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const GRID_ROWS  = 3
const GRID_COLS  = 9
const SLOT_COUNT = GRID_ROWS * GRID_COLS

export default function Inventory() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    api.me(token)
      .then(setProfile)
      .catch(e => {
        if (e.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      })
      .finally(() => setLoading(false))
  }, [navigate])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center pb-20">
      <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const roleIcon  = { PLAYER: '👤', VIP: '⭐', MODERATOR: '🛡️', ADMIN: '👑' }[profile.role] ?? '👤'
  const roleColor = {
    PLAYER:    'bg-gray-800/60 border-gray-700',
    VIP:       'bg-yellow-500/10 border-yellow-500/30',
    MODERATOR: 'bg-blue-500/10 border-blue-500/30',
    ADMIN:     'bg-red-500/10 border-red-500/30',
  }[profile.role] ?? 'bg-gray-800/60 border-gray-700'

  return (
    <div className="min-h-screen bg-gray-950 pb-24">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/25 via-purple-900/10 to-gray-950" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎒</span>
            <div>
              <h1 className="text-2xl font-black text-white">Inventaire</h1>
              <p className="text-sm text-gray-400">{profile.username}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-sm mx-auto">

        {/* Wallet */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
            <span>💰</span>
            <span className="text-sm font-semibold text-white">Portefeuille</span>
          </div>
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">
                  {profile.balance != null ? fmtBalance(profile.balance) : '—'}
                </span>
                <span className="text-lg font-bold text-yellow-400">$</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Coins disponibles en jeu</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
              <span className="text-3xl">🪙</span>
            </div>
          </div>
          <div className="px-5 pb-4 flex gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Gagné en jouant
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
              Récompenses quotidiennes
            </span>
          </div>
        </div>

        {/* Crate keys — Minecraft-style grid */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>🗝️</span>
              <span className="text-sm font-semibold text-white">Clés de caisses</span>
            </div>
            <span className="text-xs font-medium text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">0 clé</span>
          </div>

          {/* Grid */}
          <div className="p-4">
            <div
              className="grid gap-1.5 p-3 bg-gray-950/60 rounded-xl border border-gray-800"
              style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
            >
              {Array.from({ length: SLOT_COUNT }, (_, i) => (
                <div key={i}
                  className="aspect-square rounded-md bg-gray-800/70 border border-gray-700/50 flex items-center justify-center
                    hover:border-gray-600 transition-colors cursor-default"
                />
              ))}
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-600">Aucune clé en inventaire</p>
              <p className="text-[11px] text-gray-700 mt-1">
                Réclame des clés via les récompenses quotidiennes
              </p>
            </div>
          </div>
        </div>

        {/* Badges / Rank */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
            <span>🏷️</span>
            <span className="text-sm font-semibold text-white">Grades & Badges</span>
          </div>
          <div className="p-4 space-y-2">
            {/* Active role badge */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${roleColor}`}>
              <span className="text-xl shrink-0">{roleIcon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{profile.role}</p>
                <p className="text-xs text-gray-500">Grade actif</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            </div>

            {/* Placeholder locked badge */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-800 opacity-35">
              <span className="text-xl shrink-0">🎖️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Vétéran</p>
                <p className="text-xs text-gray-500">100 heures de jeu</p>
              </div>
              <span className="text-gray-600 text-xs shrink-0">🔒</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-800 opacity-35">
              <span className="text-xl shrink-0">🏅</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Conquérant</p>
                <p className="text-xs text-gray-500">Top 10 du classement</p>
              </div>
              <span className="text-gray-600 text-xs shrink-0">🔒</span>
            </div>

            <p className="text-center text-[11px] text-gray-700 pt-1">
              D'autres badges arrivent bientôt
            </p>
          </div>
        </div>

        {/* Playtime */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
            <span>⏱️</span>
            <span className="text-sm font-semibold text-white">Temps de jeu</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-white">{profile.playtime_formatted ?? '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Accumulé sur le serveur</p>
            </div>
            <span className="text-4xl">⏳</span>
          </div>
        </div>
      </div>

      <Navbar />
    </div>
  )
}
