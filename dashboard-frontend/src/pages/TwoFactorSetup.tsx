import { useEffect, useState } from 'react'
import { api } from '../api/client'

/**
 * Page Setup 2FA — wizard pour activer/désactiver le TOTP sur le compte courant.
 *
 * Steps :
 *  1. Récupère l'état actuel via /api/auth/me (totpEnabled)
 *  2. Si désactivé → POST /api/auth/totp/setup → reçoit secret + otpauthUri
 *      → Affiche QR code + secret manuel
 *      → User scan + entre code → POST /api/auth/totp/verify
 *  3. Si activé → propose de désactiver (mot de passe requis)
 */
export default function TwoFactorSetup() {
  const [me, setMe] = useState<{ username: string; role: string; totpEnabled: boolean } | null>(null)
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUri: string; issuer: string; account: string } | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadMe = async () => {
    try {
      const res = await api.me()
      setMe(res)
    } catch {}
  }

  useEffect(() => { loadMe() }, [])

  const startSetup = async () => {
    setError(''); setSuccess(''); setBusy(true)
    try {
      const res = await api.totpSetup()
      setSetupData(res)
    } catch (e: any) {
      setError(e.message || 'Erreur setup')
    } finally { setBusy(false) }
  }

  const verifyCode = async () => {
    setError(''); setBusy(true)
    try {
      await api.totpVerify(code)
      setSuccess('✓ 2FA activée avec succès !')
      setSetupData(null); setCode('')
      await loadMe()
    } catch (e: any) {
      setError(e.message || 'Code invalide')
    } finally { setBusy(false) }
  }

  const disable = async () => {
    if (!password) { setError('Mot de passe requis'); return }
    setError(''); setBusy(true)
    try {
      await api.totpDisable(password)
      setSuccess('2FA désactivée')
      setPassword('')
      await loadMe()
    } catch (e: any) {
      setError(e.message || 'Erreur')
    } finally { setBusy(false) }
  }

  if (!me) return <div className="p-6" style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  // QR code via api.qrserver.com (public, gratuit, pas de tracking)
  const qrUrl = setupData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(setupData.otpauthUri)}`
    : ''

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🔒 Authentification 2FA</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Active la double authentification (TOTP) pour sécuriser ton compte <b>{me.username}</b>.
        </p>
      </div>

      {/* État actuel */}
      <div className="rounded-xl p-4 flex items-center gap-3"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-3xl">{me.totpEnabled ? '✅' : '⚠️'}</div>
        <div className="flex-1">
          <div className="font-bold" style={{ color: 'var(--text)' }}>
            {me.totpEnabled ? '2FA activée' : '2FA désactivée'}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {me.totpEnabled
              ? 'À chaque login, un code à 6 chiffres te sera demandé.'
              : 'Active la 2FA pour bloquer toute connexion non autorisée même si ton mot de passe fuite.'}
          </div>
        </div>
      </div>

      {error && <div className="p-3 rounded text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>{error}</div>}
      {success && <div className="p-3 rounded text-sm" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>{success}</div>}

      {/* Activation */}
      {!me.totpEnabled && !setupData && (
        <div className="rounded-xl p-6 text-center"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-5xl mb-3">🛡️</div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Tu auras besoin d'une app authenticator (Google Authenticator, Authy, 1Password, Bitwarden…).
          </p>
          <button onClick={startSetup} disabled={busy}
                  className="px-5 py-2 rounded text-white font-medium"
                  style={{ background: 'var(--primary)' }}>
            {busy ? '⏳…' : 'Activer la 2FA'}
          </button>
        </div>
      )}

      {/* Setup en cours */}
      {setupData && (
        <div className="rounded-xl p-6 space-y-4"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-bold mb-2" style={{ color: 'var(--text)' }}>1. Scanne le QR code</h2>
            <div className="flex items-start gap-4">
              <div className="bg-white p-3 rounded">
                <img src={qrUrl} alt="QR Code TOTP" width={240} height={240}/>
              </div>
              <div className="flex-1 text-xs space-y-2" style={{ color: 'var(--text-muted)' }}>
                <p>Ouvre ton authenticator et scanne ce QR code.</p>
                <p>Si tu ne peux pas scanner, entre le secret manuellement :</p>
                <div className="font-mono p-2 rounded break-all"
                     style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                  {setupData.secret}
                </div>
                <p className="text-xs">Compte : <b style={{ color: 'var(--text)' }}>{setupData.account}</b></p>
                <p className="text-xs">Issuer : <b style={{ color: 'var(--text)' }}>{setupData.issuer}</b></p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-bold mb-2" style={{ color: 'var(--text)' }}>2. Entre le code à 6 chiffres</h2>
            <div className="flex gap-2">
              <input value={code}
                     onChange={e => setCode(e.target.value.replace(/\s/g, '').slice(0, 6))}
                     onKeyDown={e => e.key === 'Enter' && code.length === 6 && verifyCode()}
                     placeholder="000000"
                     inputMode="numeric" pattern="[0-9]*" maxLength={6}
                     className="flex-1 px-4 py-3 rounded text-center text-2xl font-mono tracking-widest"
                     style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
              <button onClick={verifyCode} disabled={busy || code.length !== 6}
                      className="px-5 py-3 rounded text-white font-medium disabled:opacity-50"
                      style={{ background: 'var(--primary)' }}>
                Vérifier
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              ⚠️ Ne ferme pas cette page tant que tu n'as pas vérifié le code (le secret n'est plus visible ensuite).
            </p>
          </div>

          <button onClick={() => { setSetupData(null); setCode(''); setError('') }}
                  className="text-xs"
                  style={{ color: 'var(--text-muted)' }}>
            ← Annuler
          </button>
        </div>
      )}

      {/* Désactivation */}
      {me.totpEnabled && (
        <div className="rounded-xl p-6 space-y-3"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>Désactiver la 2FA</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Confirme ton mot de passe pour désactiver la 2FA. Cette action affaiblit la sécurité de ton compte.
          </p>
          <div className="flex gap-2">
            <input type="password" value={password}
                   onChange={e => setPassword(e.target.value)}
                   placeholder="Mot de passe"
                   className="flex-1 px-3 py-2 rounded text-sm"
                   style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
            <button onClick={disable} disabled={busy || !password}
                    className="px-4 py-2 rounded text-white text-sm disabled:opacity-50"
                    style={{ background: '#ef4444' }}>
              Désactiver
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
