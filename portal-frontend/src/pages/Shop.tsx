import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type VipPlan } from '../api/client'
import Navbar from '../components/Navbar'

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
  const [loading,      setLoading]      = useState(true)
  const [checkoutPlan, setCheckoutPlan] = useState<VipPlan | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutErr,  setCheckoutErr]  = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login', { replace: true }); return }

    Promise.all([
      api.me(token),
      api.vipPlans().catch(() => [] as VipPlan[]),
    ]).then(([p, pl]) => {
      setProfile(p)
      setPlans((pl as VipPlan[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    }).catch(e => {
      if (e.status === 401) { clearToken(); navigate('/login', { replace: true }) }
    }).finally(() => setLoading(false))
  }, [navigate])

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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center pb-20">
      <div className="w-10 h-10 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      <Navbar />
    </div>
  )
  if (!profile) return null

  return (
    <div className="min-h-screen bg-gray-950 pb-24">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/25 via-amber-900/10 to-gray-950" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🛒</span>
              <div>
                <h1 className="text-2xl font-black text-white">Boutique</h1>
                <p className="text-sm text-gray-400">Avantages & VIP</p>
              </div>
            </div>
            {profile.balance != null && (
              <div className="text-right pb-1">
                <p className="text-xl font-black text-yellow-400">{fmtBalance(profile.balance)} <span className="text-base">$</span></p>
                <p className="text-xs text-gray-500">Ton solde</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-sm mx-auto">

        {/* VIP Plans */}
        {plans.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 px-0.5">Abonnements VIP</p>
            <div className="space-y-3">
              {plans.map(plan => (
                <div key={plan.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">

                  {/* Plan header */}
                  <div className="flex items-center gap-4 p-4 border-b border-gray-800">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                      <span className="text-2xl">{plan.icon ?? '⭐'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-white">{plan.displayName}</p>
                      {plan.description && <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-black text-yellow-400">{fmtPrice(plan.priceEur)}&nbsp;<span className="text-sm text-yellow-500">€</span></p>
                      <p className="text-[10px] text-gray-500">{plan.durationDays} jour{plan.durationDays > 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* Perks */}
                  {plan.perks && plan.perks.length > 0 && (
                    <div className="px-4 py-3 space-y-1.5 border-b border-gray-800">
                      {plan.perks.map((perk, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-yellow-400 text-xs mt-0.5 shrink-0">✦</span>
                          <p className="text-xs text-gray-300">{perk}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Checkout */}
                  <div className="p-4 space-y-2">
                    {checkoutPlan?.id === plan.id ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400 text-center mb-3">Choisir le mode de paiement</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => startCheckout(plan, 'STRIPE')} disabled={checkoutBusy}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                            💳 Carte
                          </button>
                          <button onClick={() => startCheckout(plan, 'PAYPAL')} disabled={checkoutBusy}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                            🅿️ PayPal
                          </button>
                        </div>
                        <button onClick={() => { setCheckoutPlan(null); setCheckoutErr('') }}
                          className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                          Annuler
                        </button>
                        {checkoutErr && <p className="text-xs text-red-400 text-center">{checkoutErr}</p>}
                      </div>
                    ) : (
                      <button onClick={() => { setCheckoutPlan(plan); setCheckoutErr('') }}
                        className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold text-sm transition-colors active:scale-[0.98]">
                        Acheter — {fmtPrice(plan.priceEur)} €
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {plans.length === 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center">
            <span className="text-5xl block mb-3">⭐</span>
            <p className="text-sm font-semibold text-white">Aucun plan VIP configuré</p>
            <p className="text-xs text-gray-500 mt-1">Les offres VIP seront disponibles prochainement.</p>
          </div>
        )}

        {/* In-game economy */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
            <span>🏪</span>
            <span className="text-sm font-semibold text-white">Économie en jeu</span>
          </div>
          <div className="divide-y divide-gray-800/50">
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
    <div className="flex items-start gap-3 px-5 py-3.5">
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
