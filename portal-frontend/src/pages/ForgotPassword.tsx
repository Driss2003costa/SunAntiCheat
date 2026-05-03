import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, saveToken } from '../api/client'
import OtpInput from '../components/OtpInput'
import SunSky from '../components/SunSky'
import SunWordmark from '../components/SunWordmark'
import { Field, PrimaryButton, ErrorBox } from './Register'

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
    <SunSky variant="dawn">
      <div className="min-h-screen flex flex-col items-center justify-center p-5">
        <div className="w-full max-w-sm">
          <div className="text-center mb-7">
            <SunWordmark size="md" tagline="Réinitialisation du PIN" />
          </div>

          <div className="glass-warm rounded-3xl p-7 space-y-5">

            {step === 'username' && (
              <>
                <div>
                  <h2 className="font-display text-3xl font-medium text-white leading-tight">PIN oublié&nbsp;?</h2>
                  <p className="text-sand-200/80 text-sm mt-1.5">
                    Connecte-toi en jeu et entre ton pseudo : un nouveau code te sera envoyé dans le chat Minecraft.
                  </p>
                </div>
                <Field label="Pseudo Minecraft">
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleForgot()}
                    placeholder="ex: Steve"
                    className="w-full px-4 py-3 bg-ink-500/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-sun-300/60 focus:bg-ink-500/60 focus:outline-none transition-all backdrop-blur"
                  />
                </Field>
                {error && <ErrorBox>{error}</ErrorBox>}
                <PrimaryButton onClick={handleForgot} disabled={loading || !username.trim()}>
                  {loading ? 'Envoi…' : 'Envoyer le code'}
                </PrimaryButton>
                <p className="text-center text-sm">
                  <Link to="/login" className="text-sun-200 hover:text-sun-100 font-medium underline-offset-4 hover:underline transition-colors">
                    ← Retour à la connexion
                  </Link>
                </p>
              </>
            )}

            {step === 'pin' && (
              <>
                <div>
                  <h2 className="font-display text-3xl font-medium text-white leading-tight">Réinitialiser le PIN</h2>
                  <p className="text-sand-200/80 text-sm mt-1.5">
                    Code envoyé dans le chat Minecraft.
                    {countdown > 0 && <span className="text-sun-200"> Expire dans {countdown}s.</span>}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-sand-200/70 mb-3 text-center uppercase tracking-widest">Code reçu en jeu</label>
                  <OtpInput value={verifyPin} onChange={setVerifyPin} length={6} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-sand-200/70 mb-3 text-center uppercase tracking-widest">
                    Nouveau PIN <span className="text-white/40">(6 chiffres)</span>
                  </label>
                  <OtpInput value={newPin} onChange={setNewPin} length={6} />
                </div>

                {error && <ErrorBox>{error}</ErrorBox>}
                <PrimaryButton onClick={handleReset} disabled={loading}>
                  {loading ? 'Vérification…' : 'Réinitialiser le PIN'}
                </PrimaryButton>
                <button onClick={() => { setStep('username'); setError(''); setVerifyPin(''); setNewPin('') }}
                  className="block w-full text-center text-xs text-sand-300/60 hover:text-sand-200 transition-colors">
                  ← Renvoyer un code
                </button>
              </>
            )}

            {step === 'success' && (
              <div className="text-center py-4 space-y-4">
                <div className="text-5xl animate-shimmer">✨</div>
                <h2 className="font-display text-3xl font-medium text-white">PIN réinitialisé</h2>
                <p className="text-sand-200/80 text-sm">Redirection vers ton profil…</p>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-sand-300/40 mt-6 font-display italic">
            « L'aube se lève sur ton aventure »
          </p>
        </div>
      </div>
    </SunSky>
  )
}
