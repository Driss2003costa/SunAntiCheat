import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, saveToken, getToken } from '../api/client'
import OtpInput from '../components/OtpInput'
import SunSky from '../components/SunSky'
import SunWordmark from '../components/SunWordmark'
import { Field, PrimaryButton, ErrorBox } from './Register'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [pin, setPin]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

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
    <SunSky variant="dawn">
      <div className="min-h-screen flex flex-col items-center justify-center p-5">
        <div className="w-full max-w-sm">
          <div className="text-center mb-7">
            <SunWordmark size="md" tagline="Portail Joueur" />
          </div>

          <div className="glass-warm rounded-3xl p-7 space-y-5">
            <div>
              <h2 className="font-display text-3xl font-medium text-white leading-tight">Connexion</h2>
              <p className="text-sand-200/80 text-sm mt-1.5">Bienvenue de retour, aventurier.</p>
            </div>

            <Field label="Pseudo Minecraft">
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="ex: Steve"
                className="w-full px-4 py-3 bg-ink-500/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-sun-300/60 focus:bg-ink-500/60 focus:outline-none transition-all backdrop-blur"
              />
            </Field>

            <div>
              <label className="block text-xs font-medium text-sand-200/70 mb-3 text-center uppercase tracking-widest">Code PIN</label>
              <OtpInput value={pin} onChange={setPin} length={6} />
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <PrimaryButton onClick={handleLogin} disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </PrimaryButton>

            <div className="pt-1 space-y-2">
              <p className="text-center text-sm">
                <Link to="/forgot" className="text-sun-200 hover:text-sun-100 font-medium underline-offset-4 hover:underline transition-colors">
                  PIN oublié ?
                </Link>
              </p>
              <p className="text-center text-sm text-sand-300/70">
                Pas encore de compte ?{' '}
                <Link to="/" className="text-sun-200 hover:text-sun-100 font-medium underline-offset-4 hover:underline transition-colors">Inscription</Link>
              </p>
            </div>
          </div>

          <p className="text-center text-[11px] text-sand-300/40 mt-6 font-display italic">
            « L'aube se lève sur ton aventure »
          </p>
        </div>
      </div>
    </SunSky>
  )
}
