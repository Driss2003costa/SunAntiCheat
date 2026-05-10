import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, getToken, clearToken, type PlayerProfile, type CrateKeyEntry } from '../api/client'
import Navbar from '../components/Navbar'
import SunBackground from '../components/SunBackground'
import { GridShell, HeroBanner, StatCard, SectionDivider, Card, Button, Tag } from '../components/ui'

function fmtBalance(n: number, locale: string) {
  return n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const SLOT_COUNT = 48

type ClaimModal = { crate: CrateKeyEntry; step: 'confirm' | 'loading' | 'done'; message?: string; ok?: boolean }
type FilterTab = 'all' | 'keys' | 'badges' | 'cosmetics'

export default function Inventory() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').startsWith('fr') ? 'fr-FR' : 'en-GB'
  const [profile,   setProfile]   = useState<PlayerProfile | null>(null)
  const [keys,      setKeys]      = useState<CrateKeyEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState<ClaimModal | null>(null)
  const [filter,    setFilter]    = useState<FilterTab>('all')

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
      setKeys(prev => prev.map(k =>
        k.crateId === crate.crateId
          ? { ...k, count: k.count - 1, pendingClaim: !res.deliveredNow }
          : k
      ).filter(k => k.count > 0))
    } catch (e: any) {
      setModal({ crate, step: 'done', message: e.error || e.message || t('inventory.errorClaim'), ok: false })
    }
  }

  const totalKeys = useMemo(() => keys.reduce((s, k) => s + k.count, 0), [keys])

  const slots: (CrateKeyEntry | null)[] = useMemo(() => {
    const arr: (CrateKeyEntry | null)[] = Array.from({ length: SLOT_COUNT }, () => null)
    let idx = 0
    for (const entry of keys) {
      for (let i = 0; i < entry.count && idx < SLOT_COUNT; i++) arr[idx++] = entry
    }
    return arr
  }, [keys])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center pb-20" style={{ background: '#080d19' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
           style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: '#fbbf24' }} />
      <Navbar />
    </div>
  )
  if (!profile) return null

  const roleIcon  = { PLAYER: '👤', VIP: '⭐', MODERATOR: '🛡️', ADMIN: '👑' }[profile.role] ?? '👤'

  const filters: { key: FilterTab; label: string; icon: string; count?: number }[] = [
    { key: 'all',        label: t('inventory.filters.all'),        icon: '🎒', count: totalKeys + 1 },
    { key: 'keys',       label: t('inventory.filters.keys'),       icon: '🗝️', count: totalKeys },
    { key: 'badges',     label: t('inventory.filters.badges'),     icon: '🏷️', count: 1 },
    { key: 'cosmetics',  label: t('inventory.filters.cosmetics'),  icon: '✨', count: 0 },
  ]

  const showKeys      = filter === 'all' || filter === 'keys'
  const showBadges    = filter === 'all' || filter === 'badges'
  const showCosmetics = filter === 'all' || filter === 'cosmetics'

  return (
    <div className="min-h-screen relative" style={{ background: '#080d19' }}>
      <SunBackground />

      {/* Claim modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <Card padding="lg" className="w-full max-w-sm space-y-4"
                style={{ background: 'rgba(15,22,40,0.98)' }}>
            {modal.step === 'confirm' && (
              <>
                <div className="text-center">
                  <span className="text-5xl block mb-3">🗝️</span>
                  <p className="font-display text-xl font-semibold" style={{ color: '#f8fafc' }}>
                    {t('inventory.modal.title')}
                  </p>
                  <p className="text-sm mt-1" style={{ color: '#fbbf24' }}>{modal.crate.displayName}</p>
                  <p className="text-xs mt-4 rounded-xl p-3"
                     style={{ color: 'rgba(241,245,249,0.6)', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)' }}>
                    {t('inventory.modal.info')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => setModal(null)} variant="secondary" size="md">{t('common.cancel')}</Button>
                  <Button onClick={() => claimKey(modal.crate)} size="md">{t('common.confirm')}</Button>
                </div>
              </>
            )}
            {modal.step === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-8 h-8 rounded-full border-2 animate-spin"
                     style={{ borderColor: 'rgba(251,191,36,0.2)', borderTopColor: '#fbbf24' }} />
                <p className="text-sm" style={{ color: 'rgba(241,245,249,0.6)' }}>{t('inventory.modal.loading')}</p>
              </div>
            )}
            {modal.step === 'done' && (
              <>
                <div className="text-center">
                  <span className="text-5xl block mb-3">{modal.ok ? '✅' : '❌'}</span>
                  <p className="text-sm" style={{ color: modal.ok ? '#4ade80' : '#f87171' }}>{modal.message}</p>
                </div>
                <Button onClick={() => setModal(null)} fullWidth size="md">{t('common.close')}</Button>
              </>
            )}
          </Card>
        </div>
      )}

      <GridShell>
        {/* HERO */}
        <HeroBanner
          eyebrow={t('inventory.eyebrow')}
          variant="ember"
          title={<>{t('inventory.hero.titleStart')}<span className="text-sun-300">{profile.username}</span></>}
          subtitle={t('inventory.hero.subtitle')}
          cta={
            <>
              <Button to="/shop" size="lg">{t('inventory.hero.buttonShop')}</Button>
              <Button to="/profile" variant="secondary" size="lg">{t('inventory.hero.buttonProfile')}</Button>
            </>
          }
          rightSlot={
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              <div className="rounded-2xl p-4 text-center"
                   style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <p className="text-3xl mb-1">🪙</p>
                <p className="font-display text-2xl font-semibold" style={{ color: '#f8fafc' }}>
                  {profile.balance != null ? fmtBalance(profile.balance, locale) : '—'}
                </p>
                <p className="text-[10px] mt-1 uppercase tracking-widest" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('inventory.hero.coins')}</p>
              </div>
              <div className="rounded-2xl p-4 text-center"
                   style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-3xl mb-1">🗝️</p>
                <p className="font-display text-2xl font-semibold" style={{ color: '#f8fafc' }}>{totalKeys}</p>
                <p className="text-[10px] mt-1 uppercase tracking-widest" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('inventory.hero.keys')}</p>
              </div>
            </div>
          }
        />

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-12 lg:mb-16">
          <StatCard label={t('inventory.stats.balance')} accent="gold" icon="💰"
                    value={profile.balance != null ? `${fmtBalance(profile.balance, locale)} $` : '—'} hint={t('inventory.stats.balanceHint')} />
          <StatCard label={t('inventory.stats.keys')} accent="violet" icon="🗝️" value={totalKeys} hint={t('inventory.stats.keysHint')} />
          <StatCard label={t('inventory.stats.role')} accent="sky" icon={roleIcon} value={profile.role} hint={t('inventory.stats.roleHint')} />
          <StatCard label={t('inventory.stats.playtime')} accent="jade" icon="⏱"
                    value={profile.playtime_formatted ?? '—'} hint={t('inventory.stats.playtimeHint')} />
        </div>

        {/* MAIN: filters sidebar + items */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 lg:gap-7">
          {/* Filters sidebar */}
          <aside className="lg:sticky lg:top-8 self-start space-y-5">
            <SectionDivider label={t('inventory.filters.label')} />
            <Card padding="sm">
              <div className="space-y-1">
                {filters.map(f => {
                  const active = filter === f.key
                  return (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: active ? 'rgba(251,191,36,0.1)' : 'transparent',
                        border: `1px solid ${active ? 'rgba(251,191,36,0.25)' : 'transparent'}`,
                        color: active ? '#fbbf24' : 'rgba(241,245,249,0.7)',
                      }}>
                      <span className="flex items-center gap-2.5">
                        <span className="text-lg">{f.icon}</span>
                        <span>{f.label}</span>
                      </span>
                      {f.count != null && (
                        <Tag tone={active ? 'gold' : 'neutral'} size="xs">{f.count}</Tag>
                      )}
                    </button>
                  )
                })}
              </div>
            </Card>

            <SectionDivider label={t('inventory.help.label')} />
            <Card padding="md">
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(241,245,249,0.6)' }}>
                {t('inventory.help.text')}
              </p>
            </Card>
          </aside>

          {/* Items grid */}
          <div className="space-y-10">
            {showKeys && (
              <section>
                <SectionDivider label={t('inventory.keys.section')}
                  hint={totalKeys > 0 ? t('inventory.keys.available', { count: totalKeys }) : t('inventory.keys.empty')}
                  action={totalKeys > 0 ? <Tag tone="gold">{totalKeys}</Tag> : undefined} />

                {/* Slot grid */}
                <Card padding="md" className="mb-5">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {slots.map((entry, i) => {
                      if (!entry) {
                        return (
                          <div key={i}
                            className="aspect-square rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.05)' }} />
                        )
                      }
                      const slotColor = entry.color ?? '#fbbf24'
                      return (
                        <button key={i}
                          onClick={() => setModal({ crate: entry, step: 'confirm' })}
                          title={entry.displayName}
                          className="group aspect-square rounded-xl flex items-center justify-center relative cursor-pointer transition-all hover:-translate-y-0.5"
                          style={{
                            background: `linear-gradient(160deg, ${slotColor}22 0%, ${slotColor}08 100%)`,
                            border: `1px solid ${slotColor}40`,
                            boxShadow: `0 4px 16px ${slotColor}10`,
                          }}>
                          <span className="text-2xl transition-transform group-hover:scale-110">🗝️</span>
                          {entry.pendingClaim && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </Card>

                {/* Detail list */}
                {totalKeys > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {keys.map(entry => (
                      <Card key={entry.crateId} padding="md" hover>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                               style={{ background: `${entry.color ?? '#fbbf24'}18`, border: `1px solid ${entry.color ?? '#fbbf24'}40` }}>
                            🗝️
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: '#f8fafc' }}>{entry.displayName}</p>
                            {entry.pendingClaim
                              ? <Tag tone="gold" size="xs">{t('inventory.keys.statusPending')}</Tag>
                              : <Tag tone="jade" size="xs">{t('inventory.keys.statusAvailable')}</Tag>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-display text-xl font-semibold tabular-nums" style={{ color: entry.color ?? '#fbbf24' }}>
                              ×{entry.count}
                            </span>
                            <Button onClick={() => setModal({ crate: entry, step: 'confirm' })} size="sm">
                              {t('inventory.keys.claim')}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card padding="lg">
                    <p className="text-center text-sm" style={{ color: 'rgba(241,245,249,0.5)' }}>
                      {t('inventory.keys.emptyDesc')}
                    </p>
                  </Card>
                )}
              </section>
            )}

            {showBadges && (
              <section>
                <SectionDivider label={t('inventory.badges.section')} hint={t('inventory.badges.subtitle')} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Card padding="md" hover>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                           style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
                        {roleIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>{profile.role}</p>
                        <p className="text-xs" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('inventory.badges.active')}</p>
                      </div>
                      <Tag tone="jade" size="xs">●</Tag>
                    </div>
                  </Card>
                  <Card padding="md" className="opacity-40">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                           style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        🎖️
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>{t('inventory.badges.veteran.name')}</p>
                        <p className="text-xs" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('inventory.badges.veteran.desc')}</p>
                      </div>
                      <span className="text-xs">🔒</span>
                    </div>
                  </Card>
                  <Card padding="md" className="opacity-40">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
                           style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        🏅
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>{t('inventory.badges.conqueror.name')}</p>
                        <p className="text-xs" style={{ color: 'rgba(241,245,249,0.5)' }}>{t('inventory.badges.conqueror.desc')}</p>
                      </div>
                      <span className="text-xs">🔒</span>
                    </div>
                  </Card>
                </div>
              </section>
            )}

            {showCosmetics && (
              <section>
                <SectionDivider label={t('inventory.cosmetics.section')} hint={t('inventory.cosmetics.subtitle')} />
                <Card padding="lg">
                  <p className="text-center text-sm" style={{ color: 'rgba(241,245,249,0.5)' }}>
                    {t('inventory.cosmetics.empty')}
                  </p>
                </Card>
              </section>
            )}
          </div>
        </div>
      </GridShell>
      <Navbar />
    </div>
  )
}
