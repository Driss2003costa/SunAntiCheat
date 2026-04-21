import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useWebSocket } from '../hooks/useWebSocket'

function tpsColor(tps: number) {
  if (tps >= 18) return '#10b981'
  if (tps >= 15) return '#f59e0b'
  return '#ef4444'
}
function tpsLabel(tps: number) {
  if (tps >= 18) return 'Excellent'
  if (tps >= 15) return 'Acceptable'
  return 'Dégradé'
}
function ramPct(used: number, max: number) { return max ? Math.round((used / max) * 100) : 0 }
function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── Quick action shortcuts ────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Console',     icon: '⌨️', to: '/console',       color: '#7C3AED' },
  { label: 'Joueurs',     icon: '👥', to: '/players',       color: '#3B82F6' },
  { label: 'Annonces',    icon: '📢', to: '/announcements', color: '#F97316' },
  { label: 'Rangs',       icon: '🎖️', to: '/ranks',         color: '#EAB308' },
  { label: 'Lootboxes',   icon: '📦', to: '/crates',        color: '#F59E0B' },
  { label: 'Sanctions',   icon: '⚖️', to: '/sanctions',     color: '#EF4444' },
  { label: 'Plugins',     icon: '🧩', to: '/plugins',       color: '#06B6D4' },
  { label: 'Assistant IA',icon: '🤖', to: '/assistant',     color: '#EC4899' },
]

