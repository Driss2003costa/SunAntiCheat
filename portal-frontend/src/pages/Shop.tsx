import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken, clearToken, type PlayerProfile, type VipPlan, type CrateShopEntry } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import WaxSeal from '../components/codex/WaxSeal'
import RuneIcon from '../components/codex/RuneIcon'
import Flourish from '../components/codex/Flourish'
import CompassRose from '../components/codex/CompassRose'

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
    setCrateBusy(crate.id); setCrateMsg(null)
    try {
      const res = await api.crateBuy(token, crate.id, 1)
      setLocalBalance(res.newBalance)
      setCrateMsg({ id: crate.id, msg: res.free ? 'Clé offerte (admin) !' : res.message, ok: true })
    } catch (e: any) {
      setCrateMsg({ id: crate.id, msg: e.error || e.message || "Erreur lors de l'achat", ok: false })
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
    <div className="min-h-screen flex items-center justify-center pb-20" style={{ background: '#080d19' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(240,169,59,0.2)', borderTopColor: '#F0A93B' }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: '#080d19' }}>
      <PageAura theme="shop" />
      <CompassRose size={400} opacity={0.035} className="absolute top-[-60px] left-[-90px] pointer-events-none z-0" />

      {/* Header */}
      <div className="relative z-10">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 80% 55% at 50% -5%,rgba(240,169,59,0.14),transparent)' }} />
        <div className="relative px-5 pt-12 pb-6 max-w-screen-sm mx-auto codex-reveal codex-reveal-1">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <RuneIcon rune="crown" size={28} color="var(--gold)" />
              <div>
                <h1 className="text-2xl font-black font-codex-display" style={{ color: 'var(--ivory)' }}>Marché des Étoiles</h1>
                <p className="text-sm font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>Avantages & Privilèges</p>
              </div>
            </div>
            {localBalance != null && (
              <div className="text-right pb-1">
                <p className="text-xl font-black font-codex-display" style={{ color: 'var(--gold)' }}>
                  {fmtBalance(localBalance)} <span className="text-base" style={{ color: 'var(--gold-soft)' }}>$</span>
                </p>
                <p className="text-xs font-codex-body" style={{ color: 'var(--parchment-shade)' }}>Ton trésor</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-2 space-y-5 max-w-screen-sm mx-auto relative z-10">

        {/* VIP Plans */}
        {plans.length > 0 && (
          <section className="codex-reveal codex-reveal-2">
            <div className="flex items-center gap-3 mb-3">
              <Flourish variant="simple" color="rgba(240,169,59,0.4)" width={40} />
              <p className="text-xs font-semibold uppercase tracking-widest font-codex-rune" style={{ color: 'var(--parchment-shade)' }}>
                Distinctions VIP
              </p>
              <Flourish variant="simple" color="rgba(240,169,59,0.4)" width={40} />
            </div>
            <div className="space-y-4">
              {plans.map((plan, idx) => {
                const planColor = plan.color ?? '#F0A93B'
                const sealVariant: 'gold' | 'silver' | 'bronze' = idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'
                return (
                  <div key={plan.id} className="codex-cartouche rounded-2xl overflow-hidden codex-flare"
                       style={{ borderColor: `${planColor}35` }}>

                    {/* Accent top bar */}
                    <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${planColor},transparent)` }} />

                    {/* Plan header */}
                    <div className="flex items-center gap-4 p-4"
                         style={{ borderBottom: '1px solid rgba(240,169,59,0.08)' }}>
                      <WaxSeal color={sealVariant} label={plan.icon ?? '★'} size={48} />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold font-codex-display" style={{ color: 'var(--ivory)' }}>{plan.displayName}</p>
                        {plan.description && (
                          <p className="text-xs mt-0.5 font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>{plan.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-black font-codex-display" style={{ color: planColor }}>
                          {fmtPrice(plan.priceEur)}&nbsp;<span className="text-sm">€</span>
                        </p>
                        <p className="text-[10px] font-codex-rune" style={{ color: 'var(--parchment-shade)' }}>
                          {plan.durationDays}j
                        </p>
                      </div>
                    </div>

                    {/* Perks */}
                    {plan.perks && plan.perks.length > 0 && (
                      <div className="px-4 py-3 space-y-1.5"
                           style={{ borderBottom: '1px solid rgba(240,169,59,0.06)' }}>
                        {plan.perks.map((perk, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-xs mt-0.5 shrink-0 font-codex-display" style={{ color: 'var(--gold)' }}>✦</span>
                            <p className="text-xs font-codex-body" style={{ color: 'var(--ivory-dim)' }}>{perk}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Checkout */}
                    <div className="p-4 space-y-2">
                      {checkoutPlan?.id === plan.id ? (
                        <div className="space-y-2">
                          <p className="text-xs text-center mb-3 font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>
                            Choisir le mode de paiement
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => startCheckout(plan, 'STRIPE')} disabled={checkoutBusy}
                              className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm disabled:opacity-50 text-white transition-colors font-codex-display"
                              style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)' }}>
                              ✦ Carte
                            </button>
                            <button onClick={() => startCheckout(plan, 'PAYPAL')} disabled={checkoutBusy}
                              className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm disabled:opacity-50 text-white transition-colors font-codex-display"
                              style={{ background: 'linear-gradient(135deg,#0070ba,#003087)' }}>
                              ✦ PayPal
                            </button>
                          </div>
                          <button onClick={() => { setCheckoutPlan(null); setCheckoutErr('') }}
                            className="w-full py-2 text-xs transition-colors font-codex-body"
                            style={{ color: 'var(--parchment-shade)' }}>
                            Annuler
                          </button>
                          {checkoutErr && <p className="text-xs text-red-400 text-center">{checkoutErr}</p>}
                        </div>
                      ) : (
                        <button onClick={() => { setCheckoutPlan(plan); setCheckoutErr('') }}
                          className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] font-codex-display"
                          style={{
                            background: `linear-gradient(135deg,var(--amber),var(--ember))`,
                            color: 'var(--ink-deep)',
                            boxShadow: '0 4px 20px rgba(240,169,59,0.25)',
                          }}>
                          Acquérir — {fmtPrice(plan.priceEur)} €
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
          <div className="codex-cartouche rounded-2xl p-10 text-center codex-reveal codex-reveal-2">
            <RuneIcon rune="crown" size={40} color="rgba(240,169,59,0.3)" className="mx-auto mb-3" />
            <p className="text-sm font-semibold font-codex-display" style={{ color: 'var(--ivory)' }}>Aucun plan VIP configuré</p>
            <p className="text-xs mt-1 font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>
              Les privilèges seront proclamés prochainement.
            </p>
          </div>
        )}

        {/* Crates shop */}
        {crates.length > 0 && (
          <section className="codex-reveal codex-reveal-3">
            <div className="flex items-center gap-3 mb-3">
              <Flourish variant="simple" color="rgba(240,169,59,0.4)" width={40} />
              <p className="text-xs font-semibold uppercase tracking-widest font-codex-rune" style={{ color: 'var(--parchment-shade)' }}>
                Coffres du Trésor
              </p>
              <Flourish variant="simple" color="rgba(240,169,59,0.4)" width={40} />
            </div>
            <div className="space-y-3">
              {crates.map(crate => {
                const c = crate.color ?? '#F0A93B'
                const isBusy = crateBusy === crate.id
                const msg = crateMsg?.id === crate.id ? crateMsg : null
                return (
                  <div key={crate.id} className="codex-cartouche rounded-2xl overflow-hidden codex-flare"
                       style={{ borderColor: `${c}30` }}>
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl"
                           style={{ background: `${c}15`, border: `1px solid ${c}35` }}>
                        ✦
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold font-codex-display" style={{ color: 'var(--ivory)' }}>{crate.displayName}</p>
                        {crate.description && (
                          <p className="text-xs mt-0.5 font-codex-lyric italic" style={{ color: 'var(--parchment-shade)' }}>{crate.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {crate.price > 0 ? (
                          <>
                            <p className="text-xl font-black font-codex-display" style={{ color: c }}>
                              {fmtBalance(crate.price)} <span className="text-sm">$</span>
                            </p>
                            <p className="text-[10px] font-codex-rune" style={{ color: 'var(--parchment-shade)' }}>par clé</p>
                          </>
                        ) : (
                          <p className="text-sm font-bold text-green-400 font-codex-display">Gratuit</p>
                        )}
                      </div>
                    </div>

                    <div className="px-4 pb-4 space-y-2">
                      {msg && (
                        <p className={`text-xs text-center py-1.5 rounded-lg font-codex-body ${msg.ok ? 'text-green-400' : 'text-red-400'}`}
                           style={{ background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)' }}>
                          {msg.ok ? '✓' : '✗'} {msg.msg}
                        </p>
                      )}
                      <button
                        onClick={() => buyCrate(crate)} disabled={isBusy}
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 font-codex-display"
                        style={{ background: `linear-gradient(135deg,${c},${c}cc)`, color: 'var(--ink-deep)', boxShadow: `0 4px 20px ${c}25` }}>
                        {isBusy ? 'Acquisition…' : crate.price > 0
                          ? `Acquérir — ${fmtBalance(crate.price)} $`
                          : 'Obtenir gratuitement'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Economy codex */}
        <div className="codex-cartouche rounded-2xl overflow-hidden codex-reveal codex-reveal-4">
          <div className="px-5 py-3.5 flex items-center gap-2"
               style={{ borderBottom: '1px solid rgba(240,169,59,0.12)' }}>
            <RuneIcon rune="sun" size={16} color="var(--gold)" />
            <span className="text-sm font-semibold font-codex-display" style={{ color: 'var(--ivory)' }}>L'Économie du Monde</span>
          </div>
          <div>
            <EcoRow rune="star"    title="Gagner des pièces" desc="Joue, mine, accomplis des quêtes, ou réclame tes récompenses quotidiennes" />
            <EcoRow rune="flame"   title="Boutique /shop"    desc="Dépense tes pièces en jeu via /shop pour acheter des items" />
            <EcoRow rune="eye"     title="Coffres & Clés"    desc="Obtiens des clés via les missions et ouvre des coffres pour des récompenses rares" />
            <EcoRow rune="compass" title="Métiers"           desc="Exerce un métier pour générer des revenus passifs et progresser" />
          </div>
        </div>
      </div>

      <Navbar />
    </div>
  )
}

function EcoRow({ rune, title, desc }: { rune: 'star' | 'flame' | 'eye' | 'compass'; title: string; desc: string }) {
  return (
    <div className="codex-row flex items-start gap-3 px-5 py-3.5"
         style={{ borderBottom: '1px solid rgba(240,169,59,0.05)' }}>
      <RuneIcon rune={rune} size={18} color="var(--gold)" className="shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold font-codex-display" style={{ color: 'var(--ivory)' }}>{title}</p>
        <p className="text-xs mt-0.5 font-codex-body" style={{ color: 'var(--parchment-shade)' }}>{desc}</p>
      </div>
    </div>
  )
}
