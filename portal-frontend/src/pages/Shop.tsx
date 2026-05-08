import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type VipPlan, type CrateShopEntry } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import DegradedNotice from '../components/DegradedNotice'

const GLASS  = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
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
    const token = getToken(); if (!token || !profile) return
    setCrateBusy(crate.id); setCrateMsg(null)
    try {
      const res = await api.crateBuy(token, crate.id, 1)
      setLocalBalance(res.newBalance)
      setCrateMsg({ id: crate.id, msg: res.free ? 'Clé offerte !' : res.message, ok: true })
    } catch (e: any) {
      setCrateMsg({ id: crate.id, msg: e.error || e.message || "Erreur lors de l'achat", ok: false })
    } finally { setCrateBusy(null) }
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080d19' }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: GOLD }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080d19' }}>
      <PageAura theme="shop" />

      {/* Header */}
      <div className="relative z-10 px-5 pt-12 pb-6 max-w-screen-sm mx-auto">
        <DegradedNotice sectionKey="shop"/>
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold" style={{ color: TEXT }}>Boutique</h1>
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>VIP & avantages</p>
          </div>
          {localBalance != null && (
            <div className="text-right">
              <p className="text-xl font-bold" style={{ color: GOLD }}>{fmtBalance(localBalance)} $</p>
              <p className="text-xs" style={{ color: MUTED }}>Ton solde</p>
            </div>
          )}
        </div>

        {/* VIP Plans */}
        {plans.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: MUTED }}>Abonnements VIP</p>
            <div className="space-y-3">
              {plans.map(plan => {
                const c = plan.color ?? GOLD
                return (
                  <div key={plan.id} className="rounded-2xl overflow-hidden"
                       style={{ background: GLASS, border: `1px solid ${c}30`, backdropFilter: 'blur(12px)' }}>
                    {/* Top accent */}
                    <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${c}, transparent)` }} />
                    <div className="p-4">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
                             style={{ background: `${c}15`, border: `1px solid ${c}25` }}>
                          {plan.icon ?? '⭐'}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold" style={{ color: TEXT }}>{plan.displayName}</p>
                          {plan.description && <p className="text-xs mt-0.5" style={{ color: MUTED }}>{plan.description}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold" style={{ color: c }}>{fmtPrice(plan.priceEur)} €</p>
                          <p className="text-[10px]" style={{ color: MUTED }}>{plan.durationDays} jour{plan.durationDays > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      {plan.perks && plan.perks.length > 0 && (
                        <div className="space-y-1.5 mb-4 pb-3 border-b" style={{ borderColor: `${c}18` }}>
                          {plan.perks.map((perk, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-xs shrink-0 mt-0.5" style={{ color: c }}>✦</span>
                              <p className="text-xs" style={{ color: '#cbd5e1' }}>{perk}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {checkoutPlan?.id === plan.id ? (
                        <div className="space-y-2">
                          <p className="text-xs text-center mb-3" style={{ color: MUTED }}>Mode de paiement</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => startCheckout(plan, 'STRIPE')} disabled={checkoutBusy}
                              className="py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)' }}>
                              💳 Carte
                            </button>
                            <button onClick={() => startCheckout(plan, 'PAYPAL')} disabled={checkoutBusy}
                              className="py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg,#0070ba,#003087)' }}>
                              PayPal
                            </button>
                          </div>
                          <button onClick={() => { setCheckoutPlan(null); setCheckoutErr('') }}
                            className="w-full py-2 text-xs" style={{ color: MUTED }}>Annuler</button>
                          {checkoutErr && <p className="text-xs text-red-400 text-center">{checkoutErr}</p>}
                        </div>
                      ) : (
                        <button onClick={() => { setCheckoutPlan(plan); setCheckoutErr('') }}
                          className="w-full py-3 rounded-xl font-bold text-sm active:scale-[0.98] transition-all text-gray-900"
                          style={{ background: `linear-gradient(135deg,#f59e0b,#fb923c)`, boxShadow: '0 4px 20px rgba(251,191,36,0.2)' }}>
                          Acheter — {fmtPrice(plan.priceEur)} €
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {plans.length === 0 && (
          <div className="rounded-2xl p-10 text-center mb-6"
               style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
            <span className="text-4xl block mb-3">⭐</span>
            <p className="text-sm font-semibold" style={{ color: TEXT }}>Aucun plan VIP configuré</p>
            <p className="text-xs mt-1" style={{ color: MUTED }}>Les offres seront disponibles prochainement.</p>
          </div>
        )}

        {/* Crates */}
        {crates.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: MUTED }}>Caisses</p>
            <div className="space-y-3">
              {crates.map(crate => {
                const c = crate.color ?? GOLD
                const isBusy = crateBusy === crate.id
                const msg = crateMsg?.id === crate.id ? crateMsg : null
                return (
                  <div key={crate.id} className="rounded-2xl overflow-hidden"
                       style={{ background: GLASS, border: `1px solid ${c}28`, backdropFilter: 'blur(12px)' }}>
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl"
                           style={{ background: `${c}12`, border: `1px solid ${c}25` }}>
                        📦
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold" style={{ color: TEXT }}>{crate.displayName}</p>
                        {crate.description && <p className="text-xs mt-0.5" style={{ color: MUTED }}>{crate.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        {crate.price > 0
                          ? <><p className="text-lg font-bold" style={{ color: c }}>{fmtBalance(crate.price)} $</p>
                              <p className="text-[10px]" style={{ color: MUTED }}>par clé</p></>
                          : <p className="text-sm font-bold text-emerald-400">Gratuit</p>}
                      </div>
                    </div>
                    <div className="px-4 pb-4 space-y-2">
                      {msg && (
                        <p className={`text-xs text-center py-1.5 rounded-lg ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}
                           style={{ background: msg.ok ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)' }}>
                          {msg.ok ? '✓' : '✗'} {msg.msg}
                        </p>
                      )}
                      <button onClick={() => buyCrate(crate)} disabled={isBusy}
                        className="w-full py-3 rounded-xl font-bold text-sm active:scale-[0.98] disabled:opacity-50 text-gray-900"
                        style={{ background: `linear-gradient(135deg,${c},${c}cc)`, boxShadow: `0 4px 16px ${c}25` }}>
                        {isBusy ? 'Achat en cours…'
                          : crate.price > 0 ? `Acheter — ${fmtBalance(crate.price)} $`
                          : 'Obtenir gratuitement'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Economy info */}
        <div className="rounded-2xl overflow-hidden" style={{ background: GLASS, border: `1px solid ${BORDER}`, backdropFilter: 'blur(12px)' }}>
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-widest border-b" style={{ color: MUTED, borderColor: BORDER }}>
            Économie en jeu
          </p>
          {[
            { icon: '🪙', title: 'Gagner des coins',  desc: 'Joue, mine, accomplis des quêtes ou réclame ta récompense quotidienne' },
            { icon: '🛍️', title: 'Boutique /shop',    desc: 'Dépense tes coins via /shop pour acheter des items en jeu' },
            { icon: '📦', title: 'Caisses & Clés',    desc: 'Obtiens des clés via les missions et ouvre des caisses pour des récompenses rares' },
            { icon: '📈', title: 'Métiers',            desc: 'Génère des revenus passifs et progresse en exercant un métier' },
          ].map((row, i) => (
            <div key={row.title} className="flex items-start gap-3 px-4 py-3.5"
                 style={{ borderBottom: i < 3 ? `1px solid rgba(255,255,255,0.04)` : undefined }}>
              <span className="text-xl shrink-0 mt-0.5">{row.icon}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: TEXT }}>{row.title}</p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>{row.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Navbar />
    </div>
  )
}
