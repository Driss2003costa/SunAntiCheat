import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp]         = useState('')
  const [step, setStep]         = useState<'credentials' | 'totp'>('credentials')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await api.login(username, password, totp || undefined)
      // Si le serveur demande un TOTP → on bascule sur le step 2
      if (res.requiresTotp) {
        setStep('totp')
        setLoading(false)
        return
      }
      if (!res.token || !res.role) {
        setError('Réponse serveur invalide'); setLoading(false); return
      }
      login(res.token, res.username, res.role)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  function backToCredentials() {
    setStep('credentials')
    setTotp('')
    setError('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">{step === 'totp' ? '🔐' : '☀️'}</div>
          <h1 className="text-2xl font-bold text-white">
            {step === 'totp' ? 'Code 2FA' : 'SunGuard'}
          </h1>
          <p className="text-muted text-sm mt-1">
            {step === 'totp'
              ? 'Ouvre ton authenticator et entre le code à 6 chiffres'
              : 'Dashboard Admin'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 'credentials' && (
            <>
              <div>
                <label className="block text-sm text-muted mb-1">Nom d'utilisateur</label>
                <input className="input" value={username}
                       onChange={e => setUsername(e.target.value)}
                       placeholder="admin" autoFocus/>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Mot de passe</label>
                <input className="input" type="password" value={password}
                       onChange={e => setPassword(e.target.value)}
                       placeholder="••••••••"/>
              </div>
            </>
          )}

          {step === 'totp' && (
            <>
              <div className="text-center mb-3">
                <div className="text-xs text-muted">Compte</div>
                <div className="font-mono font-bold">{username}</div>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Code à 6 chiffres</label>
                <input className="input text-center text-2xl font-mono tracking-widest"
                       value={totp}
                       onChange={e => setTotp(e.target.value.replace(/\s/g, '').slice(0, 6))}
                       placeholder="000000" autoFocus
                       inputMode="numeric" pattern="[0-9]*"
                       maxLength={6}/>
                <p className="text-xs text-muted mt-1 text-center">
                  Code valide ~30 secondes (à recopier rapidement)
                </p>
              </div>
              <button type="button" onClick={backToCredentials}
                      className="text-xs text-muted hover:text-white block w-full text-center">
                ← Changer de compte
              </button>
            </>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || (step === 'totp' && totp.length !== 6)}
                  className="btn-primary w-full disabled:opacity-50">
            {loading ? '⏳ Connexion...' : step === 'totp' ? 'Vérifier' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
