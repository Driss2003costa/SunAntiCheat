import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, saveToken, getToken } from '../api/client'
import OtpInput from '../components/OtpInput'
import { Button } from '../components/ui'

type Step = 'username' | 'pin' | 'success'

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep]           = useState<Step>('username')
  const [username, setUsername]   = useState('')
  const [uuid, setUuid]           = useState('')
  const [exactName, setExactName] = useState('')
  const [verifyPin, setVerifyPin] = useState('')
  const [loginPin, setLoginPin]   = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [refCode, setRefCode]     = useState('')
  const [refValid, setRefValid]   = useState<boolean | null>(null)

  useEffect(() => {
    if (getToken()) navigate('/profile', { replace: true })
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      const code = ref.toUpperCase().trim()
      setRefCode(code)
      fetch(`/api/public/referral/check?code=${encodeURIComponent(code)}`)
        .then(r => r.json()).then(d => setRefValid(d.valid)).catch(() => setRefValid(false))
    }
  }, [navigate])

  function handleRefCodeChange(val: string) {
    const code = val.toUpperCase().trim()
    setRefCode(code)
    setRefValid(null)
    if (code.length === 0) return
    if (code.length >= 4) {
      fetch(`/api/public/referral/check?code=${encodeURIComponent(code)}`)
        .then(r => r.json()).then(d => setRefValid(d.valid)).catch(() => setRefValid(false))
    }
  }

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(id)
  }, [countdown])

  async function handleRequest() {
    if (!username.trim()) return
    setLoading(true); setError('')
    try {
      const res = await api.requestPin(username.trim())
      setUuid(res.uuid); setExactName(res.username); setCountdown(res.expires_in); setStep('pin')
    } catch (e: any) {
      if (e.error === 'player_offline')          setError('Tu dois être connecté sur le serveur Minecraft pour t\'inscrire.')
      else if (e.error === 'already_registered') setError('Ce compte est déjà inscrit. Connecte-toi à la place.')
      else if (e.status === 429)                 setError('Trop de tentatives. Réessaie dans 10 minutes.')
      else                                       setError(e.message || 'Erreur inattendue.')
    }
    setLoading(false)
  }

  async function handleVerify() {
    if (verifyPin.replace(/\D/g, '').length < 6) { setError('Saisis les 6 chiffres reçus en jeu.'); return }
    if (loginPin.replace(/\D/g, '').length < 6)  { setError('Crée un code PIN de 6 chiffres.'); return }
    setLoading(true); setError('')
    try {
      const body: Record<string, string> = { uuid, pin: verifyPin, password: loginPin }
      if (refCode && refValid) body.ref_code = refCode
      const res = await fetch('/api/public/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw d; return d })
      saveToken(res.token); setStep('success')
    } catch (e: any) {
      if (e.error === 'pin_expired')      setError('Code expiré. Clique sur "Renvoyer le code".')
      else if (e.error === 'max_attempts') setError('Trop de tentatives. Recommence depuis le début.')
      else if (e.error === 'invalid_pin')  setError(`Code incorrect. ${e.attempts_left ?? 0} tentative(s) restante(s).`)
      else setError(e.message || 'Erreur inattendue.')
    }
    setLoading(false)
  }

  async function resend() {
    if (countdown > 0) return
    setLoading(true); setError('')
    try {
      const res = await api.requestPin(exactName)
      setCountdown(res.expires_in); setVerifyPin('')
    } catch (e: any) { setError(e.message || 'Erreur lors du renvoi.') }
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
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sun-300 mb-4">Rejoins l'aventure</p>
          <h1 className="font-display text-5xl xl:text-6xl 2xl:text-7xl font-semibold leading-[1.05] tracking-tight text-white mb-6">
            Crée ton compte et plonge dans l'expérience SunGuard.
          </h1>
          <p className="text-lg text-white/60 mb-8">
            Une communauté soudée, des récompenses uniques, des aventures sans fin. L'inscription se fait en jeu : sécurisée, rapide et 100% liée à ton compte Minecraft.
          </p>

          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              Vérification anti-triche directement depuis le serveur
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              Récompense de bienvenue grâce au parrainage
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              Accès complet à ton inventaire, classements et profil
            </li>
          </ul>
        </div>

        <div className="relative z-10 text-xs text-white/40">© SunGuard · Tous droits réservés</div>
      </aside>

      {/* CÔTÉ DROIT — formulaire */}
      <main className="flex flex-col justify-center px-6 sm:px-10 lg:px-12 xl:px-16 py-12 overflow-y-auto">
        <div className="w-full max-w-md mx-auto">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 mb-10 no-underline">
            <span className="font-display text-xl font-bold text-white">SunGuard</span>
          </Link>

          {step === 'success' ? (
            <div className="text-center space-y-5 py-2">
              <div className="text-6xl">🎉</div>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold text-white">Compte créé</h2>
              <p className="text-sm text-white/60">
                Bienvenue sur le portail, <span className="text-sun-300 font-semibold">{exactName}</span>.
              </p>
              <Button size="lg" fullWidth onClick={() => navigate('/profile')}>
                Voir mon profil
              </Button>
            </div>
          ) : (
            <>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight text-white mb-2">
                {step === 'username' ? 'Créer un compte' : 'Vérification'}
              </h2>
              <p className="text-sm text-white/55 mb-6">
                {step === 'username'
                  ? 'Connecte-toi d\'abord sur le serveur Minecraft, puis saisis ton pseudo.'
                  : <>Un code à 6 chiffres a été envoyé à <span className="text-sun-300 font-medium">{exactName}</span> dans le chat Minecraft.</>}
              </p>

              {/* Stepper */}
              <div className="flex items-center gap-3 mb-8">
                {['Pseudo', 'Vérification'].map((label, i) => {
                  const active = (i === 0 && step === 'username') || (i === 1 && step === 'pin')
                  const done   = (i === 0 && step === 'pin')
                  return (
                    <div key={i} className="flex items-center gap-2 flex-1">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                          ${active ? 'bg-sun-300 text-ink-500 shadow-[0_0_12px_rgba(255,179,71,0.6)]' :
                             done  ? 'bg-emerald-400 text-ink-500' :
                                     'bg-white/10 text-white/40'}`}
                      >
                        {done ? '✓' : i + 1}
                      </div>
                      <span className={`text-xs ${active ? 'text-white font-medium' : 'text-white/50'}`}>{label}</span>
                      {i < 1 && <div className={`flex-1 h-px mx-1 ${done ? 'bg-emerald-400/50' : 'bg-white/10'}`} />}
                    </div>
                  )
                })}
              </div>

              {refCode && refValid === null && (
                <div
                  className="mb-5 rounded-xl px-4 py-3 text-sm text-center"
                  style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                >
                  ⏳ Vérification du code {refCode}…
                </div>
              )}

              {step === 'username' && (
                <div className="space-y-5">
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-2">Pseudo Minecraft</span>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRequest()}
                      placeholder="ex: Steve"
                      className="w-full h-12 px-4 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sun-300/40 transition"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-2">Code de parrainage (optionnel)</span>
                    <div className="relative">
                      <input
                        type="text"
                        value={refCode}
                        onChange={e => handleRefCodeChange(e.target.value)}
                        placeholder="ex: SUN-XXXXXXXX"
                        className="w-full h-12 px-4 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sun-300/40 transition font-mono text-sm"
                        style={{
                          background: refValid === true ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${
                            refValid === true ? 'rgba(52,211,153,0.5)' :
                            refValid === false ? 'rgba(248,113,113,0.5)' :
                            'rgba(255,255,255,0.08)'
                          }`,
                        }}
                      />
                      {refCode && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                          {refValid === true ? '✅' : refValid === false ? '❌' : '⏳'}
                        </span>
                      )}
                    </div>
                    {refValid === true  && <p className="text-[11px] text-emerald-400 mt-2">Code valide — tu recevras un bonus à l'inscription !</p>}
                    {refValid === false && <p className="text-[11px] text-red-400 mt-2">Code invalide ou inexistant.</p>}
                  </label>

                  {error && (
                    <div
                      className="px-4 py-3 rounded-xl text-sm"
                      style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#fca5a5' }}
                    >
                      {error}
                    </div>
                  )}

                  <Button size="lg" fullWidth onClick={handleRequest} disabled={loading || !username.trim()}>
                    {loading ? 'Envoi…' : 'Recevoir mon code'}
                  </Button>

                  <p className="text-center text-sm text-white/55">
                    Déjà inscrit ?{' '}
                    <Link to="/login" className="text-sun-300 hover:text-sun-200 font-medium underline-offset-4 hover:underline transition-colors">
                      Connexion
                    </Link>
                  </p>
                </div>
              )}

              {step === 'pin' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-3">Code reçu en jeu</label>
                    <OtpInput value={verifyPin} onChange={setVerifyPin} length={6} />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-white/55">
                        {countdown > 0 ? `Expire dans ${countdown}s` : 'Code expiré'}
                      </span>
                      <button
                        onClick={resend}
                        disabled={countdown > 0 || loading}
                        className="text-[11px] text-sun-300 hover:text-sun-200 disabled:text-white/30 transition-colors"
                      >
                        Renvoyer le code
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-3">
                      Crée ton PIN de connexion <span className="text-white/40 normal-case tracking-normal">(6 chiffres)</span>
                    </label>
                    <OtpInput value={loginPin} onChange={setLoginPin} length={6} />
                    <p className="text-[11px] text-white/55 mt-2">Tu utiliseras ce PIN pour te connecter au portail.</p>
                  </div>

                  {error && (
                    <div
                      className="px-4 py-3 rounded-xl text-sm"
                      style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#fca5a5' }}
                    >
                      {error}
                    </div>
                  )}

                  <Button size="lg" fullWidth onClick={handleVerify} disabled={loading}>
                    {loading ? 'Vérification…' : 'Créer mon compte'}
                  </Button>

                  <button
                    onClick={() => { setStep('username'); setError(''); setVerifyPin(''); setLoginPin('') }}
                    className="block w-full text-center text-xs text-white/55 hover:text-white/80 transition-colors"
                  >
                    ← Retour
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
