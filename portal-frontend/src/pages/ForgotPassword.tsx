import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, saveToken } from '../api/client'
import OtpInput from '../components/OtpInput'

type Step = 'username' | 'pin' | 'success'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep]         = useState<Step>('username')
  const [username, setUsername] = useState('')
  const [uuid, setUuid]         = useState('')
  const [verifyPin, setVerifyPin] = useState('')   // 6-digit code from Minecraft
  const [newPin, setNewPin]       = useState('')   // new 6-digit login PIN
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [countdown, setCountdown] = useState(0)

  async function handleForgot() {
    if (!username.trim()) return
    setLoading(true); setError('')
    try {
      const res = await api.forgotPassword(username.trim())
      if (res.uuid) {
        setUuid(res.uuid)
        setCountdown(res.expires_in ?? 300)
        startCountdown(res.expires_in ?? 300)
        setStep('pin')
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
    const id = setInterval(() => {
      s--
      setCountdown(s)
      if (s <= 0) clearInterval(id)
    }, 1000)
  }

  async function handleReset() {
    if (verifyPin.replace(/\D/g, '').length < 6) { setError('Saisis le code reçu en jeu (6 chiffres).'); return }
    if (newPin.replace(/\D/g, '').length < 6)    { setError('Crée un nouveau PIN de 6 chiffres.'); return }
    setLoading(true); setError('')
    try {
      const res = await api.resetPassword(uuid, verifyPin, newPin)
      saveToken(res.token)
      setStep('success')
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
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">☀️</div>
          <h1 className="text-2xl font-bold text-white">SunAntiCheat</h1>
          <p className="text-gray-500 text-sm mt-1">Réinitialisation du PIN</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl space-y-5">

          {step === 'username' && (
            <>
              <h2 className="text-xl font-bold text-white">PIN oublié ?</h2>
              <p className="text-gray-400 text-sm">
                Entre ton pseudo Minecraft. Tu dois être connecté sur le serveur pour recevoir le code de récupération.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Pseudo Minecraft</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleForgot()}
                  placeholder="ex: Steve"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none transition-colors"
                />
              </div>
              {error && <p className="text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
              <button onClick={handleForgot} disabled={loading || !username.trim()}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-semibold transition-colors">
                {loading ? 'Envoi...' : 'Envoyer le code'}
              </button>
              <p className="text-center text-sm text-gray-500">
                <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Retour à la connexion</Link>
              </p>
            </>
          )}

          {step === 'pin' && (
            <>
              <h2 className="text-xl font-bold text-white">Réinitialiser le PIN</h2>
              <p className="text-gray-400 text-sm">
                Un code à 6 chiffres a été envoyé dans ton chat Minecraft.
                {countdown > 0 && <span className="text-brand-400"> Expire dans {countdown}s</span>}
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 text-center">Code reçu en jeu</label>
                <OtpInput value={verifyPin} onChange={setVerifyPin} length={6} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
                  Nouveau PIN <span className="text-gray-500">(6 chiffres)</span>
                </label>
                <OtpInput value={newPin} onChange={setNewPin} length={6} />
              </div>

              {error && <p className="text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
              <button onClick={handleReset} disabled={loading}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-semibold transition-colors">
                {loading ? 'Vérification...' : 'Réinitialiser le PIN'}
              </button>
              <button onClick={() => { setStep('username'); setError(''); setVerifyPin(''); setNewPin('') }}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
                ← Renvoyer un code
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-4 space-y-3">
              <div className="text-5xl">✅</div>
              <h2 className="text-xl font-bold text-white">PIN réinitialisé !</h2>
              <p className="text-gray-400 text-sm">Redirection vers ton profil...</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
