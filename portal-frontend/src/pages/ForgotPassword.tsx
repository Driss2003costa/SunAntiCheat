import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, saveToken } from '../api/client'
import OtpInput from '../components/OtpInput'
import { Button } from '../components/ui'
import LanguageSwitcher from '../components/LanguageSwitcher'

type Step = 'username' | 'pin' | 'success'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [step, setStep]                 = useState<Step>('username')
  const [username, setUsername]         = useState('')
  const [uuid, setUuid]                 = useState('')
  const [verifyPin, setVerifyPin]       = useState('')
  const [newPassword, setNewPassword]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [countdown, setCountdown]       = useState(0)

  function isPasswordStrong(pw: string): boolean {
    return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw)
  }

  async function handleForgot() {
    if (!username.trim()) return
    setLoading(true); setError('')
    try {
      const res = await api.forgotPassword(username.trim())
      if (res.uuid) {
        setUuid(res.uuid); setCountdown(res.expires_in ?? 300); startCountdown(res.expires_in ?? 300); setStep('pin')
      } else {
        setError(res.message)
      }
    } catch (e: any) {
      if (e.error === 'player_offline') {
        setError(t('forgotPassword.errorOffline'))
      } else {
        setError(e.message || t('shop.errorCheckout'))
      }
    }
    setLoading(false)
  }

  function startCountdown(seconds: number) {
    let s = seconds
    const id = setInterval(() => { s--; setCountdown(s); if (s <= 0) clearInterval(id) }, 1000)
  }

  async function handleReset() {
    if (verifyPin.replace(/\D/g, '').length < 6) { setError(t('forgotPassword.errorPinFormat')); return }
    if (!isPasswordStrong(newPassword))           { setError(t('forgotPassword.errorPasswordWeak')); return }
    setLoading(true); setError('')
    try {
      const res = await api.resetPassword(uuid, verifyPin, newPassword)
      saveToken(res.token); setStep('success')
      setTimeout(() => navigate('/profile', { replace: true }), 2000)
    } catch (e: any) {
      const msg: Record<string, string> = {
        pin_expired:   t('forgotPassword.errorExpired'),
        max_attempts:  t('forgotPassword.errorMaxAttempts'),
        invalid_pin:   t('forgotPassword.errorInvalid', { count: e.attempts_left ?? 0 }),
        weak_password: t('forgotPassword.errorPasswordWeak'),
      }
      setError(msg[e.error] ?? e.message ?? t('shop.errorCheckout'))
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.3fr_1fr]"
      style={{ background: '#080d19' }}
    >
      {/* CÔTÉ GAUCHE — visuel hero immersif */}
      <aside
        className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16"
        style={{
          background:
            'radial-gradient(120% 90% at 0% 0%, rgba(255,179,71,0.22) 0%, transparent 55%), radial-gradient(80% 80% at 100% 100%, rgba(224,127,26,0.18) 0%, transparent 60%), linear-gradient(160deg, #181f3d 0%, #0a1024 100%)',
        }}
      >
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-25 blur-3xl pointer-events-none" style={{ background: '#FFB347' }} />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: '#FFB347' }} />
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3 no-underline">
            <span className="font-display text-2xl font-bold text-white">SunGuard</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sun-300 mb-4">{t('forgotPassword.heroEyebrow')}</p>
          <h1 className="font-display text-5xl xl:text-6xl 2xl:text-7xl font-semibold leading-[1.05] tracking-tight text-white mb-6">
            {t('forgotPassword.heroTitle')}
          </h1>
          <p className="text-lg text-white/60 mb-8">
            {t('forgotPassword.heroSubtitle')}
          </p>

          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              {t('forgotPassword.heroList1')}
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              {t('forgotPassword.heroList2')}
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              {t('forgotPassword.heroList3')}
            </li>
          </ul>
        </div>

        <div className="relative z-10 text-xs text-white/40">{t('forgotPassword.heroFooter')}</div>
      </aside>

      {/* CÔTÉ DROIT — formulaire */}
      <main className="flex flex-col justify-center px-6 sm:px-10 lg:px-12 xl:px-16 py-12 overflow-y-auto relative">
        <div className="absolute top-6 right-6">
          <LanguageSwitcher variant="inline" />
        </div>
        <div className="w-full max-w-md mx-auto">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 mb-10 no-underline">
            <span className="font-display text-xl font-bold text-white">SunGuard</span>
          </Link>

          {step === 'username' && (
            <>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight text-white mb-2">{t('forgotPassword.step1Title')}</h2>
              <p className="text-sm text-white/55 mb-8">
                {t('forgotPassword.step1Subtitle')}
              </p>

              <div className="space-y-5">
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-2">{t('forgotPassword.step1Label')}</span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleForgot()}
                    placeholder={t('register.usernamePlaceholder') as string}
                    className="w-full h-12 px-4 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sun-300/40 transition"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </label>

                {error && (
                  <div
                    className="px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#fca5a5' }}
                  >
                    {error}
                  </div>
                )}

                <Button size="lg" fullWidth onClick={handleForgot} disabled={loading || !username.trim()}>
                  {loading ? t('common.loading') : t('forgotPassword.step1Button')}
                </Button>

                <p className="text-center text-sm">
                  <Link to="/login" className="text-sun-300 hover:text-sun-200 font-medium underline-offset-4 hover:underline transition-colors">
                    {t('forgotPassword.step1BackLink')}
                  </Link>
                </p>
              </div>
            </>
          )}

          {step === 'pin' && (
            <>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight text-white mb-2">{t('forgotPassword.step2Title')}</h2>
              <p className="text-sm text-white/55 mb-8">
                {countdown > 0
                  ? t('forgotPassword.step2Subtitle', { count: countdown })
                  : t('forgotPassword.step2Subtitle', { count: 0 })}
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-3">{t('forgotPassword.step2CodeLabel')}</label>
                  <OtpInput value={verifyPin} onChange={setVerifyPin} length={6} />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-3">
                    {t('forgotPassword.step2NewPasswordLabel')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleReset()}
                      placeholder={t('forgotPassword.step2NewPasswordPlaceholder') as string}
                      autoComplete="new-password"
                      className="w-full h-12 px-4 pr-12 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sun-300/40 transition"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/55 hover:text-white/80 transition"
                    >
                      {showPassword ? t('forgotPassword.hidePassword') : t('forgotPassword.showPassword')}
                    </button>
                  </div>
                  <p className="text-[11px] text-white/55 mt-2">{t('forgotPassword.step2NewPasswordHint')}</p>
                </div>

                {error && (
                  <div
                    className="px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#fca5a5' }}
                  >
                    {error}
                  </div>
                )}

                <Button size="lg" fullWidth onClick={handleReset} disabled={loading}>
                  {loading ? t('forgotPassword.step2Submitting') : t('forgotPassword.step2Button')}
                </Button>

                <button
                  onClick={() => { setStep('username'); setError(''); setVerifyPin(''); setNewPassword('') }}
                  className="block w-full text-center text-xs text-white/55 hover:text-white/80 transition-colors"
                >
                  {t('forgotPassword.step2Resend')}
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-4 space-y-5">
              <div className="text-6xl">✨</div>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold text-white">{t('forgotPassword.step3Title')}</h2>
              <p className="text-sm text-white/60">{t('forgotPassword.step3Subtitle')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
