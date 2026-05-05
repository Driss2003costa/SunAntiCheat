import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type CrateKeyEntry } from '../api/client'
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

type ClaimModal = { crate: CrateKeyEntry; step: 'confirm' | 'loading' | 'done'; message?: string; ok?: boolean }

export default function Inventory() {
  const navigate = useNavigate()
  const [profile,   setProfile]   = useState<PlayerProfile | null>(null)
  const [keys,      setKeys]      = useState<CrateKeyEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState<ClaimModal | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }
    Promise.all([
      api.me(token),
      api.crateKeys(token).catch(() => [] as CrateKeyEntry[]),
    ])
      .then(([p, k]) => { setProfile(p); setKeys(k as CrateKeyEntry[]) })
      .catch(e => {
        if (e.status === 401) { clearToken(); navigate('/login', { replace: true }) }
      })
      .finally(() => setLoading(false))
  }, [navigate])

  async function claimKey(crate: CrateKeyEntry) {
    const token = getToken()
    if (!token) return
    setModal({ crate, step: 'loading' })
    try {
      const res = await api.crateClaim(token, crate.crateId)
      setModal({ crate, step: 'done', message: res.message, ok: true })
      // Mettre à jour les clés localement
      setKeys(prev => prev.map(k =>
        k.crateId === crate.crateId
          ? { ...k, count: k.count - 1, pendingClaim: !res.deliveredNow }
          : k
      ).filter(k => k.count > 0))
    } catch (e: any) {
      setModal({ crate, step: 'done', message: e.error || e.message || 'Erreur lors de la réclamation', ok: false })
    }
  }

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

  const totalKeys = keys.reduce((s, k) => s + k.count, 0)

  // Remplir les slots : une entrée par tranche de clé (max SLOT_COUNT)
  const slots: (CrateKeyEntry | null)[] = Array.from({ length: SLOT_COUNT }, () => null)
  let slotIdx = 0
  for (const entry of keys) {
    for (let i = 0; i < entry.count && slotIdx < SLOT_COUNT; i++) {
      slots[slotIdx++] = entry
    }
  }

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: BG }}>
      <SunBackground />

      {/* Claim modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
               style={{ background: 'rgba(15,22,40,0.98)', border: `1px solid ${BORDER}` }}>
            {modal.step === 'confirm' && (
              <>
                <div className="text-center">
                  <span className="text-4xl block mb-2">🗝️</span>
                  <p className="text-base font-bold" style={{ color: TEXT }}>
                    Réclamer la clé
                  </p>
                  <p className="text-sm mt-1" style={{ color: MUTED }}>
                    <span style={{ color: GOLD }}>{modal.crate.displayName}</span>
                  </p>
                  <p className="text-xs mt-3 rounded-xl p-3"
                     style={{ color: MUTED, background: 'rgba(251,191,36,0.05)', border: `1px solid ${BORDER}` }}>
                    Cette clé vous sera remise en jeu à votre prochaine connexion (ou immédiatement si vous êtes connecté).
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setModal(null)}
                    className="py-3 rounded-xl font-semibold text-sm transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', color: MUTED }}>
                    Annuler
                  </button>
                  <button onClick={() => claimKey(modal.crate)}
                    className="py-3 rounded-xl font-bold text-sm text-gray-900 transition-all active:scale-[0.98]"
                    style={{ background: `linear-gradient(135deg,#f59e0b,#fb923c)` }}>
                    Confirmer
                  </button>
                </div>
              </>
            )}

            {modal.step === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-8 h-8 rounded-full border-2 animate-spin"
                     style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
                <p className="text-sm" style={{ color: MUTED }}>Réclamation en cours…</p>
              </div>
            )}

            {modal.step === 'done' && (
              <>
                <div className="text-center">
                  <span className="text-4xl block mb-2">{modal.ok ? '✅' : '❌'}</span>
                  <p className="text-sm" style={{ color: modal.ok ? '#4ade80' : '#f87171' }}>
                    {modal.message}
                  </p>
                </div>
                <button onClick={() => setModal(null)}
                  className="w-full py-3 rounded-xl font-bold text-sm text-gray-900"
                  style={{ background: `linear-gradient(135deg,#f59e0b,#fb923c)` }}>
                  Fermer
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
                  style={{ background: 'rgba(251,191,36,0.08)', border: `1px solid ${BORDER}`, color: totalKeys > 0 ? GOLD : MUTED }}>
              {totalKeys} clé{totalKeys !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="p-4">
            <div className="grid gap-1.5 p-3 rounded-xl"
                 style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, background: 'rgba(0,0,0,0.3)', border: `1px solid ${BORDER}` }}>
              {slots.map((entry, i) => {
                if (!entry) {
                  return (
                    <div key={i}
                      className="aspect-square rounded-md flex items-center justify-center cursor-default"
                      style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.08)' }}
                    />
                  )
                }
                const slotColor = entry.color ?? GOLD
                const isPending = entry.pendingClaim
                return (
                  <div key={i}
                    className="aspect-square rounded-md flex items-center justify-center relative cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
                    style={{ background: `${slotColor}18`, border: `1px solid ${slotColor}40` }}
                    title={entry.displayName}
                    onClick={() => setModal({ crate: entry, step: 'confirm' })}>
                    <span className="text-base">🗝️</span>
                    {isPending && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-yellow-400 border border-black" />
                    )}
                  </div>
                )
              })}
            </div>

            {totalKeys > 0 ? (
              <div className="mt-4 space-y-2">
                {keys.map(entry => (
                  <div key={entry.crateId}
                       className="flex items-center gap-3 p-3 rounded-xl"
                       style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${entry.color ?? GOLD}25` }}>
                    <span className="text-xl shrink-0">🗝️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{entry.displayName}</p>
                      {entry.pendingClaim && (
                        <p className="text-[10px] mt-0.5" style={{ color: '#fbbf24' }}>⏳ En attente de livraison…</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${entry.color ?? GOLD}20`, color: entry.color ?? GOLD }}>
                        ×{entry.count}
                      </span>
                      <button
                        onClick={() => setModal({ crate: entry, step: 'confirm' })}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all active:scale-95"
                        style={{ background: `linear-gradient(135deg,#f59e0b,#fb923c)`, color: '#111' }}>
                        Réclamer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-center">
                <p className="text-xs" style={{ color: MUTED }}>Aucune clé en inventaire</p>
                <p className="text-[11px] mt-1" style={{ color: '#475569' }}>
                  Achetez des clés dans la boutique ou réclamez des récompenses
                </p>
              </div>
            )}
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
