import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

/**
 * Page d'achat publique — pas d'auth requise.
 * Layout standalone (pas le Layout admin).
 *
 * Workflow :
 *  1. Le visiteur saisit son pseudo Minecraft
 *  2. Choisit un plan VIP
 *  3. Clic sur Stripe ou PayPal → redirige vers la page de paiement hébergée
 *  4. Webhook côté serveur active la subscription après confirmation
 */

export default function Buy() {
  const [params] = useSearchParams()
  const [plans, setPlans] = useState<any[]>([])
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const success = params.get('success') === 'true'
  const cancelled = params.get('cancelled') === 'true'

  useEffect(() => {
    api.vipPublicPlans().then(setPlans).catch(() => setError('Impossible de charger les plans'))
  }, [])

  // Persist player name in localStorage for convenience
  useEffect(() => {
    const saved = localStorage.getItem('buy-player-name')
    if (saved) setPlayerName(saved)
  }, [])
  useEffect(() => {
    if (playerName) localStorage.setItem('buy-player-name', playerName)
  }, [playerName])

  const checkout = async (planId: string, gateway: 'STRIPE' | 'PAYPAL') => {
    setError(null)
    if (!playerName || !/^[a-zA-Z0-9_]{3,16}$/.test(playerName)) {
      setError('Pseudo Minecraft invalide (3-16 caractères, lettres/chiffres/_ uniquement)')
      return
    }
    setLoading(`${planId}-${gateway}`)
    try {
      const r = await api.vipPublicCheckout(planId, playerName, gateway)
      window.location.href = r.redirectUrl
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la création du paiement')
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Header */}
        <header className="text-center mb-12">
          <div className="text-6xl mb-4">👑</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: 'white' }}>
            Devenez VIP
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Soutenez le serveur et débloquez des avantages exclusifs
          </p>
        </header>

        {/* Success/Cancel banners */}
        {success && (
          <div className="max-w-md mx-auto mb-6 rounded-xl p-4 flex items-start gap-3"
               style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: 'white' }}>
            <div className="text-2xl">🎉</div>
            <div>
              <div className="font-bold">Paiement réussi !</div>
              <div className="text-sm opacity-80">
                Ton VIP sera activé en quelques secondes (le temps que le webhook arrive).
                Reconnecte-toi en jeu pour profiter de tes avantages.
              </div>
            </div>
          </div>
        )}

        {cancelled && (
          <div className="max-w-md mx-auto mb-6 rounded-xl p-4 flex items-start gap-3"
               style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid #f97316', color: 'white' }}>
            <div className="text-2xl">⚠️</div>
            <div>
              <div className="font-bold">Paiement annulé</div>
              <div className="text-sm opacity-80">
                Aucun débit effectué. Tu peux réessayer ci-dessous.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mb-6 rounded-xl p-3 text-center"
               style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {/* Étape 1 — Pseudo */}
        <div className="max-w-md mx-auto mb-12 rounded-2xl p-6"
             style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
            🎮 Ton pseudo Minecraft
          </label>
          <input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Notch"
            className="w-full px-4 py-3 rounded-lg text-lg font-mono"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
            }}/>
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Le VIP sera crédité sur ce compte. Vérifie bien ton pseudo !
          </p>
        </div>

        {/* Étape 2 — Plans */}
        {plans.length === 0 ? (
          <div className="text-center" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Aucun plan VIP disponible pour le moment.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.sort((a, b) => (a.priceEur || 0) - (b.priceEur || 0)).map((p, idx) => (
              <PlanPriceCard key={p.id} plan={p}
                             featured={idx === 1 && plans.length >= 3}
                             onCheckout={(g: 'STRIPE' | 'PAYPAL') => checkout(p.id, g)}
                             loading={loading}/>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <div className="flex items-center justify-center gap-4 mb-3 text-sm">
            <span>🔒 Paiement sécurisé</span>
            <span>·</span>
            <span>💳 Stripe & PayPal</span>
            <span>·</span>
            <span>⚡ Activation instantanée</span>
          </div>
          <p className="text-xs">
            Aucune information de paiement n'est stockée sur notre serveur.
            <br/>
            Les transactions sont gérées par Stripe et PayPal.
          </p>
        </footer>
      </div>
    </div>
  )
}

function PlanPriceCard({ plan, featured, onCheckout, loading }: any) {
  return (
    <div className="rounded-2xl overflow-hidden relative"
         style={{
           background: 'rgba(255,255,255,0.05)',
           backdropFilter: 'blur(10px)',
           border: featured ? `2px solid ${plan.color}` : '1px solid rgba(255,255,255,0.1)',
           transform: featured ? 'scale(1.05)' : 'scale(1)',
           transition: 'transform 0.2s',
         }}>
      {featured && (
        <div className="absolute top-0 left-0 right-0 text-center py-1.5 text-xs font-bold uppercase tracking-wider"
             style={{ background: plan.color, color: 'white' }}>
          ⭐ Le plus populaire
        </div>
      )}

      <div className={`p-6 ${featured ? 'pt-10' : ''}`}>
        <div className="text-center mb-4">
          <div className="text-6xl mb-2">{plan.icon}</div>
          <h3 className="text-2xl font-bold" style={{ color: 'white' }}>{plan.displayName}</h3>
        </div>

        {plan.description && (
          <p className="text-sm text-center mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {plan.description}
          </p>
        )}

        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold" style={{ color: plan.color }}>{plan.priceEur?.toFixed(2)}</span>
            <span className="text-xl" style={{ color: 'rgba(255,255,255,0.7)' }}>€</span>
          </div>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            pour {plan.durationDays} jours
          </div>
        </div>

        <ul className="space-y-2 mb-6">
          {(plan.perks || []).map((perk: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
              <span style={{ color: '#10b981' }}>✓</span>
              <span>{perk}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <button onClick={() => onCheckout('STRIPE')}
                  disabled={loading === `${plan.id}-STRIPE`}
                  className="w-full py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
                  style={{
                    background: '#635bff',
                    color: 'white',
                    opacity: loading ? 0.6 : 1,
                  }}>
            {loading === `${plan.id}-STRIPE` ? '⏳ Redirection...' : <>💳 Payer avec Stripe</>}
          </button>
          <button onClick={() => onCheckout('PAYPAL')}
                  disabled={loading === `${plan.id}-PAYPAL`}
                  className="w-full py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
                  style={{
                    background: '#ffc439',
                    color: '#003087',
                    opacity: loading ? 0.6 : 1,
                  }}>
            {loading === `${plan.id}-PAYPAL` ? '⏳ Redirection...' : <>🅿️ Payer avec PayPal</>}
          </button>
        </div>
      </div>
    </div>
  )
}
