import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, saveToken, getToken } from '../api/client'
import OtpInput from '../components/OtpInput'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [pin, setPin]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (getToken()) navigate('/profile', { replace: true })
  }, [navigate])

  async function handleLogin() {
    if (!username.trim()) { setError('Saisis ton pseudo.'); return }
    if (pin.replace(/\D/g, '').length < 6) { setError('Saisis ton code PIN de 6 chiffres.'); return }
    setLoading(true); setError('')
    try {
      const res = await api.login(username.trim(), pin)
      saveToken(res.token)
      navigate('/profile', { replace: true })
    } catch (e: any) {
      setError(e.message || 'Pseudo ou PIN incorrect.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">☀️</div>
          <h1 className="text-2xl font-bold text-white">SunAntiCheat</h1>
          <p className="text-gray-500 text-sm mt-1">Portail Joueur</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl space-y-5">
          <h2 className="text-xl font-bold text-white">Connexion</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Pseudo Minecraft</label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="ex: Steve"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3 text-center">Code PIN</label>
            <OtpInput value={pin} onChange={setPin} length={6} />
          </div>

          {error && <p className="text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

          <button onClick={handleLogin} disabled={loading}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-semibold transition-colors">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <p className="text-center text-sm text-gray-500">
            <Link to="/forgot" className="text-brand-400 hover:text-brand-300 font-medium">PIN oublié ?</Link>
          </p>
          <p className="text-center text-sm text-gray-500">
            Pas encore de compte ?{' '}
            <Link to="/" className="text-brand-400 hover:text-brand-300 font-medium">Inscription</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
