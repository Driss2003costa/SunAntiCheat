import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, saveToken, getToken } from '../api/client'
import OtpInput from '../components/OtpInput'
import SunSky from '../components/SunSky'
import SunWordmark from '../components/SunWordmark'

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
      // Passe le code de parrainage dans le body si présent
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

  if (step === 'success') {
    return (
      <SunSky variant="dawn" twist={{ starDensity: 'dense', cloudLayer: true }}>
        <Frame>
          <div className="text-center space-y-5 py-2">
            <div className="text-6xl animate-shimmer">🎉</div>
            <h2 className="font-display text-3xl font-medium text-white">Compte créé</h2>
            <p className="text-sand-200/90 text-sm">
              Bienvenue sur le portail, <span className="text-sun-200 font-semibold">{exactName}</span>.
            </p>
            <PrimaryButton onClick={() => navigate('/profile')}>
              Voir mon profil
            </PrimaryButton>
          </div>
        </Frame>
      </SunSky>
    )
  }

  return (
    <SunSky variant="dawn" twist={{ starDensity: 'dense', cloudLayer: true }}>
      <Frame>
        {/* Referral banner — uniquement si le code vient de l'URL et est encore en cours de vérification */}
        {refCode && refValid === null && (
          <div className="mb-5 rounded-xl px-4 py-3 text-sm text-center"
               style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
            ⏳ Vérification du code {refCode}…
          </div>
        )}
        {/* Stepper */}
        <div className="flex items-center gap-3 mb-7">
          {['Pseudo', 'Vérification'].map((label, i) => {
            const active = (i === 0 && step === 'username') || (i === 1 && step === 'pin')
            const done   = (i === 0 && step === 'pin')
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${active ? 'bg-sun-300 text-ink-500 shadow-[0_0_12px_rgba(255,179,71,0.6)]' :
                     done  ? 'bg-jade-400 text-ink-500' :
                             'bg-white/10 text-white/40'}`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${active ? 'text-white font-medium' : 'text-white/50'}`}>{label}</span>
                {i < 1 && <div className={`flex-1 h-px mx-1 ${done ? 'bg-jade-400/50' : 'bg-white/10'}`} />}
              </div>
            )
          })}
        </div>

        {step === 'username' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-3xl font-medium text-white leading-tight">Crée ton compte</h2>
              <p className="text-sand-200/80 text-sm mt-1.5">
                Connecte-toi d'abord sur le serveur Minecraft, puis saisis ton pseudo.
              </p>
            </div>
            <Field label="Pseudo Minecraft">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRequest()}
                placeholder="ex: Steve"
                className="w-full px-4 py-3 bg-ink-500/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-sun-300/60 focus:bg-ink-500/60 focus:outline-none transition-all backdrop-blur"
              />
            </Field>
            <Field label="Code de parrainage (optionnel)">
              <div className="relative">
                <input
                  type="text"
                  value={refCode}
                  onChange={e => handleRefCodeChange(e.target.value)}
                  placeholder="ex: SUN-XXXXXXXX"
                  className="w-full px-4 py-3 bg-ink-500/40 border rounded-xl text-white placeholder-white/30 focus:outline-none transition-all backdrop-blur font-mono text-sm"
                  style={{
                    borderColor: refValid === true ? 'rgba(52,211,153,0.5)' : refValid === false ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)',
                    background: refValid === true ? 'rgba(16,185,129,0.08)' : 'rgba(10,16,32,0.4)',
                  }}
                />
                {refCode && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                    {refValid === true ? '✅' : refValid === false ? '❌' : '⏳'}
                  </span>
                )}
              </div>
              {refValid === true  && <p className="text-[11px] text-emerald-400 mt-1">Code valide — tu recevras un bonus à l'inscription !</p>}
              {refValid === false && <p className="text-[11px] text-red-400 mt-1">Code invalide ou inexistant.</p>}
            </Field>
            {error && <ErrorBox>{error}</ErrorBox>}
            <PrimaryButton onClick={handleRequest} disabled={loading || !username.trim()}>
              {loading ? 'Envoi…' : 'Recevoir mon code'}
            </PrimaryButton>
            <p className="text-center text-sm text-sand-300/70">
              Déjà inscrit ? <Link to="/login" className="text-sun-200 hover:text-sun-100 font-medium underline-offset-4 hover:underline transition-colors">Connexion</Link>
            </p>
          </div>
        )}

        {step === 'pin' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-3xl font-medium text-white leading-tight">Vérification</h2>
              <p className="text-sand-200/80 text-sm mt-1.5">
                Un code à 6 chiffres a été envoyé à <span className="text-sun-200 font-medium">{exactName}</span> dans le chat Minecraft.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-sand-200/70 mb-3 text-center uppercase tracking-widest">Code reçu en jeu</label>
              <OtpInput value={verifyPin} onChange={setVerifyPin} length={6} />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-sand-300/60">
                  {countdown > 0 ? `Expire dans ${countdown}s` : 'Code expiré'}
                </span>
                <button onClick={resend} disabled={countdown > 0 || loading}
                  className="text-[11px] text-sun-200 hover:text-sun-100 disabled:text-white/30 transition-colors">
                  Renvoyer le code
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-sand-200/70 mb-3 text-center uppercase tracking-widest">
                Crée ton PIN de connexion <span className="text-white/40">(6 chiffres)</span>
              </label>
              <OtpInput value={loginPin} onChange={setLoginPin} length={6} />
              <p className="text-center text-[11px] text-sand-300/60 mt-2">Tu utiliseras ce PIN pour te connecter au portail.</p>
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <PrimaryButton onClick={handleVerify} disabled={loading}>
              {loading ? 'Vérification…' : 'Créer mon compte'}
            </PrimaryButton>
            <button onClick={() => { setStep('username'); setError(''); setVerifyPin(''); setLoginPin('') }}
              className="block w-full text-center text-xs text-sand-300/60 hover:text-sand-200 transition-colors">
              ← Retour
            </button>
          </div>
        )}
      </Frame>
    </SunSky>
  )
}

// ── Shared layout primitives ────────────────────────────────────────────────────

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <SunWordmark size="md" tagline="Portail Joueur" />
        </div>
        <div className="glass-warm rounded-3xl p-7">
          {children}
        </div>
        <p className="text-center text-[11px] text-sand-300/40 mt-6 font-display italic">
          « L'aube se lève sur ton aventure »
        </p>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-sand-200/70 mb-1.5 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative w-full py-3.5 rounded-xl font-semibold text-ink-500 overflow-hidden
        bg-gradient-to-br from-sun-100 via-sun-300 to-sun-500
        shadow-[0_8px_24px_-8px_rgba(255,179,71,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]
        hover:shadow-[0_12px_32px_-8px_rgba(255,179,71,0.7),inset_0_1px_0_rgba(255,255,255,0.5)]
        disabled:from-white/10 disabled:via-white/10 disabled:to-white/10 disabled:text-white/30 disabled:shadow-none
        transition-all active:scale-[0.98]"
    >
      <span className="relative z-10">{children}</span>
    </button>
  )
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg">
      {children}
    </p>
  )
}
