import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type VipPlan, type CrateShopEntry } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'

const BG     = '#080d19'
const CARD   = 'rgba(15,22,40,0.8)'
const BORDER = 'rgba(251,191,36,0.12)'
const GOLD   = '#fbbf24'
const TEXT   = '#f1f5f9'
const MUTED  = '#64748b'

function fmtBalance(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function fmtPrice(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Shop() {
  const navigate = useNavigate()
  const [profile,      setProfile]      = useState<PlayerProfile | null>(null)
  const [plans,        setPlans]        = useState<VipPlan[]>([])
  const [crates,       setCrates]       = useState<CrateShopEntry[]>([])
  const [loading,      setLoading]      = useState(true)
  const [checkoutPlan, setCheckoutPlan] = useState<VipPlan | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutErr,  setCheckoutErr]  = useState('')
  const [crateBusy,    setCrateBusy]    = useState<string | null>(null)
  const [crateMsg,     setCrateMsg]     = useState<{ id: string; msg: string; ok: boolean } | null>(null)
  const [localBalance, setLocalBalance] = useState<number | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }

    Promise.all([
      api.me(token),
      api.vipPlans().catch(() => [] as VipPlan[]),
      api.crateShop().catch(() => [] as CrateShopEntry[]),
    ]).then(([p, pl, cr]) => {
      setProfile(p)
      setLocalBalance((p as PlayerProfile).balance ?? null)
      setPlans((pl as VipPlan[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setCrates(cr as CrateShopEntry[])
    }).catch(e => {
      if (e.status === 401) { clearToken(); navigate('/login', { replace: true }) }
    }).finally(() => setLoading(false))
  }, [navigate])

  async function buyCrate(crate: CrateShopEntry) {
    const token = getToken()
    if (!token || !profile) return
    setCrateBusy(crate.id)
    setCrateMsg(null)
    try {
      const res = await api.crateBuy(token, crate.id, 1)
      setLocalBalance(res.newBalance)
      setCrateMsg({ id: crate.id, msg: res.free ? 'Clé offerte (admin) !' : res.message, ok: true })
    } catch (e: any) {
      setCrateMsg({ id: crate.id, msg: e.error || e.message || 'Erreur lors de l\'achat', ok: false })
    } finally {
      setCrateBusy(null)
    }
  }

  async function startCheckout(plan: VipPlan, gateway: 'STRIPE' | 'PAYPAL') {
    if (!profile) return
    setCheckoutBusy(true); setCheckoutErr('')
    try {
      const res = await fetch('/api/public/vip/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, playerName: profile.username, gateway }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      window.location.href = data.redirectUrl
    } catch (e: any) {
      setCheckoutErr(e.message || 'Une erreur est survenue.')
      setCheckoutBusy(false)
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

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: BG }}>
      <PageAura theme="shop" />

      {/* Header */}
      <div className="relative overflow-hidden z-10">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(251,191,36,0.15),transparent)' }} />
        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🛒</span>
              <div>
                <h1 className="text-2xl font-black" style={{ color: TEXT }}>Boutique</h1>
                <p className="text-sm" style={{ color: MUTED }}>Avantages & VIP</p>
              </div>
            </div>
            {localBalance != null && (
              <div className="text-right pb-1">
                <p className="text-xl font-black" style={{ color: GOLD }}>
                  {fmtBalance(localBalance)} <span className="text-base">$</span>
                </p>
                <p className="text-xs" style={{ color: MUTED }}>Ton solde</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-sm mx-auto relative z-10">

        {/* VIP Plans */}
        {plans.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-0.5" style={{ color: MUTED }}>
              Abonnements VIP
            </p>
            <div className="space-y-3">
              {plans.map(plan => {
                const planColor = plan.color ?? GOLD
                return (
                  <div key={plan.id} className="rounded-2xl overflow-hidden backdrop-blur-sm"
                       style={{ background: CARD, border: `1px solid ${planColor}30` }}>

                    {/* Plan header */}
                    <div className="flex items-center gap-4 p-4"
                         style={{ borderBottom: `1px solid rgba(251,191,36,0.1)` }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                           style={{ background: `${planColor}18`, border: `1px solid ${planColor}35` }}>
                        <span className="text-2xl">{plan.icon ?? '⭐'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold" style={{ color: TEXT }}>{plan.displayName}</p>
                        {plan.description && <p className="text-xs mt-0.5" style={{ color: MUTED }}>{plan.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-black" style={{ color: planColor }}>
                          {fmtPrice(plan.priceEur)}&nbsp;<span className="text-sm">€</span>
                        </p>
                        <p className="text-[10px]" style={{ color: MUTED }}>{plan.durationDays} jour{plan.durationDays > 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {/* Perks */}
                    {plan.perks && plan.perks.length > 0 && (
                      <div className="px-4 py-3 space-y-1.5"
                           style={{ borderBottom: `1px solid rgba(251,191,36,0.08)` }}>
                        {plan.perks.map((perk, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-xs mt-0.5 shrink-0" style={{ color: GOLD }}>✦</span>
                            <p className="text-xs" style={{ color: '#cbd5e1' }}>{perk}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Checkout */}
                    <div className="p-4 space-y-2">
                      {checkoutPlan?.id === plan.id ? (
                        <div className="space-y-2">
                          <p className="text-xs text-center mb-3" style={{ color: MUTED }}>Choisir le mode de paiement</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => startCheckout(plan, 'STRIPE')} disabled={checkoutBusy}
                              className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm disabled:opacity-50 text-white transition-colors"
                              style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)' }}>
                              💳 Carte
                            </button>
                            <button onClick={() => startCheckout(plan, 'PAYPAL')} disabled={checkoutBusy}
                              className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm disabled:opacity-50 text-white transition-colors"
                              style={{ background: 'linear-gradient(135deg,#0070ba,#003087)' }}>
                              🅿️ PayPal
                            </button>
                          </div>
                          <button onClick={() => { setCheckoutPlan(null); setCheckoutErr('') }}
                            className="w-full py-2 text-xs transition-colors"
                            style={{ color: MUTED }}>
                            Annuler
                          </button>
                          {checkoutErr && <p className="text-xs text-red-400 text-center">{checkoutErr}</p>}
                        </div>
                      ) : (
                        <button onClick={() => { setCheckoutPlan(plan); setCheckoutErr('') }}
                          className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] text-gray-900"
                          style={{
                            background: `linear-gradient(135deg,#f59e0b,#fb923c)`,
                            boxShadow: '0 4px 20px rgba(251,191,36,0.2)',
                          }}>
                          Acheter — {fmtPrice(plan.priceEur)} €
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {plans.length === 0 && (
          <div className="rounded-2xl p-10 text-center backdrop-blur-sm"
               style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <span className="text-5xl block mb-3">⭐</span>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>Aucun plan VIP configuré</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>Les offres VIP seront disponibles prochainement.</p>
          </div>
        )}

        {/* Crates shop */}
        {crates.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-0.5" style={{ color: MUTED }}>
              Caisses
            </p>
            <div className="space-y-3">
              {crates.map(crate => {
                const c = crate.color ?? GOLD
                const isBusy = crateBusy === crate.id
                const msg = crateMsg?.id === crate.id ? crateMsg : null
                return (
                  <div key={crate.id} className="rounded-2xl overflow-hidden backdrop-blur-sm"
                       style={{ background: CARD, border: `1px solid ${c}30` }}>
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl"
                           style={{ background: `${c}18`, border: `1px solid ${c}35` }}>
                        📦
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold" style={{ color: TEXT }}>{crate.displayName}</p>
                        {crate.description && (
                          <p className="text-xs mt-0.5" style={{ color: MUTED }}>{crate.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {crate.price > 0 ? (
                          <>
                            <p className="text-xl font-black" style={{ color: c }}>
                              {fmtBalance(crate.price)} <span className="text-sm">$</span>
                            </p>
                            <p className="text-[10px]" style={{ color: MUTED }}>par clé</p>
                          </>
                        ) : (
                          <p className="text-sm font-bold" style={{ color: '#4ade80' }}>Gratuit</p>
                        )}
                      </div>
                    </div>

                    <div className="px-4 pb-4 space-y-2">
                      {msg && (
                        <p className={`text-xs text-center py-1.5 rounded-lg ${msg.ok ? 'text-green-400' : 'text-red-400'}`}
                           style={{ background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)' }}>
                          {msg.ok ? '✓' : '✗'} {msg.msg}
                        </p>
                      )}
                      <button
                        onClick={() => buyCrate(crate)}
                        disabled={isBusy}
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 text-gray-900"
                        style={{ background: `linear-gradient(135deg,${c},${c}cc)`, boxShadow: `0 4px 20px ${c}25` }}>
                        {isBusy ? 'Achat en cours…' : crate.price > 0
                          ? `Acheter — ${fmtBalance(crate.price)} $`
                          : 'Obtenir gratuitement'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* In-game economy */}
        <div className="rounded-2xl overflow-hidden backdrop-blur-sm"
             style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="px-5 py-3.5 flex items-center gap-2"
               style={{ borderBottom: `1px solid ${BORDER}` }}>
            <span>🏪</span>
            <span className="text-sm font-semibold" style={{ color: TEXT }}>Économie en jeu</span>
          </div>
          <div>
            <EcoRow icon="🪙" title="Gagner des coins" desc="Joue, mine, accomplis des quêtes, ou réclame tes récompenses quotidiennes" />
            <EcoRow icon="🛍️" title="Boutique /shop"    desc="Dépense tes coins en jeu via la commande /shop pour acheter des items" />
            <EcoRow icon="📦" title="Caisses & Clés"    desc="Obtiens des clés via les missions et ouvre des caisses pour des récompenses rares" />
            <EcoRow icon="📈" title="Métiers"            desc="Exerce un métier pour générer des revenus passifs et monter en niveau" />
          </div>
        </div>
      </div>

      <Navbar />
    </div>
  )
}

function EcoRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5"
         style={{ borderBottom: '1px solid rgba(251,191,36,0.05)' }}>
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{desc}</p>
      </div>
    </div>
  )
}