export default function Overview() {
  const [status, setStatus]   = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [worlds, setWorlds]   = useState<any[]>([])
  const [alerts, setAlerts]   = useState<any[]>([])
  const [panic, setPanic]     = useState<any>(null)
  const navigate = useNavigate()

  const load = () => {
    api.serverStatus().then(setStatus).catch(() => {})
    api.players().then(setPlayers).catch(() => {})
    api.worlds().then(setWorlds).catch(() => {})
    api.alerts(10).then(a => setAlerts(Array.isArray(a) ? a.slice(0, 8) : [])).catch(() => {})
    api.panicStatus().then(setPanic).catch(() => {})
  }

  useEffect(() => { load(); const i = setInterval(load, 8000); return () => clearInterval(i) }, [])
  useWebSocket(['stats'], (msg) => { if (msg.channel === 'stats') setStatus(msg.data) })

  const ram = status ? ramPct(status.ramUsedMb, status.ramMaxMb) : 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Panic banner ─────────────────────────────────────────────────── */}
      {panic?.active && (
        <div onClick={() => navigate('/panic')}
             className="cursor-pointer rounded-xl px-5 py-3 flex items-center justify-between animate-pulse"
             style={{ background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <div className="font-bold text-red-400">PANIC MODE ACTIF</div>
              <div className="text-xs text-red-400/80">Raison : {panic.reason} · Activé par {panic.activatedBy}</div>
            </div>
          </div>
          <span className="text-xs text-red-400 underline">Gérer →</span>
        </div>
      )}

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          icon="⚡" label="Performance (TPS)"
          value={status?.tps1m ?? '—'}
          sub={status ? tpsLabel(status.tps1m) : 'chargement...'}
          accent={status ? tpsColor(status.tps1m) : '#64748b'}
          bar={status ? (status.tps1m / 20) * 100 : 0}
        />
        <KpiCard
          icon="👥" label="Joueurs en ligne"
          value={`${status?.playersOnline ?? 0}`}
          sub={`/ ${status?.playersMax ?? 0} max`}
          accent="#3B82F6"
          bar={status ? (status.playersOnline / status.playersMax) * 100 : 0}
        />
        <KpiCard
          icon="🧠" label="Mémoire RAM"
          value={`${status?.ramUsedMb ?? '—'} MB`}
          sub={`/ ${status?.ramMaxMb ?? '—'} MB (${ram}%)`}
          accent={ram > 85 ? '#ef4444' : ram > 65 ? '#f59e0b' : '#10b981'}
          bar={ram}
        />
        <KpiCard
          icon="⏱️" label="Uptime"
          value={status ? formatUptime(status.uptimeMs) : '—'}
          sub={status?.version?.split('-')[0]?.replace('git-Paper-', 'Paper ') ?? ''}
          accent="#8B5CF6"
          bar={100}
        />
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Accès rapide
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {QUICK_ACTIONS.map(a => (
            <button key={a.to} onClick={() => navigate(a.to)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl text-center hover:scale-105 transition-transform"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                   style={{ background: a.color + '20' }}>
                {a.icon}
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-6">

        {/* ── Joueurs en ligne ──────────────────────────────────────────── */}
        <div className="col-span-2 space-y-4">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Joueurs en ligne ({players.length})
            </h2>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {players.length === 0 ? (
                <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  Aucun joueur connecté
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th className="px-4 py-3 text-left font-medium">Joueur</th>
                      <th className="px-4 py-3 text-left font-medium">Monde</th>
                      <th className="px-4 py-3 text-left font-medium">Ping</th>
                      <th className="px-4 py-3 text-left font-medium">HP</th>
                      <th className="px-4 py-3 text-left font-medium">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, i) => (
                      <tr key={p.uuid}
                          style={{ borderBottom: i < players.length - 1 ? '1px solid var(--border)' : 'none' }}
                          className="hover:bg-white/5 transition">
                        <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text)' }}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs text-white font-bold">
                              {p.name[0]}
                            </div>
                            {p.name}
                          </div>
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{p.world}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-mono ${p.ping > 200 ? 'text-red-400' : p.ping > 100 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {p.ping}ms
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                              <div className="h-1.5 rounded-full"
                                   style={{ width: `${Math.round((p.health / 20) * 100)}%`, background: p.health > 10 ? '#10b981' : p.health > 5 ? '#f59e0b' : '#ef4444' }}/>
                            </div>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{Math.round(p.health)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs px-2 py-0.5 rounded"
                                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                            {p.gameMode}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Mondes */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Mondes ({worlds.length})
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {worlds.map(w => (
                <div key={w.name} className="rounded-xl p-4"
                     style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      {w.environment === 'NETHER' ? '🔥' : w.environment === 'THE_END' ? '🌑' : '🌍'} {w.name}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>👥 {w.players}</span>
                    <span>📦 {w.loadedChunks}</span>
                    <span>⚔️ {w.pvp ? 'PvP ON' : 'PvP OFF'}</span>
                    <span>☀️ {w.difficulty}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Alertes récentes ──────────────────────────────────────────── */}
        <section className="flex flex-col">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Alertes récentes
          </h2>
          <div className="flex-1 rounded-xl overflow-hidden"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  ✅ Aucune alerte récente
                </div>
              ) : alerts.map((a, i) => (
                <div key={i} className="flex gap-2 p-2 rounded-lg"
                     style={{ background: 'var(--surface-2)' }}>
                  <div className="mt-0.5 shrink-0 w-2 h-2 rounded-full"
                       style={{ background: a.type?.includes('CHEAT') ? '#ef4444' : '#f59e0b' }}/>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                      {a.player}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {a.type}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                      {new Date(a.timestamp).toLocaleTimeString('fr-FR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 pb-3">
              <button onClick={() => navigate('/sanctions')}
                      className="w-full py-2 rounded-lg text-xs text-center transition hover:bg-white/5"
                      style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                Voir toutes les alertes →
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent, bar }: {
  icon: string; label: string; value: string | number; sub: string; accent: string; bar: number
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
             style={{ background: accent + '20' }}>{icon}</div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: accent }}>{value}</div>
        </div>
      </div>
      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>{label}</div>
      <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{sub}</div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-1 rounded-full transition-all duration-700"
             style={{ width: `${Math.min(100, Math.max(0, bar))}%`, background: accent }}/>
      </div>
    </div>
  )
}
