import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, saveToken, getToken, type CaptchaChallenge } from '../api/client'
import { Button } from '../components/ui'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [captcha, setCaptcha]     = useState<CaptchaChallenge | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [banInfo, setBanInfo]     = useState<{ reason: string; until: number } | null>(null)

  useEffect(() => {
    if (getToken()) navigate('/profile', { replace: true })
  }, [navigate])

  async function handleLogin() {
    if (!username.trim())       { setError(t('login.errorNoUsername')); return }
    if (password.length < 6)    { setError(t('login.errorNoPassword')); return }
    if (captcha && !captchaAnswer.trim()) { setError(t('login.errorCaptcha')); return }
    setLoading(true); setError(''); setBanInfo(null)
    try {
      const res = await api.login(
        username.trim(),
        password,
        captcha ? { id: captcha.id, answer: captchaAnswer.trim() } : undefined,
      )
      saveToken(res.token)
      if (res.must_reset_password) {
        // L'admin a forcé une réinitialisation : on redirige vers /forgot avec un préfill du pseudo.
        navigate('/forgot?force=1', { replace: true, state: { username: res.username } })
        return
      }
      navigate('/profile', { replace: true })
    } catch (e: any) {
      // Cas 1 : un captcha est requis (ou il vient de devenir requis suite à cet essai)
      if (e?.error === 'captcha_required' || e?.captcha_required) {
        if (e.captcha) setCaptcha(e.captcha as CaptchaChallenge)
        setCaptchaAnswer('')
        setError(e.message || t('login.errorCaptchaRequired'))
      }
      // Cas 2 : compte banni
      else if (e?.error === 'banned') {
        setBanInfo({ reason: e.reason || '', until: e.banned_until ?? 0 })
        setCaptcha(null)
        setError('')
      }
      // Cas 3 : tentative échouée — la réponse peut inclure un captcha pour la prochaine
      else {
        if (e?.captcha) { setCaptcha(e.captcha as CaptchaChallenge); setCaptchaAnswer('') }
        setError(e?.message || t('login.errorInvalid'))
      }
    }
    setLoading(false)
  }

  async function refreshCaptcha() {
    try {
      const ch = await api.fetchCaptcha()
      setCaptcha(ch)
      setCaptchaAnswer('')
    } catch { /* silencieux */ }
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
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sun-300 mb-4">{t('login.heroEyebrow')}</p>
          <h1 className="font-display text-5xl xl:text-6xl 2xl:text-7xl font-semibold leading-[1.05] tracking-tight text-white mb-6">
            {t('login.heroTitle')}
          </h1>
          <p className="text-lg text-white/60 mb-8">
            {t('login.heroSubtitle')}
          </p>

          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              {t('login.heroList1')}
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              {t('login.heroList2')}
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              {t('login.heroList3')}
            </li>
          </ul>
        </div>

        <div className="relative z-10 text-xs text-white/40">{t('login.heroFooter')}</div>
      </aside>

      {/* CÔTÉ DROIT — formulaire */}
      <main className="flex flex-col justify-center px-6 sm:px-10 lg:px-12 xl:px-16 py-12 overflow-y-auto relative">
        {/* Sélecteur de langue accessible avant connexion */}
        <div className="absolute top-6 right-6">
          <LanguageSwitcher variant="inline" />
        </div>

        <div className="w-full max-w-md mx-auto">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 mb-10 no-underline">
            <span className="font-display text-xl font-bold text-white">SunGuard</span>
          </Link>

          <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight text-white mb-2">{t('login.title')}</h2>
          <p className="text-sm text-white/55 mb-8">{t('login.subtitle')}</p>

          <div className="space-y-5">
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-2">{t('login.usernameLabel')}</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder={t('register.usernamePlaceholder') as string}
                className="w-full h-12 px-4 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sun-300/40 transition"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-2">{t('login.passwordLabel')}</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder={t('login.passwordPlaceholder') as string}
                  autoComplete="current-password"
                  className="w-full h-12 px-4 pr-20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sun-300/40 transition"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-wider text-white/55 hover:text-white/80 transition-colors"
                >
                  {showPassword ? t('login.passwordHide') : t('login.passwordShow')}
                </button>
              </div>
            </label>

            {captcha && !banInfo && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(255,179,71,0.08)', border: '1px solid rgba(255,179,71,0.30)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-sun-300">
                    {t('login.captchaLabel')}
                  </span>
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    className="text-[11px] text-sun-300 hover:text-sun-200 transition-colors"
                  >
                    {t('login.captchaRefresh')}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono text-lg text-white font-semibold select-none">
                    {captcha.question}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={captchaAnswer}
                    onChange={e => setCaptchaAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="?"
                    className="w-24 h-10 px-3 rounded-lg text-white text-center placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sun-300/40 transition"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
                <p className="text-[11px] text-white/55 mt-2">{t('login.captchaHint')}</p>
              </div>
            )}

            {banInfo && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#fca5a5' }}
              >
                <div className="font-semibold mb-1">{t('login.banned')}</div>
                {banInfo.reason && <div className="text-xs mb-1">{banInfo.reason}</div>}
                <div className="text-[11px] opacity-80">
                  {banInfo.until === 0
                    ? t('login.bannedPermanent')
                    : t('login.bannedUntil', { date: new Date(banInfo.until).toLocaleString() })}
                </div>
              </div>
            )}

            {error && !banInfo && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#fca5a5' }}
              >
                {error}
              </div>
            )}

            <Button size="lg" fullWidth onClick={handleLogin} disabled={loading || !!banInfo}>
              {loading ? t('login.buttonLoading') : t('login.button')}
            </Button>

            <div className="pt-2 space-y-2 text-center">
              <p className="text-sm">
                <Link to="/forgot" className="text-sun-300 hover:text-sun-200 font-medium underline-offset-4 hover:underline transition-colors">
                  {t('login.linkForgot')}
                </Link>
              </p>
              <p className="text-sm text-white/55">
                {t('login.noAccount')}{' '}
                <Link to="/" className="text-sun-300 hover:text-sun-200 font-medium underline-offset-4 hover:underline transition-colors">
                  {t('login.createAccount')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
