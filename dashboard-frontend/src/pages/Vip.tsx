import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { usePermission } from '../hooks/usePermission'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

/**
 * Page admin VIP — gestion des plans, subscriptions, stats.
 * 3 onglets : 📋 Plans · 👥 Subscriptions · 📊 Stats
 */

const ICONS = ['👑', '⭐', '💎', '🌟', '🎖️', '🏆', '✨', '🔥', '⚡', '🚀']
const COLORS = ['#fbbf24', '#a78bfa', '#60a5fa', '#34d399', '#f97316', '#ec4899', '#06b6d4', '#ef4444']

function blankPlan() {
  return {
    name: 'vip_bronze',
    displayName: 'VIP Bronze',
    description: '',
    icon: '⭐',
    color: '#fbbf24',
    priceEur: 4.99,
    durationDays: 30,
    rank: 'vip',
    perks: ['/fly', 'XP Boost x1.5', 'Tag chat coloré'],
    commandsOnActivate: [],
    commandsOnExpire: [],
    enabled: true,
    order: 0,
    createdAt: Date.now(),
  }
}

export default function Vip() {
  const { canEdit, isAdmin } = usePermission()
  const [tab, setTab] = useState<'plans' | 'subs' | 'stats'>('plans')
  const [plans, setPlans] = useState<any[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [gateways, setGateways] = useState<any>(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [giftModal, setGiftModal] = useState<{ planId?: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null)

  const refresh = async () => {
    try {
      setPlans(await api.vipPlans())
      setSubs(await api.vipSubscriptions({ limit: 200 }))
      setStats(await api.vipStats(30))
      setGateways(await api.vipGateways())
    } catch {}
  }
  useEffect(() => { refresh(); const t = setInterval(refresh, 20000); return () => clearInterval(t) }, [])

  const showFlash = (text: string, ok = true) => { setFlash({ text, ok }); setTimeout(() => setFlash(null), 3500) }

  const savePlan = async () => {
    if (!editing) return
    try {
      if (editing.id) await api.vipUpdatePlan(editing.id, editing)
      else await api.vipCreatePlan(editing)
      showFlash('✓ Plan enregistré')
      setEditing(null)
      refresh()
    } catch (e: any) { showFlash('✗ ' + e.message, false) }
  }

  const delPlan = async (id: string) => {
    if (!confirm('Supprimer ce plan ?')) return
    try { await api.vipDeletePlan(id); showFlash('✓ Plan supprimé'); refresh() }
    catch (e: any) { showFlash('✗ ' + e.message, false) }
  }

  const gift = async (playerName: string, planId: string) => {
    try { await api.vipGift(playerName, planId); showFlash(`✓ VIP offert à ${playerName}`); setGiftModal(null); refresh() }
    catch (e: any) { showFlash('✗ ' + e.message, false) }
  }

  const extend = async (subId: string, days: number) => {
    try { await api.vipExtend(subId, days); showFlash(`✓ Étendu de ${days} jours`); refresh() }
    catch (e: any) { showFlash('✗ ' + e.message, false) }
  }

  const revoke = async (subId: string) => {
    const reason = prompt('Raison de la révocation ?', 'Annulation manuelle')
    if (!reason) return
    try { await api.vipRevoke(subId, reason); showFlash('✓ Révoqué'); refresh() }
    catch (e: any) { showFlash('✗ ' + e.message, false) }
  }

  const filteredSubs = subs.filter(s =>
    (!statusFilter || s.status === statusFilter) &&
    (!search || s.playerName?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-6 space-y-6">
      {flash && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-2 rounded-lg font-medium"
             style={{ background: flash.ok ? '#10b981' : '#ef4444', color: 'white' }}>
          {flash.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>👑 VIP & Subscriptions</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Vente de rangs VIP avec paiement en ligne (Stripe + PayPal)
          </p>
        </div>
        {canEdit && (
          <a href="/buy" target="_blank"
             className="px-3 py-2 rounded text-sm"
             style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            🔗 Voir page d'achat publique
          </a>
        )}
      </div>

      {/* Banner gateways */}
      {gateways && (
        <div className="grid grid-cols-2 gap-3">
          <GatewayCard name="Stripe" icon="💳"
                       configured={gateways.stripe?.configured}
                       mode={gateways.stripe?.mode}
                       hint="https://dashboard.stripe.com/apikeys"/>
          <GatewayCard name="PayPal" icon="🅿️"
                       configured={gateways.paypal?.configured}
                       mode={gateways.paypal?.mode}
                       hint="https://developer.paypal.com/dashboard/applications"/>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
        {(['plans', 'subs', 'stats'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-2 text-sm font-medium transition"
                  style={{
                    color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
                    borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                  }}>
            {t === 'plans' && '📋 Plans'}
            {t === 'subs' && `👥 Subscriptions (${subs.length})`}
            {t === 'stats' && '📊 Stats'}
          </button>
        ))}
      </div>

      {/* ── Onglet PLANS ─────────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {isAdmin && (
              <button onClick={() => setEditing(blankPlan())}
                      className="px-4 py-2 rounded-lg text-white font-medium"
                      style={{ background: 'var(--primary)' }}>
                + Nouveau plan
              </button>
            )}
          </div>

          {plans.length === 0 ? (
            <div className="rounded-xl p-12 text-center"
                 style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
              <div className="text-6xl mb-3">👑</div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Aucun plan VIP</h2>
              <p className="max-w-md mx-auto mb-6" style={{ color: 'var(--text-muted)' }}>
                Crée ton premier plan (ex: VIP Bronze 30j à 4.99€) pour commencer à vendre des rangs.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.sort((a, b) => (a.order || 0) - (b.order || 0)).map(p => (
                <PlanCard key={p.id} plan={p}
                          onEdit={() => setEditing({ ...p })}
                          onDelete={() => delPlan(p.id)}
                          onGift={() => setGiftModal({ planId: p.id })}
                          isAdmin={isAdmin}
                          canEdit={canEdit}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet SUBSCRIPTIONS ─────────────────────────────────────────── */}
      {tab === 'subs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                      style={inputStyle} className="px-3 py-2 rounded text-sm">
                <option value="">Tous statuts</option>
                <option value="ACTIVE">✓ Actif</option>
                <option value="EXPIRED">⏱ Expiré</option>
                <option value="REFUNDED">↩ Refund</option>
                <option value="CANCELLED">✗ Annulé</option>
              </select>
              <input placeholder="🔍 Joueur..." value={search} onChange={e => setSearch(e.target.value)}
                     style={inputStyle} className="px-3 py-2 rounded text-sm"/>
            </div>
            {isAdmin && (
              <button onClick={() => setGiftModal({})}
                      className="px-3 py-2 rounded text-sm text-white"
                      style={{ background: 'var(--primary)' }}>
                🎁 Offrir un VIP
              </button>
            )}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--surface-2)' }}>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left px-3 py-2">Joueur</th>
                  <th className="text-left px-3 py-2">Plan</th>
                  <th className="text-left px-3 py-2">Statut</th>
                  <th className="text-left px-3 py-2">Gateway</th>
                  <th className="text-right px-3 py-2">Montant</th>
                  <th className="text-left px-3 py-2">Expire</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubs.map((s, i) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'var(--surface-2)' : 'transparent' }}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--text)' }}>{s.playerName}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{s.planName}</td>
                    <td className="px-3 py-2"><StatusBadge status={s.status}/></td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                      {s.gateway === 'STRIPE' && '💳 Stripe'}
                      {s.gateway === 'PAYPAL' && '🅿️ PayPal'}
                      {s.gateway === 'MANUAL_GIFT' && '🎁 Gift'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text)' }}>
                      {s.amountPaid > 0 ? `${s.amountPaid.toFixed(2)} ${s.currency}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(s.expiresAt).toLocaleDateString('fr-FR')}
                      {s.status === 'ACTIVE' && (
                        <div style={{ color: daysLeft(s.expiresAt) <= 3 ? '#ef4444' : 'var(--text-muted)' }}>
                          dans {daysLeft(s.expiresAt)}j
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isAdmin && s.status === 'ACTIVE' && (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => extend(s.id, 30)}
                                  title="Étendre de 30 jours"
                                  className="text-xs px-2 py-1 rounded hover:bg-white/10"
                                  style={{ color: 'var(--text-muted)' }}>+30j</button>
                          <button onClick={() => revoke(s.id)}
                                  title="Révoquer immédiatement"
                                  className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10">
                            Révoquer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredSubs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                      Aucune subscription
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Onglet STATS ─────────────────────────────────────────────────── */}
      {tab === 'stats' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="CA total (30j)" value={`${(stats.totalRevenue || 0).toFixed(2)} €`} color="#10b981"/>
            <Kpi label="Ventes (30j)" value={stats.totalSales || 0} color="#60a5fa"/>
            <Kpi label="MRR estimé" value={`${(stats.mrrEstimated || 0).toFixed(2)} €`} color="#a78bfa"/>
            <Kpi label="Churn rate" value={`${(stats.churnRate || 0).toFixed(1)}%`} color="#f97316"/>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Kpi label="Subs actifs" value={stats.activeSubscriptions || 0} color="#10b981"/>
            <Kpi label="Subs expirés (30j)" value={stats.expiredSubscriptions || 0} color="#ef4444"/>
          </div>

          {stats.dailyRevenue && stats.dailyRevenue.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>📈 CA par jour</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/>
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11}/>
                  <YAxis stroke="var(--text-muted)" fontSize={11}/>
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}/>
                  <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {stats.topPlans && stats.topPlans.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>🏆 Top plans</h3>
              <div className="space-y-2">
                {stats.topPlans.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded"
                       style={{ background: 'var(--surface-2)' }}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: i < 3 ? '#fbbf24' : 'var(--text-muted)' }}>#{i+1}</span>
                      <span style={{ color: 'var(--text)' }}>{p.planName}</span>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {p.count} ventes · <b style={{ color: '#10b981' }}>{(p.revenue || 0).toFixed(2)} €</b>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal édition plan ──────────────────────────────────────────── */}
      {editing && (
        <PlanEditor plan={editing} setPlan={setEditing}
                    onSave={savePlan} onClose={() => setEditing(null)}/>
      )}

      {/* ── Modal gift ──────────────────────────────────────────────────── */}
      {giftModal && (
        <GiftModal plans={plans} initialPlanId={giftModal.planId}
                   onConfirm={gift} onClose={() => setGiftModal(null)}/>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function GatewayCard({ name, icon, configured, mode, hint }: any) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3"
         style={{
           background: configured ? 'rgba(16,185,129,0.1)' : 'var(--surface)',
           border: `1px solid ${configured ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
         }}>
      <div className="text-3xl">{icon}</div>
      <div className="flex-1">
        <div className="font-bold" style={{ color: 'var(--text)' }}>{name}</div>
        {configured ? (
          <div className="text-xs" style={{ color: '#10b981' }}>
            ✓ Configuré ({mode === 'live' ? 'PROD' : 'TEST'})
          </div>
        ) : (
          <>
            <div className="text-xs" style={{ color: '#ef4444' }}>✗ Non configuré</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>config.yml → vip.{name.toLowerCase()}.*</div>
            <a href={hint} target="_blank" rel="noreferrer"
               className="text-xs underline" style={{ color: 'var(--primary)' }}>Obtenir les clés →</a>
          </>
        )}
      </div>
    </div>
  )
}

function PlanCard({ plan, onEdit, onDelete, onGift, isAdmin, canEdit }: any) {
  return (
    <div className="rounded-xl overflow-hidden relative"
         style={{ background: 'var(--surface)', border: `2px solid ${plan.color || 'var(--border)'}` }}>
      <div className="h-2" style={{ background: plan.color }}/>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="text-5xl">{plan.icon}</div>
          {!plan.enabled && (
            <span className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>Désactivé</span>
          )}
        </div>
        <div className="font-bold text-lg" style={{ color: 'var(--text)' }}>{plan.displayName}</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>/{plan.name}</div>

        <div className="my-3 flex items-baseline gap-1">
          <span className="text-3xl font-bold" style={{ color: plan.color }}>{plan.priceEur?.toFixed(2)}</span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>€ / {plan.durationDays}j</span>
        </div>

        {plan.description && (
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{plan.description}</p>
        )}

        <div className="space-y-1 mb-4">
          {(plan.perks || []).slice(0, 4).map((perk: string, i: number) => (
            <div key={i} className="text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <span style={{ color: '#10b981' }}>✓</span>
              <span>{perk}</span>
            </div>
          ))}
          {plan.perks?.length > 4 && (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              +{plan.perks.length - 4} autres avantages
            </div>
          )}
        </div>

        <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          🎖️ Rang LP : <code>{plan.rank || '—'}</code>
        </div>

        {(canEdit || isAdmin) && (
          <div className="flex gap-1">
            {isAdmin && (
              <button onClick={onGift}
                      className="flex-1 text-sm px-3 py-1.5 rounded"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                🎁 Offrir
              </button>
            )}
            {canEdit && (
              <button onClick={onEdit}
                      className="flex-1 text-sm px-3 py-1.5 rounded text-white"
                      style={{ background: 'var(--primary)' }}>
                ✏️ Éditer
              </button>
            )}
            {isAdmin && (
              <button onClick={onDelete}
                      className="text-sm px-3 py-1.5 rounded text-red-400 hover:bg-red-500/10">
                🗑
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PlanEditor({ plan, setPlan, onSave, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div className="w-[600px] h-full overflow-y-auto"
           style={{ background: 'var(--surface)' }}
           onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
             style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-xl font-bold flex items-center gap-3" style={{ color: 'var(--text)' }}>
            <span className="text-3xl">{plan.icon}</span>
            <span>{plan.id ? 'Modifier' : 'Nouveau'} plan</span>
          </h2>
          <div className="flex gap-2">
            <button onClick={onClose}
                    className="px-3 py-1.5 rounded text-sm"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Annuler</button>
            <button onClick={onSave}
                    className="px-4 py-1.5 rounded text-sm text-white font-medium"
                    style={{ background: '#10b981' }}>💾 Enregistrer</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom interne (slug)">
              <input value={plan.name}
                     onChange={e => setPlan({ ...plan, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                     style={inputStyle} className="w-full px-3 py-2 rounded"/>
            </Field>
            <Field label="Nom affiché">
              <input value={plan.displayName}
                     onChange={e => setPlan({ ...plan, displayName: e.target.value })}
                     style={inputStyle} className="w-full px-3 py-2 rounded"/>
            </Field>
          </div>

          <Field label="Description">
            <textarea value={plan.description || ''}
                      onChange={e => setPlan({ ...plan, description: e.target.value })}
                      rows={2} style={inputStyle} className="w-full px-3 py-2 rounded text-sm"/>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Prix (€)">
              <input type="number" min={0} step={0.01} value={plan.priceEur}
                     onChange={e => setPlan({ ...plan, priceEur: +e.target.value })}
                     style={inputStyle} className="w-full px-3 py-2 rounded"/>
            </Field>
            <Field label="Durée (jours)">
              <input type="number" min={1} value={plan.durationDays}
                     onChange={e => setPlan({ ...plan, durationDays: +e.target.value })}
                     style={inputStyle} className="w-full px-3 py-2 rounded"/>
            </Field>
            <Field label="Ordre d'affichage">
              <input type="number" value={plan.order || 0}
                     onChange={e => setPlan({ ...plan, order: +e.target.value })}
                     style={inputStyle} className="w-full px-3 py-2 rounded"/>
            </Field>
          </div>

          <Field label="Rang LuckPerms à donner" hint="Ex: vip-bronze, vip, premium">
            <input value={plan.rank || ''}
                   onChange={e => setPlan({ ...plan, rank: e.target.value })}
                   placeholder="vip"
                   style={inputStyle} className="w-full px-3 py-2 rounded font-mono"/>
          </Field>

          <Field label="Icône">
            <div className="flex flex-wrap gap-1">
              {ICONS.map(i => (
                <button key={i} onClick={() => setPlan({ ...plan, icon: i })}
                        className="w-10 h-10 rounded text-2xl"
                        style={{ background: plan.icon === i ? 'var(--primary)' : 'var(--surface-2)' }}>
                  {i}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Couleur">
            <div className="flex flex-wrap gap-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => setPlan({ ...plan, color: c })}
                        className="w-10 h-10 rounded"
                        style={{
                          background: c,
                          border: plan.color === c ? '3px solid white' : '2px solid transparent',
                        }}/>
              ))}
              <input type="color" value={plan.color}
                     onChange={e => setPlan({ ...plan, color: e.target.value })}
                     className="w-10 h-10 rounded cursor-pointer"/>
            </div>
          </Field>

          <Field label="Avantages (un par ligne — affichés sur la page d'achat)">
            <textarea value={(plan.perks || []).join('\n')}
                      onChange={e => setPlan({ ...plan, perks: e.target.value.split('\n').filter(Boolean) })}
                      rows={5} style={inputStyle} className="w-full px-3 py-2 rounded text-sm"
                      placeholder="/fly partout&#10;XP Boost x2&#10;Tag chat coloré"/>
          </Field>

          <Field label="Commandes à l'activation ({player})">
            <textarea value={(plan.commandsOnActivate || []).join('\n')}
                      onChange={e => setPlan({ ...plan, commandsOnActivate: e.target.value.split('\n').filter(Boolean) })}
                      rows={3} style={inputStyle} className="w-full px-3 py-2 rounded text-sm font-mono"
                      placeholder="say {player} est devenu VIP !&#10;eco give {player} 10000"/>
          </Field>

          <Field label="Commandes à l'expiration ({player})">
            <textarea value={(plan.commandsOnExpire || []).join('\n')}
                      onChange={e => setPlan({ ...plan, commandsOnExpire: e.target.value.split('\n').filter(Boolean) })}
                      rows={2} style={inputStyle} className="w-full px-3 py-2 rounded text-sm font-mono"/>
          </Field>

          <div className="flex items-center gap-3">
            <Toggle checked={plan.enabled} onChange={(v: boolean) => setPlan({ ...plan, enabled: v })}/>
            <span style={{ color: 'var(--text)' }}>
              {plan.enabled ? '🟢 Visible sur la page d\'achat publique' : '⏸ Caché'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function GiftModal({ plans, initialPlanId, onConfirm, onClose }: any) {
  const [playerName, setPlayerName] = useState('')
  const [planId, setPlanId] = useState(initialPlanId || (plans[0]?.id ?? ''))

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-[500px] rounded-xl p-6"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            🎁 Offrir un VIP
          </h3>
          <button onClick={onClose} className="text-2xl leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        <div className="space-y-4">
          <Field label="Nom du joueur">
            <input value={playerName} onChange={e => setPlayerName(e.target.value)}
                   placeholder="Notch"
                   style={inputStyle} className="w-full px-4 py-3 rounded text-lg"/>
          </Field>
          <Field label="Plan à offrir">
            <select value={planId} onChange={e => setPlanId(e.target.value)}
                    style={inputStyle} className="w-full px-3 py-2 rounded">
              {plans.map((p: any) => (
                <option key={p.id} value={p.id}>{p.icon} {p.displayName} — {p.priceEur}€ / {p.durationDays}j</option>
              ))}
            </select>
          </Field>
          <button onClick={() => onConfirm(playerName, planId)}
                  disabled={!playerName || !planId}
                  className="w-full py-3 rounded text-white font-medium"
                  style={{ background: 'var(--primary)', opacity: (!playerName || !planId) ? 0.5 : 1 }}>
            🎁 Offrir le VIP
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; bg: string; label: string }> = {
    ACTIVE:    { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: '✓ Actif' },
    EXPIRED:   { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: '⏱ Expiré' },
    REFUNDED:  { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: '↩ Refund' },
    CANCELLED: { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: '✗ Annulé' },
  }
  const c = configs[status] || configs.EXPIRED
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

function Kpi({ label, value, color }: any) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  )
}

function Field({ label, hint, children }: any) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>{label}</label>
      {children}
      {hint && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  )
}

function Toggle({ checked, onChange }: any) {
  return (
    <button onClick={() => onChange(!checked)}
            className="relative w-10 h-6 rounded-full transition shrink-0"
            style={{ background: checked ? 'var(--primary)' : 'var(--surface-2)' }}>
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
           style={{ left: checked ? '1.125rem' : '0.125rem' }}/>
    </button>
  )
}

function daysLeft(ts: number) {
  return Math.max(0, Math.ceil((ts - Date.now()) / 86400000))
}

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
} as const
