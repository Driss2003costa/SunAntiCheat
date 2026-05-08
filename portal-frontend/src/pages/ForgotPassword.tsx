import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, saveToken } from '../api/client'
import OtpInput from '../components/OtpInput'
import { Button } from '../components/ui'

type Step = 'username' | 'pin' | 'success'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep]           = useState<Step>('username')
  const [username, setUsername]   = useState('')
  const [uuid, setUuid]           = useState('')
  const [verifyPin, setVerifyPin] = useState('')
  const [newPin, setNewPin]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [countdown, setCountdown] = useState(0)

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
        setError('Tu dois être connecté sur le serveur Minecraft pour réinitialiser ton PIN.')
      } else {
        setError(e.message || 'Une erreur est survenue.')
      }
    }
    setLoading(false)
  }

  function startCountdown(seconds: number) {
    let s = seconds
    const id = setInterval(() => { s--; setCountdown(s); if (s <= 0) clearInterval(id) }, 1000)
  }

  async function handleReset() {
    if (verifyPin.replace(/\D/g, '').length < 6) { setError('Saisis le code reçu en jeu (6 chiffres).'); return }
    if (newPin.replace(/\D/g, '').length < 6)    { setError('Crée un nouveau PIN de 6 chiffres.'); return }
    setLoading(true); setError('')
    try {
      const res = await api.resetPassword(uuid, verifyPin, newPin)
      saveToken(res.token); setStep('success')
      setTimeout(() => navigate('/profile', { replace: true }), 2000)
    } catch (e: any) {
      const msg: Record<string, string> = {
        pin_expired:  'Code expiré. Retourne à l\'étape précédente.',
        max_attempts: 'Trop de tentatives incorrectes.',
        invalid_pin:  `Code incorrect. ${e.attempts_left ?? ''} tentative(s) restante(s).`,
      }
      setError(msg[e.error] ?? e.message ?? 'Erreur de vérification.')
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
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sun-300 mb-4">Récupère ton compte</p>
          <h1 className="font-display text-5xl xl:text-6xl 2xl:text-7xl font-semibold leading-[1.05] tracking-tight text-white mb-6">
            Un PIN oublié n'est jamais une fin.
          </h1>
          <p className="text-lg text-white/60 mb-8">
            La réinitialisation passe par le serveur Minecraft pour garantir que personne d'autre que toi ne puisse récupérer ton compte. Sécurisé, instantané, sans email.
          </p>

          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              Vérification d'identité directement en jeu
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              Aucun email, aucun mot de passe à retenir
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sun-300 shrink-0" />
              Reprends ton aventure en quelques secondes
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

          {step === 'username' && (
            <>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight text-white mb-2">PIN oublié ?</h2>
              <p className="text-sm text-white/55 mb-8">
                Connecte-toi en jeu et entre ton pseudo : un nouveau code te sera envoyé dans le chat Minecraft.
              </p>

              <div className="space-y-5">
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-2">Pseudo Minecraft</span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleForgot()}
                    placeholder="ex: Steve"
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
                  {loading ? 'Envoi…' : 'Envoyer le code'}
                </Button>

                <p className="text-center text-sm">
                  <Link to="/login" className="text-sun-300 hover:text-sun-200 font-medium underline-offset-4 hover:underline transition-colors">
                    ← Retour à la connexion
                  </Link>
                </p>
              </div>
            </>
          )}

          {step === 'pin' && (
            <>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight text-white mb-2">Réinitialiser le PIN</h2>
              <p className="text-sm text-white/55 mb-8">
                Code envoyé dans le chat Minecraft.
                {countdown > 0 && <span className="text-sun-300"> Expire dans {countdown}s.</span>}
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-3">Code reçu en jeu</label>
                  <OtpInput value={verifyPin} onChange={setVerifyPin} length={6} />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/55 mb-3">
                    Nouveau PIN <span className="text-white/40 normal-case tracking-normal">(6 chiffres)</span>
                  </label>
                  <OtpInput value={newPin} onChange={setNewPin} length={6} />
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
                  {loading ? 'Vérification…' : 'Réinitialiser le PIN'}
                </Button>

                <button
                  onClick={() => { setStep('username'); setError(''); setVerifyPin(''); setNewPin('') }}
                  className="block w-full text-center text-xs text-white/55 hover:text-white/80 transition-colors"
                >
                  ← Renvoyer un code
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-4 space-y-5">
              <div className="text-6xl">✨</div>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold text-white">PIN réinitialisé</h2>
              <p className="text-sm text-white/60">Redirection vers ton profil…</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
