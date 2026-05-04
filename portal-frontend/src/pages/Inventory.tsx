import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile } from '../api/client'
import Navbar from '../components/Navbar'
import SunBackground from '../components/SunBackground'

const BG     = '#080d19'
const CARD   = 'rgba(15,22,40,0.8)'
const BORDER = 'rgba(251,191,36,0.12)'
const GOLD   = '#fbbf24'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'

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
    <div className="min-h-screen flex items-center justify-center pb-20" style={{ background: BG }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const roleIcon  = { PLAYER: '👤', VIP: '⭐', MODERATOR: '🛡️', ADMIN: '👑' }[profile.role] ?? '👤'
  const roleBorder = {
    PLAYER:    'rgba(255,255,255,0.1)',
    VIP:       'rgba(251,191,36,0.35)',
    MODERATOR: 'rgba(59,130,246,0.35)',
    ADMIN:     'rgba(239,68,68,0.35)',
  }[profile.role] ?? 'rgba(255,255,255,0.1)'
  const roleGlow = {
    PLAYER:    'none',
    VIP:       '0 0 16px rgba(251,191,36,0.15)',
    MODERATOR: '0 0 16px rgba(59,130,246,0.15)',
    ADMIN:     '0 0 16px rgba(239,68,68,0.15)',
  }[profile.role] ?? 'none'

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: BG }}>
      <SunBackground />

      {/* Header */}
      <div className="relative overflow-hidden z-10">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(251,191,36,0.12),transparent)' }} />
        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎒</span>
            <div>
              <h1 className="text-2xl font-black" style={{ color: TEXT }}>Inventaire</h1>
              <p className="text-sm" style={{ color: MUTED }}>{profile.username}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-sm mx-auto relative z-10">

        {/* Wallet */}
        <div className="rounded-2xl overflow-hidden backdrop-blur-sm"
             style={{ background: CARD, border: `1px solid rgba(251,191,36,0.2)` }}>
          <div className="px-5 py-3.5 flex items-center gap-2"
               style={{ borderBottom: `1px solid ${BORDER}` }}>
            <span>💰</span>
            <span className="text-sm font-semibold" style={{ color: TEXT }}>Portefeuille</span>
          </div>
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black" style={{ color: TEXT }}>
                  {profile.balance != null ? fmtBalance(profile.balance) : '—'}
                </span>
                <span className="text-lg font-bold" style={{ color: GOLD }}>$</span>
              </div>
              <p className="text-xs mt-1" style={{ color: MUTED }}>Coins disponibles en jeu</p>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                 style={{ background: 'rgba(251,191,36,0.12)', border: `1px solid rgba(251,191,36,0.25)` }}>
              <span className="text-3xl">🪙</span>
            </div>
          </div>
          <div className="px-5 pb-4 flex gap-3 text-xs" style={{ color: MUTED }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              Gagné en jouant
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: GOLD }} />
              Récompenses quotidiennes
            </span>
          </div>
        </div>

        {/* Crate keys */}
        <div className="rounded-2xl overflow-hidden backdrop-blur-sm"
             style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-3.5 flex items-center justify-between"
               style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-2">
              <span>🗝️</span>
              <span className="text-sm font-semibold" style={{ color: TEXT }}>Clés de caisses</span>
            </div>
            <span className="text-xs font-medium rounded-full px-2 py-0.5"
                  style={{ background: 'rgba(251,191,36,0.08)', border: `1px solid ${BORDER}`, color: MUTED }}>
              0 clé
            </span>
          </div>

          <div className="p-4">
            <div className="grid gap-1.5 p-3 rounded-xl"
                 style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, background: 'rgba(0,0,0,0.3)', border: `1px solid ${BORDER}` }}>
              {Array.from({ length: SLOT_COUNT }, (_, i) => (
                <div key={i}
                  className="aspect-square rounded-md flex items-center justify-center hover:opacity-80 transition-opacity cursor-default"
                  style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.08)' }}
                />
              ))}
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs" style={{ color: MUTED }}>Aucune clé en inventaire</p>
              <p className="text-[11px] mt-1" style={{ color: '#475569' }}>
                Réclame des clés via les récompenses quotidiennes
              </p>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="rounded-2xl overflow-hidden backdrop-blur-sm"
             style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-3.5 flex items-center gap-2"
               style={{ borderBottom: `1px solid ${BORDER}` }}>
            <span>🏷️</span>
            <span className="text-sm font-semibold" style={{ color: TEXT }}>Grades & Badges</span>
          </div>
          <div className="p-4 space-y-2">
            {/* Active role badge */}
            <div className="flex items-center gap-3 p-3 rounded-xl"
                 style={{ border: `1px solid ${roleBorder}`, background: 'rgba(0,0,0,0.2)', boxShadow: roleGlow }}>
              <span className="text-xl shrink-0">{roleIcon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: TEXT }}>{profile.role}</p>
                <p className="text-xs" style={{ color: MUTED }}>Grade actif</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            </div>

            {/* Locked badges */}
            <div className="flex items-center gap-3 p-3 rounded-xl opacity-30"
                 style={{ border: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.1)' }}>
              <span className="text-xl shrink-0">🎖️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: TEXT }}>Vétéran</p>
                <p className="text-xs" style={{ color: MUTED }}>100 heures de jeu</p>
              </div>
              <span className="text-xs shrink-0" style={{ color: MUTED }}>🔒</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl opacity-30"
                 style={{ border: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.1)' }}>
              <span className="text-xl shrink-0">🏅</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: TEXT }}>Conquérant</p>
                <p className="text-xs" style={{ color: MUTED }}>Top 10 du classement</p>
              </div>
              <span className="text-xs shrink-0" style={{ color: MUTED }}>🔒</span>
            </div>

            <p className="text-center text-[11px] pt-1" style={{ color: '#475569' }}>
              D'autres badges arrivent bientôt
            </p>
          </div>
        </div>

        {/* Playtime */}
        <div className="rounded-2xl overflow-hidden backdrop-blur-sm"
             style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-3.5 flex items-center gap-2"
               style={{ borderBottom: `1px solid ${BORDER}` }}>
            <span>⏱️</span>
            <span className="text-sm font-semibold" style={{ color: TEXT }}>Temps de jeu</span>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-black" style={{ color: TEXT }}>{profile.playtime_formatted ?? '—'}</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>Accumulé sur le serveur</p>
            </div>
            <span className="text-4xl">⏳</span>
          </div>
        </div>
      </div>

      <Navbar />
    </div>
  )
}
