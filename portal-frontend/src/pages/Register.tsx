import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, saveToken, getToken } from '../api/client'
import OtpInput from '../components/OtpInput'

type Step = 'username' | 'pin' | 'success'

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep]         = useState<Step>('username')
  const [username, setUsername] = useState('')
  const [uuid, setUuid]         = useState('')
  const [exactName, setExactName] = useState('')
  const [verifyPin, setVerifyPin] = useState('')   // 6-digit code from Minecraft
  const [loginPin, setLoginPin]   = useState('')   // 4-digit PIN chosen by player
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (getToken()) navigate('/profile', { replace: true })
  }, [navigate])

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
      setUuid(res.uuid)
      setExactName(res.username)
      setCountdown(res.expires_in)
      setStep('pin')
    } catch (e: any) {
      if (e.error === 'player_offline')        setError('Tu dois être connecté sur le serveur Minecraft pour t\'inscrire.')
      else if (e.error === 'already_registered') setError('Ce compte est déjà inscrit. Connecte-toi à la place.')
      else if (e.status === 429)               setError('Trop de tentatives. Réessaie dans 10 minutes.')
      else                                     setError(e.message || 'Erreur inattendue.')
    }
    setLoading(false)
  }

  async function handleVerify() {
    if (verifyPin.replace(/\D/g, '').length < 6) { setError('Saisis les 6 chiffres reçus en jeu.'); return }
    if (loginPin.replace(/\D/g, '').length < 6)  { setError('Crée un code PIN de 6 chiffres.'); return }
    setLoading(true); setError('')
    try {
      const res = await api.verifyPin(uuid, verifyPin, loginPin)
      saveToken(res.token)
      setStep('success')
    } catch (e: any) {
      if (e.error === 'pin_expired')    setError('Code expiré. Clique sur "Renvoyer le code".')
      else if (e.error === 'max_attempts') setError('Trop de tentatives. Recommence depuis le début.')
      else if (e.error === 'invalid_pin') setError(`Code incorrect. ${e.attempts_left ?? 0} tentative(s) restante(s).`)
      else setError(e.message || 'Erreur inattendue.')
    }
    setLoading(false)
  }

  async function resend() {
    if (countdown > 0) return
    setLoading(true); setError('')
    try {
      const res = await api.requestPin(exactName)
      setCountdown(res.expires_in)
      setVerifyPin('')
    } catch (e: any) { setError(e.message || 'Erreur lors du renvoi.') }
    setLoading(false)
  }

  if (step === 'success') {
    return (
      <Layout>
        <div className="text-center space-y-6">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold text-white">Compte créé !</h2>
          <p className="text-gray-400">Bienvenue sur le portail, <span className="text-brand-400 font-semibold">{exactName}</span> !</p>
          <button onClick={() => navigate('/profile')}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 rounded-xl font-semibold transition-colors">
            Voir mon profil →
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {['Pseudo', 'Vérification'].map((label, i) => {
          const active = (i === 0 && step === 'username') || (i === 1 && step === 'pin')
          const done   = (i === 0 && step === 'pin')
          return (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${active ? 'bg-brand-500 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${active ? 'text-white font-medium' : 'text-gray-500'}`}>{label}</span>
              {i < 1 && <div className="flex-1 h-px bg-gray-700 mx-2" />}
            </div>
          )
        })}
      </div>

      {step === 'username' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Crée ton compte</h2>
            <p className="text-gray-400 text-sm">Connecte-toi d'abord sur le serveur Minecraft, puis saisis ton pseudo.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Pseudo Minecraft</label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRequest()}
              placeholder="ex: Steve"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none transition-colors"
            />
          </div>
          {error && <p className="text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
          <button onClick={handleRequest} disabled={loading || !username.trim()}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-semibold transition-colors">
            {loading ? 'Envoi...' : 'Recevoir mon code →'}
          </button>
          <p className="text-center text-sm text-gray-500">
            Déjà inscrit ?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Connexion</Link>
          </p>
        </div>
      )}

      {step === 'pin' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Vérifie ton compte</h2>
            <p className="text-gray-400 text-sm">
              Un code à 6 chiffres a été envoyé à <span className="text-brand-400 font-medium">{exactName}</span> dans le chat Minecraft.
            </p>
          </div>

          {/* Verify code from Minecraft */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3 text-center">Code reçu en jeu</label>
            <OtpInput value={verifyPin} onChange={setVerifyPin} length={6} />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">
                {countdown > 0 ? `Expire dans ${countdown}s` : 'Code expiré'}
              </span>
              <button onClick={resend} disabled={countdown > 0 || loading}
                className="text-xs text-brand-400 hover:text-brand-300 disabled:text-gray-600 transition-colors">
                Renvoyer le code
              </button>
            </div>
          </div>

          {/* Create login PIN */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
              Crée ton code PIN de connexion <span className="text-gray-500">(6 chiffres)</span>
            </label>
            <OtpInput value={loginPin} onChange={setLoginPin} length={6} />
            <p className="text-center text-xs text-gray-600 mt-2">Tu utiliseras ce PIN pour te connecter au portail</p>
          </div>

          {error && <p className="text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

          <button onClick={handleVerify} disabled={loading}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-semibold transition-colors">
            {loading ? 'Vérification...' : 'Créer mon compte'}
          </button>
          <button onClick={() => { setStep('username'); setError(''); setVerifyPin(''); setLoginPin('') }}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
            ← Retour
          </button>
        </div>
      )}
    </Layout>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">☀️</div>
          <h1 className="text-2xl font-bold text-white">SunAntiCheat</h1>
          <p className="text-gray-500 text-sm mt-1">Portail Joueur</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl">
          {children}
        </div>
      </div>
    </div>
  )
}
