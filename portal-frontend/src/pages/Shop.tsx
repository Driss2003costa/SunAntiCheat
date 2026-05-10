import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, getToken, clearToken, type PlayerProfile, type VipPlan, type CrateShopEntry } from '../api/client'
import Navbar from '../components/Navbar'
import PageAura from '../components/PageAura'
import DegradedNotice from '../components/DegradedNotice'
import { GridShell, HeroBanner, SectionDivider, Card, Button, Tag } from '../components/ui'

type Category = 'all' | 'vip' | 'crates'

export default function Shop() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
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
  const [category,     setCategory]     = useState<Category>('all')

  const numberLocale = i18n.resolvedLanguage?.startsWith('fr') ? 'fr-FR' : 'en-GB'
  const fmtBalance = (n: number) =>
    n.toLocaleString(numberLocale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const fmtPrice = (n: number) =>
    n.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
      setCrateMsg({ id: crate.id, msg: res.free ? t('shop.crates.gift') : res.message, ok: true })
    } catch (e: any) {
      setCrateMsg({ id: crate.id, msg: e.error || e.message || t('shop.errorBuy'), ok: false })
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
      if (!res.ok) throw new Error(data.error || t('common.error'))
      window.location.href = data.redirectUrl
    } catch (e: any) {
      setCheckoutErr(e.message || t('shop.errorCheckout'))
      setCheckoutBusy(false)
    }
  }

  const featuredPlan = useMemo(() => plans[0] ?? null, [plans])
  const otherPlans = useMemo(
    () => plans.filter(p => p.id !== featuredPlan?.id),
    [plans, featuredPlan]
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080d19' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: '#FFB347' }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const showVip    = category === 'all' || category === 'vip'
  const showCrates = category === 'all' || category === 'crates'

  return (
    <div className="min-h-screen" style={{ background: '#080d19' }}>
      <PageAura theme="shop" />
      <GridShell>
        <HeroBanner
          eyebrow={t('shop.eyebrow')}
          variant="sun"
          title={<>{t('shop.hero.titleStart')}<span className="text-sun-300">{t('shop.hero.titleHighlight')}</span>{t('shop.hero.titleEnd')}</>}
          subtitle={t('shop.hero.subtitle')}
          cta={
            <>
              <Button onClick={() => setCategory('vip')}    size="lg">{t('shop.hero.buttonVip')}</Button>
              <Button onClick={() => setCategory('crates')} variant="secondary" size="lg">{t('shop.hero.buttonCrates')}</Button>
            </>
          }
          rightSlot={
            localBalance != null && (
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: '#FFB347' }}>
                  {t('shop.hero.balance')}
                </p>
                <p className="font-display text-5xl lg:text-6xl font-semibold" style={{ color: '#fbbf24' }}>
                  {fmtBalance(localBalance)} <span className="text-3xl">$</span>
                </p>
              </div>
            )
          }
        />

        {/* Featured VIP hero */}
        {showVip && featuredPlan && (
          <>
            <SectionDivider label={t('shop.featured.section')} hint={t('shop.featured.hint')} />
            <Card variant="glass-warm" padding="lg" className="mb-12 lg:mb-16 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl"
                   style={{ background: 'rgba(251,191,36,0.20)' }} />
              <div className="relative grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-8 items-center">
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                         style={{ background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.35)' }}>
                      {featuredPlan.icon ?? '⭐'}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sun-300">{t('shop.featured.badge')}</p>
                      <h2 className="font-display text-3xl lg:text-4xl font-semibold" style={{ color: '#f8fafc' }}>
                        {featuredPlan.displayName}
                      </h2>
                    </div>
                  </div>
                  {featuredPlan.description && (
                    <p className="text-base mb-5" style={{ color: 'rgba(241,245,249,0.7)' }}>{featuredPlan.description}</p>
                  )}
                  {featuredPlan.perks && featuredPlan.perks.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                      {featuredPlan.perks.map((perk, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(203,213,225,0.9)' }}>
                          <span className="text-sun-300 shrink-0 mt-0.5">✦</span>
                          <span>{perk}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-center lg:text-right">
                  <p className="font-display text-5xl lg:text-6xl font-semibold mb-2" style={{ color: '#fbbf24' }}>
                    {fmtPrice(featuredPlan.priceEur)} €
                  </p>
                  <p className="text-xs mb-5" style={{ color: 'rgba(241,245,249,0.5)' }}>
                    {t('shop.featured.duration', { count: featuredPlan.durationDays })}
                  </p>
                  {checkoutPlan?.id === featuredPlan.id ? (
                    <div className="space-y-2 max-w-xs ml-auto">
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => startCheckout(featuredPlan, 'STRIPE')} disabled={checkoutBusy} variant="secondary">{t('shop.featured.buttonCard')}</Button>
                        <Button onClick={() => startCheckout(featuredPlan, 'PAYPAL')} disabled={checkoutBusy} variant="secondary">{t('shop.featured.buttonPaypal')}</Button>
                      </div>
                      <Button onClick={() => { setCheckoutPlan(null); setCheckoutErr('') }} variant="ghost" fullWidth size="sm">{t('shop.featured.buttonCancel')}</Button>
                      {checkoutErr && <p className="text-xs text-red-400">{checkoutErr}</p>}
                    </div>
                  ) : (
                    <Button onClick={() => { setCheckoutPlan(featuredPlan); setCheckoutErr('') }} size="lg">
                      {t('shop.featured.buyNow')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </>
        )}

        {/* VIP Grid */}
        {showVip && otherPlans.length > 0 && (
          <>
            <SectionDivider label={t('shop.vip.section')} hint={t('shop.vip.hint', { count: otherPlans.length })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-12 lg:mb-16">
              {otherPlans.map(plan => {
                const c = plan.color ?? '#fbbf24'
                const open = checkoutPlan?.id === plan.id
                return (
                  <Card key={plan.id} variant="glass-warm" padding="md" hover className="flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
                           style={{ background: `${c}15`, border: `1px solid ${c}30` }}>
                        {plan.icon ?? '⭐'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-lg font-semibold truncate" style={{ color: '#f8fafc' }}>{plan.displayName}</p>
                        <p className="text-[11px]" style={{ color: 'rgba(241,245,249,0.5)' }}>
                          {t('shop.vip.duration', { count: plan.durationDays })}
                        </p>
                      </div>
                    </div>
                    {plan.description && (
                      <p className="text-xs mb-4 line-clamp-3" style={{ color: 'rgba(241,245,249,0.6)' }}>{plan.description}</p>
                    )}
                    {plan.perks && plan.perks.length > 0 && (
                      <div className="space-y-1.5 mb-4 flex-1">
                        {plan.perks.slice(0, 4).map((perk, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(203,213,225,0.85)' }}>
                            <span className="shrink-0 mt-0.5" style={{ color: c }}>✦</span>
                            <span className="line-clamp-1">{perk}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="font-display text-3xl font-semibold mb-3" style={{ color: c }}>
                      {fmtPrice(plan.priceEur)} €
                    </p>
                    {open ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => startCheckout(plan, 'STRIPE')} disabled={checkoutBusy} variant="secondary" size="sm">💳</Button>
                          <Button onClick={() => startCheckout(plan, 'PAYPAL')} disabled={checkoutBusy} variant="secondary" size="sm">{t('shop.featured.buttonPaypal')}</Button>
                        </div>
                        <Button onClick={() => { setCheckoutPlan(null); setCheckoutErr('') }} variant="ghost" fullWidth size="sm">{t('shop.featured.buttonCancel')}</Button>
                        {checkoutErr && <p className="text-xs text-red-400 text-center">{checkoutErr}</p>}
                      </div>
                    ) : (
                      <Button onClick={() => { setCheckoutPlan(plan); setCheckoutErr('') }} fullWidth>{t('shop.crates.buy')}</Button>
                    )}
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {showVip && plans.length === 0 && (
          <Card padding="lg" className="text-center mb-12">
            <span className="text-4xl block mb-3">⭐</span>
            <p className="font-semibold" style={{ color: '#f8fafc' }}>{t('shop.vip.emptyTitle')}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('shop.vip.emptyDesc')}</p>
          </Card>
        )}

        {/* Crates Grid */}
        {showCrates && crates.length > 0 && (
          <>
            <SectionDivider label={t('shop.crates.section')} hint={t('shop.crates.hint')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-12 lg:mb-16">
              {crates.map(crate => {
                const c = crate.color ?? '#fbbf24'
                const isBusy = crateBusy === crate.id
                const msg = crateMsg?.id === crate.id ? crateMsg : null
                return (
                  <Card key={crate.id} variant="glass" padding="md" hover className="flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl"
                           style={{ background: `${c}15`, border: `1px solid ${c}28` }}>
                        📦
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-lg font-semibold truncate" style={{ color: '#f8fafc' }}>{crate.displayName}</p>
                        {crate.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(241,245,249,0.55)' }}>{crate.description}</p>}
                      </div>
                    </div>
                    <div className="flex-1" />
                    <div className="mb-3">
                      {crate.price > 0
                        ? <p className="font-display text-2xl font-semibold" style={{ color: c }}>{fmtBalance(crate.price)} $</p>
                        : <Tag tone="jade">{t('shop.crates.free')}</Tag>}
                    </div>
                    {msg && (
                      <p className={`text-xs text-center py-1.5 mb-2 rounded-lg ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}
                         style={{ background: msg.ok ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)' }}>
                        {msg.ok ? '✓' : '✗'} {msg.msg}
                      </p>
                    )}
                    <Button onClick={() => buyCrate(crate)} disabled={isBusy} fullWidth>
                      {isBusy ? t('shop.crates.buying') : crate.price > 0 ? t('shop.crates.buy') : t('shop.crates.obtain')}
                    </Button>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {/* Economy info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: '🪙', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',  title: t('shop.economy.earningTitle'),  desc: t('shop.economy.earningDesc') },
            { icon: '🛍️', bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.3)',  title: t('shop.economy.spendingTitle'), desc: t('shop.economy.spendingDesc') },
            { icon: '📦', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  title: t('shop.economy.cratesTitle'),   desc: t('shop.economy.cratesDesc') },
            { icon: '📈', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)',  title: t('shop.economy.jobsTitle'),     desc: t('shop.economy.jobsDesc') },
          ].map(row => (
            <Card key={row.title} padding="md">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3"
                   style={{ background: row.bg, border: `1px solid ${row.border}` }}>{row.icon}</div>
              <p className="font-display text-lg font-semibold mb-1" style={{ color: '#f8fafc' }}>{row.title}</p>
              <p className="text-xs" style={{ color: 'rgba(241,245,249,0.55)' }}>{row.desc}</p>
            </Card>
          ))}
        </div>
      </GridShell>

      <Navbar />
    </div>
  )
}
